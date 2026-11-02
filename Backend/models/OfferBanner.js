const mongoose = require("mongoose");

const offerBannerSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            trim: true,
            maxlength: 120,
            default: "",
        },
        subtitle: {
            type: String,
            trim: true,
            maxlength: 240,
            default: "",
        },
        imageUrl: {
            type: String,
            default: "",
        },
        imagePublicId: {
            type: String,
            default: "",
        },
        linkUrl: {
            type: String,
            trim: true,
            maxlength: 500,
            default: "",
        },
        sortOrder: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE"],
            default: "ACTIVE",
        },
        startsAt: {
            type: Date,
            default: null,
        },
        endsAt: {
            type: Date,
            default: null,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true },
);

offerBannerSchema.index({ status: 1, sortOrder: 1, createdAt: -1 });

module.exports = mongoose.model("OfferBanner", offerBannerSchema);
