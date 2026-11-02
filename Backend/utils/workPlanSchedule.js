/** Working days Mon–Sat (Sunday skipped). */

const startOfDay = (value) => {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const [year, month, day] = value.slice(0, 10).split("-").map(Number);
        return new Date(year, month - 1, day);
    }
    const d = new Date(value);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const addDays = (date, n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
};

const isSunday = (date) => date.getDay() === 0;

const workingDaysBetween = (start, end) => {
    const from = startOfDay(start);
    const to = startOfDay(end);
    if (to < from) return [];
    const days = [];
    for (let cursor = new Date(from); cursor <= to; cursor = addDays(cursor, 1)) {
        if (!isSunday(cursor)) days.push(new Date(cursor));
    }
    return days;
};

/** Round-robin mix so reels/posts/carousels alternate instead of dumping one type first. */
const interleaveDeliverables = (deliverables) => {
    const piles = deliverables.map((row) => ({
        key: row.key,
        label: row.label,
        left: Math.max(0, Number(row.quantity) || 0),
    })).filter((row) => row.left > 0);

    const items = [];
    while (piles.some((row) => row.left > 0)) {
        for (const pile of piles) {
            if (pile.left <= 0) continue;
            items.push({ key: pile.key, label: pile.label });
            pile.left -= 1;
        }
    }
    return items;
};

const distributeOntoDays = (items, days) => {
    if (!items.length || !days.length) return [];
    const slots = [];
    for (let i = 0; i < items.length; i += 1) {
        const dayIndex = Math.min(
            days.length - 1,
            Math.floor((i * days.length) / items.length),
        );
        slots.push({
            date: days[dayIndex],
            kind: items[i].key,
            label: items[i].label,
            percentShare: 0,
            status: "PENDING",
            note: "",
            assignee: null,
        });
    }
    return slots;
};

const buildQuantitySlots = ({ startDate, endDate, deliverables }) => {
    const days = workingDaysBetween(startDate, endDate);
    const items = interleaveDeliverables(deliverables || []);
    return { days, slots: distributeOntoDays(items, days) };
};

const buildPercentSlots = ({ startDate, endDate, phases }) => {
    const days = workingDaysBetween(startDate, endDate);
    if (!days.length) return { days, slots: [] };

    const clean = (phases || [])
        .map((row) => ({
            key: row.key,
            label: row.label,
            percent: Math.max(0, Number(row.percent) || 0),
        }))
        .filter((row) => row.percent > 0);

    const totalPct = clean.reduce((sum, row) => sum + row.percent, 0) || 100;
    const slots = [];
    let cursor = 0;

    clean.forEach((phase, phaseIndex) => {
        const share = phase.percent / totalPct;
        let count = Math.round(share * days.length);
        if (phaseIndex === clean.length - 1) {
            count = Math.max(0, days.length - cursor);
        }
        if (cursor + count > days.length) count = days.length - cursor;
        for (let i = 0; i < count; i += 1) {
            slots.push({
                date: days[cursor + i],
                kind: phase.key,
                label: phase.label,
                percentShare: phase.percent,
                status: "PENDING",
                note: "",
                assignee: null,
            });
        }
        cursor += count;
    });

    // Fill any leftover days with last phase
    while (cursor < days.length && clean.length) {
        const last = clean[clean.length - 1];
        slots.push({
            date: days[cursor],
            kind: last.key,
            label: last.label,
            percentShare: last.percent,
            status: "PENDING",
            note: "",
            assignee: null,
        });
        cursor += 1;
    }

    return { days, slots };
};

const suggestModeFromName = (name = "") => {
    const text = String(name).toLowerCase();
    if (/seo|search\s*engine/.test(text)) return "PERCENT";
    if (/web|site|develop|app/.test(text)) return "PERCENT";
    if (/graph|social|smm|content|creative|design|post|reel/.test(text)) return "QUANTITY";
    return "QUANTITY";
};

const defaultDeliverables = () => ([
    { key: "REEL", label: "Reel", quantity: 0 },
    { key: "POST", label: "Post", quantity: 0 },
    { key: "CAROUSEL", label: "Carousel", quantity: 0 },
]);

const defaultPhases = (modeHint = "") => {
    if (/seo/.test(String(modeHint).toLowerCase())) {
        return [
            { key: "AUDIT", label: "Audit & research", percent: 20 },
            { key: "ONPAGE", label: "On-page SEO", percent: 40 },
            { key: "OFFPAGE", label: "Off-page / links", percent: 25 },
            { key: "REPORT", label: "Reporting", percent: 15 },
        ];
    }
    return [
        { key: "DESIGN", label: "Design", percent: 20 },
        { key: "DEVELOP", label: "Development", percent: 50 },
        { key: "CONTENT", label: "Content", percent: 15 },
        { key: "QA", label: "QA & launch", percent: 15 },
    ];
};

module.exports = {
    workingDaysBetween,
    buildQuantitySlots,
    buildPercentSlots,
    suggestModeFromName,
    defaultDeliverables,
    defaultPhases,
    startOfDay,
    addDays,
};
