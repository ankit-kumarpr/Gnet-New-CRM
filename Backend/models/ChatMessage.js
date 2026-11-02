const mongoose = require("mongoose");
const { MEMBER_KINDS } = require("./ChatRoom");

const chatMessageSchema = new mongoose.Schema({
    room: { type: mongoose.Schema.Types.ObjectId, ref: "ChatRoom", required: true, index: true },
    sender: {
        refId: { type: mongoose.Schema.Types.ObjectId, required: true },
        kind: { type: String, enum: MEMBER_KINDS, required: true },
        name: { type: String, required: true, trim: true, maxlength: 120 },
    },
    body: { type: String, trim: true, maxlength: 4000, default: "" },
    replyTo: {
        messageId: { type: mongoose.Schema.Types.ObjectId, default: null },
        body: { type: String, trim: true, maxlength: 500, default: "" },
        senderName: { type: String, trim: true, maxlength: 120, default: "" },
    },
    isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

chatMessageSchema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
