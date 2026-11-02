const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
    // unique: true ensures no two counters share the same prefix (EMP, VEN, etc.)
    // This prevents race conditions on the upsert in generateId
    id:  { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
});

module.exports = mongoose.model("Counter", counterSchema);
