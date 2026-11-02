const User = require("../models/User");
const Notification = require("../models/Notification");

const toId = (value) => {
    if (!value) return "";
    return String(value._id || value);
};

/**
 * Create an in-app notification for admins (+ optional people).
 * Actor is included by default so solo admins still see their own events.
 */
const notify = async ({
    type,
    title,
    body = "",
    href = "/dashboard",
    actorId = null,
    extraUserIds = [],
    excludeActor = false,
    meta = {},
}) => {
    try {
        const admins = await User.find({ userType: "ADMIN", status: "ACTIVE" }).select("_id").lean();
        const ids = new Set(admins.map((row) => toId(row)));
        for (const id of extraUserIds) {
            const key = toId(id);
            if (key) ids.add(key);
        }
        if (actorId) ids.add(toId(actorId));
        if (excludeActor && actorId) ids.delete(toId(actorId));

        const audience = [...ids].filter(Boolean);
        if (!audience.length) return null;

        return await Notification.create({
            type,
            title: String(title || "").slice(0, 160),
            body: String(body || "").slice(0, 400),
            href: String(href || "/dashboard").slice(0, 240),
            actor: actorId || null,
            audience,
            readBy: [],
            meta,
        });
    } catch (error) {
        console.error("notify failed:", error.message);
        return null;
    }
};

module.exports = { notify };
