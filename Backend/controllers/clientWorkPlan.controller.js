const mongoose = require("mongoose");
const Client = require("../models/Client");
const Service = require("../models/Service");
const User = require("../models/User");
const ClientWorkPlan = require("../models/ClientWorkPlan");
const { PLAN_MODES, SLOT_STATUSES } = require("../models/ClientWorkPlan");
const UrgentWork = require("../models/UrgentWork");
const { downlineIds } = require("../utils/reporting");
const ExcelJS = require("exceljs");
const SoftwareSetting = require("../models/SoftwareSetting");
const {
    suggestModeFromName,
    defaultDeliverables,
    defaultPhases,
    startOfDay,
    addDays,
} = require("../utils/workPlanSchedule");
const { loadPlansWithDaySlots } = require("../utils/dayWorkSlots");
const { permissionGranted } = require("../utils/permissions");

const fail = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    throw error;
};

const readDay = (value, label) => {
    const text = String(value || "").trim();
    if (!text) fail(`${label} is required`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) fail(`${label} must be a valid date`);
    const date = startOfDay(text);
    if (Number.isNaN(date.getTime())) fail(`${label} must be a valid date`);
    return date;
};

const readPeople = async (value, label, { required = false, many = false } = {}) => {
    if (many) {
        const raw = Array.isArray(value) ? value : [];
        const ids = [...new Set(raw.map((id) => String(id || "").trim()).filter(Boolean))];
        if (!ids.length) return [];
        if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) fail(`Invalid ${label}`);
        const found = await User.find({
            _id: { $in: ids },
            status: "ACTIVE",
            userType: { $in: ["ADMIN", "EMPLOYEE"] },
        }).select("_id");
        if (found.length !== ids.length) fail(`Select active people for ${label}`);
        return found.map((row) => row._id);
    }
    const id = String(value || "").trim();
    if (!id) {
        if (required) fail(`${label} is required`);
        return null;
    }
    if (!mongoose.Types.ObjectId.isValid(id)) fail(`Invalid ${label}`);
    const user = await User.findOne({
        _id: id,
        status: "ACTIVE",
        userType: { $in: ["ADMIN", "EMPLOYEE"] },
    }).select("_id");
    if (!user) fail(`Select an active ${label}`);
    return user._id;
};

const slugKey = (label, fallback = "ITEM") => {
    const base = String(label || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 40);
    return base || fallback;
};

const readDeliverables = (value) => {
    if (!Array.isArray(value) || !value.length) fail("Add at least one deliverable with quantity");
    const rows = value.map((row, index) => {
        const label = String(row?.label || "").trim();
        if (!label) fail("Deliverable name is required");
        const quantity = Number(row?.quantity);
        if (!Number.isFinite(quantity) || quantity < 0) fail("Quantity must be 0 or more");
        if (quantity > 500) fail("Quantity cannot be more than 500 per item");
        return {
            key: String(row?.key || slugKey(label, `ITEM_${index + 1}`)).slice(0, 40),
            label: label.slice(0, 80),
            quantity: Math.floor(quantity),
        };
    });
    if (!rows.some((row) => row.quantity > 0)) fail("Set quantity on at least one deliverable");
    return rows;
};

const readPhases = (value) => {
    if (!Array.isArray(value) || !value.length) fail("Add at least one phase with percent");
    const rows = value.map((row, index) => {
        const label = String(row?.label || "").trim();
        if (!label) fail("Phase name is required");
        const percent = Number(row?.percent);
        if (!Number.isFinite(percent) || percent < 0) fail("Percent must be 0 or more");
        return {
            key: String(row?.key || slugKey(label, `PHASE_${index + 1}`)).slice(0, 40),
            label: label.slice(0, 80),
            percent: Math.min(100, Math.floor(percent)),
        };
    });
    const total = rows.reduce((sum, row) => sum + row.percent, 0);
    if (total <= 0) fail("Phase percents must add up to more than 0");
    if (total > 100) fail("Phase percents cannot exceed 100%");
    return rows;
};

const memberIds = (plan) => {
    const manager = String(plan.reportingManager?._id || plan.reportingManager || "");
    const people = (plan.assignees || []).map((person) => String(person?._id || person));
    return [manager, ...people].filter(Boolean);
};

const isSeniorOfPlan = (plan, user, downline) => {
    if (!plan || !user) return false;
    if (user.userType === "ADMIN") return true;
    const manager = String(plan.reportingManager?._id || plan.reportingManager || "");
    if (manager === String(user._id)) return true;
    return memberIds(plan).some((id) => downline.has(id));
};

const isAssigneeOnly = (plan, user) => {
    if (!plan || !user || user.userType === "ADMIN") return false;
    const me = String(user._id);
    const manager = String(plan.reportingManager?._id || plan.reportingManager || "");
    if (manager === me) return false;
    return (plan.assignees || []).some((person) => String(person?._id || person) === me)
        || (plan.slots || []).some((slot) => String(slot.assignee?._id || slot.assignee) === me);
};

const canSeePlan = (plan, user, downline) => {
    if (!plan) return false;
    if (user.userType === "ADMIN") return true;
    if (isSeniorOfPlan(plan, user, downline)) return true;
    return isAssigneeOnly(plan, user);
};

const canEditPlan = (plan, user, downline) => isSeniorOfPlan(plan, user, downline);

const withPeople = (query) => query
    .populate("service", "name")
    .populate("reportingManager", "name")
    .populate("assignees", "name")
    .populate("createdBy", "name")
    .populate("slots.assignee", "name");

const normalizePlanBody = (mode, body) => {
    if (mode === "QUANTITY") {
        return { deliverables: readDeliverables(body.deliverables), phases: [] };
    }
    return { deliverables: [], phases: readPhases(body.phases) };
};

const shapePlan = (plan, user, downline) => {
    const edit = canEditPlan(plan, user, downline);
    const data = {
        ...plan,
        canEdit: edit,
        canSeeAll: edit || user.userType === "ADMIN",
    };
    if (data.canSeeAll) return data;
    const me = String(user._id);
    return {
        ...data,
        slots: (data.slots || []).filter((slot) => String(slot.assignee?._id || slot.assignee) === me),
        assignees: (data.assignees || []).filter((person) => String(person?._id || person) === me),
    };
};

const loadAccess = async (user) => {
    if (user.userType === "ADMIN") return new Set();
    return new Set((await downlineIds(user._id)).map((id) => String(id)));
};

const getPlanDefaults = async (req, res, next) => {
    try {
        const serviceId = String(req.query.service || "").trim();
        let service = null;
        if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
            service = await Service.findById(serviceId).select("name").lean();
        }
        const mode = suggestModeFromName(service?.name || "");
        res.status(200).json({
            success: true,
            data: {
                mode,
                deliverables: defaultDeliverables(),
                phases: defaultPhases(service?.name || ""),
            },
        });
    } catch (error) {
        next(error);
    }
};

const getPlanEmployees = async (req, res, next) => {
    try {
        const people = await User.find({
            status: "ACTIVE",
            userType: { $in: ["ADMIN", "EMPLOYEE"] },
        })
            .select("name userType")
            .sort({ name: 1 })
            .limit(500)
            .lean();
        res.status(200).json({ success: true, data: people });
    } catch (error) {
        next(error);
    }
};

const listClientPlans = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.clientId)) {
            return res.status(400).json({ success: false, message: "Invalid client ID" });
        }
        const client = await Client.findById(req.params.clientId).select("_id");
        if (!client) return res.status(404).json({ success: false, message: "Client not found" });

        const downline = await loadAccess(req.user);
        const rows = await withPeople(ClientWorkPlan.find({ client: client._id }))
            .sort({ createdAt: -1 })
            .lean();

        const visible = rows
            .filter((plan) => canSeePlan(plan, req.user, downline))
            .map((plan) => shapePlan(plan, req.user, downline));

        res.status(200).json({ success: true, data: visible });
    } catch (error) {
        next(error);
    }
};

const listProjectPlans = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.projectId)) {
            return res.status(400).json({ success: false, message: "Invalid project ID" });
        }
        const Project = require("../models/Project");
        const project = await Project.findById(req.params.projectId).select("_id client");
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        const downline = await loadAccess(req.user);
        const rows = await withPeople(ClientWorkPlan.find({ project: project._id }))
            .sort({ createdAt: -1 })
            .lean();

        const visible = rows
            .filter((plan) => canSeePlan(plan, req.user, downline))
            .map((plan) => shapePlan(plan, req.user, downline));

        res.status(200).json({ success: true, data: visible });
    } catch (error) {
        next(error);
    }
};

const getPlanById = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid plan ID" });
        }
        const plan = await withPeople(ClientWorkPlan.findById(req.params.id)).lean();
        const downline = await loadAccess(req.user);
        if (!canSeePlan(plan, req.user, downline)) {
            return res.status(404).json({ success: false, message: "Plan not found" });
        }
        res.status(200).json({ success: true, data: shapePlan(plan, req.user, downline) });
    } catch (error) {
        next(error);
    }
};

const createPlan = async (req, res, next) => {
    try {
        const clientId = String(req.body.client || "").trim();
        const serviceId = String(req.body.service || "").trim();
        if (!mongoose.Types.ObjectId.isValid(clientId)) fail("Select a client");
        if (!mongoose.Types.ObjectId.isValid(serviceId)) fail("Select a service");

        const client = await Client.findById(clientId);
        if (!client) fail("Client not found", 404);
        if (!(client.services || []).some((id) => String(id) === serviceId)) {
            fail("This service is not on the client. Add it on the client first.");
        }
        const service = await Service.findById(serviceId);
        if (!service) fail("Service not found", 404);

        const mode = String(req.body.mode || suggestModeFromName(service.name)).toUpperCase();
        if (!PLAN_MODES.includes(mode)) fail("Select Quantity or Percent plan mode");

        const startDate = readDay(req.body.startDate, "Start date");
        const endDate = readDay(req.body.endDate, "Deadline");
        if (endDate < startDate) fail("Deadline cannot be before start date");

        const reportingManager = await readPeople(req.body.reportingManager, "reporting manager", { required: true });
        const assignees = await readPeople(req.body.assignees, "assignees", { many: true });

        const normalized = normalizePlanBody(mode, req.body);

        let projectId = null;
        if (req.body.project) {
            if (!mongoose.Types.ObjectId.isValid(String(req.body.project))) fail("Invalid project");
            projectId = req.body.project;
        }

        const plan = await ClientWorkPlan.create({
            client: client._id,
            project: projectId,
            service: service._id,
            mode,
            startDate,
            endDate,
            reportingManager,
            assignees,
            deliverables: normalized.deliverables,
            phases: normalized.phases,
            slots: [],
            createdBy: req.user._id,
        });

        const { notify } = require("../utils/notify");
        await notify({
            type: "WORK_PLAN",
            title: `Work plan created: ${client.name}`,
            body: `${service.name} · targets saved (no auto day-split)`,
            href: `/dashboard/clients/${client._id}`,
            actorId: req.user._id,
            extraUserIds: [reportingManager, ...assignees],
        });

        const downline = await loadAccess(req.user);
        const data = await withPeople(ClientWorkPlan.findById(plan._id)).lean();
        res.status(201).json({ success: true, data: shapePlan(data, req.user, downline) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const updatePlan = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid plan ID" });
        }
        const plan = await ClientWorkPlan.findById(req.params.id);
        if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

        const downline = await loadAccess(req.user);
        if (!canEditPlan(plan, req.user, downline)) {
            return res.status(403).json({
                success: false,
                message: "Only admin or the reporting senior can edit this plan",
            });
        }

        const mode = String(req.body.mode || plan.mode).toUpperCase();
        if (!PLAN_MODES.includes(mode)) fail("Select Quantity or Percent plan mode");

        const startDate = readDay(req.body.startDate || plan.startDate.toISOString().slice(0, 10), "Start date");
        const endDate = readDay(req.body.endDate || plan.endDate.toISOString().slice(0, 10), "Deadline");
        if (endDate < startDate) fail("Deadline cannot be before start date");

        const reportingManager = await readPeople(
            req.body.reportingManager || plan.reportingManager,
            "reporting manager",
            { required: true },
        );
        const assignees = await readPeople(
            req.body.assignees != null ? req.body.assignees : plan.assignees,
            "assignees",
            { many: true },
        );

        const normalized = normalizePlanBody(mode, {
            deliverables: req.body.deliverables != null ? req.body.deliverables : plan.deliverables,
            phases: req.body.phases != null ? req.body.phases : plan.phases,
        });

        plan.mode = mode;
        plan.startDate = startDate;
        plan.endDate = endDate;
        plan.reportingManager = reportingManager;
        plan.assignees = assignees;
        plan.deliverables = normalized.deliverables;
        plan.phases = normalized.phases;
        // Clear any previously auto-generated day slots — no automatic divide.
        plan.slots = [];
        await plan.save();

        const data = await withPeople(ClientWorkPlan.findById(plan._id)).lean();
        res.status(200).json({ success: true, data: shapePlan(data, req.user, downline) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const updateSlot = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id) || !mongoose.Types.ObjectId.isValid(req.params.slotId)) {
            return res.status(400).json({ success: false, message: "Invalid plan or slot ID" });
        }
        const plan = await ClientWorkPlan.findById(req.params.id);
        if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

        const downline = await loadAccess(req.user);
        if (!canSeePlan(plan, req.user, downline)) {
            return res.status(404).json({ success: false, message: "Plan not found" });
        }

        const slot = plan.slots.id(req.params.slotId);
        if (!slot) return res.status(404).json({ success: false, message: "Slot not found" });

        const edit = canEditPlan(plan, req.user, downline);
        const mine = String(slot.assignee || "") === String(req.user._id);

        if (!edit && !mine) {
            return res.status(403).json({ success: false, message: "You can only update your own assigned items" });
        }

        if (edit) {
            if (req.body.date) slot.date = readDay(req.body.date, "Date");
            if (req.body.label != null) slot.label = String(req.body.label).trim().slice(0, 80) || slot.label;
            if (req.body.kind != null) slot.kind = String(req.body.kind).trim().slice(0, 40) || slot.kind;
            if (req.body.assignee !== undefined) {
                slot.assignee = await readPeople(req.body.assignee, "assignee", { required: false });
            }
            if (req.body.note != null) slot.note = String(req.body.note).trim().slice(0, 500);
        }

        if (req.body.status != null) {
            const status = String(req.body.status).toUpperCase();
            if (!SLOT_STATUSES.includes(status)) fail("Invalid status");
            // Assignees may only toggle status on their own row — not rewrite the plan.
            if (!edit && !mine) fail("You cannot change this item", 403);
            slot.status = status;
        }

        if (!edit && req.body.note != null && mine) {
            slot.note = String(req.body.note).trim().slice(0, 500);
        }

        await plan.save();

        const data = await withPeople(ClientWorkPlan.findById(plan._id)).lean();
        res.status(200).json({ success: true, data: shapePlan(data, req.user, downline) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const deletePlan = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid plan ID" });
        }
        const plan = await ClientWorkPlan.findById(req.params.id);
        if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
        const downline = await loadAccess(req.user);
        if (!canEditPlan(plan, req.user, downline)) {
            return res.status(403).json({ success: false, message: "Only admin or senior can delete this plan" });
        }
        await plan.deleteOne();
        res.status(200).json({ success: true, message: "Plan deleted" });
    } catch (error) {
        next(error);
    }
};

const typeStatus = (done, total) => {
    if (total <= 0) return "PENDING";
    if (done >= total) return "DONE";
    if (done > 0) return "PARTIAL";
    return "PENDING";
};

const canSeeSlot = (plan, slot, user, downline) => {
    if (user.userType === "ADMIN") return true;
    if (canEditPlan(plan, user, downline)) return true;
    return String(slot.assignee?._id || slot.assignee || "") === String(user._id);
};

const collectDayEntries = async (user, { from, to, assigneeId = "" }) => {
    const downline = await loadAccess(user);
    const { plans, start, endExclusive } = await loadPlansWithDaySlots(from, to);

    const entries = [];
    for (const plan of plans) {
        if (!canSeePlan(plan, user, downline) && !isAssigneeOnly(plan, user)) continue;
        for (const slot of plan.slots || []) {
            const slotDay = startOfDay(slot.date);
            if (slotDay < start || slotDay >= endExclusive) continue;
            if (!canSeeSlot(plan, slot, user, downline)) continue;
            if (assigneeId && String(slot.assignee?._id || slot.assignee || "") !== String(assigneeId)) continue;
            entries.push({ plan, slot, day: slotDay });
        }
    }
    return { entries, downline };
};

const plainWorkText = (value) => String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const collectUrgentDayGroups = async (user, { from, to, assigneeId = "" }) => {
    const start = startOfDay(from);
    const endExclusive = addDays(startOfDay(to), 1);
    const filter = { eod: { $gte: start, $lt: endExclusive } };

    if (user.userType !== "ADMIN") {
        filter.$or = [{ createdBy: user._id }, { assignees: user._id }];
    }
    if (assigneeId) {
        if (!mongoose.Types.ObjectId.isValid(assigneeId)) fail("Invalid employee");
        filter.assignees = assigneeId;
    }

    const rows = await UrgentWork.find(filter)
        .populate("project", "name")
        .populate("assignees", "name")
        .populate("createdBy", "name")
        .sort({ eod: 1, createdAt: -1 })
        .lean();

    return rows.map((row) => {
        const status = row.status === "DONE" ? "DONE" : "PENDING";
        const done = status === "DONE" ? 1 : 0;
        const assignees = (row.assignees || []).map((person) => ({
            _id: person._id,
            name: person.name,
        }));
        const primary = assignees[0] || null;
        const note = plainWorkText(row.work).slice(0, 180);
        const day = startOfDay(row.eod);
        const canUpdate = user.userType === "ADMIN"
            || String(row.createdBy?._id || row.createdBy || "") === String(user._id)
            || assignees.some((person) => String(person._id) === String(user._id));

        return {
            key: `urgent|${row._id}`,
            source: "URGENT",
            urgentId: row._id,
            date: day,
            planId: null,
            client: { _id: null, name: "Urgent work" },
            project: row.project ? { _id: row.project._id, name: row.project.name } : null,
            service: { _id: null, name: row.priority || "URGENT" },
            reportingManager: row.createdBy
                ? { _id: row.createdBy._id, name: row.createdBy.name }
                : null,
            mode: "URGENT",
            canEdit: canUpdate,
            types: [{
                key: "URGENT",
                label: "Urgent task",
                slots: [{
                    _id: row._id,
                    status,
                    note,
                    assignee: primary,
                    assignees,
                }],
                total: 1,
                done,
                pending: 1 - done,
                status,
            }],
            total: 1,
            done,
            pending: 1 - done,
            status,
        };
    });
};

const mergeBoardCounts = (planBoard, urgentGroups) => {
    const groups = [...(planBoard.groups || []), ...urgentGroups].sort((a, b) => {
        const byDate = new Date(a.date) - new Date(b.date);
        if (byDate) return byDate;
        const aUrgent = a.source === "URGENT" ? 0 : 1;
        const bUrgent = b.source === "URGENT" ? 0 : 1;
        if (aUrgent !== bUrgent) return aUrgent - bUrgent;
        return String(a.client?.name || "").localeCompare(String(b.client?.name || ""));
    });

    const counts = { PENDING: 0, PARTIAL: 0, DONE: 0, ALL: groups.length };
    for (const group of groups) {
        counts[group.status] = (counts[group.status] || 0) + 1;
    }
    const slotTotal = groups.reduce((sum, row) => sum + (row.total || 0), 0);
    const slotDone = groups.reduce((sum, row) => sum + (row.done || 0), 0);
    const averagePercent = slotTotal ? Math.round((slotDone / slotTotal) * 1000) / 10 : 0;
    return { groups, counts, averagePercent, slotTotal, slotDone };
};

const buildDailyGroups = (entries, user, downline) => {
    const map = new Map();
    const me = String(user._id);
    for (const { plan, slot, day } of entries) {
        const dateKey = `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
        const groupKey = `${dateKey}|${plan._id}`;
        const mine = String(slot.assignee?._id || slot.assignee || "") === me;
        if (!map.has(groupKey)) {
            map.set(groupKey, {
                key: groupKey,
                date: day,
                planId: plan._id,
                client: plan.client ? { _id: plan.client._id, name: plan.client.name } : null,
                project: plan.project ? { _id: plan.project._id, name: plan.project.name } : null,
                service: plan.service ? { _id: plan.service._id, name: plan.service.name } : null,
                reportingManager: plan.reportingManager
                    ? { _id: plan.reportingManager._id, name: plan.reportingManager.name }
                    : null,
                mode: plan.mode,
                // Assignees must mark their own slots done/pending (seniors can too).
                canEdit: canEditPlan(plan, user, downline) || mine,
                slots: [],
            });
        }
        const row = map.get(groupKey);
        row.slots.push(slot);
        if (mine) row.canEdit = true;
    }

    const groups = [...map.values()].map((group) => {
        const typeMap = new Map();
        for (const slot of group.slots) {
            const key = slot.kind || slot.label || "ITEM";
            if (!typeMap.has(key)) {
                typeMap.set(key, {
                    key,
                    label: slot.label || slot.kind || "Item",
                    slots: [],
                });
            }
            typeMap.get(key).slots.push({
                _id: slot._id,
                status: slot.status,
                note: slot.note || "",
                assignee: slot.assignee
                    ? { _id: slot.assignee._id, name: slot.assignee.name }
                    : null,
            });
        }
        const types = [...typeMap.values()].map((type) => {
            const total = type.slots.length;
            const done = type.slots.filter((item) => item.status === "DONE").length;
            return {
                ...type,
                total,
                done,
                pending: total - done,
                status: typeStatus(done, total),
            };
        });
        const total = group.slots.length;
        const done = group.slots.filter((slot) => slot.status === "DONE").length;
        return {
            ...group,
            slots: undefined,
            types,
            total,
            done,
            pending: total - done,
            status: typeStatus(done, total),
        };
    });

    groups.sort((a, b) => {
        const byDate = a.date - b.date;
        if (byDate) return byDate;
        return String(a.client?.name || "").localeCompare(String(b.client?.name || ""));
    });

    const counts = { PENDING: 0, PARTIAL: 0, DONE: 0, ALL: groups.length };
    for (const group of groups) {
        counts[group.status] = (counts[group.status] || 0) + 1;
    }
    const slotTotal = groups.reduce((sum, row) => sum + row.total, 0);
    const slotDone = groups.reduce((sum, row) => sum + row.done, 0);
    const averagePercent = slotTotal ? Math.round((slotDone / slotTotal) * 1000) / 10 : 0;

    return { groups, counts, averagePercent, slotTotal, slotDone };
};

const canBrowseOthersDaily = (user) => (
    user?.userType === "ADMIN" || permissionGranted(user, ["MANAGE_DAILY_TASKS"])
);

const resolveDailyAssignee = (user, requested) => {
    const id = String(requested || "").trim();
    if (!canBrowseOthersDaily(user)) return String(user._id);
    return id;
};

const getDailyPlanBoard = async (req, res, next) => {
    try {
        const dateText = String(req.query.date || "").trim() || new Date().toISOString().slice(0, 10);
        const date = readDay(dateText, "Date");
        const assigneeId = resolveDailyAssignee(req.user, req.query.assignee);
        const { entries, downline } = await collectDayEntries(req.user, {
            from: date,
            to: date,
            assigneeId,
        });
        const planBoard = buildDailyGroups(entries, req.user, downline);
        const urgentGroups = await collectUrgentDayGroups(req.user, {
            from: date,
            to: date,
            assigneeId,
        });
        const board = mergeBoardCounts(planBoard, urgentGroups);
        const people = canBrowseOthersDaily(req.user)
            ? await User.find({
                status: "ACTIVE",
                userType: { $in: ["ADMIN", "EMPLOYEE"] },
            })
                .select("name")
                .sort({ name: 1 })
                .limit(500)
                .lean()
            : [];

        res.status(200).json({
            success: true,
            data: {
                date: dateText,
                mineOnly: !canBrowseOthersDaily(req.user),
                ...board,
                employees: people,
            },
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const getDailyPlanAlerts = async (req, res, next) => {
    try {
        const today = startOfDay(new Date());
        const assigneeId = resolveDailyAssignee(req.user, "");
        const { entries, downline } = await collectDayEntries(req.user, {
            from: today,
            to: today,
            assigneeId,
        });
        const planBoard = buildDailyGroups(entries, req.user, downline);
        const urgentGroups = await collectUrgentDayGroups(req.user, {
            from: today,
            assigneeId,
            to: today,
        });
        const board = mergeBoardCounts(planBoard, urgentGroups);
        const openGroups = board.groups.filter((row) => row.status !== "DONE");
        const pending = board.groups.filter((row) => row.status === "PENDING").length;
        const partial = board.groups.filter((row) => row.status === "PARTIAL").length;

        res.status(200).json({
            success: true,
            data: {
                openCount: pending + partial,
                pending,
                partial,
                averagePercent: board.averagePercent,
                tasks: openGroups.slice(0, 20).map((row) => ({
                    _id: row.key,
                    title: row.source === "URGENT"
                        ? `Urgent · ${row.project?.name || "Project"}`
                        : `${row.client?.name || "Client"} · ${row.service?.name || "Service"}`,
                    status: row.status,
                    date: row.date,
                    assignee: row.types[0]?.slots?.[0]?.assignee || null,
                })),
            },
        });
    } catch (error) {
        next(error);
    }
};

const formatDayLabel = (value) => {
    if (!value) return "";
    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(value));
};

const exportDailyPlanBoard = async (req, res, next) => {
    try {
        const from = readDay(req.query.from || req.query.date, "From date");
        const to = readDay(req.query.to || req.query.from || req.query.date, "To date");
        if (to < from) fail("To date cannot be before from date");
        const assigneeId = resolveDailyAssignee(req.user, req.query.assignee);
        if (assigneeId && !mongoose.Types.ObjectId.isValid(assigneeId)) fail("Select a valid employee");

        const [assigneeUser, brand] = await Promise.all([
            assigneeId ? User.findById(assigneeId).select("name").lean() : Promise.resolve(null),
            SoftwareSetting.findOne({ key: "software" }).select("companyName").lean(),
        ]);
        if (assigneeId && !assigneeUser) fail("Employee not found", 404);

        const { entries, downline } = await collectDayEntries(req.user, { from, to, assigneeId });
        const board = buildDailyGroups(entries, req.user, downline);
        const company = brand?.companyName?.trim() || "CRM";
        const pendingItems = Math.max(0, (board.slotTotal || 0) - (board.slotDone || 0));
        const pendingPercent = board.slotTotal
            ? Math.round((pendingItems / board.slotTotal) * 1000) / 10
            : 0;

        // Type-wise totals across the period
        const typeTotals = new Map();
        const clientTotals = new Map();
        for (const group of board.groups) {
            const clientName = group.client?.name || "Client";
            if (!clientTotals.has(clientName)) clientTotals.set(clientName, { total: 0, done: 0 });
            const clientRow = clientTotals.get(clientName);
            clientRow.total += group.total;
            clientRow.done += group.done;
            for (const type of group.types) {
                if (!typeTotals.has(type.label)) typeTotals.set(type.label, { total: 0, done: 0 });
                const row = typeTotals.get(type.label);
                row.total += type.total;
                row.done += type.done;
            }
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = company;

        const summary = workbook.addWorksheet("Summary", { views: [{ state: "frozen", ySplit: 1 }] });
        summary.getCell("A1").value = company;
        summary.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF064E3B" } };
        summary.mergeCells("A1:B1");
        summary.getCell("A2").value = "Employee monthly / date-range work report";
        summary.getCell("A2").font = { bold: true, size: 13 };
        summary.mergeCells("A2:B2");
        summary.getCell("A3").value = "Employee";
        summary.getCell("B3").value = assigneeUser?.name || "All visible employees";
        summary.getCell("A4").value = "Period";
        summary.getCell("B4").value = `${formatDayLabel(from)} to ${formatDayLabel(to)}`;
        summary.getCell("A5").value = "Generated by";
        summary.getCell("B5").value = req.user.name || "Admin";

        summary.addRow([]);
        const scoreHeader = summary.addRow(["Overall scorecard", "Value"]);
        scoreHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
        scoreHeader.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
        });
        summary.addRow(["Total items assigned", board.slotTotal || 0]);
        summary.addRow(["Completed (done)", board.slotDone || 0]);
        summary.addRow(["Pending items", pendingItems]);
        summary.addRow(["% Complete", `${board.averagePercent}%`]);
        summary.addRow(["% Pending", `${pendingPercent}%`]);
        summary.addRow(["Client/service days — Done", board.counts.DONE || 0]);
        summary.addRow(["Client/service days — Partial", board.counts.PARTIAL || 0]);
        summary.addRow(["Client/service days — Pending", board.counts.PENDING || 0]);

        summary.addRow([]);
        const typeHeader = summary.addRow(["By deliverable type", "Total", "Done", "Pending", "% Complete"]);
        typeHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
        typeHeader.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
        });
        for (const [label, row] of typeTotals.entries()) {
            const pct = row.total ? Math.round((row.done / row.total) * 1000) / 10 : 0;
            summary.addRow([label, row.total, row.done, row.total - row.done, `${pct}%`]);
        }
        if (!typeTotals.size) summary.addRow(["No work in this period", 0, 0, 0, "0%"]);

        summary.addRow([]);
        const clientHeader = summary.addRow(["By client", "Total", "Done", "Pending", "% Complete"]);
        clientHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
        clientHeader.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
        });
        for (const [name, row] of clientTotals.entries()) {
            const pct = row.total ? Math.round((row.done / row.total) * 1000) / 10 : 0;
            summary.addRow([name, row.total, row.done, row.total - row.done, `${pct}%`]);
        }
        if (!clientTotals.size) summary.addRow(["No clients", 0, 0, 0, "0%"]);

        summary.columns = [{ width: 28 }, { width: 18 }, { width: 12 }, { width: 12 }, { width: 14 }];

        const sheet = workbook.addWorksheet("Details", {
            views: [{ state: "frozen", ySplit: 1 }],
        });
        const headers = [
            "Date", "Client", "Project", "Service", "Type",
            "Total", "Done", "Pending", "% Complete", "% Pending", "Status", "Assignee",
        ];
        const headerRow = sheet.addRow(headers);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
        });

        for (const group of board.groups) {
            for (const type of group.types) {
                const assignees = [...new Set(type.slots.map((s) => s.assignee?.name).filter(Boolean))].join(", ");
                const pct = type.total ? Math.round((type.done / type.total) * 1000) / 10 : 0;
                const typePending = type.total - type.done;
                const pendingPct = type.total ? Math.round((typePending / type.total) * 1000) / 10 : 0;
                sheet.addRow([
                    formatDayLabel(group.date),
                    group.client?.name || "",
                    group.project?.name || "",
                    group.service?.name || "",
                    type.label,
                    type.total,
                    type.done,
                    typePending,
                    pct,
                    pendingPct,
                    type.status,
                    assignees || assigneeUser?.name || "",
                ]);
            }
        }

        sheet.columns = [
            { width: 14 }, { width: 22 }, { width: 20 }, { width: 18 },
            { width: 16 }, { width: 10 }, { width: 10 }, { width: 10 },
            { width: 12 }, { width: 12 }, { width: 12 }, { width: 22 },
        ];

        const empSlug = (assigneeUser?.name || "all").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
        const filename = `work-report-${empSlug}-${String(req.query.from || "").slice(0, 10)}_to_${String(req.query.to || req.query.from || "").slice(0, 10)}.xlsx`;
        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(Buffer.from(buffer));
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

module.exports = {
    getPlanDefaults,
    getPlanEmployees,
    listClientPlans,
    listProjectPlans,
    getPlanById,
    createPlan,
    updatePlan,
    updateSlot,
    deletePlan,
    getDailyPlanBoard,
    getDailyPlanAlerts,
    exportDailyPlanBoard,
};
