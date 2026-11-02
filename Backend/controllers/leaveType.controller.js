const mongoose = require("mongoose");
const LeaveType = require("../models/LeaveType");
const LeaveAssignment = require("../models/LeaveAssignment");
const LeaveRequest = require("../models/LeaveRequest");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePagination = (page, limit) => {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * limitNum;
    return { pageNum, limitNum, skip };
};

const createLeaveType = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Leave type name is required" });
        }

        const leaveType = await LeaveType.create({
            name: name.trim(),
            createdBy: req.user._id,
        });

        res.status(201).json({ success: true, data: leaveType });
    } catch (error) {
        next(error);
    }
};

const getLeaveTypes = async (req, res, next) => {
    try {
        const { search, status, page = 1, limit = 10 } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);
        const filter = {};

        if (status) {
            if (!["ACTIVE", "INACTIVE"].includes(status)) {
                return res.status(400).json({ success: false, message: "Invalid status. Use ACTIVE or INACTIVE" });
            }
            filter.status = status;
        }
        if (search) {
            filter.name = { $regex: escapeRegex(search), $options: "i" };
        }

        const [total, leaveTypes] = await Promise.all([
            LeaveType.countDocuments(filter),
            LeaveType.find(filter).skip(skip).limit(limitNum).sort({ createdAt: -1 }).lean(),
        ]);

        res.status(200).json({
            success: true,
            data: leaveTypes,
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum), limit: limitNum },
        });
    } catch (error) {
        next(error);
    }
};

const getLeaveTypeById = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid leave type ID format" });
        }

        const leaveType = await LeaveType.findById(req.params.id).lean();
        if (!leaveType) {
            return res.status(404).json({ success: false, message: "Leave type not found" });
        }

        res.status(200).json({ success: true, data: leaveType });
    } catch (error) {
        next(error);
    }
};

const updateLeaveType = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid leave type ID format" });
        }

        const leaveType = await LeaveType.findById(req.params.id);
        if (!leaveType) {
            return res.status(404).json({ success: false, message: "Leave type not found" });
        }

        if (req.body.name !== undefined) {
            const name = String(req.body.name || "").trim();
            if (!name) {
                return res.status(400).json({ success: false, message: "Leave type name is required" });
            }
            leaveType.name = name;
        }
        await leaveType.save();
        res.status(200).json({ success: true, data: leaveType });
    } catch (error) {
        next(error);
    }
};

const changeLeaveTypeStatus = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid leave type ID format" });
        }

        const { status } = req.body;
        if (!["ACTIVE", "INACTIVE"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value. Use ACTIVE or INACTIVE" });
        }

        const leaveType = await LeaveType.findById(req.params.id);
        if (!leaveType) {
            return res.status(404).json({ success: false, message: "Leave type not found" });
        }

        leaveType.status = status;
        await leaveType.save();
        res.status(200).json({ success: true, data: leaveType, message: `Leave type marked as ${status}` });
    } catch (error) {
        next(error);
    }
};

const deleteLeaveType = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid leave type ID format" });
        }

        const leaveType = await LeaveType.findById(req.params.id);
        if (!leaveType) {
            return res.status(404).json({ success: false, message: "Leave type not found" });
        }

        const inUse = await LeaveAssignment.exists({ leaveType: leaveType._id })
            || await LeaveRequest.exists({ leaveType: leaveType._id });
        if (inUse) {
            return res.status(409).json({ success: false, message: "Leave type is assigned to an employee. Mark it INACTIVE instead" });
        }

        await leaveType.deleteOne();
        res.status(200).json({ success: true, message: "Leave type deleted successfully" });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createLeaveType,
    getLeaveTypes,
    getLeaveTypeById,
    updateLeaveType,
    changeLeaveTypeStatus,
    deleteLeaveType,
};
