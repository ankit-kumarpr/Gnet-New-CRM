const mongoose = require("mongoose");
const LeaveRequest = require("../models/LeaveRequest");
const { DURATIONS, STATUSES } = require("../models/LeaveRequest");
const LeaveAssignment = require("../models/LeaveAssignment");
const LeaveType = require("../models/LeaveType");
const User = require("../models/User");
const { uploadLeaveFile, destroyCloudinaryFile } = require("../config/cloudinary");

const fail = (message) => {
    const error = new Error(message);
    error.status = 400;
    throw error;
};

const { permissionGranted } = require("../utils/permissions");

const canApprove = (user) => permissionGranted(user, ["APPROVE_LEAVE"]);

const sameId = (left, right) => String(left?._id || left || "") === String(right?._id || right || "");

const readDay = (value, label) => {
    const text = String(value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) fail(`${label} is required`);
    const date = new Date(`${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) fail(`${label} is not a valid date`);
    return date;
};

const dayCount = (start, end) => Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

const cleanReason = (value) => {
    const text = String(value || "")
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
        .replace(/\son\w+=("[^"]*"|'[^']*')/gi, "")
        .trim();
    const plain = text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    if (plain.length < 2) fail("Write a reason for this leave");
    if (text.length > 20000) fail("Reason is too long");
    return text;
};

const readSpan = (body) => {
    if (!DURATIONS.includes(body.duration)) fail("Select full day, half day, or multi day");
    if (body.duration === "MULTI_DAY") {
        const startDate = readDay(body.startDate, "Start date");
        const endDate = readDay(body.endDate, "End date");
        if (endDate < startDate) fail("End date cannot be before the start date");
        const days = dayCount(startDate, endDate);
        if (days > 365) fail("Leave cannot be longer than 365 days");
        return { duration: body.duration, startDate, endDate, days };
    }
    const date = readDay(body.date || body.startDate, "Date");
    return {
        duration: body.duration,
        startDate: date,
        endDate: date,
        days: body.duration === "HALF_DAY" ? 0.5 : 1,
    };
};

const presentDocument = (document) => {
    if (!document?.url) return null;
    return { name: document.name, url: document.url };
};

const present = (row) => ({
    _id: row._id,
    employee: row.employee,
    leaveType: row.leaveType,
    duration: row.duration,
    startDate: row.startDate,
    endDate: row.endDate,
    days: row.days,
    reason: row.reason,
    document: presentDocument(row.document),
    status: row.status,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    reviewNote: row.reviewNote || "",
    createdAt: row.createdAt,
});

const populateRow = (query) => query
    .populate("leaveType", "name")
    .populate("employee", "name employeeId")
    .populate("reviewedBy", "name");

const assertApplicant = async (user) => {
    if (user.userType !== "EMPLOYEE") fail("Only an employee can apply for leave");
    const employee = await User.findById(user._id).select("status userType");
    if (!employee || employee.status !== "ACTIVE") fail("Your account is not active");
    return employee;
};

const assertChoice = async (employeeId, leaveTypeId, span, excludeId) => {
    if (!mongoose.Types.ObjectId.isValid(leaveTypeId)) fail("Select a leave type");
    const leaveType = await LeaveType.findById(leaveTypeId);
    if (!leaveType || leaveType.status !== "ACTIVE") fail("Select an active leave type");
    const assignment = await LeaveAssignment.findOne({ employee: employeeId, leaveType: leaveType._id });
    if (!assignment) fail("This leave type is not assigned to you");

    const overlap = await LeaveRequest.findOne({
        employee: employeeId,
        status: { $in: ["PENDING", "APPROVED"] },
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
        startDate: { $lte: span.endDate },
        endDate: { $gte: span.startDate },
    }).select("_id");
    if (overlap) fail("These dates overlap another leave");

    const usedRows = await LeaveRequest.aggregate([
        {
            $match: {
                employee: new mongoose.Types.ObjectId(String(employeeId)),
                leaveType: leaveType._id,
                status: { $in: ["PENDING", "APPROVED"] },
                ...(excludeId ? { _id: { $ne: new mongoose.Types.ObjectId(String(excludeId)) } } : {}),
            },
        },
        { $group: { _id: null, days: { $sum: "$days" } } },
    ]);
    const used = usedRows[0]?.days || 0;
    if (used + span.days > assignment.days) {
        const left = Math.max(assignment.days - used, 0);
        fail(`Only ${left} day${left === 1 ? "" : "s"} left for ${leaveType.name}`);
    }
    return leaveType;
};

const saveDocument = async (file, current) => {
    if (!file) return current || null;
    const result = await uploadLeaveFile(file);
    if (current?.publicId) await destroyCloudinaryFile(current.publicId, current.resourceType);
    const name = String(file.originalname || "document").split(/[/\\]/).pop().slice(0, 80);
    return {
        name: name || "document",
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: file.mimetype === "application/pdf" ? "raw" : "image",
        format: result.format || "",
    };
};

const createLeaveRequest = async (req, res, next) => {
    try {
        const employee = await assertApplicant(req.user);
        const span = readSpan(req.body);
        const leaveType = await assertChoice(employee._id, req.body.leaveType, span);
        const request = await LeaveRequest.create({
            employee: employee._id,
            leaveType: leaveType._id,
            ...span,
            reason: cleanReason(req.body.reason),
            document: await saveDocument(req.file, null),
        });
        const { notify } = require("../utils/notify");
        const profile = await User.findById(employee._id).select("name reportingManager").lean();
        await notify({
            type: "LEAVE_REQUEST",
            title: `${profile?.name || req.user.name || "Employee"} requested leave`,
            body: leaveType.name || "Leave request",
            href: "/dashboard/leave",
            actorId: req.user._id,
            extraUserIds: [profile?.reportingManager].filter(Boolean),
        });
        const data = await populateRow(LeaveRequest.findById(request._id)).lean();
        res.status(201).json({ success: true, data: present(data) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const listMine = async (req, res, next) => {
    try {
        const rows = await populateRow(LeaveRequest.find({ employee: req.user._id }))
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
        res.status(200).json({ success: true, data: rows.map(present) });
    } catch (error) {
        next(error);
    }
};

const myBalance = async (req, res, next) => {
    try {
        const assignments = await LeaveAssignment.find({ employee: req.user._id })
            .populate("leaveType", "name status")
            .lean();
        const usedRows = await LeaveRequest.aggregate([
            { $match: { employee: new mongoose.Types.ObjectId(String(req.user._id)), status: { $in: ["PENDING", "APPROVED"] } } },
            { $group: { _id: "$leaveType", days: { $sum: "$days" } } },
        ]);
        const usedByType = new Map(usedRows.map((row) => [String(row._id), row.days]));
        const data = assignments
            .filter((row) => row.leaveType && row.leaveType.status === "ACTIVE")
            .map((row) => {
                const used = usedByType.get(String(row.leaveType._id)) || 0;
                return {
                    leaveType: row.leaveType._id,
                    name: row.leaveType.name,
                    assigned: row.days,
                    used,
                    remaining: Math.max(row.days - used, 0),
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const listQueue = async (req, res, next) => {
    try {
        if (!canApprove(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot review leave" });
        }
        const filter = {};
        if (req.user.userType !== "ADMIN") filter.employee = { $ne: req.user._id };
        if (req.query.status) {
            if (!STATUSES.includes(req.query.status)) {
                return res.status(400).json({ success: false, message: "Invalid leave status" });
            }
            filter.status = req.query.status;
        }
        const rows = await populateRow(LeaveRequest.find(filter))
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
        res.status(200).json({ success: true, data: rows.map(present) });
    } catch (error) {
        next(error);
    }
};

const loadOwnedPending = async (id, user) => {
    if (!mongoose.Types.ObjectId.isValid(id)) fail("Invalid leave request");
    const request = await LeaveRequest.findById(id);
    if (!request) {
        const error = new Error("Leave request not found");
        error.status = 404;
        throw error;
    }
    if (request.status !== "PENDING") fail("Only a pending leave can be changed");
    const owner = sameId(request.employee, user._id);
    if (!owner && user.userType !== "ADMIN") {
        const error = new Error("You can only change your own leave");
        error.status = 403;
        throw error;
    }
    return request;
};

const updateLeaveRequest = async (req, res, next) => {
    try {
        const request = await loadOwnedPending(req.params.id, req.user);
        const span = readSpan(req.body);
        const leaveType = await assertChoice(request.employee, req.body.leaveType, span, request._id);
        request.leaveType = leaveType._id;
        request.duration = span.duration;
        request.startDate = span.startDate;
        request.endDate = span.endDate;
        request.days = span.days;
        request.reason = cleanReason(req.body.reason);
        if (req.body.removeDocument === "1" && !req.file && request.document?.publicId) {
            await destroyCloudinaryFile(request.document.publicId, request.document.resourceType);
            request.document = null;
        }
        if (req.file) request.document = await saveDocument(req.file, request.document);
        await request.save();
        const data = await populateRow(LeaveRequest.findById(request._id)).lean();
        res.status(200).json({ success: true, data: present(data) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const deleteLeaveRequest = async (req, res, next) => {
    try {
        const request = await loadOwnedPending(req.params.id, req.user);
        if (request.document?.publicId) {
            await destroyCloudinaryFile(request.document.publicId, request.document.resourceType);
        }
        await request.deleteOne();
        res.status(200).json({ success: true, message: "Leave deleted" });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const reviewLeaveRequest = async (req, res, next) => {
    try {
        if (!canApprove(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot review leave" });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Invalid leave request");
        const request = await LeaveRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: "Leave request not found" });
        if (request.status !== "PENDING") fail("This leave is already reviewed");
        if (req.user.userType !== "ADMIN" && sameId(request.employee, req.user._id)) {
            fail("You cannot review your own leave");
        }
        if (!["APPROVED", "REJECTED"].includes(req.body.status)) fail("Approve or reject this leave");
        const note = String(req.body.reviewNote || "").trim();
        if (note.length > 500) fail("Review note cannot be longer than 500 characters");
        request.status = req.body.status;
        request.reviewNote = note;
        request.reviewedBy = req.user._id;
        request.reviewedAt = new Date();
        await request.save();
        const data = await populateRow(LeaveRequest.findById(request._id)).lean();
        res.status(200).json({ success: true, data: present(data) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

module.exports = {
    createLeaveRequest,
    listMine,
    myBalance,
    listQueue,
    updateLeaveRequest,
    deleteLeaveRequest,
    reviewLeaveRequest,
};
