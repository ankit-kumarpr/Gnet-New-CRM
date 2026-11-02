const mongoose = require("mongoose");
const Department = require("../models/Department");
const Designation = require("../models/Designation");
const User = require("../models/User");

// ─── Helpers ──────────────────────────────────────────────────────────────────
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePagination = (page, limit) => {
    const pageNum  = Math.max(parseInt(page,  10) || 1,  1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip     = (pageNum - 1) * limitNum;
    return { pageNum, limitNum, skip };
};

// @desc    Create a Department
// @route   POST /api/v1/admin/departments/create
// @access  Private/Admin
const createDepartment = async (req, res, next) => {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Department name is required" });
        }

        // Let MongoDB unique index enforce uniqueness — catch 11000 in global handler
        const dept = await Department.create({
            name: name.trim(),
            createdBy: req.user._id,
        });

        res.status(201).json({ success: true, data: dept });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all Departments
// @route   GET /api/v1/admin/departments/list
// @access  Private/Admin
const getDepartments = async (req, res, next) => {
    try {
        const { search, status, page = 1, limit = 10 } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);

        let filter = {};

        // Validate status if provided
        if (status) {
            if (!["ACTIVE", "INACTIVE"].includes(status)) {
                return res.status(400).json({ success: false, message: "Invalid status. Use ACTIVE or INACTIVE" });
            }
            filter.status = status;
        }

        // Regex escaped — prevents ReDoS
        if (search) {
            filter.name = { $regex: escapeRegex(search), $options: "i" };
        }

        const [total, depts] = await Promise.all([
            Department.countDocuments(filter),
            Department.find(filter)
                .skip(skip)
                .limit(limitNum)
                .sort({ createdAt: -1 })
                .lean(),
        ]);

        res.status(200).json({
            success: true,
            data: depts,
            pagination: {
                total,
                page:  pageNum,
                pages: Math.ceil(total / limitNum),
                limit: limitNum,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get Department by ID
// @route   GET /api/v1/admin/departments/details/:id
// @access  Private/Admin
const getDepartmentById = async (req, res, next) => {
    try {
        // Guard invalid ObjectId — prevents Mongoose CastError → 500
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid department ID format" });
        }

        const dept = await Department.findById(req.params.id).lean();
        if (!dept) {
            return res.status(404).json({ success: false, message: "Department not found" });
        }

        res.status(200).json({ success: true, data: dept });
    } catch (error) {
        next(error);
    }
};

// @desc    Update Department
// @route   PATCH /api/v1/admin/departments/update/:id
// @access  Private/Admin
const updateDepartment = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid department ID format" });
        }

        const { name } = req.body;

        const dept = await Department.findById(req.params.id);
        if (!dept) {
            return res.status(404).json({ success: false, message: "Department not found" });
        }

        if (name) dept.name = name.trim();

        await dept.save();
        res.status(200).json({ success: true, data: dept });
    } catch (error) {
        next(error); // 11000 caught by global handler
    }
};

// @desc    Change Department Status
// @route   PATCH /api/v1/admin/departments/status/:id
// @access  Private/Admin
const changeDepartmentStatus = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid department ID format" });
        }

        const { status } = req.body;
        if (!["ACTIVE", "INACTIVE"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value. Use ACTIVE or INACTIVE" });
        }

        const dept = await Department.findById(req.params.id);
        if (!dept) {
            return res.status(404).json({ success: false, message: "Department not found" });
        }

        dept.status = status;
        await dept.save();

        res.status(200).json({ success: true, data: dept, message: `Department marked as ${status}` });
    } catch (error) {
        next(error);
    }
};

const deleteDepartment = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid department ID format" });
        }

        const dept = await Department.findById(req.params.id);
        if (!dept) {
            return res.status(404).json({ success: false, message: "Department not found" });
        }

        const [designationInUse, employeeInUse] = await Promise.all([
            Designation.exists({ department: dept._id }),
            User.exists({ department: dept._id }),
        ]);
        if (designationInUse || employeeInUse) {
            return res.status(409).json({
                success: false,
                message: "Department is still used by a designation or employee. Remove those first, or mark it INACTIVE",
            });
        }

        await dept.deleteOne();
        res.status(200).json({ success: true, message: "Department deleted successfully" });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createDepartment,
    getDepartments,
    getDepartmentById,
    updateDepartment,
    changeDepartmentStatus,
    deleteDepartment,
};
