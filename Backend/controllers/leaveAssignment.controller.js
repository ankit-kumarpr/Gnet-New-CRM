const mongoose = require("mongoose");
const LeaveAssignment = require("../models/LeaveAssignment");
const LeaveType = require("../models/LeaveType");
const User = require("../models/User");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePagination = (page, limit) => {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * limitNum;
    return { pageNum, limitNum, skip };
};

const parseDays = (value) => {
    if (value === undefined || value === null || value === "") {
        const error = new Error("Leave days are required");
        error.status = 400;
        throw error;
    }
    const days = Number(value);
    if (!Number.isInteger(days) || days < 0 || days > 365) {
        const error = new Error("Leave days must be a whole number from 0 to 365");
        error.status = 400;
        throw error;
    }
    return days;
};

const assertEmployee = async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        const error = new Error("Invalid employee ID format");
        error.status = 400;
        throw error;
    }
    const employee = await User.findOne({ _id: id, userType: "EMPLOYEE" });
    if (!employee) {
        const error = new Error("Employee not found");
        error.status = 404;
        throw error;
    }
    if (employee.status !== "ACTIVE") {
        const error = new Error("Cannot assign leave to an inactive employee");
        error.status = 400;
        throw error;
    }
    return employee;
};

const assertLeaveType = async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        const error = new Error("Invalid leave type ID format");
        error.status = 400;
        throw error;
    }
    const leaveType = await LeaveType.findById(id);
    if (!leaveType) {
        const error = new Error("Leave type not found");
        error.status = 404;
        throw error;
    }
    if (leaveType.status !== "ACTIVE") {
        const error = new Error("Cannot assign an inactive leave type");
        error.status = 400;
        throw error;
    }
    return leaveType;
};

const duplicateMessage = "This employee already has this leave type";

const createLeaveAssignment = async (req, res, next) => {
    try {
        const employee = await assertEmployee(req.body.employee);
        const leaveType = await assertLeaveType(req.body.leaveType);
        const days = parseDays(req.body.days);

        const existing = await LeaveAssignment.findOne({ employee: employee._id, leaveType: leaveType._id });
        if (existing) {
            return res.status(409).json({ success: false, message: duplicateMessage });
        }

        const assignment = await LeaveAssignment.create({
            employee: employee._id,
            leaveType: leaveType._id,
            days,
            createdBy: req.user._id,
        });

        const data = await LeaveAssignment.findById(assignment._id)
            .populate("employee", "name employeeId")
            .populate("leaveType", "name")
            .lean();

        res.status(201).json({ success: true, data });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: duplicateMessage });
        }
        if (error.status) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const getLeaveAssignments = async (req, res, next) => {
    try {
        const { search, employee, leaveType, page = 1, limit = 10 } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);
        const filter = {};

        if (employee) {
            if (!mongoose.Types.ObjectId.isValid(employee)) {
                return res.status(400).json({ success: false, message: "Invalid employee ID format" });
            }
            filter.employee = employee;
        }
        if (leaveType) {
            if (!mongoose.Types.ObjectId.isValid(leaveType)) {
                return res.status(400).json({ success: false, message: "Invalid leave type ID format" });
            }
            filter.leaveType = leaveType;
        }
        if (search) {
            const regex = new RegExp(escapeRegex(search), "i");
            const [people, types] = await Promise.all([
                User.find({ userType: "EMPLOYEE", $or: [{ name: regex }, { employeeId: regex }] }).select("_id").limit(200).lean(),
                LeaveType.find({ name: regex }).select("_id").limit(50).lean(),
            ]);
            if (!people.length && !types.length) {
                return res.status(200).json({
                    success: true,
                    data: [],
                    pagination: { total: 0, page: pageNum, pages: 1, limit: limitNum },
                });
            }
            filter.$or = [
                { employee: { $in: people.map((person) => person._id) } },
                { leaveType: { $in: types.map((type) => type._id) } },
            ];
        }

        const [total, assignments] = await Promise.all([
            LeaveAssignment.countDocuments(filter),
            LeaveAssignment.find(filter)
                .populate("employee", "name employeeId")
                .populate("leaveType", "name status")
                .skip(skip)
                .limit(limitNum)
                .sort({ createdAt: -1 })
                .lean(),
        ]);

        res.status(200).json({
            success: true,
            data: assignments,
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum },
        });
    } catch (error) {
        next(error);
    }
};

const getLeaveAssignmentById = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid leave assignment ID format" });
        }

        const assignment = await LeaveAssignment.findById(req.params.id)
            .populate("employee", "name employeeId")
            .populate("leaveType", "name status")
            .lean();
        if (!assignment) {
            return res.status(404).json({ success: false, message: "Leave assignment not found" });
        }

        res.status(200).json({ success: true, data: assignment });
    } catch (error) {
        next(error);
    }
};

const updateLeaveAssignment = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid leave assignment ID format" });
        }

        const assignment = await LeaveAssignment.findById(req.params.id);
        if (!assignment) {
            return res.status(404).json({ success: false, message: "Leave assignment not found" });
        }

        if (req.body.employee !== undefined) {
            const employee = await assertEmployee(req.body.employee);
            assignment.employee = employee._id;
        }
        if (req.body.leaveType !== undefined) {
            const leaveType = await assertLeaveType(req.body.leaveType);
            assignment.leaveType = leaveType._id;
        }
        if (req.body.days !== undefined) {
            assignment.days = parseDays(req.body.days);
        }

        const clash = await LeaveAssignment.findOne({
            _id: { $ne: assignment._id },
            employee: assignment.employee,
            leaveType: assignment.leaveType,
        });
        if (clash) {
            return res.status(409).json({ success: false, message: duplicateMessage });
        }

        await assignment.save();
        const data = await LeaveAssignment.findById(assignment._id)
            .populate("employee", "name employeeId")
            .populate("leaveType", "name")
            .lean();

        res.status(200).json({ success: true, data });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: duplicateMessage });
        }
        if (error.status) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const saveLeaveAssignments = async (req, res, next) => {
    try {
        const employee = await assertEmployee(req.body.employee);
        const leaves = req.body.leaves;
        if (!Array.isArray(leaves) || leaves.length === 0) {
            return res.status(400).json({ success: false, message: "Add days for at least one leave type" });
        }
        if (leaves.length > 50) {
            return res.status(400).json({ success: false, message: "Too many leave types in one request" });
        }

        const seen = new Set();
        const prepared = [];
        for (const row of leaves) {
            const leaveType = await assertLeaveType(row?.leaveType);
            const id = String(leaveType._id);
            if (seen.has(id)) {
                return res.status(400).json({ success: false, message: "Each leave type can be sent only once" });
            }
            seen.add(id);
            prepared.push({ leaveType: leaveType._id, days: parseDays(row.days) });
        }

        await Promise.all(prepared.map((row) => LeaveAssignment.findOneAndUpdate(
            { employee: employee._id, leaveType: row.leaveType },
            { $set: { days: row.days }, $setOnInsert: { createdBy: req.user._id } },
            { upsert: true },
        )));

        const data = await LeaveAssignment.find({ employee: employee._id })
            .populate("employee", "name employeeId")
            .populate("leaveType", "name")
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({ success: true, message: "Leave assigned", data });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: duplicateMessage });
        }
        if (error.status) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const deleteLeaveAssignment = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid leave assignment ID format" });
        }

        const assignment = await LeaveAssignment.findById(req.params.id);
        if (!assignment) {
            return res.status(404).json({ success: false, message: "Leave assignment not found" });
        }

        await assignment.deleteOne();
        res.status(200).json({ success: true, message: "Leave assignment deleted successfully" });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createLeaveAssignment,
    saveLeaveAssignments,
    getLeaveAssignments,
    getLeaveAssignmentById,
    updateLeaveAssignment,
    deleteLeaveAssignment,
};
