const mongoose = require("mongoose");
const ClientEveningReport = require("../models/ClientEveningReport");
const Client = require("../models/Client");
const Project = require("../models/Project");
const { istParts } = require("../utils/eveningReportGenerator");
const { startOfDay } = require("../utils/workPlanSchedule");
const { notify } = require("../utils/notify");

const fail = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    throw error;
};

const isAdmin = (user) => user?.userType === "ADMIN";
const isClient = (req) => req.authKind === "CLIENT" || req.user?.userType === "CLIENT";

const idOf = (value) => String(value?._id || value || "");

const dayStartFromInput = (value) => {
    if (!value) {
        return startOfDay(new Date());
    }
    const text = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) fail("Date must be YYYY-MM-DD");
    return startOfDay(text);
};

const parsePagination = (page, limit) => {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
};

const canViewStaff = (report, user) => {
    if (isAdmin(user)) return true;
    const uid = String(user._id);
    if (idOf(report.reportingManager) === uid) return true;
    return (report.contributors || []).some((id) => idOf(id) === uid);
};

/** Admin or client's reporting manager — see/edit full combined report. */
const isReportLead = (report, user) => {
    if (!user) return false;
    if (isAdmin(user)) return true;
    return idOf(report.reportingManager) === String(user._id);
};

const canEditDraft = (report, user, assignedOk = false) => {
    if (report.status !== "DRAFT") return false;
    return canViewStaff(report, user) || assignedOk;
};

/** Only RM/Admin lock the combined final report (not individual employees). */
const canLock = (report, user) => {
    if (report.status !== "DRAFT") return false;
    return isReportLead(report, user);
};

const canApprove = (report, user) => {
    if (report.status !== "LOCKED") return false;
    if (isAdmin(user)) return true;
    return idOf(report.reportingManager) === String(user._id);
};

const canFeedback = (report, user, req) => {
    if (isClient(req)) {
        return report.status === "APPROVED" && idOf(report.client) === String(user._id);
    }
    return canViewStaff(report, user);
};

const normalizeItem = (item, { forceAssigneeId = null, forceAssigneeName = "" } = {}) => ({
    planId: item.planId || null,
    projectId: item.projectId || null,
    projectName: String(item.projectName || "").trim().slice(0, 120),
    serviceId: item.serviceId || null,
    serviceName: String(item.serviceName || "").trim().slice(0, 120),
    slotId: String(item.slotId || new mongoose.Types.ObjectId()).slice(0, 64),
    label: String(item.label || "").trim().slice(0, 120),
    kind: String(item.kind || "MANUAL").trim().slice(0, 40),
    status: ["PENDING", "DONE", "PARTIAL", "HOLD"].includes(String(item.status || "").toUpperCase())
        ? String(item.status).toUpperCase()
        : "DONE",
    note: String(item.note || "").trim().slice(0, 500),
    assigneeId: forceAssigneeId || item.assigneeId || null,
    assigneeName: forceAssigneeName || String(item.assigneeName || "").trim().slice(0, 120),
});

const present = (row, user, req, { assignedOk = false } = {}) => {
    const clientUser = isClient(req);
    const lead = !clientUser && isReportLead(row, user);
    const uid = String(user?._id || "");
    const allItems = row.items || [];
    // Employees only see their own assigned lines; RM/Admin/client see combined report.
    const items = (!clientUser && !lead)
        ? allItems.filter((item) => idOf(item.assigneeId) === uid)
        : allItems;
    const mineCount = allItems.filter((item) => idOf(item.assigneeId) === uid).length;
    const draftOk = !clientUser && canEditDraft(row, user, assignedOk);

    return {
        _id: row._id,
        client: row.client && row.client._id
            ? {
                _id: row.client._id,
                name: row.client.name,
                clientId: row.client.clientId,
                phone: row.client.phone || "",
                whatsapp: row.client.whatsapp || "",
            }
            : row.client,
        date: row.date,
        status: row.status,
        items,
        totalItems: allItems.length,
        myItems: mineCount,
        notes: row.notes || "",
        reportingManager: row.reportingManager && row.reportingManager._id
            ? { _id: row.reportingManager._id, name: row.reportingManager.name }
            : row.reportingManager,
        contributors: row.contributors || [],
        generatedAt: row.generatedAt,
        lockedAt: row.lockedAt,
        lockedBy: row.lockedBy && row.lockedBy._id
            ? { _id: row.lockedBy._id, name: row.lockedBy.name }
            : row.lockedBy,
        approvedAt: row.approvedAt,
        approvedBy: row.approvedBy && row.approvedBy._id
            ? { _id: row.approvedBy._id, name: row.approvedBy.name }
            : row.approvedBy,
        feedback: (row.feedback || []).map((f) => ({
            _id: f._id,
            body: f.body,
            authorName: f.authorName,
            authorKind: f.authorKind,
            createdAt: f.createdAt,
        })),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        viewScope: clientUser || lead ? "all" : "mine",
        canEdit: draftOk,
        // Anyone assigned on this client/project can write the rich-text report body.
        canEditNotes: draftOk,
        canEditMyItems: draftOk,
        canLock: clientUser ? false : canLock(row, user),
        canApprove: clientUser ? false : canApprove(row, user),
        canFeedback: canFeedback(row, user, req),
    };
};

const withPeople = (query) => query
    .populate("client", "name clientId phone whatsapp")
    .populate("reportingManager", "name")
    .populate("lockedBy", "name")
    .populate("approvedBy", "name")
    .populate("contributors", "name");

const listEveningReports = async (req, res, next) => {
    try {
        if (isClient(req)) {
            return res.status(403).json({ success: false, message: "Use client evening-report routes" });
        }
        const { page = 1, limit = 20, date, status, clientId } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);
        const filter = {};
        if (date) filter.date = dayStartFromInput(date);
        if (status) filter.status = String(status).toUpperCase();
        if (clientId && mongoose.Types.ObjectId.isValid(clientId)) filter.client = clientId;

        if (!isAdmin(req.user)) {
            const scope = await assignedScopeForUser(req.user);
            // Only reports for clients/projects this employee is assigned on.
            filter.client = { $in: scope.clientIds || [] };
        }

        const [total, rows] = await Promise.all([
            ClientEveningReport.countDocuments(filter),
            withPeople(ClientEveningReport.find(filter))
                .sort({ date: -1, updatedAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
        ]);

        res.status(200).json({
            success: true,
            data: rows.map((row) => present(row, req.user, req, { assignedOk: true })),
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum },
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

/** Clients/projects this staff user is actually assigned on (or admin = all). */
const assignedScopeForUser = async (user) => {
    if (isAdmin(user)) {
        const [clients, projects] = await Promise.all([
            Client.find({}).select("name clientId reportingManager").populate("reportingManager", "name").sort({ name: 1 }).limit(500).lean(),
            Project.find({}).select("name client").limit(1000).lean(),
        ]);
        return { clientIds: null, clients, projects };
    }

    const uid = user._id;
    const projects = await Project.find({
        $or: [
            { reportingManager: uid },
            { workingEmployees: uid },
            { "serviceAssignments.employee": uid },
        ],
    }).select("name client reportingManager").lean();

    const fromProjects = projects.map((p) => idOf(p.client)).filter(Boolean);
    const asClientRm = await Client.find({ reportingManager: uid }).select("_id").lean();
    const clientIds = [...new Set([
        ...fromProjects,
        ...asClientRm.map((c) => String(c._id)),
    ])].filter(Boolean);

    const clients = clientIds.length
        ? await Client.find({ _id: { $in: clientIds } })
            .select("name clientId reportingManager")
            .populate("reportingManager", "name")
            .sort({ name: 1 })
            .limit(500)
            .lean()
        : [];

    return { clientIds, clients, projects };
};

const listReportClients = async (req, res, next) => {
    try {
        if (isClient(req)) return res.status(403).json({ success: false, message: "Not allowed" });

        const scope = await assignedScopeForUser(req.user);
        const projectsByClient = new Map();
        for (const project of scope.projects || []) {
            const cid = idOf(project.client);
            if (!cid) continue;
            if (!projectsByClient.has(cid)) projectsByClient.set(cid, []);
            projectsByClient.get(cid).push({ _id: project._id, name: project.name });
        }

        const data = (scope.clients || []).map((client) => ({
            ...client,
            projects: projectsByClient.get(String(client._id)) || [],
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const createEveningReport = async (req, res, next) => {
    try {
        if (isClient(req)) return res.status(403).json({ success: false, message: "Not allowed" });

        const clientId = String(req.body?.client || "").trim();
        if (!mongoose.Types.ObjectId.isValid(clientId)) fail("Select a client");
        const day = dayStartFromInput(req.body?.date || istParts().dateKey);

        const client = await Client.findById(clientId).select("name reportingManager status").lean();
        if (!client) fail("Client not found", 404);

        if (!isAdmin(req.user)) {
            const scope = await assignedScopeForUser(req.user);
            if (!(scope.clientIds || []).includes(String(clientId))) {
                return res.status(403).json({
                    success: false,
                    message: "Sirf assigned client / project pe hi report bana sakte ho",
                });
            }
        }

        let row = await ClientEveningReport.findOne({ client: clientId, date: day });
        if (row) {
            if (!canViewStaff(row, req.user) && !isAdmin(req.user)) {
                return res.status(403).json({ success: false, message: "Report already exists but you cannot open it" });
            }
            const data = await withPeople(ClientEveningReport.findById(row._id)).lean();
            return res.status(200).json({
                success: true,
                message: "Report already exists",
                data: present(data, req.user, req, { assignedOk: true }),
            });
        }

        const contributors = [...new Set([
            String(req.user._id),
            ...(client.reportingManager ? [idOf(client.reportingManager)] : []),
        ].filter(Boolean))];

        row = await ClientEveningReport.create({
            client: clientId,
            date: day,
            status: "DRAFT",
            items: [],
            notes: "",
            reportingManager: client.reportingManager || null,
            contributors,
            generatedAt: new Date(),
        });

        const data = await withPeople(ClientEveningReport.findById(row._id)).lean();
        res.status(201).json({
            success: true,
            message: "Draft report created — ab kitna kaam kiya likho aur save/submit karo",
            data: present(data, req.user, req, { assignedOk: true }),
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const listTodayApproved = async (req, res, next) => {
    try {
        if (!isAdmin(req.user) && req.user?.userType !== "EMPLOYEE") {
            return res.status(403).json({ success: false, message: "Not allowed" });
        }
        const day = dayStartFromInput(req.query.date || istParts().dateKey);

        const filter = { date: day };
        const status = String(req.query.status || "").trim().toUpperCase();
        // Default: show DRAFT + LOCKED + APPROVED (not only approved — employees need live drafts).
        if (status && ["DRAFT", "LOCKED", "APPROVED"].includes(status)) {
            filter.status = status;
        }
        if (!isAdmin(req.user)) {
            const scope = await assignedScopeForUser(req.user);
            filter.client = { $in: scope.clientIds || [] };
        }
        const rows = await withPeople(ClientEveningReport.find(filter))
            .sort({ status: 1, updatedAt: -1 })
            .lean();
        res.status(200).json({
            success: true,
            date: day,
            data: rows.map((row) => present(row, req.user, req, { assignedOk: true })),
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const getEveningReport = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid report id" });
        }
        const row = await withPeople(ClientEveningReport.findById(req.params.id)).lean();
        if (!row) return res.status(404).json({ success: false, message: "Report not found" });

        let assignedOk = isAdmin(req.user);
        if (isClient(req)) {
            if (idOf(row.client) !== String(req.user._id) || row.status !== "APPROVED") {
                return res.status(404).json({ success: false, message: "Report not found" });
            }
        } else if (!isAdmin(req.user)) {
            const scope = await assignedScopeForUser(req.user);
            assignedOk = (scope.clientIds || []).includes(idOf(row.client));
            if (!assignedOk && !canViewStaff(row, req.user)) {
                return res.status(403).json({ success: false, message: "Not your assigned client / project" });
            }
            assignedOk = assignedOk || canViewStaff(row, req.user);
        }

        res.status(200).json({ success: true, data: present(row, req.user, req, { assignedOk }) });
    } catch (error) {
        next(error);
    }
};

const updateEveningReport = async (req, res, next) => {
    try {
        if (isClient(req)) return res.status(403).json({ success: false, message: "Clients cannot edit reports" });
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid report id" });
        }
        const row = await ClientEveningReport.findById(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: "Report not found" });

        let assignedOk = isAdmin(req.user);
        if (!assignedOk) {
            const scope = await assignedScopeForUser(req.user);
            assignedOk = (scope.clientIds || []).includes(idOf(row.client));
        }
        if (!canEditDraft(row, req.user, assignedOk)) {
            return res.status(403).json({ success: false, message: "Only draft reports can be edited by assignees / RM / admin" });
        }

        const lead = isReportLead(row, req.user);
        const uid = String(req.user._id);

        if (Object.prototype.hasOwnProperty.call(req.body || {}, "notes")) {
            const notes = String(req.body.notes || "").trim();
            if (notes.length > 50000) fail("Report content too long");
            row.notes = notes;
            if (!(row.contributors || []).some((id) => idOf(id) === uid)) {
                row.contributors = [...(row.contributors || []), req.user._id];
            }
        }

        const plainNotes = String(row.notes || "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        if (Array.isArray(req.body?.items)) {
            if (lead) {
                row.items = (req.body.items || [])
                    .map((item) => normalizeItem(item))
                    .filter((item) => item.label || item.note || item.serviceName);
            } else {
                // Employee: replace only their own manual lines (others stay).
                const others = (row.items || []).filter((item) => idOf(item.assigneeId) !== uid);
                const mine = (req.body.items || [])
                    .map((item) => normalizeItem(item, {
                        forceAssigneeId: req.user._id,
                        forceAssigneeName: req.user.name || "",
                    }))
                    .filter((item) => item.label || item.note || item.serviceName);
                row.items = [...others, ...mine];
                if (!(row.contributors || []).some((id) => idOf(id) === uid)) {
                    row.contributors = [...(row.contributors || []), req.user._id];
                }
            }
            row.markModified("items");
        }

        const hasItems = (row.items || []).length > 0;
        if (!hasItems && !plainNotes) {
            fail("Write the report in the editor, or add at least one work line");
        }

        await row.save();
        const data = await withPeople(ClientEveningReport.findById(row._id)).lean();
        res.status(200).json({
            success: true,
            message: lead ? "Report saved" : "Aapka kaam save / submit ho gaya — RM lock & approve karega",
            data: present(data, req.user, req, { assignedOk: true }),
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const lockEveningReport = async (req, res, next) => {
    try {
        if (isClient(req)) return res.status(403).json({ success: false, message: "Not allowed" });
        const row = await ClientEveningReport.findById(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: "Report not found" });
        if (!canLock(row, req.user)) {
            return res.status(403).json({ success: false, message: "Cannot lock this report" });
        }
        row.status = "LOCKED";
        row.lockedAt = new Date();
        row.lockedBy = req.user._id;
        await row.save();

        const client = await Client.findById(row.client).select("name").lean();
        await notify({
            type: "EVENING_REPORT",
            title: `Report locked for approval: ${client?.name || "Client"}`,
            body: `${req.user.name || "Employee"} locked today's evening report`,
            href: `/dashboard/evening-reports/${row._id}`,
            actorId: req.user._id,
            extraUserIds: [row.reportingManager].filter(Boolean),
        });

        const data = await withPeople(ClientEveningReport.findById(row._id)).lean();
        res.status(200).json({ success: true, message: "Report locked — waiting for RM/admin approval", data: present(data, req.user, req) });
    } catch (error) {
        next(error);
    }
};

const approveEveningReport = async (req, res, next) => {
    try {
        if (isClient(req)) return res.status(403).json({ success: false, message: "Not allowed" });
        const row = await ClientEveningReport.findById(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: "Report not found" });
        if (!canApprove(row, req.user)) {
            return res.status(403).json({ success: false, message: "Only RM or admin can approve a locked report" });
        }
        row.status = "APPROVED";
        row.approvedAt = new Date();
        row.approvedBy = req.user._id;
        await row.save();

        const client = await Client.findById(row.client).select("name").lean();
        await notify({
            type: "EVENING_REPORT",
            title: `Evening report approved: ${client?.name || "Client"}`,
            body: "Visible to client now · also on Today's reports",
            href: `/dashboard/evening-reports/today`,
            actorId: req.user._id,
            extraUserIds: row.contributors || [],
        });

        const data = await withPeople(ClientEveningReport.findById(row._id)).lean();
        res.status(200).json({ success: true, message: "Approved — client can view this report", data: present(data, req.user, req) });
    } catch (error) {
        next(error);
    }
};

const unlockEveningReport = async (req, res, next) => {
    try {
        if (isClient(req)) return res.status(403).json({ success: false, message: "Not allowed" });
        const row = await ClientEveningReport.findById(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: "Report not found" });
        if (row.status !== "LOCKED") fail("Only locked reports can be sent back to draft");
        if (!isAdmin(req.user) && idOf(row.reportingManager) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: "Only RM or admin can unlock" });
        }
        row.status = "DRAFT";
        row.lockedAt = null;
        row.lockedBy = null;
        await row.save();
        const data = await withPeople(ClientEveningReport.findById(row._id)).lean();
        res.status(200).json({ success: true, message: "Sent back to draft", data: present(data, req.user, req) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const addEveningFeedback = async (req, res, next) => {
    try {
        const row = await ClientEveningReport.findById(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: "Report not found" });
        if (!canFeedback(row, req.user, req)) {
            return res.status(403).json({ success: false, message: "You cannot comment on this report" });
        }
        const body = String(req.body?.body || "").trim();
        if (!body) fail("Feedback is required");
        if (body.length > 2000) fail("Feedback too long");

        let authorKind = "EMPLOYEE";
        if (isClient(req)) authorKind = "CLIENT";
        else if (isAdmin(req.user)) authorKind = "ADMIN";

        row.feedback.push({
            body,
            author: req.user._id,
            authorName: req.user.name || "",
            authorKind,
        });
        await row.save();

        const data = await withPeople(ClientEveningReport.findById(row._id)).lean();
        res.status(201).json({ success: true, data: present(data, req.user, req) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const generateNow = async (req, res, next) => {
    try {
        // Kept for older UI — auto generate is off; use create evening report instead.
        res.status(200).json({
            success: true,
            message: "Auto generate band hai. Client select karke manual report banao.",
            data: { created: 0, updated: 0, skipped: true, reason: "manual-only" },
        });
    } catch (error) {
        next(error);
    }
};

const listClientEveningReports = async (req, res, next) => {
    try {
        if (!isClient(req)) return res.status(403).json({ success: false, message: "Clients only" });
        const { page = 1, limit = 20 } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);
        const filter = { client: req.user._id, status: "APPROVED" };
        const [total, rows] = await Promise.all([
            ClientEveningReport.countDocuments(filter),
            withPeople(ClientEveningReport.find(filter))
                .sort({ date: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
        ]);
        res.status(200).json({
            success: true,
            data: rows.map((row) => present(row, req.user, req)),
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listEveningReports,
    listTodayApproved,
    listReportClients,
    createEveningReport,
    getEveningReport,
    updateEveningReport,
    lockEveningReport,
    approveEveningReport,
    unlockEveningReport,
    addEveningFeedback,
    generateNow,
    listClientEveningReports,
};
