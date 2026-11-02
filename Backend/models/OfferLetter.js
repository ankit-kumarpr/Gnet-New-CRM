const mongoose = require("mongoose");

const offerLetterSchema = new mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },
    refNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    prefix: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    sequence: { type: Number, required: true },
    sentAt: { type: Date, default: null },
    sentTo: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

module.exports = mongoose.model("OfferLetter", offerLetterSchema);
