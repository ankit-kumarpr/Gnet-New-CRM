const mongoose = require("mongoose");

const PLAN_MODES = ["QUANTITY", "PERCENT"];
const SLOT_STATUSES = ["PENDING", "DONE", "SKIPPED"];

const deliverableSchema = new mongoose.Schema({
    key: { type: String, required: true, trim: true, maxlength: 40 },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    quantity: { type: Number, min: 0, default: 0 },
}, { _id: false });

const phaseSchema = new mongoose.Schema({
    key: { type: String, required: true, trim: true, maxlength: 40 },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    percent: { type: Number, min: 0, max: 100, default: 0 },
}, { _id: false });

const slotSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    kind: { type: String, required: true, trim: true, maxlength: 40 },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    percentShare: { type: Number, default: 0 },
    status: { type: String, enum: SLOT_STATUSES, default: "PENDING" },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { _id: true });

const clientWorkPlanSchema = new mongoose.Schema({
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    mode: { type: String, enum: PLAN_MODES, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    deliverables: [deliverableSchema],
    phases: [phaseSchema],
    slots: [slotSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

clientWorkPlanSchema.index({ client: 1, service: 1 });
clientWorkPlanSchema.index({ project: 1, service: 1 });
clientWorkPlanSchema.index({ "slots.date": 1 });
clientWorkPlanSchema.index({ "slots.assignee": 1, "slots.date": 1 });
clientWorkPlanSchema.index({ reportingManager: 1, "slots.date": 1 });

module.exports = mongoose.model("ClientWorkPlan", clientWorkPlanSchema);
module.exports.PLAN_MODES = PLAN_MODES;
module.exports.SLOT_STATUSES = SLOT_STATUSES;
