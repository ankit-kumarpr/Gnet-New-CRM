const mongoose = require("mongoose");
const WorkMode = require("../models/WorkMode");
const User = require("../models/User");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePagination = (page, limit) => {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * limitNum;
    return { pageNum, limitNum, skip };
};

const createWorkMode = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Work mode name is required" });
        }

        const workMode = await WorkMode.create({
            name: name.trim(),
            createdBy: req.user._id,
        });

        res.status(201).json({ success: true, data: workMode });
    } catch (error) {
        next(error);
    }
};

const getWorkModes = async (req, res, next) => {
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

        const [total, workModes] = await Promise.all([
            WorkMode.countDocuments(filter),
            WorkMode.find(filter).skip(skip).limit(limitNum).sort({ createdAt: -1 }).lean(),
        ]);

        res.status(200).json({
            success: true,
            data: workModes,
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum), limit: limitNum },
        });
    } catch (error) {
        next(error);
    }
};

const getWorkModeById = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid work mode ID format" });
        }

        const workMode = await WorkMode.findById(req.params.id).lean();
        if (!workMode) {
            return res.status(404).json({ success: false, message: "Work mode not found" });
        }

        res.status(200).json({ success: true, data: workMode });
    } catch (error) {
        next(error);
    }
};

const updateWorkMode = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid work mode ID format" });
        }

        const workMode = await WorkMode.findById(req.params.id);
        if (!workMode) {
            return res.status(404).json({ success: false, message: "Work mode not found" });
        }

        if (req.body.name) workMode.name = req.body.name.trim();
        await workMode.save();
        res.status(200).json({ success: true, data: workMode });
    } catch (error) {
        next(error);
    }
};

const changeWorkModeStatus = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid work mode ID format" });
        }

        const { status } = req.body;
        if (!["ACTIVE", "INACTIVE"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value. Use ACTIVE or INACTIVE" });
        }

        const workMode = await WorkMode.findById(req.params.id);
        if (!workMode) {
            return res.status(404).json({ success: false, message: "Work mode not found" });
        }

        workMode.status = status;
        await workMode.save();
        res.status(200).json({ success: true, data: workMode, message: `Work mode marked as ${status}` });
    } catch (error) {
        next(error);
    }
};

const deleteWorkMode = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid work mode ID format" });
        }

        const workMode = await WorkMode.findById(req.params.id);
        if (!workMode) {
            return res.status(404).json({ success: false, message: "Work mode not found" });
        }

        const inUse = await User.exists({ workMode: workMode._id });
        if (inUse) {
            return res.status(409).json({ success: false, message: "Work mode is assigned to an employee. Mark it INACTIVE instead" });
        }

        await workMode.deleteOne();
        res.status(200).json({ success: true, message: "Work mode deleted successfully" });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createWorkMode,
    getWorkModes,
    getWorkModeById,
    updateWorkMode,
    changeWorkModeStatus,
    deleteWorkMode,
};
