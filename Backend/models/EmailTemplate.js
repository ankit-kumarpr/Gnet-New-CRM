const mongoose = require("mongoose");

const emailTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    subject: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    body: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50000,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
}, { timestamps: true });

emailTemplateSchema.index({ name: 1 });
emailTemplateSchema.index({ createdAt: -1 });

module.exports = mongoose.model("EmailTemplate", emailTemplateSchema);
