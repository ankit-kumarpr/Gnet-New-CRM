const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ChatRoom = require("../models/ChatRoom");
const ChatMessage = require("../models/ChatMessage");
const { presentMessage } = require("../controllers/chat.controller");

const loadSocketActor = async (token) => {
    if (!token) return null;
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch {
        return null;
    }
    if (decoded.kind === "CLIENT") return null;
    const user = await User.findById(decoded.id).select("name status userType").lean();
    if (!user || user.status === "BLOCKED" || user.status === "INACTIVE") return null;
    return { refId: user._id, kind: "USER", name: user.name, userType: user.userType };
};

const isMember = (room, actor) =>
    (room.members || []).some((m) => m.kind === actor.kind && String(m.refId) === String(actor.refId));

const attachChatSocket = (io) => {
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.query?.token;
            const actor = await loadSocketActor(token);
            if (!actor) return next(new Error("Unauthorized"));
            socket.actor = actor;
            next();
        } catch (error) {
            next(error);
        }
    });

    io.on("connection", (socket) => {
        const actor = socket.actor;
        socket.join(`user:${actor.kind}:${actor.refId}`);

        socket.on("chat:join", async (roomId, ack) => {
            try {
                if (!roomId) throw new Error("Room required");
                const room = await ChatRoom.findById(roomId).select("members").lean();
                if (!room || !isMember(room, actor)) throw new Error("Forbidden");
                socket.join(`room:${roomId}`);
                if (typeof ack === "function") ack({ ok: true });
            } catch (error) {
                if (typeof ack === "function") ack({ ok: false, message: error.message });
            }
        });

        socket.on("chat:leave", (roomId) => {
            if (roomId) socket.leave(`room:${roomId}`);
        });

        socket.on("chat:typing", async ({ roomId, typing }) => {
            try {
                if (!roomId) return;
                const room = await ChatRoom.findById(roomId).select("members").lean();
                if (!room || !isMember(room, actor)) return;
                socket.to(`room:${roomId}`).emit("chat:typing", {
                    roomId: String(roomId),
                    name: actor.name,
                    typing: Boolean(typing),
                    actor: { refId: actor.refId, kind: actor.kind },
                });
            } catch {
                // ignore
            }
        });

        socket.on("chat:send", async (payload, ack) => {
            try {
                const roomId = payload?.roomId;
                const body = String(payload?.body || "").trim();
                if (!roomId || !body) throw new Error("Message required");
                if (body.length > 4000) throw new Error("Message too long");

                const room = await ChatRoom.findById(roomId);
                if (!room || !isMember(room, actor)) throw new Error("Forbidden");

                let replyTo = { messageId: null, body: "", senderName: "" };
                const replyId = String(payload?.replyTo || "").trim();
                if (replyId) {
                    const parent = await ChatMessage.findOne({ _id: replyId, room: room._id }).lean();
                    if (parent && !parent.isDeleted) {
                        replyTo = {
                            messageId: parent._id,
                            body: String(parent.body || "").slice(0, 500),
                            senderName: parent.sender?.name || "",
                        };
                    }
                }

                const msg = await ChatMessage.create({
                    room: room._id,
                    sender: { refId: actor.refId, kind: actor.kind, name: actor.name },
                    body,
                    replyTo,
                });
                room.lastMessageAt = msg.createdAt;
                room.lastMessageText = body.slice(0, 500);
                room.lastMessageSenderName = actor.name;
                await room.save();

                const data = presentMessage(msg.toObject());
                io.to(`room:${room._id}`).emit("chat:message", data);
                for (const member of room.members || []) {
                    io.to(`user:${member.kind}:${member.refId}`).emit("chat:room-updated", {
                        roomId: String(room._id),
                        lastMessageAt: room.lastMessageAt,
                        lastMessageText: room.lastMessageText,
                        lastMessageSenderName: room.lastMessageSenderName,
                    });
                }
                if (typeof ack === "function") ack({ ok: true, data });
            } catch (error) {
                if (typeof ack === "function") ack({ ok: false, message: error.message || "Send failed" });
            }
        });
    });
};

module.exports = { attachChatSocket };
