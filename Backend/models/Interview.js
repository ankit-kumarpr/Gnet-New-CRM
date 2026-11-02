const mongoose = require("mongoose");

const STATUSES = ["SCHEDULED", "NEXT_ROUND", "SELECTED", "NOT_SELECTED"];

const resumeSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 80 },
    url: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, trim: true },
    resourceType: { type: String, default: "raw" },
    format: { type: String, default: "" },
}, { _id: false });

const interviewSchema = new mongoose.Schema({
    candidateName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, maxlength: 120, default: "" },
    role: { type: String, required: true, trim: true, maxlength: 120 },
    round: { type: String, required: true, trim: true, maxlength: 80 },
    interviewDate: { type: Date, required: true },
    status: { type: String, enum: STATUSES, default: "SCHEDULED" },
    interviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, trim: true, maxlength: 2000, default: "" },
    nextRoundDate: { type: Date, default: null },
    resume: { type: resumeSchema, default: null },
    rejectionMailSentAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

interviewSchema.index({ status: 1, interviewDate: 1 });
interviewSchema.index({ interviewer: 1, interviewDate: 1 });

const Interview = mongoose.model("Interview", interviewSchema);
Interview.STATUSES = STATUSES;
module.exports = Interview;
