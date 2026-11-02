const mongoose = require("mongoose");

const DURATIONS = ["HALF_DAY", "FULL_DAY", "MULTI_DAY"];
const STATUSES = ["PENDING", "APPROVED", "REJECTED"];

const documentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 80 },
    url: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, trim: true },
    resourceType: { type: String, default: "image" },
    format: { type: String, default: "" },
}, { _id: false });

const leaveRequestSchema = new mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    leaveType: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LeaveType",
        required: true,
    },
    duration: {
        type: String,
        enum: DURATIONS,
        required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true, min: 0.5, max: 365 },
    reason: { type: String, required: true, maxlength: 20000 },
    document: { type: documentSchema, default: null },
    status: {
        type: String,
        enum: STATUSES,
        default: "PENDING",
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, trim: true, maxlength: 500, default: "" },
}, { timestamps: true });

leaveRequestSchema.index({ employee: 1, status: 1, startDate: 1 });
leaveRequestSchema.index({ status: 1, createdAt: -1 });
leaveRequestSchema.index({ status: 1, startDate: 1, endDate: 1 });

const LeaveRequest = mongoose.model("LeaveRequest", leaveRequestSchema);
LeaveRequest.DURATIONS = DURATIONS;
LeaveRequest.STATUSES = STATUSES;
module.exports = LeaveRequest;
