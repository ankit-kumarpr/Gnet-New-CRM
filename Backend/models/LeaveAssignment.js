const mongoose = require("mongoose");

const leaveAssignmentSchema = new mongoose.Schema({
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
    days: {
        type: Number,
        required: true,
        min: 0,
        max: 365,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
}, { timestamps: true });

leaveAssignmentSchema.index({ employee: 1, leaveType: 1 }, { unique: true });

module.exports = mongoose.model("LeaveAssignment", leaveAssignmentSchema);
