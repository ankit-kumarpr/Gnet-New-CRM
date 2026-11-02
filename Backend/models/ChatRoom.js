const mongoose = require("mongoose");

const ROOM_TYPES = ["DM", "GROUP"];
const MEMBER_KINDS = ["USER"];

const avatarSchema = new mongoose.Schema({
    url: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, trim: true },
}, { _id: false });

const memberSchema = new mongoose.Schema({
    refId: { type: mongoose.Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: MEMBER_KINDS, required: true },
    joinedAt: { type: Date, default: Date.now },
}, { _id: false });

const chatRoomSchema = new mongoose.Schema({
    type: { type: String, enum: ROOM_TYPES, required: true },
    name: { type: String, trim: true, maxlength: 120, default: "" },
    avatar: { type: avatarSchema, default: null },
    members: { type: [memberSchema], required: true },
    /** Sorted unique key for DM uniqueness: USER:id|USER:id */
    pairKey: { type: String, default: null, index: true, sparse: true, unique: true },
    createdBy: {
        refId: { type: mongoose.Schema.Types.ObjectId, required: true },
        kind: { type: String, enum: MEMBER_KINDS, required: true },
    },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastMessageText: { type: String, trim: true, maxlength: 500, default: "" },
    lastMessageSenderName: { type: String, trim: true, maxlength: 120, default: "" },
}, { timestamps: true });

chatRoomSchema.index({ "members.refId": 1, "members.kind": 1, lastMessageAt: -1 });
chatRoomSchema.index({ type: 1, name: 1 });

const ChatRoom = mongoose.model("ChatRoom", chatRoomSchema);
ChatRoom.ROOM_TYPES = ROOM_TYPES;
ChatRoom.MEMBER_KINDS = MEMBER_KINDS;
module.exports = ChatRoom;
