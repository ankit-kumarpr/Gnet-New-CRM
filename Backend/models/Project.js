const mongoose = require("mongoose");

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const STATUSES = ["START", "WORKING", "PENDING", "COMPLETED", "HOLD"];

const serviceAssignmentSchema = new mongoose.Schema({
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    work: { type: String, trim: true, maxlength: 2000, default: "" },
    eod: { type: Date, default: null },
}, { _id: false });

const projectSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 20000, default: "" },
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
    services: [{ type: mongoose.Schema.Types.ObjectId, ref: "Service" }],
    serviceAssignments: [serviceAssignmentSchema],
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    workingEmployees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    priority: { type: String, enum: PRIORITIES, default: "MEDIUM" },
    status: { type: String, enum: STATUSES, default: "START" },
    eod: { type: Date, required: true },
    remark: { type: String, trim: true, maxlength: 2000, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

projectSchema.index({ status: 1, eod: 1 });
projectSchema.index({ priority: 1, eod: 1 });
projectSchema.index({ reportingManager: 1, eod: 1 });
projectSchema.index({ workingEmployees: 1 });
projectSchema.index({ client: 1 });
projectSchema.index({ "serviceAssignments.employee": 1 });
projectSchema.index({ isDeleted: 1, deletedAt: -1 });

const excludeDeleted = function excludeDeleted() {
    if (this.getOptions()?.withDeleted) return;
    this.where({ isDeleted: { $ne: true } });
};

projectSchema.pre("find", excludeDeleted);
projectSchema.pre("findOne", excludeDeleted);
projectSchema.pre("countDocuments", excludeDeleted);
projectSchema.pre("findOneAndUpdate", excludeDeleted);

const Project = mongoose.model("Project", projectSchema);
Project.PRIORITIES = PRIORITIES;
Project.STATUSES = STATUSES;
module.exports = Project;
