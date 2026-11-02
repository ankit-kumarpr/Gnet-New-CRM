const mongoose = require("mongoose");

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const STATUSES = ["OPEN", "CLOSED", "SOLVED"];

const fileSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 80 },
    url: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, trim: true },
    resourceType: { type: String, default: "image" },
    format: { type: String, default: "" },
}, { _id: false });

const ticketSchema = new mongoose.Schema({
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    content: { type: String, required: true, trim: true, maxlength: 20000 },
    priority: { type: String, enum: PRIORITIES, default: "MEDIUM" },
    status: { type: String, enum: STATUSES, default: "OPEN" },
    file: { type: fileSchema, default: null },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

ticketSchema.index({ raisedBy: 1, updatedAt: -1 });
ticketSchema.index({ status: 1, priority: 1, updatedAt: -1 });

const Ticket = mongoose.model("Ticket", ticketSchema);
Ticket.PRIORITIES = PRIORITIES;
Ticket.STATUSES = STATUSES;
module.exports = Ticket;
