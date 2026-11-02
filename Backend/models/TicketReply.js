const mongoose = require("mongoose");

const ticketReplySchema = new mongoose.Schema({
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket", required: true },
    message: { type: String, required: true, trim: true, maxlength: 20000 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

ticketReplySchema.index({ ticket: 1, createdAt: 1 });

module.exports = mongoose.model("TicketReply", ticketReplySchema);
