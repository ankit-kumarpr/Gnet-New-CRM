const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const clientAddressSchema = new mongoose.Schema({
    street: { type: String, trim: true, maxlength: 200, default: "" },
    city: { type: String, trim: true, maxlength: 80, default: "" },
    state: { type: String, trim: true, maxlength: 80, default: "" },
    pincode: { type: String, trim: true, maxlength: 6, default: "" },
    landmark: { type: String, trim: true, maxlength: 120, default: "" },
}, { _id: false });

const clientSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    clientId: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        uppercase: true,
    },
    password: {
        type: String,
        select: false,
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        sparse: true,
        unique: true,
    },
    phone: {
        type: String,
        required: true,
        trim: true,
    },
    whatsapp: {
        type: String,
        trim: true,
        default: "",
    },
    address: {
        type: clientAddressSchema,
        default: () => ({}),
    },
    remark: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: "",
    },
    /** Optional renewal payment rows (date + amount); unpaid rows notify from 5 days before */
    payments: [{
        date: { type: Date, required: true },
        amount: { type: Number, min: 0, default: null },
        note: { type: String, trim: true, maxlength: 200, default: "" },
        paid: { type: Boolean, default: false },
        paidAt: { type: Date, default: null },
        paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        lastRemindedOn: { type: Date, default: null },
    }],
    services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
    }],
    reportingManager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    permissions: [{ type: String }],
    avatar: {
        url: { type: String, trim: true, default: "" },
        publicId: { type: String, trim: true, default: "" },
    },
    /** Personal notification prefs — if useCustom is false, admin defaults apply */
    notificationPrefs: {
        useCustom: { type: Boolean, default: false },
        soundEnabled: { type: Boolean, default: true },
        toastEnabled: { type: Boolean, default: true },
        ringtoneUrl: { type: String, trim: true, default: "" },
        ringtonePublicId: { type: String, trim: true, default: "" },
        ringtoneName: { type: String, trim: true, maxlength: 120, default: "" },
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    refreshToken: {
        type: String,
        select: false,
        default: null,
    },
}, { timestamps: true });

clientSchema.index({ createdAt: -1 });
clientSchema.index({ reportingManager: 1 });
clientSchema.index({ name: 1 });
clientSchema.index({ phone: 1 });
clientSchema.index({ "payments.date": 1 });

clientSchema.pre("save", async function () {
    if (!this.isModified("password") || !this.password) return;
    if (String(this.password).startsWith("$2")) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

clientSchema.methods.matchPassword = async function (enteredPassword) {
    if (!this.password) return false;
    return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("Client", clientSchema);
