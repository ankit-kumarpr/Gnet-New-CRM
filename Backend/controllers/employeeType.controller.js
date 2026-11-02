const mongoose = require("mongoose");
const EmployeeType = require("../models/EmployeeType");
const User = require("../models/User");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePagination = (page, limit) => {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * limitNum;
    return { pageNum, limitNum, skip };
};

const createEmployeeType = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Employee type name is required" });
        }

        const employeeType = await EmployeeType.create({
            name: name.trim(),
            createdBy: req.user._id,
        });

        res.status(201).json({ success: true, data: employeeType });
    } catch (error) {
        next(error);
    }
};

const getEmployeeTypes = async (req, res, next) => {
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

        const [total, employeeTypes] = await Promise.all([
            EmployeeType.countDocuments(filter),
            EmployeeType.find(filter).skip(skip).limit(limitNum).sort({ createdAt: -1 }).lean(),
        ]);

        res.status(200).json({
            success: true,
            data: employeeTypes,
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum), limit: limitNum },
        });
    } catch (error) {
        next(error);
    }
};

const getEmployeeTypeById = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid employee type ID format" });
        }

        const employeeType = await EmployeeType.findById(req.params.id).lean();
        if (!employeeType) {
            return res.status(404).json({ success: false, message: "Employee type not found" });
        }

        res.status(200).json({ success: true, data: employeeType });
    } catch (error) {
        next(error);
    }
};

const updateEmployeeType = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid employee type ID format" });
        }

        const employeeType = await EmployeeType.findById(req.params.id);
        if (!employeeType) {
            return res.status(404).json({ success: false, message: "Employee type not found" });
        }

        if (req.body.name) employeeType.name = req.body.name.trim();
        await employeeType.save();
        res.status(200).json({ success: true, data: employeeType });
    } catch (error) {
        next(error);
    }
};

const changeEmployeeTypeStatus = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid employee type ID format" });
        }

        const { status } = req.body;
        if (!["ACTIVE", "INACTIVE"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value. Use ACTIVE or INACTIVE" });
        }

        const employeeType = await EmployeeType.findById(req.params.id);
        if (!employeeType) {
            return res.status(404).json({ success: false, message: "Employee type not found" });
        }

        employeeType.status = status;
        await employeeType.save();
        res.status(200).json({ success: true, data: employeeType, message: `Employee type marked as ${status}` });
    } catch (error) {
        next(error);
    }
};

const deleteEmployeeType = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid employee type ID format" });
        }

        const employeeType = await EmployeeType.findById(req.params.id);
        if (!employeeType) {
            return res.status(404).json({ success: false, message: "Employee type not found" });
        }

        const inUse = await User.exists({ employeeType: employeeType._id });
        if (inUse) {
            return res.status(409).json({ success: false, message: "Employee type is assigned to an employee. Mark it INACTIVE instead" });
        }

        await employeeType.deleteOne();
        res.status(200).json({ success: true, message: "Employee type deleted successfully" });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createEmployeeType,
    getEmployeeTypes,
    getEmployeeTypeById,
    updateEmployeeType,
    changeEmployeeTypeStatus,
    deleteEmployeeType,
};
