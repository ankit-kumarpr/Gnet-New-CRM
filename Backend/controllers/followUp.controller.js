const mongoose = require("mongoose");
const FollowUp = require("../models/FollowUp");
const { TYPES } = require("../models/FollowUp");
const Lead = require("../models/Lead");
const { STATUSES } = require("../models/Lead");
const { canFollowLead, canSeeLead, seesAllLeads, leadTeamIds } = require("../utils/leadAccess");

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

const readDate = (value, label) => {
    if (value === undefined || value === null || String(value).trim() === "") return null;
    const text = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) fail(`${label} must be a valid date`);
    const date = new Date(`${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) fail(`${label} must be a valid date`);
    return date;
};

const dayRange = () => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startTomorrow = new Date(startToday);
    startTomorrow.setDate(startTomorrow.getDate() + 1);
    const startDayAfter = new Date(startTomorrow);
    startDayAfter.setDate(startDayAfter.getDate() + 1);
    return { startToday, startTomorrow, startDayAfter };
};

const readAmount = (value) => {
    const text = String(value ?? "").trim();
    if (!text) fail("Revenue amount is required");
    if (!/^\d+(\.\d{1,2})?$/.test(text)) fail("Revenue amount must be a valid amount");
    const amount = Number(text);
    if (!Number.isFinite(amount) || amount < 0 || amount > 999999999.99) fail("Revenue amount must be a valid amount");
    return Math.round(amount * 100) / 100;
};

const readFollowUp = (body) => {
    if (!TYPES.includes(body.type)) fail("Select a follow-up type");
    const remark = readText(body.remark, 2000, "Remark");
    if (remark.length < 2) fail("Write what happened in this follow-up");
    const status = body.status || "NEW";
    if (!STATUSES.includes(status)) fail("Select a valid lead status");
    const lostReason = readText(body.lostReason, 500, "Lost reason");
    if (status === "LOST" && lostReason.length < 2) fail("Add a reason when the lead is lost");
    return {
        type: body.type,
        remark,
        status,
        lostReason: status === "LOST" ? lostReason : "",
        nextFollowUpAt: ["LOST", "CONVERTED", "PAYMENT"].includes(status) ? null : readDate(body.nextFollowUpAt, "Next follow-up"),
        amount: status === "PAYMENT" ? readAmount(body.amount) : 0,
    };
};

const createFollowUp = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid lead ID format" });
        }
        const lead = await Lead.findById(req.params.id);
        if (!(await canSeeLead(lead, req.user))) {
            return res.status(404).json({ success: false, message: "Lead not found" });
        }
        if (!canFollowLead(req.user, lead)) {
            return res.status(403).json({ success: false, message: "You cannot add a follow-up on this lead." });
        }

        const fields = readFollowUp(req.body);
        if (fields.status === "PAYMENT" && !["CONVERTED", "PAYMENT"].includes(lead.status)) {
            return res.status(400).json({ success: false, message: "Mark the lead converted before payment" });
        }
        const note = await FollowUp.create({
            ...fields,
            lead: lead._id,
            createdBy: req.user._id,
        });

        try {
            lead.status = fields.status;
            lead.nextFollowUpAt = fields.nextFollowUpAt;
            lead.lostReason = fields.lostReason;
            if (fields.status === "CONVERTED" || fields.status === "PAYMENT") {
                if (!lead.soldBy) {
                    lead.soldBy = req.user._id;
                    lead.convertedAt = new Date();
                }
            } else {
                lead.soldBy = null;
                lead.convertedAt = null;
            }
            if (fields.status === "PAYMENT") {
                if (!lead.paymentAt) {
                    lead.paymentBy = req.user._id;
                    lead.paymentAt = new Date();
                }
                lead.amount = fields.amount;
            } else {
                lead.paymentBy = null;
                lead.paymentAt = null;
                lead.amount = 0;
            }
            await lead.save();
        } catch (error) {
            await note.deleteOne();
            throw error;
        }

        const { notify } = require("../utils/notify");
        const when = fields.nextFollowUpAt
            ? `Next follow-up set · ${lead.name}`
            : `Follow-up logged · ${lead.name}`;
        await notify({
            type: "FOLLOW_UP",
            title: when,
            body: fields.remark?.slice(0, 120) || fields.status,
            href: `/dashboard/leads/${lead._id}`,
            actorId: req.user._id,
            extraUserIds: [lead.assignedTo].filter(Boolean),
        });

        const data = await FollowUp.findById(note._id).populate("createdBy", "name").lean();
        res.status(201).json({ success: true, data });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const getLeadFollowUps = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid lead ID format" });
        }
        const lead = await Lead.findById(req.params.id).select("assignedTo createdBy");
        if (!(await canSeeLead(lead, req.user))) {
            return res.status(404).json({ success: false, message: "Lead not found" });
        }
        const notes = await FollowUp.find({ lead: req.params.id })
            .populate("createdBy", "name")
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();
        res.status(200).json({ success: true, data: notes });
    } catch (error) {
        next(error);
    }
};

const getDueFollowUps = async (req, res, next) => {
    try {
        const range = req.query.range || "today";
        const ranges = ["overdue", "today", "tomorrow", "upcoming"];
        if (!ranges.includes(range)) {
            return res.status(400).json({ success: false, message: "Invalid follow-up range" });
        }
        const scope = req.query.scope === "mine" ? "mine" : "all";
        const { startToday, startTomorrow, startDayAfter } = dayRange();

        const base = { status: { $nin: ["LOST", "CONVERTED", "PAYMENT"] }, nextFollowUpAt: { $ne: null } };
        if (!seesAllLeads(req.user)) {
            const team = await leadTeamIds(req.user);
            base.$or = [{ assignedTo: { $in: team } }, { createdBy: { $in: team } }];
        }
        if (scope === "mine") base.assignedTo = req.user._id;

        const windows = {
            overdue: { $lt: startToday },
            today: { $gte: startToday, $lt: startTomorrow },
            tomorrow: { $gte: startTomorrow, $lt: startDayAfter },
            upcoming: { $gte: startDayAfter },
        };

        const [overdue, today, tomorrow, upcoming, leads] = await Promise.all([
            Lead.countDocuments({ ...base, nextFollowUpAt: windows.overdue }),
            Lead.countDocuments({ ...base, nextFollowUpAt: windows.today }),
            Lead.countDocuments({ ...base, nextFollowUpAt: windows.tomorrow }),
            Lead.countDocuments({ ...base, nextFollowUpAt: windows.upcoming }),
            Lead.find({ ...base, nextFollowUpAt: windows[range] })
                .select("name phone companyName status source nextFollowUpAt assignedTo")
                .populate("assignedTo", "name")
                .sort({ nextFollowUpAt: 1 })
                .limit(200)
                .lean(),
        ]);

        res.status(200).json({
            success: true,
            data: leads,
            counts: { overdue, today, tomorrow, upcoming },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createFollowUp,
    getLeadFollowUps,
    getDueFollowUps,
};
