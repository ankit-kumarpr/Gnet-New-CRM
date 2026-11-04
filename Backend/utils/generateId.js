const Counter = require("../models/Counter");

/**
 * Generates an auto-incremented ID like EMP-000001 or VEN-000001
 * @param {string} prefix - The prefix for the ID (e.g., "EMP", "VEN")
 * @returns {Promise<string>} The generated ID
 */
const generateId = async (prefix) => {
    const ids = await generateIds(prefix, 1);
    return ids[0];
};

/**
 * Reserves `count` IDs in one atomic counter bump (fast for bulk create).
 * @param {string} prefix
 * @param {number} count
 * @returns {Promise<string[]>}
 */
const generateIds = async (prefix, count) => {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (!n) return [];
    const counter = await Counter.findOneAndUpdate(
        { id: prefix },
        { $inc: { seq: n } },
        { new: true, upsert: true }
    );
    const end = counter.seq;
    const start = end - n + 1;
    const ids = [];
    for (let seq = start; seq <= end; seq += 1) {
        ids.push(`${prefix}-${seq.toString().padStart(6, "0")}`);
    }
    return ids;
};

module.exports = generateId;
module.exports.generateIds = generateIds;
