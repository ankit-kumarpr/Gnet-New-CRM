const mongoose = require("mongoose");

const shotSchema = new mongoose.Schema({
    at: { type: Date, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, default: null },
    distanceMeters: { type: Number, required: true },
    photoUrl: { type: String, required: true, trim: true },
    photoPublicId: { type: String, required: true, trim: true },
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    punchIn: { type: shotSchema, default: null },
    punchOut: { type: shotSchema, default: null },
}, { timestamps: true });

attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: -1, user: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
