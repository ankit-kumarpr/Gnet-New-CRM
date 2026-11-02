const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const SoftwareSetting = require("../models/SoftwareSetting");
const User = require("../models/User");
const { uploadAttendancePhoto, destroyCloudinaryFile } = require("../config/cloudinary");
const { permissionGranted } = require("../utils/permissions");

const fail = (message) => {
    const error = new Error(message);
    error.status = 400;
    throw error;
};

const parsePagination = (page, limit) => {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
};

const readDay = (value, label) => {
    const text = String(value || "").trim();
    if (!text) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) fail(`${label} must be a valid date`);
    const date = new Date(`${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) fail(`${label} must be a valid date`);
    return date;
};

const dayQuery = (from, to) => {
    const start = readDay(from, "From date");
    const end = readDay(to, "To date");
    if (start && end && start > end) fail("From date cannot be after to date");
    if (!start && !end) return null;
    const query = {};
    if (start) query.$gte = start;
    if (end) {
        const next = new Date(end);
        next.setDate(next.getDate() + 1);
        query.$lt = next;
    }
    return query;
};

const todayKey = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const distanceMeters = (lat1, lon1, lat2, lon2) => {
    const earth = 6371000;
    const toRad = (value) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * earth * Math.asin(Math.min(1, Math.sqrt(a)));
};

const hoursLabel = (start, end) => {
    if (!start || !end) return "—";
    const minutes = Math.max(0, Math.round((new Date(end) - new Date(start)) / 60000));
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const isImage = (buffer) => {
    if (!buffer || buffer.length < 4096) return false;
    const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const png = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const webp = buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
    return jpeg || png || webp;
};

const officeOf = (setting) => {
    const latitude = setting?.officeLatitude;
    const longitude = setting?.officeLongitude;
    const ready = Number.isFinite(latitude) && Number.isFinite(longitude);
    const radius = Number.isFinite(setting?.officeRadiusMeters) ? setting.officeRadiusMeters : 20;
    return { ready, latitude, longitude, radius };
};

const loadOffice = async () => officeOf(await SoftwareSetting.findOne({ key: "software" }).select("officeLatitude officeLongitude officeRadiusMeters").lean());

const presentShot = (shot) => {
    if (!shot?.at) return null;
    return {
        at: shot.at,
        accuracy: Number.isFinite(shot.accuracy) ? Math.round(shot.accuracy) : null,
        distanceMeters: Math.round(shot.distanceMeters),
        photoUrl: shot.photoUrl || "",
    };
};

const presentRow = (doc) => ({
    _id: doc._id,
    date: doc.date,
    user: doc.user && doc.user.name ? {
        _id: doc.user._id,
        name: doc.user.name,
        employeeId: doc.user.employeeId || "",
        designation: doc.user.designation?.name || "",
    } : null,
    punchIn: presentShot(doc.punchIn),
    punchOut: presentShot(doc.punchOut),
    hours: hoursLabel(doc.punchIn?.at, doc.punchOut?.at),
});

const canSeeAllAttendance = (user) =>
    permissionGranted(user, ["VIEW_ALL_ATTENDANCE", "MANAGE_ATTENDANCE"]);

const canSeeTeamAttendance = (user) =>
    canSeeAllAttendance(user) || permissionGranted(user, ["VIEW_TEAM_ATTENDANCE"]);

const canAccessAttendance = (user) =>
    permissionGranted(user, [
        "VIEW_ATTENDANCE",
        "PUNCH_ATTENDANCE",
        "VIEW_TEAM_ATTENDANCE",
        "VIEW_ALL_ATTENDANCE",
        "VIEW_ATTENDANCE_REPORT",
        "MANAGE_ATTENDANCE",
    ]);

const loadTeamUserIds = async (managerId) => {
    const ids = new Set([String(managerId)]);
    let frontier = [managerId];
    while (frontier.length) {
        const children = await User.find({
            reportingManager: { $in: frontier },
            userType: { $in: ["ADMIN", "EMPLOYEE"] },
        })
            .select("_id")
            .lean();
        frontier = [];
        for (const child of children) {
            const id = String(child._id);
            if (!ids.has(id)) {
                ids.add(id);
                frontier.push(child._id);
            }
        }
    }
    return [...ids].map((id) => new mongoose.Types.ObjectId(id));
};

const resolveAttendanceScope = (user, query) => {
    const asked = String(query.scope || "").trim().toLowerCase();
    if (asked === "mine") return "mine";
    if (canSeeAllAttendance(user) && asked !== "team") return "all";
    if (canSeeTeamAttendance(user)) return "team";
    return "mine";
};

const buildFilter = async (user, query) => {
    const filter = {};
    const scope = resolveAttendanceScope(user, query);

    if (scope === "mine") {
        filter.user = user._id;
    } else if (scope === "team") {
        filter.user = { $in: await loadTeamUserIds(user._id) };
        if (query.employee) {
            const text = String(query.employee).trim();
            if (!mongoose.Types.ObjectId.isValid(text)) fail("Employee is not valid");
            const teamIds = new Set((await loadTeamUserIds(user._id)).map(String));
            if (!teamIds.has(text)) fail("You can only open attendance for your team", 403);
            filter.user = new mongoose.Types.ObjectId(text);
        }
    } else if (query.employee) {
        const text = String(query.employee).trim();
        if (!mongoose.Types.ObjectId.isValid(text)) fail("Employee is not valid");
        filter.user = new mongoose.Types.ObjectId(text);
    }

    const range = dayQuery(query.from, query.to);
    if (range) filter.date = range;
    const status = String(query.status || "").trim();
    if (status && !["open", "complete"].includes(status)) fail("Punch filter is not valid");
    if (status === "open") filter["punchOut.at"] = null;
    if (status === "complete") filter["punchOut.at"] = { $ne: null };
    return { filter, scope };
};

const queryAttendance = async (user, query, skip, limitNum) => {
    const { filter, scope } = await buildFilter(user, query);
    const [total, rows, grouped] = await Promise.all([
        Attendance.countDocuments(filter),
        Attendance.find(filter)
            .select("user date punchIn.at punchIn.accuracy punchIn.distanceMeters punchIn.photoUrl punchOut.at punchOut.accuracy punchOut.distanceMeters punchOut.photoUrl")
            .populate({ path: "user", select: "name employeeId designation", populate: { path: "designation", select: "name" } })
            .sort({ date: -1, createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Attendance.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    records: { $sum: 1 },
                    complete: { $sum: { $cond: [{ $ifNull: ["$punchOut.at", false] }, 1, 0] } },
                },
            },
        ]),
    ]);
    const records = grouped[0]?.records || 0;
    const complete = grouped[0]?.complete || 0;
    return {
        rows: rows.map(presentRow),
        total,
        summary: { records, complete, open: records - complete },
        seesAll: scope === "all",
        scope,
    };
};

const getAttendance = async (req, res, next) => {
    try {
        if (!canAccessAttendance(req.user)) {
            return res.status(403).json({ success: false, message: "You do not have attendance access" });
        }
        const { pageNum, limitNum, skip } = parsePagination(req.query.page, req.query.limit);
        const [office, report, today] = await Promise.all([
            loadOffice(),
            queryAttendance(req.user, req.query, skip, limitNum),
            Attendance.findOne({ user: req.user._id, date: todayKey() })
                .select("date punchIn.at punchIn.accuracy punchIn.distanceMeters punchIn.photoUrl punchOut.at punchOut.accuracy punchOut.distanceMeters punchOut.photoUrl")
                .lean(),
        ]);
        res.status(200).json({
            success: true,
            officeReady: office.ready,
            radiusMeters: office.radius,
            seesAll: report.seesAll,
            scope: report.scope,
            today: today ? presentRow(today) : null,
            summary: report.summary,
            data: report.rows,
            pagination: {
                total: report.total,
                page: pageNum,
                pages: Math.ceil(report.total / limitNum) || 1,
                limit: limitNum,
            },
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const attendanceEmployees = async (req, res, next) => {
    try {
        if (!canSeeTeamAttendance(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot open team attendance" });
        }
        let filter = { userType: { $in: ["ADMIN", "EMPLOYEE"] } };
        if (!canSeeAllAttendance(req.user)) {
            const teamIds = await loadTeamUserIds(req.user._id);
            filter = { _id: { $in: teamIds }, userType: { $in: ["ADMIN", "EMPLOYEE"] } };
        }
        const people = await User.find(filter)
            .select("name")
            .sort({ name: 1 })
            .limit(500)
            .lean();
        res.status(200).json({ success: true, data: people });
    } catch (error) {
        next(error);
    }
};

const readPoint = (body) => {
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const accuracy = Number(body.accuracy);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) fail("Location latitude is not valid");
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) fail("Location longitude is not valid");
    return { latitude, longitude, accuracy: Number.isFinite(accuracy) && accuracy > 0 ? accuracy : null };
};

const punchAttendance = async (req, res, next) => {
    let uploaded = null;
    try {
        if (!permissionGranted(req.user, ["PUNCH_ATTENDANCE", "MANAGE_ATTENDANCE"])) {
            return res.status(403).json({ success: false, message: "You do not have punch permission" });
        }
        const action = String(req.body?.action || "").trim();
        if (!["in", "out"].includes(action)) fail("Choose punch in or punch out");
        if (!req.file) fail("Take a photo to punch");
        if (!isImage(req.file.buffer)) fail("Punch photo must be a real jpg, png, or webp image");

        const point = readPoint(req.body || {});
        const office = await loadOffice();
        if (!office.ready) fail("Office location is not set yet. Ask an admin to save it in Settings");
        const distance = distanceMeters(point.latitude, point.longitude, office.latitude, office.longitude);
        if (distance > office.radius) {
            fail(`You are ${Math.round(distance)} m from the office. Punch works inside ${office.radius} m`);
        }

        const result = await uploadAttendancePhoto(req.file);
        uploaded = { id: result.public_id, url: result.secure_url };
        if (!uploaded.url || !uploaded.id) fail("Could not save the punch photo");

        const shot = {
            at: new Date(),
            latitude: point.latitude,
            longitude: point.longitude,
            accuracy: point.accuracy,
            distanceMeters: Math.round(distance),
            photoUrl: uploaded.url,
            photoPublicId: uploaded.id,
        };
        const date = todayKey();
        let saved = null;

        if (action === "in") {
            try {
                saved = await Attendance.create({ user: req.user._id, date, punchIn: shot });
            } catch (error) {
                if (error.code === 11000) fail("You already punched in today");
                throw error;
            }
        } else {
            saved = await Attendance.findOneAndUpdate(
                { user: req.user._id, date, "punchIn.at": { $ne: null }, "punchOut.at": null },
                { $set: { punchOut: shot } },
                { returnDocument: "after" }
            );
            if (!saved) {
                const existing = await Attendance.findOne({ user: req.user._id, date }).select("punchOut.at").lean();
                fail(existing?.punchOut?.at ? "You already punched out today" : "Punch in before punch out");
            }
        }

        uploaded = null;
        res.status(200).json({
            success: true,
            message: action === "in" ? "Punched in" : "Punched out",
            data: presentRow(saved),
        });
    } catch (error) {
        if (uploaded?.id) await destroyCloudinaryFile(uploaded.id, "image");
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

module.exports = { getAttendance, punchAttendance, attendanceEmployees, queryAttendance };
