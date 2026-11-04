const mongoose = require("mongoose");
const EmailTemplate = require("../models/EmailTemplate");
const Client = require("../models/Client");
const { sendClientMail } = require("../utils/mailer");
const { permissionGranted } = require("../utils/permissions");

const fail = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    throw error;
};

const canView = (user) =>
    user?.userType === "ADMIN"
    || permissionGranted(user, ["VIEW_EMAIL_TEMPLATES", "MANAGE_EMAIL_TEMPLATES", "SEND_CLIENT_MAILS"]);

const canCreate = (user) =>
    user?.userType === "ADMIN"
    || permissionGranted(user, ["CREATE_EMAIL_TEMPLATES", "MANAGE_EMAIL_TEMPLATES"]);

const canEdit = (user) =>
    user?.userType === "ADMIN"
    || permissionGranted(user, ["EDIT_EMAIL_TEMPLATES", "MANAGE_EMAIL_TEMPLATES"]);

const canDelete = (user) =>
    user?.userType === "ADMIN"
    || permissionGranted(user, ["DELETE_EMAIL_TEMPLATES", "MANAGE_EMAIL_TEMPLATES"]);

const canSend = (user) =>
    user?.userType === "ADMIN"
    || permissionGranted(user, ["SEND_CLIENT_MAILS", "MANAGE_EMAIL_TEMPLATES"]);

const escapeRegex = (str) => String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readTemplateFields = (body) => {
    const name = String(body.name || "").trim();
    const subject = String(body.subject || "").trim();
    const bodyHtml = String(body.body || "").trim();
    if (name.length < 2) fail("Template name must be at least 2 characters");
    if (name.length > 120) fail("Template name is too long");
    if (!subject) fail("Subject is required");
    if (subject.length > 200) fail("Subject is too long");
    if (!bodyHtml) fail("Mail body is required");
    if (bodyHtml.length > 50000) fail("Mail body is too long");
    return { name, subject, body: bodyHtml };
};

const applyTokens = (value, client = {}) =>
    String(value || "")
        .replace(/\{\{\s*name\s*\}\}/gi, client.name || "")
        .replace(/\{\{\s*email\s*\}\}/gi, client.email || "")
        .replace(/\{\{\s*clientId\s*\}\}/gi, client.clientId || "")
        .replace(/\{\{\s*phone\s*\}\}/gi, client.phone || "");

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const parseExtraEmails = (raw) => {
    let list = [];
    if (Array.isArray(raw)) list = raw;
    else if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (!trimmed) return [];
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) list = parsed;
            else list = trimmed.split(/[,;\n]+/);
        } catch {
            list = trimmed.split(/[,;\n]+/);
        }
    }
    return [...new Set(list.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean))];
};

const parseClientIds = (raw) => {
    let list = [];
    if (Array.isArray(raw)) list = raw;
    else if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (!trimmed) return [];
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) list = parsed;
            else list = trimmed.split(/[,;\s]+/);
        } catch {
            list = trimmed.split(/[,;\s]+/);
        }
    }
    return [...new Set(list.map((id) => String(id || "").trim()).filter((id) => mongoose.Types.ObjectId.isValid(id)))];
};

const listEmailTemplates = async (req, res, next) => {
    try {
        if (!canView(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot view email templates" });
        }
        const search = String(req.query.search || "").trim();
        const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const filter = {};
        if (search) {
            const regex = { $regex: escapeRegex(search), $options: "i" };
            filter.$or = [{ name: regex }, { subject: regex }];
        }
        const [total, data] = await Promise.all([
            EmailTemplate.countDocuments(filter),
            EmailTemplate.find(filter)
                .sort({ updatedAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
        ]);
        res.status(200).json({
            success: true,
            data,
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum },
        });
    } catch (error) {
        next(error);
    }
};

const getEmailTemplateById = async (req, res, next) => {
    try {
        if (!canView(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot view email templates" });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid template id" });
        }
        const data = await EmailTemplate.findById(req.params.id).lean();
        if (!data) return res.status(404).json({ success: false, message: "Template not found" });
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const createEmailTemplate = async (req, res, next) => {
    try {
        if (!canCreate(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot create email templates" });
        }
        const fields = readTemplateFields(req.body);
        const data = await EmailTemplate.create({
            ...fields,
            createdBy: req.user._id,
            updatedBy: req.user._id,
        });
        res.status(201).json({ success: true, data, message: "Template created" });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const updateEmailTemplate = async (req, res, next) => {
    try {
        if (!canEdit(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot edit email templates" });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid template id" });
        }
        const fields = readTemplateFields(req.body);
        const data = await EmailTemplate.findByIdAndUpdate(
            req.params.id,
            { ...fields, updatedBy: req.user._id },
            { new: true },
        ).lean();
        if (!data) return res.status(404).json({ success: false, message: "Template not found" });
        res.status(200).json({ success: true, data, message: "Template updated" });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const deleteEmailTemplate = async (req, res, next) => {
    try {
        if (!canDelete(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot delete email templates" });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid template id" });
        }
        const data = await EmailTemplate.findByIdAndDelete(req.params.id).lean();
        if (!data) return res.status(404).json({ success: false, message: "Template not found" });
        res.status(200).json({ success: true, message: "Template deleted" });
    } catch (error) {
        next(error);
    }
};

const listMailRecipients = async (req, res, next) => {
    try {
        if (!canSend(req.user) && !canView(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot load clients for mail" });
        }
        const search = String(req.query.search || "").trim();
        const filter = { email: { $exists: true, $nin: [null, ""] } };
        if (search) {
            const regex = { $regex: escapeRegex(search), $options: "i" };
            filter.$or = [{ name: regex }, { email: regex }, { phone: regex }, { clientId: regex }];
        }
        const data = await Client.find(filter)
            .select("name email phone clientId")
            .sort({ name: 1 })
            .limit(500)
            .lean();
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const sendClientMails = async (req, res, next) => {
    try {
        if (!canSend(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot send client mails" });
        }

        const templateId = String(req.body.templateId || "").trim();
        let subject = String(req.body.subject || "").trim();
        let bodyHtml = String(req.body.body || "").trim();

        if (templateId) {
            if (!mongoose.Types.ObjectId.isValid(templateId)) {
                return res.status(400).json({ success: false, message: "Invalid template id" });
            }
            const template = await EmailTemplate.findById(templateId).lean();
            if (!template) return res.status(404).json({ success: false, message: "Template not found" });
            if (!subject) subject = template.subject;
            if (!bodyHtml) bodyHtml = template.body;
        }

        if (!subject) return res.status(400).json({ success: false, message: "Subject is required" });
        if (!bodyHtml) return res.status(400).json({ success: false, message: "Mail body is required" });

        const clientIds = parseClientIds(req.body.clientIds);
        const extraEmails = parseExtraEmails(req.body.extraEmails);
        const badExtra = extraEmails.filter((email) => !isEmail(email));
        if (badExtra.length) {
            return res.status(400).json({
                success: false,
                message: `Invalid extra email: ${badExtra[0]}`,
            });
        }

        const clients = clientIds.length
            ? await Client.find({ _id: { $in: clientIds } }).select("name email phone clientId").lean()
            : [];

        const jobs = [];
        for (const client of clients) {
            const email = String(client.email || "").trim().toLowerCase();
            if (!email || !isEmail(email)) {
                jobs.push({
                    kind: "client",
                    clientId: client._id,
                    name: client.name,
                    email: email || "",
                    ok: false,
                    reason: "Client has no valid registered email",
                });
                continue;
            }
            jobs.push({
                kind: "client",
                clientId: client._id,
                name: client.name,
                email,
                subject: applyTokens(subject, client),
                body: applyTokens(bodyHtml, client),
                ok: true,
            });
        }

        for (const email of extraEmails) {
            jobs.push({
                kind: "extra",
                name: "",
                email,
                subject: applyTokens(subject, { email }),
                body: applyTokens(bodyHtml, { email }),
                ok: true,
            });
        }

        const ready = jobs.filter((job) => job.ok);
        if (!ready.length) {
            return res.status(400).json({
                success: false,
                message: "Select at least one client with email, or add an extra email",
                results: jobs.filter((job) => !job.ok).slice(0, 40),
            });
        }

        const attachments = (req.files || []).map((file) => ({
            filename: file.originalname,
            content: file.buffer,
            contentType: file.mimetype,
        }));

        const results = [];
        let sent = 0;
        let failed = 0;

        for (const job of jobs) {
            if (!job.ok) {
                failed += 1;
                results.push({
                    kind: job.kind,
                    name: job.name,
                    email: job.email,
                    sent: false,
                    reason: job.reason,
                });
                continue;
            }
            const outcome = await sendClientMail({
                to: job.email,
                subject: job.subject,
                html: job.body,
                attachments,
            });
            if (outcome.sent) {
                sent += 1;
                results.push({ kind: job.kind, name: job.name, email: job.email, sent: true });
            } else {
                failed += 1;
                results.push({
                    kind: job.kind,
                    name: job.name,
                    email: job.email,
                    sent: false,
                    reason: outcome.reason || "Send failed",
                });
            }
        }

        res.status(sent ? 200 : 400).json({
            success: sent > 0,
            sent,
            failed,
            total: jobs.length,
            results: results.slice(0, 80),
            message: sent
                ? `Sent ${sent} mail${sent === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}`
                : results.find((item) => item.reason)?.reason || "No mail was sent",
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

module.exports = {
    listEmailTemplates,
    getEmailTemplateById,
    createEmailTemplate,
    updateEmailTemplate,
    deleteEmailTemplate,
    listMailRecipients,
    sendClientMails,
};
