const mongoose = require("mongoose");

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
const ORIGINS = ["CLIENT", "STAFF"];

const meetRequestSchema = new mongoose.Schema({
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    scheduledAt: { type: Date, required: true, index: true },
    agenda: { type: String, required: true, trim: true, maxlength: 2000 },
    meetLink: { type: String, trim: true, maxlength: 500, default: "" },
    status: { type: String, enum: STATUSES, default: "PENDING", index: true },
    origin: { type: String, enum: ORIGINS, default: "CLIENT" },
    createdByClient: { type: mongoose.Schema.Types.ObjectId, ref: "Client", default: null },
    createdByUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    employees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectReason: { type: String, trim: true, maxlength: 500, default: "" },
}, { timestamps: true });

meetRequestSchema.index({ status: 1, scheduledAt: 1 });
meetRequestSchema.index({ employees: 1, scheduledAt: -1 });

module.exports = mongoose.model("MeetRequest", meetRequestSchema);
module.exports.STATUSES = STATUSES;
module.exports.ORIGINS = ORIGINS;
