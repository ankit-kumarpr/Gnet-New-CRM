const mongoose = require("mongoose");
const MeetRequest = require("../models/MeetRequest");
const Client = require("../models/Client");
const User = require("../models/User");
const { notify } = require("../utils/notify");

const fail = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    throw error;
};

const isAdmin = (user) => user?.userType === "ADMIN";
const isClientAuth = (req) => req.authKind === "CLIENT" || req.user?.userType === "CLIENT";
const idOf = (value) => String(value?._id || value || "");

const parsePagination = (page, limit) => {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
};

const readAgenda = (value) => {
    const text = String(value || "").trim();
    if (text.length < 5) fail("Agenda must be at least 5 characters");
    if (text.length > 2000) fail("Agenda is too long");
    return text;
};

const readSchedule = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) fail("Enter a valid meeting date & time");
    return date;
};

const readMeetLink = (value, { required = false } = {}) => {
    const url = String(value || "").trim();
    if (!url) {
        if (required) fail("Google Meet link is required");
        return "";
    }
    if (!/^https:\/\//i.test(url)) fail("Meeting link must start with https://");
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        const okHost = host === "meet.google.com"
            || host.endsWith(".meet.google.com")
            || (host.endsWith("google.com") && parsed.pathname.toLowerCase().includes("meet"));
        if (!okHost) fail("Use a Google Meet link (https://meet.google.com/...)");
    } catch {
        fail("Enter a valid Google Meet URL");
    }
    if (url.length > 500) fail("Meeting link is too long");
    return url;
};

const readEmployeeIds = async (value) => {
    if (value === undefined || value === null || value === "") return [];
    let list = value;
    if (typeof value === "string") {
        try {
            list = JSON.parse(value);
        } catch {
            list = String(value).split(",").map((item) => item.trim()).filter(Boolean);
        }
    }
    if (!Array.isArray(list)) fail("Employees must be a list");
    const ids = [...new Set(list.map((id) => String(id || "").trim()).filter(Boolean))];
    if (!ids.length) return [];
    if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) fail("Invalid employee selected");
    const found = await User.countDocuments({
        _id: { $in: ids },
        userType: { $in: ["ADMIN", "EMPLOYEE"] },
        status: "ACTIVE",
    });
    if (found !== ids.length) fail("One or more employees were not found");
    return ids;
};

const withPeople = (query) => query
    .populate("client", "name clientId email phone reportingManager")
    .populate("reportingManager", "name")
    .populate("employees", "name employeeId")
    .populate("createdByUser", "name")
    .populate("approvedBy", "name")
    .populate("rejectedBy", "name");

const present = (row, req) => {
    const clientSide = isClientAuth(req);
    const uid = String(req.user?._id || "");
    const isRm = idOf(row.reportingManager) === uid;
    const isCreatorStaff = idOf(row.createdByUser) === uid;
    const isInvitee = (row.employees || []).some((person) => idOf(person) === uid);
    const canApprove = !clientSide && row.status === "PENDING" && (isAdmin(req.user) || isRm);
    const canManage = !clientSide && (isAdmin(req.user) || isRm || isCreatorStaff);
    return {
        _id: row._id,
        client: row.client && row.client._id
            ? { _id: row.client._id, name: row.client.name, clientId: row.client.clientId, email: row.client.email }
            : row.client,
        scheduledAt: row.scheduledAt,
        agenda: row.agenda,
        meetLink: (clientSide ? row.status === "APPROVED" : true) ? (row.meetLink || "") : "",
        status: row.status,
        origin: row.origin,
        reportingManager: row.reportingManager && row.reportingManager._id
            ? { _id: row.reportingManager._id, name: row.reportingManager.name }
            : row.reportingManager,
        employees: (row.employees || []).map((person) => (
            person && person._id ? { _id: person._id, name: person.name, employeeId: person.employeeId } : person
        )),
        createdByUser: row.createdByUser && row.createdByUser._id
            ? { _id: row.createdByUser._id, name: row.createdByUser.name }
            : row.createdByUser,
        approvedBy: row.approvedBy && row.approvedBy._id
            ? { _id: row.approvedBy._id, name: row.approvedBy.name }
            : row.approvedBy,
        approvedAt: row.approvedAt,
        rejectedBy: row.rejectedBy && row.rejectedBy._id
            ? { _id: row.rejectedBy._id, name: row.rejectedBy.name }
            : row.rejectedBy,
        rejectedAt: row.rejectedAt,
        rejectReason: row.rejectReason || "",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        canApprove,
        canReject: canApprove,
        canCancel: clientSide
            ? row.status === "PENDING" && idOf(row.client) === uid
            : canManage && ["PENDING", "APPROVED"].includes(row.status),
        isInvitee: clientSide ? false : isInvitee,
    };
};

const listStaffMeetings = async (req, res, next) => {
    try {
        if (isClientAuth(req)) return res.status(403).json({ success: false, message: "Staff only" });
        const { page = 1, limit = 20, status, clientId } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);
        const filter = {};
        if (status) filter.status = String(status).toUpperCase();
        if (clientId && mongoose.Types.ObjectId.isValid(clientId)) filter.client = clientId;

        if (!isAdmin(req.user)) {
            filter.$or = [
                { reportingManager: req.user._id },
                { employees: req.user._id },
                { createdByUser: req.user._id },
            ];
        }

        const [total, rows] = await Promise.all([
            MeetRequest.countDocuments(filter),
            withPeople(MeetRequest.find(filter)).sort({ scheduledAt: -1 }).skip(skip).limit(limitNum).lean(),
        ]);

        res.status(200).json({
            success: true,
            data: rows.map((row) => present(row, req)),
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum },
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const listClientMeetings = async (req, res, next) => {
    try {
        if (!isClientAuth(req)) return res.status(403).json({ success: false, message: "Clients only" });
        const { page = 1, limit = 20, status } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);
        const filter = { client: req.user._id };
        if (status) filter.status = String(status).toUpperCase();

        const [total, rows] = await Promise.all([
            MeetRequest.countDocuments(filter),
            withPeople(MeetRequest.find(filter)).sort({ scheduledAt: -1 }).skip(skip).limit(limitNum).lean(),
        ]);

        res.status(200).json({
            success: true,
            data: rows.map((row) => present(row, req)),
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum },
        });
    } catch (error) {
        next(error);
    }
};

const getMeeting = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid meeting id" });
        }
        const row = await withPeople(MeetRequest.findById(req.params.id)).lean();
        if (!row) return res.status(404).json({ success: false, message: "Meeting not found" });

        if (isClientAuth(req)) {
            if (idOf(row.client) !== String(req.user._id)) {
                return res.status(404).json({ success: false, message: "Meeting not found" });
            }
        } else if (!isAdmin(req.user)) {
            const uid = String(req.user._id);
            const allowed = idOf(row.reportingManager) === uid
                || idOf(row.createdByUser) === uid
                || (row.employees || []).some((person) => idOf(person) === uid);
            if (!allowed) return res.status(403).json({ success: false, message: "Not allowed" });
        }

        res.status(200).json({ success: true, data: present(row, req) });
    } catch (error) {
        next(error);
    }
};

const createClientMeetRequest = async (req, res, next) => {
    try {
        if (!isClientAuth(req)) return res.status(403).json({ success: false, message: "Clients only" });
        const client = await Client.findById(req.user._id).select("name reportingManager").lean();
        if (!client) return res.status(404).json({ success: false, message: "Client not found" });

        const scheduledAt = readSchedule(req.body.scheduledAt);
        const agenda = readAgenda(req.body.agenda);

        const row = await MeetRequest.create({
            client: client._id,
            scheduledAt,
            agenda,
            status: "PENDING",
            origin: "CLIENT",
            createdByClient: client._id,
            reportingManager: client.reportingManager || null,
            employees: [],
            meetLink: "",
        });

        await notify({
            type: "MEET_REQUEST",
            title: `Meet request: ${client.name}`,
            body: agenda.slice(0, 120),
            href: `/dashboard/meetings`,
            extraUserIds: client.reportingManager ? [client.reportingManager] : [],
        });

        const data = await withPeople(MeetRequest.findById(row._id)).lean();
        res.status(201).json({ success: true, message: "Meet request sent for approval", data: present(data, req) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const createStaffMeeting = async (req, res, next) => {
    try {
        if (isClientAuth(req)) return res.status(403).json({ success: false, message: "Staff only" });
        const clientId = String(req.body.clientId || "").trim();
        if (!mongoose.Types.ObjectId.isValid(clientId)) fail("Select a client");
        const client = await Client.findById(clientId).select("name reportingManager").lean();
        if (!client) fail("Client not found", 404);

        if (!isAdmin(req.user) && idOf(client.reportingManager) !== String(req.user._id)) {
            // allow any employee? user said admin/RM - restrict to admin or client's RM
            return res.status(403).json({ success: false, message: "Only admin or this client's reporting manager can schedule" });
        }

        const scheduledAt = readSchedule(req.body.scheduledAt);
        const agenda = readAgenda(req.body.agenda);
        const meetLink = readMeetLink(req.body.meetLink, { required: true });
        const employees = await readEmployeeIds(req.body.employees);

        const row = await MeetRequest.create({
            client: client._id,
            scheduledAt,
            agenda,
            meetLink,
            status: "APPROVED",
            origin: "STAFF",
            createdByUser: req.user._id,
            reportingManager: client.reportingManager || req.user._id,
            employees,
            approvedBy: req.user._id,
            approvedAt: new Date(),
        });

        await notify({
            type: "MEET_REQUEST",
            title: `Meeting scheduled: ${client.name}`,
            body: agenda.slice(0, 120),
            href: `/dashboard/meetings`,
            actorId: req.user._id,
            extraUserIds: [...employees, client.reportingManager].filter(Boolean),
        });

        const data = await withPeople(MeetRequest.findById(row._id)).lean();
        res.status(201).json({
            success: true,
            message: "Meeting created — client (and selected employees) can join",
            data: present(data, req),
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const approveMeeting = async (req, res, next) => {
    try {
        if (isClientAuth(req)) return res.status(403).json({ success: false, message: "Staff only" });
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid meeting id" });
        }
        const row = await MeetRequest.findById(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: "Meeting not found" });
        if (row.status !== "PENDING") fail("Only pending requests can be approved");

        if (!isAdmin(req.user) && idOf(row.reportingManager) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: "Only RM or admin can approve" });
        }

        const meetLink = readMeetLink(req.body.meetLink, { required: true });
        const employees = await readEmployeeIds(req.body.employees);

        row.meetLink = meetLink;
        row.employees = employees;
        row.status = "APPROVED";
        row.approvedBy = req.user._id;
        row.approvedAt = new Date();
        row.rejectedBy = null;
        row.rejectedAt = null;
        row.rejectReason = "";
        await row.save();

        const client = await Client.findById(row.client).select("name").lean();
        await notify({
            type: "MEET_REQUEST",
            title: `Meet approved: ${client?.name || "Client"}`,
            body: "Google Meet link is ready",
            href: `/dashboard/meetings`,
            actorId: req.user._id,
            extraUserIds: employees,
        });

        const data = await withPeople(MeetRequest.findById(row._id)).lean();
        res.status(200).json({ success: true, message: "Approved — client can open the Meet link", data: present(data, req) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const rejectMeeting = async (req, res, next) => {
    try {
        if (isClientAuth(req)) return res.status(403).json({ success: false, message: "Staff only" });
        const row = await MeetRequest.findById(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: "Meeting not found" });
        if (row.status !== "PENDING") fail("Only pending requests can be rejected");
        if (!isAdmin(req.user) && idOf(row.reportingManager) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: "Only RM or admin can reject" });
        }
        row.status = "REJECTED";
        row.rejectedBy = req.user._id;
        row.rejectedAt = new Date();
        row.rejectReason = String(req.body?.reason || "").trim().slice(0, 500);
        await row.save();
        const data = await withPeople(MeetRequest.findById(row._id)).lean();
        res.status(200).json({ success: true, message: "Meet request rejected", data: present(data, req) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const cancelMeeting = async (req, res, next) => {
    try {
        const row = await MeetRequest.findById(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: "Meeting not found" });

        if (isClientAuth(req)) {
            if (idOf(row.client) !== String(req.user._id) || row.status !== "PENDING") {
                return res.status(403).json({ success: false, message: "You can only cancel your pending requests" });
            }
        } else {
            if (!isAdmin(req.user)
                && idOf(row.reportingManager) !== String(req.user._id)
                && idOf(row.createdByUser) !== String(req.user._id)) {
                return res.status(403).json({ success: false, message: "Not allowed" });
            }
            if (!["PENDING", "APPROVED"].includes(row.status)) fail("This meeting cannot be cancelled");
        }

        row.status = "CANCELLED";
        await row.save();
        const data = await withPeople(MeetRequest.findById(row._id)).lean();
        res.status(200).json({ success: true, message: "Meeting cancelled", data: present(data, req) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

module.exports = {
    listStaffMeetings,
    listClientMeetings,
    getMeeting,
    createClientMeetRequest,
    createStaffMeeting,
    approveMeeting,
    rejectMeeting,
    cancelMeeting,
};
