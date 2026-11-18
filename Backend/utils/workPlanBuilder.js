const ClientWorkPlan = require("../models/ClientWorkPlan");
const { PLAN_MODES } = require("../models/ClientWorkPlan");
const { suggestModeFromName, startOfDay } = require("./workPlanSchedule");

const fail = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    throw error;
};

const slugKey = (label, fallback = "ITEM") => {
    const base = String(label || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 40);
    return base || fallback;
};

const PART_STATUSES = ["PENDING", "WORKING", "COMPLETED"];

const clampPartStatus = (value, fallback = "PENDING") => {
    const status = String(value || "").toUpperCase();
    return PART_STATUSES.includes(status) ? status : fallback;
};

const mergeProgress = (rows, previous = [], mode = "QUANTITY") => {
    const byKey = new Map((previous || []).map((row) => [String(row.key || ""), row]));
    return rows.map((row) => {
        const old = byKey.get(String(row.key || ""));
        if (mode === "PERCENT") {
            return {
                key: row.key,
                label: row.label,
                percent: row.percent,
                donePercent: Math.min(
                    Number(row.percent) || 0,
                    Math.max(0, Math.floor(Number(old?.donePercent ?? row.donePercent) || 0)),
                ),
                status: clampPartStatus(old?.status ?? row.status, "PENDING"),
            };
        }
        const quantity = Number(row.quantity) || 0;
        return {
            key: row.key,
            label: row.label,
            quantity,
            done: Math.min(quantity, Math.max(0, Math.floor(Number(old?.done ?? row.done) || 0))),
            status: clampPartStatus(old?.status ?? row.status, "PENDING"),
        };
    });
};

const readDeliverables = (value) => {
    if (!Array.isArray(value) || !value.length) fail("Add at least one deliverable with quantity");
    const rows = value.map((row, index) => {
        const label = String(row?.label || "").trim();
        if (!label) fail("Deliverable name is required");
        const quantity = Number(row?.quantity);
        if (!Number.isFinite(quantity) || quantity < 0) fail("Quantity must be 0 or more");
        if (quantity > 500) fail("Quantity cannot be more than 500 per item");
        const done = Math.max(0, Math.floor(Number(row?.done) || 0));
        return {
            key: String(row?.key || slugKey(label, `ITEM_${index + 1}`)).slice(0, 40),
            label: label.slice(0, 80),
            quantity: Math.floor(quantity),
            done: Math.min(Math.floor(quantity), done),
            status: clampPartStatus(row?.status, "PENDING"),
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
        const donePercent = Math.min(100, Math.max(0, Math.floor(Number(row?.donePercent) || 0)));
        return {
            key: String(row?.key || slugKey(label, `PHASE_${index + 1}`)).slice(0, 40),
            label: label.slice(0, 80),
            percent: Math.min(100, Math.floor(percent)),
            donePercent,
            status: clampPartStatus(row?.status, "PENDING"),
        };
    });
    const total = rows.reduce((sum, row) => sum + row.percent, 0);
    if (total <= 0) fail("Phase percents must add up to more than 0");
    if (total > 100) fail("Phase percents cannot exceed 100%");
    return rows;
};

const summarizeWork = (mode, deliverables, phases) => {
    if (mode === "QUANTITY") {
        return (deliverables || [])
            .filter((row) => row.quantity > 0)
            .map((row) => `${row.quantity} ${row.label}`)
            .join(", ");
    }
    return (phases || [])
        .filter((row) => row.percent > 0)
        .map((row) => `${row.label} ${row.percent}%`)
        .join(", ");
};

const normalizePlanBody = (mode, { deliverables, phases }) => {
    if (mode === "QUANTITY") {
        return { deliverables: readDeliverables(deliverables), phases: [] };
    }
    return { deliverables: [], phases: readPhases(phases) };
};

/**
 * Create or replace a work plan for client (+ optional project) + service.
 * Stores deliverables / phases only — no automatic day-wise or round-robin divide.
 */
const upsertWorkPlan = async ({
    clientId,
    projectId = null,
    serviceId,
    serviceName = "",
    mode,
    startDate,
    endDate,
    reportingManager,
    assignees = [],
    deliverables,
    phases,
    createdBy,
}) => {
    const resolvedMode = String(mode || suggestModeFromName(serviceName)).toUpperCase();
    if (!PLAN_MODES.includes(resolvedMode)) fail("Select Quantity or Percent plan mode");

    const start = startOfDay(startDate);
    const end = startOfDay(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) fail("Start date and deadline are required");
    if (end < start) fail("Deadline cannot be before start date");

    const normalized = normalizePlanBody(resolvedMode, { deliverables, phases });
    const summary = summarizeWork(resolvedMode, normalized.deliverables, normalized.phases);

    const filter = projectId
        ? { project: projectId, service: serviceId }
        : { client: clientId, service: serviceId, project: null };

    const existing = await ClientWorkPlan.findOne(filter);
    const deliverablesNext = resolvedMode === "QUANTITY"
        ? mergeProgress(normalized.deliverables, existing?.deliverables || [], "QUANTITY")
        : [];
    const phasesNext = resolvedMode === "PERCENT"
        ? mergeProgress(normalized.phases, existing?.phases || [], "PERCENT")
        : [];

    const payload = {
        client: clientId,
        project: projectId || null,
        service: serviceId,
        mode: resolvedMode,
        startDate: start,
        endDate: end,
        reportingManager,
        assignees,
        deliverables: deliverablesNext,
        phases: phasesNext,
        // No automatic day / person divide — daily work is handled manually.
        slots: [],
        createdBy,
    };

    if (existing) {
        Object.assign(existing, payload);
        await existing.save();
        return { plan: existing, summary, created: false };
    }
    const plan = await ClientWorkPlan.create(payload);
    return { plan, summary, created: true };
};

module.exports = {
    upsertWorkPlan,
    summarizeWork,
    readDeliverables,
    readPhases,
    normalizePlanBody,
    suggestModeFromName,
    mergeProgress,
    clampPartStatus,
    PART_STATUSES,
};
