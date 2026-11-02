const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");
const { PRIORITIES, STATUSES } = require("../models/Ticket");
const TicketReply = require("../models/TicketReply");
const { uploadTicketFile, destroyCloudinaryFile } = require("../config/cloudinary");
const { downlineIds } = require("../utils/reporting");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePagination = (page, limit) => {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * limitNum;
    return { pageNum, limitNum, skip };
};

const fail = (message) => {
    const error = new Error(message);
    error.status = 400;
    throw error;
};

const cleanHtml = (value, label) => {
    const text = String(value || "")
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
        .replace(/\son\w+=("[^"]*"|'[^']*')/gi, "")
        .trim();
    const plain = text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    if (!plain) fail(`${label} is required`);
    if (text.length > 20000) fail(`${label} is too long`);
    return text;
};

const { permissionGranted } = require("../utils/permissions");
const isAdmin = (user) => user.userType === "ADMIN";
const seesAllTickets = (user) => isAdmin(user) || permissionGranted(user, ["VIEW_TICKETS", "MANAGE_TICKETS"]);

const teamIds = async (user) => {
    const downline = await downlineIds(user._id);
    return [user._id, ...downline];
};

const canSeeTicket = async (ticket, user) => {
    if (!ticket) return false;
    if (seesAllTickets(user)) return true;
    const allowed = await teamIds(user);
    const raiserId = String(ticket.raisedBy?._id || ticket.raisedBy);
    return allowed.some((id) => String(id) === raiserId);
};

const canChangeStatus = async (ticket, user) => {
    if (!ticket) return false;
    if (seesAllTickets(user) || permissionGranted(user, ["EDIT_TICKETS", "MANAGE_TICKETS"])) return true;
    const raiserId = String(ticket.raisedBy?._id || ticket.raisedBy);
    if (raiserId === String(user._id)) return false;
    const downline = await downlineIds(user._id);
    return downline.some((id) => String(id) === raiserId);
};

const presentFile = (file) => (file?.url ? { name: file.name, url: file.url } : null);

const presentTicket = (ticket, extra = {}) => ({
    ...ticket,
    file: presentFile(ticket.file),
    ...extra,
});

const saveFile = async (file) => {
    const result = await uploadTicketFile(file);
    const name = String(file.originalname || "file").split(/[/\\]/).pop().slice(0, 80);
    return {
        name: name || "file",
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: file.mimetype === "application/pdf" ? "raw" : "image",
        format: result.format || "",
    };
};

const createTicket = async (req, res, next) => {
    let stored = null;
    try {
        const subject = String(req.body.subject || "").trim();
        if (subject.length < 2) fail("Subject must be at least 2 characters");
        if (subject.length > 160) fail("Subject cannot be longer than 160 characters");
        const priority = req.body.priority || "MEDIUM";
        if (!PRIORITIES.includes(priority)) fail("Select a valid priority");
        const content = cleanHtml(req.body.content, "Content");
        if (req.file) stored = await saveFile(req.file);

        const ticket = await Ticket.create({
            subject,
            content,
            priority,
            status: "OPEN",
            file: stored,
            raisedBy: req.user._id,
        });
        const { notify } = require("../utils/notify");
        await notify({
            type: "TICKET_NEW",
            title: `Help ticket: ${subject}`,
            body: `${req.user.name || "Someone"} · ${priority}`,
            href: `/dashboard/help/${ticket._id}`,
            actorId: req.user._id,
        });
        const data = await Ticket.findById(ticket._id).populate("raisedBy", "name").lean();
        res.status(201).json({
            success: true,
            data: presentTicket(data, {
                canReply: true,
                canChangeStatus: false,
                canDelete: permissionGranted(req.user, ["DELETE_TICKETS", "MANAGE_TICKETS"]),
            }),
        });
    } catch (error) {
        if (stored?.publicId) await destroyCloudinaryFile(stored.publicId, stored.resourceType);
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const getTickets = async (req, res, next) => {
    try {
        const { search, status, priority, page = 1, limit = 10 } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);
        const filter = {};

        if (!seesAllTickets(req.user)) filter.raisedBy = { $in: await teamIds(req.user) };
        if (status) {
            if (!STATUSES.includes(status)) return res.status(400).json({ success: false, message: "Invalid ticket status" });
            filter.status = status;
        }
        if (priority) {
            if (!PRIORITIES.includes(priority)) return res.status(400).json({ success: false, message: "Invalid priority" });
            filter.priority = priority;
        }
        if (search) filter.subject = { $regex: escapeRegex(search), $options: "i" };

        const [total, rows] = await Promise.all([
            Ticket.countDocuments(filter),
            Ticket.find(filter).populate("raisedBy", "name").sort({ updatedAt: -1 }).skip(skip).limit(limitNum).lean(),
        ]);

        res.status(200).json({
            success: true,
            data: rows.map((row) => presentTicket(row)),
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum },
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const loadVisible = async (id, user) => {
    if (!mongoose.Types.ObjectId.isValid(id)) fail("Invalid ticket ID format");
    const ticket = await Ticket.findById(id).populate("raisedBy", "name");
    if (!ticket || !(await canSeeTicket(ticket, user))) {
        const error = new Error("Ticket not found");
        error.status = 404;
        throw error;
    }
    return ticket;
};

const getTicketById = async (req, res, next) => {
    try {
        const ticket = await loadVisible(req.params.id, req.user);
        const replies = await TicketReply.find({ ticket: ticket._id }).populate("author", "name").sort({ createdAt: 1 }).lean();
        const data = presentTicket(ticket.toObject(), {
            replies: replies.map((reply) => ({
                _id: reply._id,
                message: reply.message,
                author: reply.author,
                createdAt: reply.createdAt,
            })),
            canReply: true,
            canChangeStatus: await canChangeStatus(ticket, req.user),
            canDelete: permissionGranted(req.user, ["DELETE_TICKETS", "MANAGE_TICKETS"]),
        });
        res.status(200).json({ success: true, data });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const replyToTicket = async (req, res, next) => {
    try {
        const ticket = await loadVisible(req.params.id, req.user);
        const message = cleanHtml(req.body.message, "Reply");
        const reply = await TicketReply.create({ ticket: ticket._id, message, author: req.user._id });
        await Ticket.updateOne({ _id: ticket._id }, { $currentDate: { updatedAt: true } });
        const data = await TicketReply.findById(reply._id).populate("author", "name").lean();
        res.status(201).json({
            success: true,
            data: { _id: data._id, message: data.message, author: data.author, createdAt: data.createdAt },
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const updateTicketStatus = async (req, res, next) => {
    try {
        const ticket = await loadVisible(req.params.id, req.user);
        if (!(await canChangeStatus(ticket, req.user))) {
            return res.status(403).json({ success: false, message: "Only the reporting manager or an admin can change the status" });
        }
        const status = String(req.body.status || "");
        if (!STATUSES.includes(status)) fail("Select a valid ticket status");
        ticket.status = status;
        await ticket.save();
        const data = await Ticket.findById(ticket._id).populate("raisedBy", "name").lean();
        res.status(200).json({
            success: true,
            data: presentTicket(data, {
                canChangeStatus: true,
                canDelete: permissionGranted(req.user, ["DELETE_TICKETS", "MANAGE_TICKETS"]),
                canReply: true,
            }),
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const deleteTicket = async (req, res, next) => {
    try {
        if (!permissionGranted(req.user, ["DELETE_TICKETS", "MANAGE_TICKETS"])) {
            return res.status(403).json({ success: false, message: "You do not have permission to delete tickets" });
        }
        const ticket = await loadVisible(req.params.id, req.user);
        if (ticket.file?.publicId) await destroyCloudinaryFile(ticket.file.publicId, ticket.file.resourceType);
        await TicketReply.deleteMany({ ticket: ticket._id });
        await ticket.deleteOne();
        res.status(200).json({ success: true, message: "Ticket deleted" });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

module.exports = {
    createTicket,
    getTickets,
    getTicketById,
    replyToTicket,
    updateTicketStatus,
    deleteTicket,
};
