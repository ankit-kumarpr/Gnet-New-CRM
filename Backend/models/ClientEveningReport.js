const mongoose = require("mongoose");

const STATUSES = ["DRAFT", "LOCKED", "APPROVED"];

const workItemSchema = new mongoose.Schema({
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "ClientWorkPlan", default: null },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    projectName: { type: String, trim: true, maxlength: 120, default: "" },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", default: null },
    serviceName: { type: String, trim: true, maxlength: 120, default: "" },
    slotId: { type: String, trim: true, default: "" },
    label: { type: String, trim: true, maxlength: 120, default: "" },
    kind: { type: String, trim: true, maxlength: 40, default: "" },
    status: { type: String, trim: true, maxlength: 20, default: "PENDING" },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assigneeName: { type: String, trim: true, maxlength: 120, default: "" },
}, { _id: false });

const feedbackSchema = new mongoose.Schema({
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    authorName: { type: String, trim: true, maxlength: 120, default: "" },
    authorKind: { type: String, enum: ["ADMIN", "EMPLOYEE", "CLIENT", "SYSTEM"], default: "EMPLOYEE" },
}, { timestamps: { createdAt: true, updatedAt: false } });

const clientEveningReportSchema = new mongoose.Schema({
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    date: { type: Date, required: true, index: true },
    status: { type: String, enum: STATUSES, default: "DRAFT", index: true },
    items: { type: [workItemSchema], default: [] },
    notes: { type: String, trim: true, maxlength: 50000, default: "" },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    contributors: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    generatedAt: { type: Date, default: null },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    feedback: { type: [feedbackSchema], default: [] },
}, { timestamps: true });

clientEveningReportSchema.index({ client: 1, date: 1 }, { unique: true });
clientEveningReportSchema.index({ status: 1, date: -1 });
clientEveningReportSchema.index({ approvedAt: -1 });

module.exports = mongoose.model("ClientEveningReport", clientEveningReportSchema);
module.exports.STATUSES = STATUSES;
