const mongoose = require("mongoose");
const ChatRoom = require("../models/ChatRoom");
const ChatMessage = require("../models/ChatMessage");
const User = require("../models/User");
const { uploadChatAvatar, destroyCloudinaryFile } = require("../config/cloudinary");

const fail = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    throw error;
};

const actorOf = (req) => {
    if (req.authKind === "CLIENT" || req.user?.userType === "CLIENT") {
        fail("Chat is only available for staff", 403);
    }
    return {
        refId: req.user._id,
        kind: "USER",
        name: req.user.name || "User",
        userType: req.user.userType || "EMPLOYEE",
    };
};

const memberKey = (kind, id) => `${kind}:${String(id)}`;

const makePairKey = (a, b) => [memberKey(a.kind, a.refId), memberKey(b.kind, b.refId)].sort().join("|");

const isMember = (room, actor) =>
    (room.members || []).some((m) => m.kind === actor.kind && String(m.refId) === String(actor.refId));

const isGroupCreator = (room, actor) =>
    room.createdBy?.kind === actor.kind && String(room.createdBy?.refId) === String(actor.refId);

/** Group creator is admin; company ADMIN can also manage. */
const canManageGroup = (room, actor) =>
    room.type === "GROUP" && (isGroupCreator(room, actor) || actor.userType === "ADMIN");

const emitRoomMembers = (io, room, event, payload) => {
    if (!io || !room) return;
    for (const member of room.members || []) {
        io.to(`user:${member.kind}:${member.refId}`).emit(event, payload);
    }
};

const parseMembers = async (employeeIds = []) => {
    const employees = [...new Set((Array.isArray(employeeIds) ? employeeIds : String(employeeIds || "").split(","))
        .map((id) => String(id || "").trim())
        .filter(Boolean))];

    if (employees.some((id) => !mongoose.Types.ObjectId.isValid(id))) fail("Invalid employee id");

    const users = employees.length
        ? await User.find({ _id: { $in: employees }, userType: { $in: ["ADMIN", "EMPLOYEE"] }, status: "ACTIVE" }).select("_id name").lean()
        : [];
    if (users.length !== employees.length) fail("One or more employees were not found or inactive");

    return users.map((row) => ({ refId: row._id, kind: "USER", name: row.name }));
};

const loadMemberProfiles = async (members) => {
    const userIds = members.filter((m) => m.kind === "USER").map((m) => m.refId);
    const users = userIds.length
        ? await User.find({ _id: { $in: userIds } }).select("name employeeId").lean()
        : [];
    const map = new Map();
    for (const row of users) map.set(`USER:${row._id}`, { ...row, kind: "USER" });
    return map;
};

const presentRoom = (room, actor, profileMap) => {
    const members = (room.members || []).map((m) => {
        const key = memberKey(m.kind, m.refId);
        const profile = profileMap.get(key);
        return {
            refId: m.refId,
            kind: m.kind,
            name: profile?.name || "Unknown",
            code: profile?.employeeId || "",
        };
    });

    let title = room.name;
    let avatarUrl = room.avatar?.url || null;
    if (room.type === "DM") {
        const other = members.find((m) => !(m.kind === actor.kind && String(m.refId) === String(actor.refId))) || members[0];
        title = other?.name || "Chat";
    }

    const membersWithRole = members.map((m) => ({
        ...m,
        isAdmin: room.createdBy?.kind === m.kind && String(room.createdBy?.refId) === String(m.refId),
    }));

    return {
        _id: room._id,
        type: room.type,
        name: room.name || "",
        title,
        avatarUrl,
        members: membersWithRole,
        createdBy: room.createdBy
            ? { refId: room.createdBy.refId, kind: room.createdBy.kind }
            : null,
        lastMessageAt: room.lastMessageAt,
        lastMessageText: room.lastMessageText || "",
        lastMessageSenderName: room.lastMessageSenderName || "",
        createdAt: room.createdAt,
        canManage: canManageGroup(room, actor),
    };
};

const presentMessage = (msg) => ({
    _id: msg._id,
    room: msg.room,
    body: msg.isDeleted ? "" : (msg.body || ""),
    isDeleted: Boolean(msg.isDeleted),
    sender: msg.sender,
    replyTo: msg.replyTo?.messageId
        ? {
            messageId: msg.replyTo.messageId,
            body: msg.replyTo.body || "",
            senderName: msg.replyTo.senderName || "",
        }
        : null,
    createdAt: msg.createdAt,
});

const previewTextForMessage = (body) => {
    const text = String(body || "").trim();
    return text ? text.slice(0, 500) : "";
};

const broadcastMessage = (io, room, data) => {
    if (!io || !room) return;
    io.to(`room:${room._id}`).emit("chat:message", data);
    emitRoomMembers(io, room, "chat:room-updated", {
        roomId: String(room._id),
        lastMessageAt: room.lastMessageAt,
        lastMessageText: room.lastMessageText,
        lastMessageSenderName: room.lastMessageSenderName,
    });
};

const notifyMembersRoomAdded = (io, roomDoc, profileMap, creatorActor) => {
    if (!io || !roomDoc) return;
    const plain = roomDoc.toObject ? roomDoc.toObject() : roomDoc;
    for (const member of plain.members || []) {
        const isCreator = creatorActor
            && member.kind === creatorActor.kind
            && String(member.refId) === String(creatorActor.refId);
        const memberActor = {
            refId: member.refId,
            kind: member.kind,
            userType: isCreator ? creatorActor.userType : "EMPLOYEE",
        };
        io.to(`user:${member.kind}:${member.refId}`).emit(
            "chat:room-added",
            presentRoom(plain, memberActor, profileMap),
        );
    }
};

const listRooms = async (req, res, next) => {
    try {
        const actor = actorOf(req);
        const q = String(req.query.search || "").trim();
        const filter = {
            members: { $elemMatch: { refId: actor.refId, kind: actor.kind } },
        };
        if (q) {
            filter.$or = [
                { name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
                { lastMessageText: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
            ];
        }
        const rooms = await ChatRoom.find(filter).sort({ lastMessageAt: -1 }).limit(100).lean();
        const allMembers = rooms.flatMap((room) => room.members || []);
        const profileMap = await loadMemberProfiles(allMembers);
        let data = rooms.map((room) => presentRoom(room, actor, profileMap));
        if (q) {
            const lower = q.toLowerCase();
            data = data.filter((room) =>
                String(room.title || "").toLowerCase().includes(lower)
                || String(room.name || "").toLowerCase().includes(lower)
                || String(room.lastMessageText || "").toLowerCase().includes(lower)
                || room.members.some((m) => String(m.name || "").toLowerCase().includes(lower)));
        }
        res.status(200).json({ success: true, data });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const searchPeople = async (req, res, next) => {
    try {
        const actor = actorOf(req);
        const q = String(req.query.search || req.query.q || "").trim();
        const filterUser = { userType: { $in: ["ADMIN", "EMPLOYEE"] }, status: "ACTIVE", _id: { $ne: actor.refId } };
        if (q) {
            const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filterUser.$or = [
                { name: { $regex: safe, $options: "i" } },
                { employeeId: { $regex: safe, $options: "i" } },
                { email: { $regex: safe, $options: "i" } },
            ];
        }
        const employees = await User.find(filterUser).select("name employeeId").sort({ name: 1 }).limit(30).lean();
        res.status(200).json({
            success: true,
            data: {
                employees: employees.map((row) => ({ _id: row._id, name: row.name, code: row.employeeId || "", kind: "USER" })),
            },
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const openDm = async (req, res, next) => {
    try {
        const actor = actorOf(req);

        const targetId = String(req.body.userId || "").trim();
        if (!mongoose.Types.ObjectId.isValid(targetId)) fail("Select an employee");
        if (String(targetId) === String(actor.refId)) fail("Cannot chat with yourself");

        const target = await User.findOne({
            _id: targetId,
            userType: { $in: ["ADMIN", "EMPLOYEE"] },
            status: "ACTIVE",
        }).select("_id name").lean();
        if (!target) fail("Employee not found", 404);

        const other = { refId: target._id, kind: "USER" };
        const pairKey = makePairKey(actor, other);
        let room = await ChatRoom.findOne({ type: "DM", pairKey });
        if (!room) {
            room = await ChatRoom.create({
                type: "DM",
                name: "",
                pairKey,
                members: [
                    { refId: actor.refId, kind: actor.kind },
                    { refId: other.refId, kind: other.kind },
                ],
                createdBy: { refId: actor.refId, kind: actor.kind },
                lastMessageAt: new Date(),
            });
        }
        const profileMap = await loadMemberProfiles(room.members);
        res.status(200).json({ success: true, data: presentRoom(room.toObject ? room.toObject() : room, actor, profileMap) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const createGroup = async (req, res, next) => {
    try {
        const actor = actorOf(req);

        const name = String(req.body.name || "").trim();
        if (name.length < 2) fail("Group name must be at least 2 characters");
        if (name.length > 120) fail("Group name is too long");

        let employeeIds = req.body.employees || req.body.employeeIds || [];
        if (typeof employeeIds === "string") {
            try { employeeIds = JSON.parse(employeeIds); } catch { employeeIds = employeeIds.split(","); }
        }

        const people = await parseMembers(employeeIds);
        const memberMap = new Map();
        memberMap.set(memberKey(actor.kind, actor.refId), { refId: actor.refId, kind: actor.kind });
        for (const person of people) {
            memberMap.set(memberKey(person.kind, person.refId), { refId: person.refId, kind: person.kind });
        }
        const members = [...memberMap.values()];
        if (members.length < 2) fail("Add at least one other member");

        let avatar = null;
        if (req.file) {
            const uploaded = await uploadChatAvatar(req.file);
            avatar = { url: uploaded.secure_url, publicId: uploaded.public_id };
        }

        const room = await ChatRoom.create({
            type: "GROUP",
            name,
            avatar,
            members,
            createdBy: { refId: actor.refId, kind: actor.kind },
            lastMessageAt: new Date(),
            lastMessageText: "Group created",
            lastMessageSenderName: actor.name,
        });

        const profileMap = await loadMemberProfiles(members);
        const data = presentRoom(room.toObject(), actor, profileMap);
        notifyMembersRoomAdded(req.app.get("io"), room, profileMap, actor);
        res.status(201).json({ success: true, data });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const updateGroup = async (req, res, next) => {
    try {
        const actor = actorOf(req);
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Invalid group");

        const room = await ChatRoom.findById(req.params.id);
        if (!room || room.type !== "GROUP") fail("Group not found", 404);
        if (!isMember(room, actor)) fail("Not a member of this group", 403);
        if (!canManageGroup(room, actor)) fail("Only the group admin can edit this group", 403);

        if (req.body.name != null) {
            const name = String(req.body.name || "").trim();
            if (name.length < 2) fail("Group name must be at least 2 characters");
            room.name = name.slice(0, 120);
        }

        if (req.body.employees != null || req.body.employeeIds != null) {
            let employeeIds = req.body.employees || req.body.employeeIds || [];
            if (typeof employeeIds === "string") {
                try { employeeIds = JSON.parse(employeeIds); } catch { employeeIds = String(employeeIds).split(","); }
            }
            const people = await parseMembers(employeeIds);
            const memberMap = new Map();
            memberMap.set(memberKey(actor.kind, actor.refId), { refId: actor.refId, kind: actor.kind });
            for (const person of people) {
                memberMap.set(memberKey(person.kind, person.refId), { refId: person.refId, kind: person.kind });
            }
            // Keep creator
            if (room.createdBy?.refId) {
                memberMap.set(memberKey(room.createdBy.kind, room.createdBy.refId), {
                    refId: room.createdBy.refId,
                    kind: room.createdBy.kind,
                });
            }
            room.members = [...memberMap.values()];
            if (room.members.length < 2) fail("Group needs at least 2 members");
        }

        if (req.file) {
            const uploaded = await uploadChatAvatar(req.file);
            if (room.avatar?.publicId) await destroyCloudinaryFile(room.avatar.publicId, "image");
            room.avatar = { url: uploaded.secure_url, publicId: uploaded.public_id };
        }
        if (req.body.removeAvatar === "1" && room.avatar?.publicId) {
            await destroyCloudinaryFile(room.avatar.publicId, "image");
            room.avatar = null;
        }

        await room.save();
        const profileMap = await loadMemberProfiles(room.members);
        const data = presentRoom(room.toObject(), actor, profileMap);
        const io = req.app.get("io");
        if (io) {
            notifyMembersRoomAdded(io, room, profileMap, actor);
            io.to(`room:${room._id}`).emit("chat:group-updated", data);
            emitRoomMembers(io, room, "chat:room-updated", {
                roomId: String(room._id),
                lastMessageAt: room.lastMessageAt,
                lastMessageText: room.lastMessageText,
                lastMessageSenderName: room.lastMessageSenderName,
                name: room.name,
                avatarUrl: room.avatar?.url || null,
            });
        }
        res.status(200).json({ success: true, data });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const removeGroupMember = async (req, res, next) => {
    try {
        const actor = actorOf(req);
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Invalid group");

        const room = await ChatRoom.findById(req.params.id);
        if (!room || room.type !== "GROUP") fail("Group not found", 404);
        if (!canManageGroup(room, actor)) fail("Only the group admin can remove members", 403);

        const kind = String(req.body.kind || "USER").toUpperCase();
        const refId = String(req.body.refId || req.body.userId || "").trim();
        if (kind !== "USER") fail("Member kind must be USER");
        if (!mongoose.Types.ObjectId.isValid(refId)) fail("Invalid member id");

        if (room.createdBy?.kind === kind && String(room.createdBy?.refId) === String(refId)) {
            fail("Cannot remove the group admin");
        }
        if (actor.kind === kind && String(actor.refId) === String(refId)) {
            fail("Use delete group instead of removing yourself as admin");
        }

        const before = room.members.map((m) => ({ kind: m.kind, refId: m.refId }));
        const nextMembers = room.members.filter(
            (m) => !(m.kind === kind && String(m.refId) === String(refId)),
        );
        if (nextMembers.length === room.members.length) fail("Member is not in this group", 404);
        if (nextMembers.length < 2) fail("Group needs at least 2 members");

        room.members = nextMembers;
        room.lastMessageAt = new Date();
        room.lastMessageText = "A member was removed";
        room.lastMessageSenderName = actor.name;
        await room.save();

        const profileMap = await loadMemberProfiles(room.members);
        const data = presentRoom(room.toObject(), actor, profileMap);
        const io = req.app.get("io");
        if (io) {
            io.to(`user:${kind}:${refId}`).emit("chat:removed-from-group", {
                roomId: String(room._id),
                name: room.name,
            });
            emitRoomMembers(io, { members: before }, "chat:room-updated", {
                roomId: String(room._id),
                lastMessageAt: room.lastMessageAt,
                lastMessageText: room.lastMessageText,
                lastMessageSenderName: room.lastMessageSenderName,
            });
            io.to(`room:${room._id}`).emit("chat:group-updated", data);
        }

        res.status(200).json({ success: true, data, message: "Member removed" });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const deleteGroup = async (req, res, next) => {
    try {
        const actor = actorOf(req);
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Invalid group");

        const room = await ChatRoom.findById(req.params.id);
        if (!room || room.type !== "GROUP") fail("Group not found", 404);
        if (!canManageGroup(room, actor)) fail("Only the group admin can delete this group", 403);

        const membersSnapshot = (room.members || []).map((m) => ({ kind: m.kind, refId: m.refId }));
        const roomId = String(room._id);
        const roomName = room.name || "Group";

        if (room.avatar?.publicId) {
            try { await destroyCloudinaryFile(room.avatar.publicId, "image"); } catch { /* ignore */ }
        }

        await ChatMessage.deleteMany({ room: room._id });
        await ChatRoom.deleteOne({ _id: room._id });

        const io = req.app.get("io");
        if (io) {
            emitRoomMembers(io, { members: membersSnapshot }, "chat:group-deleted", {
                roomId,
                name: roomName,
            });
        }

        res.status(200).json({ success: true, message: "Group deleted" });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const getRoom = async (req, res, next) => {
    try {
        const actor = actorOf(req);
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Invalid room");
        const room = await ChatRoom.findById(req.params.id).lean();
        if (!room) fail("Chat not found", 404);
        if (!isMember(room, actor)) fail("Not a member of this chat", 403);
        const profileMap = await loadMemberProfiles(room.members);
        res.status(200).json({ success: true, data: presentRoom(room, actor, profileMap) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const listMessages = async (req, res, next) => {
    try {
        const actor = actorOf(req);
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Invalid room");
        const room = await ChatRoom.findById(req.params.id).select("members").lean();
        if (!room) fail("Chat not found", 404);
        if (!isMember(room, actor)) fail("Not a member of this chat", 403);

        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 40, 1), 100);
        const filter = { room: room._id };
        if (req.query.before && mongoose.Types.ObjectId.isValid(req.query.before)) {
            const pivot = await ChatMessage.findById(req.query.before).select("createdAt").lean();
            if (pivot) filter.createdAt = { $lt: pivot.createdAt };
        }

        const rows = await ChatMessage.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
        res.status(200).json({
            success: true,
            data: rows.reverse().map(presentMessage),
            hasMore: rows.length === limit,
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const createMessage = async (req, res, next) => {
    try {
        const actor = actorOf(req);
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Invalid room");
        const body = String(req.body.body || "").trim();
        if (body.length > 4000) fail("Message is too long");

        const room = await ChatRoom.findById(req.params.id);
        if (!room) fail("Chat not found", 404);
        if (!isMember(room, actor)) fail("Not a member of this chat", 403);

        if (!body) fail("Message cannot be empty");

        let replyTo = { messageId: null, body: "", senderName: "" };
        const replyId = String(req.body.replyTo || req.body.replyToId || "").trim();
        if (replyId) {
            if (!mongoose.Types.ObjectId.isValid(replyId)) fail("Invalid reply message");
            const parent = await ChatMessage.findOne({ _id: replyId, room: room._id }).lean();
            if (!parent || parent.isDeleted) fail("Reply message not found", 404);
            replyTo = {
                messageId: parent._id,
                body: String(parent.body || "").slice(0, 500),
                senderName: parent.sender?.name || "",
            };
        }

        const msg = await ChatMessage.create({
            room: room._id,
            sender: { refId: actor.refId, kind: actor.kind, name: actor.name },
            body,
            replyTo,
        });

        room.lastMessageAt = msg.createdAt;
        room.lastMessageText = previewTextForMessage(body);
        room.lastMessageSenderName = actor.name;
        await room.save();

        const data = presentMessage(msg.toObject());
        broadcastMessage(req.app.get("io"), room, data);

        res.status(201).json({ success: true, data });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

module.exports = {
    listRooms,
    searchPeople,
    openDm,
    createGroup,
    updateGroup,
    removeGroupMember,
    deleteGroup,
    getRoom,
    listMessages,
    createMessage,
    actorOf,
    isMember,
    presentMessage,
};
