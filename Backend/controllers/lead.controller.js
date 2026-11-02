const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const { SOURCES, STATUSES } = require("../models/Lead");
const Service = require("../models/Service");
const FollowUp = require("../models/FollowUp");
const User = require("../models/User");
const { canEditLeadData, canDeleteLead, isAssigneeOnly, seesAllLeads, leadTeamIds, canSeeLead, canReassignLead } = require("../utils/leadAccess");

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

const readText = (value, max, label) => {
    const text = String(value || "").trim();
    if (text.length > max) fail(`${label} cannot be longer than ${max} characters`);
    return text;
};

const readServices = async (value) => {
    if (!Array.isArray(value) || value.length === 0) return [];
    const ids = [...new Set(value.map((id) => String(id || "").trim()).filter(Boolean))];
    if (!ids.length) return [];
    if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) fail("Invalid service selected");
    const found = await Service.countDocuments({ _id: { $in: ids } });
    if (found !== ids.length) fail("One or more services were not found");
    return ids;
};

const readAssignee = async (value, currentAssignee, allowedIds, { required = false } = {}) => {
    const id = String(value || "").trim();
    if (!id) {
        if (required) fail("Select who will handle this lead");
        return null;
    }
    if (!mongoose.Types.ObjectId.isValid(id)) fail("Select who will handle this lead");
    if (currentAssignee && String(currentAssignee) === id) return id;
    if (allowedIds && !allowedIds.some((item) => String(item) === id)) {
        fail("You can assign this lead only to yourself or someone on your team");
    }
    const user = await User.findOne({
        _id: id,
        status: "ACTIVE",
        userType: { $in: ["ADMIN", "EMPLOYEE"] },
    }).select("_id");
    if (!user) fail("Select an active team member");
    return user._id;
};

const readLead = async (body, { currentAssignee, allowedIds } = {}) => {
    const name = readText(body.name, 120, "Name");
    if (name.length < 2) fail("Name must be at least 2 characters");
    const phone = String(body.phone || "").trim();
    if (!/^[0-9]{10}$/.test(phone)) fail("Phone number must be 10 digits");
    if (!SOURCES.includes(body.source)) fail("Select a valid source");

    return {
        name,
        phone,
        companyName: readText(body.companyName, 120, "Company name"),
        address: readText(body.address, 300, "Address"),
        source: body.source,
        services: await readServices(body.services),
        remark: readText(body.remark, 2000, "Remark"),
        assignedTo: await readAssignee(body.assignedTo, currentAssignee, allowedIds, { required: false }),
    };
};

const presentLead = (id, services = "name description") => Lead.findById(id)
    .populate("services", services)
    .populate("createdBy", "name")
    .populate("assignedTo", "name")
    .populate("soldBy", "name")
    .populate("paymentBy", "name")
    .lean();

const allowedAssigneeIds = async (user) => (user.userType === "ADMIN" ? null : leadTeamIds(user));

const presentAccess = (lead, user) => ({ ...lead, canAssign: canReassignLead(lead, user) });

const createLead = async (req, res, next) => {
    try {
        const fields = await readLead(req.body, {
            allowedIds: await allowedAssigneeIds(req.user),
        });
        const lead = await Lead.create({
            ...fields,
            createdBy: req.user._id,
            status: "NEW",
            nextFollowUpAt: null,
            lostReason: "",
        });
        const { notify } = require("../utils/notify");
        await notify({
            type: "LEAD_NEW",
            title: `New lead: ${lead.name}`,
            body: lead.companyName ? `${lead.companyName} · ${lead.phone}` : lead.phone,
            href: `/dashboard/leads/${lead._id}`,
            actorId: req.user._id,
            extraUserIds: [fields.assignedTo].filter(Boolean),
        });
        const data = await presentLead(lead._id);
        res.status(201).json({ success: true, data: presentAccess(data, req.user) });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const buildLeadListFilter = async (user, query) => {
    const { search, status, source } = query;
    const filter = {};
    if (!seesAllLeads(user)) {
        const team = await leadTeamIds(user);
        filter.$or = [{ assignedTo: { $in: team } }, { createdBy: { $in: team } }];
    }
    if (status) {
        if (!STATUSES.includes(status)) fail("Invalid lead status");
        filter.status = status;
    }
    if (source) {
        if (!SOURCES.includes(source)) fail("Invalid source");
        filter.source = source;
    }
    if (search) {
        const regex = { $regex: escapeRegex(search), $options: "i" };
        const searchClause = { $or: [{ name: regex }, { phone: regex }, { companyName: regex }] };
        if (filter.$or) {
            filter.$and = [{ $or: filter.$or }, searchClause];
            delete filter.$or;
        } else {
            Object.assign(filter, searchClause);
        }
    }
    return filter;
};

const getLeads = async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);
        const filter = await buildLeadListFilter(req.user, req.query);

        const [total, leads] = await Promise.all([
            Lead.countDocuments(filter),
            Lead.find(filter)
                .populate("services", "name")
                .populate("createdBy", "name")
                .populate("assignedTo", "name")
                .skip(skip)
                .limit(limitNum)
                .sort({ createdAt: -1 })
                .lean(),
        ]);

        res.status(200).json({
            success: true,
            data: leads.map((lead) => presentAccess(lead, req.user)),
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum },
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const getLeadById = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid lead ID format" });
        }
        const lead = await presentLead(req.params.id);
        if (!(await canSeeLead(lead, req.user))) {
            return res.status(404).json({ success: false, message: "Lead not found" });
        }
        res.status(200).json({ success: true, data: presentAccess(lead, req.user) });
    } catch (error) {
        next(error);
    }
};

const updateLead = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid lead ID format" });
        }
        const lead = await Lead.findById(req.params.id);
        if (!(await canSeeLead(lead, req.user))) {
            return res.status(404).json({ success: false, message: "Lead not found" });
        }
        if (!canEditLeadData(req.user, lead)) {
            const message = isAssigneeOnly(req.user, lead)
                ? "This lead is assigned to you. Change the status from Follow-up, not Edit."
                : "You cannot edit this lead.";
            return res.status(403).json({ success: false, message });
        }

        const fields = await readLead(req.body, {
            currentAssignee: lead.assignedTo,
            allowedIds: await allowedAssigneeIds(req.user),
        });
        Object.assign(lead, fields);
        await lead.save();

        const data = await presentLead(lead._id);
        res.status(200).json({ success: true, data: presentAccess(data, req.user) });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const deleteLead = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid lead ID format" });
        }
        const lead = await Lead.findById(req.params.id);
        if (!(await canSeeLead(lead, req.user))) {
            return res.status(404).json({ success: false, message: "Lead not found" });
        }
        if (!canDeleteLead(req.user, lead)) {
            const message = isAssigneeOnly(req.user, lead)
                ? "This lead is assigned to you. You can add a follow-up, not delete it."
                : "You cannot delete this lead.";
            return res.status(403).json({ success: false, message });
        }
        await FollowUp.deleteMany({ lead: lead._id });
        await lead.deleteOne();
        res.status(200).json({ success: true, message: "Lead deleted successfully" });
    } catch (error) {
        next(error);
    }
};

const getLeadAssignees = async (req, res, next) => {
    try {
        const filter = { status: "ACTIVE", userType: { $in: ["ADMIN", "EMPLOYEE"] } };
        const directory = req.query.scope === "directory" && seesAllLeads(req.user);
        if (req.user.userType !== "ADMIN" && !directory) filter._id = { $in: await leadTeamIds(req.user) };
        const people = await User.find(filter)
            .select("name userType")
            .sort({ name: 1 })
            .limit(500)
            .lean();
        res.status(200).json({ success: true, data: people });
    } catch (error) {
        next(error);
    }
};

const assignLead = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid lead ID format" });
        }
        const lead = await Lead.findById(req.params.id);
        if (!(await canSeeLead(lead, req.user))) {
            return res.status(404).json({ success: false, message: "Lead not found" });
        }
        if (!canReassignLead(lead, req.user)) {
            return res.status(403).json({ success: false, message: "You cannot assign this lead" });
        }
        lead.assignedTo = await readAssignee(req.body.assignedTo, null, await allowedAssigneeIds(req.user), { required: true });
        await lead.save();
        const data = await presentLead(lead._id);
        res.status(200).json({ success: true, data: presentAccess(data, req.user) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

module.exports = {
    createLead,
    getLeads,
    getLeadById,
    updateLead,
    deleteLead,
    getLeadAssignees,
    assignLead,
    buildLeadListFilter,
};
