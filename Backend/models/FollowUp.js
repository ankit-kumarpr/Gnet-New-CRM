const mongoose = require("mongoose");
const { STATUSES } = require("./Lead");

const TYPES = ["CALL", "WHATSAPP", "MEETING", "NOTE"];

const followUpSchema = new mongoose.Schema({
    lead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lead",
        required: true,
    },
    type: {
        type: String,
        enum: TYPES,
        required: true,
    },
    remark: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000,
    },
    status: {
        type: String,
        enum: STATUSES,
        required: true,
    },
    nextFollowUpAt: {
        type: Date,
        default: null,
    },
    lostReason: {
        type: String,
        trim: true,
        maxlength: 500,
        default: "",
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
}, { timestamps: true });

followUpSchema.index({ lead: 1, createdAt: -1 });

const FollowUp = mongoose.model("FollowUp", followUpSchema);
FollowUp.TYPES = TYPES;
module.exports = FollowUp;
