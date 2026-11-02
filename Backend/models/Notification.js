const mongoose = require("mongoose");

const TYPES = [
    "LEAD_NEW",
    "FOLLOW_UP",
    "FOLLOW_UP_DUE",
    "PROJECT_NEW",
    "PROJECT_PENDING",
    "CLIENT_NEW",
    "CLIENT_PAYMENT_DUE",
    "WORK_PLAN",
    "EMPLOYEE_NEW",
    "EVENING_REPORT",
    "DAILY_TASK_UPDATE",
    "LEAVE_REQUEST",
    "TICKET_NEW",
    "URGENT_WORK",
    "INTERVIEW",
    "MEET_REQUEST",
];

const notificationSchema = new mongoose.Schema({
    type: { type: String, enum: TYPES, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, trim: true, maxlength: 400, default: "" },
    href: { type: String, trim: true, maxlength: 240, default: "/dashboard" },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    audience: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ audience: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
module.exports.TYPES = TYPES;
