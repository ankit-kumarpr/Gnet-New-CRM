const mongoose = require("mongoose");

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const STATUSES = ["PENDING", "DONE", "PARTIAL", "HOLD"];

const dailyTaskSchema = new mongoose.Schema({
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    work: { type: String, required: true, trim: true, maxlength: 2000 },
    priority: { type: String, enum: PRIORITIES, default: "MEDIUM" },
    status: { type: String, enum: STATUSES, default: "PENDING" },
    workDone: { type: String, trim: true, maxlength: 2000, default: "" },
    pendingWork: { type: String, trim: true, maxlength: 2000, default: "" },
    remark: { type: String, trim: true, maxlength: 2000, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

dailyTaskSchema.index({ assignee: 1, date: 1 });
dailyTaskSchema.index({ date: 1, status: 1 });
dailyTaskSchema.index({ createdBy: 1 });
dailyTaskSchema.index({ isDeleted: 1, deletedAt: -1 });

const excludeDeleted = function excludeDeleted() {
    if (this.getOptions()?.withDeleted) return;
    this.where({ isDeleted: { $ne: true } });
};

dailyTaskSchema.pre("find", excludeDeleted);
dailyTaskSchema.pre("findOne", excludeDeleted);
dailyTaskSchema.pre("countDocuments", excludeDeleted);
dailyTaskSchema.pre("findOneAndUpdate", excludeDeleted);

const DailyTask = mongoose.model("DailyTask", dailyTaskSchema);
DailyTask.PRIORITIES = PRIORITIES;
DailyTask.STATUSES = STATUSES;
module.exports = DailyTask;
