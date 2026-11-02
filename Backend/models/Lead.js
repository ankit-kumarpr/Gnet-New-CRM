const mongoose = require("mongoose");

const SOURCES = ["GMB", "COLD_CALL", "META_ADS", "WEBSITE", "REFERRAL", "OTHER"];
const STATUSES = ["NEW", "CONTACTED", "INTERESTED", "FOLLOW_UP", "PROPOSAL", "CONVERTED", "PAYMENT", "LOST"];

const leadSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    phone: {
        type: String,
        required: true,
        trim: true,
    },
    companyName: {
        type: String,
        trim: true,
        maxlength: 120,
        default: "",
    },
    address: {
        type: String,
        trim: true,
        maxlength: 300,
        default: "",
    },
    source: {
        type: String,
        enum: SOURCES,
        required: true,
    },
    services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
    }],
    remark: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: "",
    },
    status: {
        type: String,
        enum: STATUSES,
        default: "NEW",
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
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
    soldBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    convertedAt: {
        type: Date,
        default: null,
    },
    paymentBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    paymentAt: {
        type: Date,
        default: null,
    },
    amount: {
        type: Number,
        default: 0,
        min: 0,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
}, { timestamps: true });

leadSchema.index({ status: 1, convertedAt: -1 });
leadSchema.index({ status: 1, paymentAt: -1 });
leadSchema.index({ soldBy: 1, status: 1 });
leadSchema.index({ nextFollowUpAt: 1, status: 1 });
leadSchema.index({ assignedTo: 1, nextFollowUpAt: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ createdBy: 1, createdAt: -1 });
leadSchema.index({ name: 1 });
leadSchema.index({ phone: 1 });

const Lead = mongoose.model("Lead", leadSchema);
Lead.SOURCES = SOURCES;
Lead.STATUSES = STATUSES;
module.exports = Lead;
