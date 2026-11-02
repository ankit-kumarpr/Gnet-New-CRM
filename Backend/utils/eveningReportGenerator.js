const SoftwareSetting = require("../models/SoftwareSetting");

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, "0");

const istParts = (date = new Date()) => {
    const ist = new Date(date.getTime() + IST_OFFSET_MS);
    return {
        y: ist.getUTCFullYear(),
        m: ist.getUTCMonth() + 1,
        d: ist.getUTCDate(),
        hh: ist.getUTCHours(),
        mm: ist.getUTCMinutes(),
        dateKey: `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`,
        minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
    };
};

const parseTimeToMinutes = (value) => {
    const text = String(value || "18:30").trim();
    const match = /^(\d{1,2}):(\d{2})$/.exec(text);
    if (!match) return 18 * 60 + 30;
    const hh = Math.min(23, Math.max(0, Number(match[1])));
    const mm = Math.min(59, Math.max(0, Number(match[2])));
    return hh * 60 + mm;
};

/**
 * Auto work-plan sync removed — evening reports are manual now.
 * Kept as no-op so older callers don't crash.
 */
const syncClientEveningReportDraft = async () => ({
    created: 0,
    updated: 0,
    skipped: true,
    reason: "manual-only",
});

/**
 * Auto bulk generate from work plans removed — reports are created manually.
 */
const generateEveningReportsForDate = async () => ({
    created: 0,
    updated: 0,
    totalClients: 0,
    reports: [],
    skipped: true,
    reason: "manual-only",
});

const loadEveningSettings = async () => {
    let setting = await SoftwareSetting.findOne({ key: "software" });
    if (!setting) setting = await SoftwareSetting.create({ key: "software" });
    return setting;
};

/** Cron auto-generate disabled — reports are filled manually per client. */
const runEveningReportJobIfDue = async () => ({ skipped: true, reason: "manual-only" });

const startEveningReportJob = () => {
    // no-op: evening reports are manual
};

module.exports = {
    syncClientEveningReportDraft,
    generateEveningReportsForDate,
    runEveningReportJobIfDue,
    startEveningReportJob,
    istParts,
    parseTimeToMinutes,
    loadEveningSettings,
};
