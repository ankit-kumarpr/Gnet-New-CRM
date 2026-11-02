const mongoose = require("mongoose");

const softwareSettingSchema = new mongoose.Schema({
    key: {
        type: String,
        default: "software",
        unique: true,
    },
    companyName: {
        type: String,
        trim: true,
        maxlength: 120,
        default: "",
    },
    logoUrl: {
        type: String,
        trim: true,
        default: "",
    },
    logoPublicId: {
        type: String,
        trim: true,
        default: "",
    },
    companyAddress: { type: String, trim: true, maxlength: 300, default: "" },
    companyPhone: { type: String, trim: true, maxlength: 20, default: "" },
    companyEmail: { type: String, trim: true, maxlength: 120, default: "" },
    companyWebsite: { type: String, trim: true, maxlength: 160, default: "" },
    offerPrefix: { type: String, trim: true, maxlength: 8, default: "" },
    probationPeriod: { type: String, trim: true, maxlength: 40, default: "" },
    workingHours: { type: String, trim: true, maxlength: 80, default: "" },
    signatoryName: { type: String, trim: true, maxlength: 80, default: "" },
    signatoryTitle: { type: String, trim: true, maxlength: 80, default: "" },
    officeLatitude: { type: Number, default: null },
    officeLongitude: { type: Number, default: null },
    officeRadiusMeters: { type: Number, default: 20 },
    /** Company-wide notification defaults (used when user has no personal prefs) */
    notificationDefaults: {
        soundEnabled: { type: Boolean, default: true },
        toastEnabled: { type: Boolean, default: true },
        ringtoneUrl: { type: String, trim: true, default: "" },
        ringtonePublicId: { type: String, trim: true, default: "" },
        ringtoneName: { type: String, trim: true, maxlength: 120, default: "" },
    },
    /** Auto evening client reports (HH:mm, Asia/Kolkata) */
    eveningReportEnabled: { type: Boolean, default: true },
    eveningReportTime: { type: String, trim: true, maxlength: 5, default: "18:30" },
    lastEveningReportRunDate: { type: String, trim: true, default: "" },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
}, { timestamps: true });

module.exports = mongoose.model("SoftwareSetting", softwareSettingSchema);
