const Counter = require("../models/Counter");

/**
 * Generates an auto-incremented ID like EMP-000001 or VEN-000001
 * @param {string} prefix - The prefix for the ID (e.g., "EMP", "VEN")
 * @returns {Promise<string>} The generated ID
 */
const generateId = async (prefix) => {
    // findOneAndUpdate with $inc is atomic and safe for concurrent requests
    const counter = await Counter.findOneAndUpdate(
        { id: prefix },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    
    // Pad the sequence with leading zeros (e.g., 000001)
    const formattedSeq = counter.seq.toString().padStart(6, '0');
    return `${prefix}-${formattedSeq}`;
};

module.exports = generateId;
