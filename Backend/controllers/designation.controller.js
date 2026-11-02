const mongoose = require("mongoose");
const Designation = require("../models/Designation");
const Department = require("../models/Department");
const User = require("../models/User");

// ─── Helpers ──────────────────────────────────────────────────────────────────
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePagination = (page, limit) => {
    const pageNum  = Math.max(parseInt(page,  10) || 1,  1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip     = (pageNum - 1) * limitNum;
    return { pageNum, limitNum, skip };
};

// @desc    Create a Designation
// @route   POST /api/v1/admin/designations/create
// @access  Private/Admin
const createDesignation = async (req, res, next) => {
    try {
        const { name, department } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Designation name is required" });
        }

        // Validate department ObjectId format
        if (!mongoose.Types.ObjectId.isValid(department)) {
            return res.status(400).json({ success: false, message: "Invalid department ID format" });
        }

        const deptExists = await Department.findById(department);
        if (!deptExists) {
            return res.status(404).json({ success: false, message: "Department not found" });
        }

        if (deptExists.status !== "ACTIVE") {
            return res.status(400).json({ success: false, message: "Cannot create designation under an INACTIVE department" });
        }

        const designation = await Designation.create({
            name: name.trim(),
            department,
            createdBy: req.user._id,
        });

        res.status(201).json({ success: true, data: designation });
    } catch (error) {
        next(error); // 11000 (duplicate name in dept) caught by global handler
    }
};

// @desc    Get all Designations
// @route   GET /api/v1/admin/designations/list
// @access  Private/Admin
const getDesignations = async (req, res, next) => {
    try {
        const { search, status, department, page = 1, limit = 10 } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);

        let filter = {};

        if (status) {
            if (!["ACTIVE", "INACTIVE"].includes(status)) {
                return res.status(400).json({ success: false, message: "Invalid status. Use ACTIVE or INACTIVE" });
            }
            filter.status = status;
        }

        // Validate department ObjectId before using as filter — prevents CastError → 500
        if (department) {
            if (!mongoose.Types.ObjectId.isValid(department)) {
                return res.status(400).json({ success: false, message: "Invalid department ID format" });
            }
            filter.department = department;
        }

        // Regex escaped — prevents ReDoS
        if (search) {
            filter.name = { $regex: escapeRegex(search), $options: "i" };
        }

        const [total, designations] = await Promise.all([
            Designation.countDocuments(filter),
            Designation.find(filter)
                .populate("department", "name status")
                .skip(skip)
                .limit(limitNum)
                .sort({ createdAt: -1 })
                .lean(),
        ]);

        res.status(200).json({
            success: true,
            data: designations,
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

// @desc    Get Designation by ID
// @route   GET /api/v1/admin/designations/details/:id
// @access  Private/Admin
const getDesignationById = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid designation ID format" });
        }

        const designation = await Designation.findById(req.params.id)
            .populate("department", "name")
            .lean();

        if (!designation) {
            return res.status(404).json({ success: false, message: "Designation not found" });
        }

        res.status(200).json({ success: true, data: designation });
    } catch (error) {
        next(error);
    }
};

// @desc    Get Designations by Department
// @route   GET /api/v1/admin/designations/list/department/:departmentId
// @access  Private/Admin
const getDesignationsByDepartment = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.departmentId)) {
            return res.status(400).json({ success: false, message: "Invalid department ID format" });
        }

        const designations = await Designation.find({
            department: req.params.departmentId,
            status: "ACTIVE", // only return active designations
        }).lean();

        res.status(200).json({ success: true, data: designations });
    } catch (error) {
        next(error);
    }
};

// @desc    Update Designation
// @route   PATCH /api/v1/admin/designations/update/:id
// @access  Private/Admin
const updateDesignation = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid designation ID format" });
        }

        const { name } = req.body;

        const designation = await Designation.findById(req.params.id);
        if (!designation) {
            return res.status(404).json({ success: false, message: "Designation not found" });
        }

        if (name) designation.name = name.trim();

        await designation.save();
        res.status(200).json({ success: true, data: designation });
    } catch (error) {
        next(error); // 11000 caught by global handler
    }
};

// @desc    Change Designation Status
// @route   PATCH /api/v1/admin/designations/status/:id
// @access  Private/Admin
const changeDesignationStatus = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid designation ID format" });
        }

        const { status } = req.body;
        if (!["ACTIVE", "INACTIVE"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value. Use ACTIVE or INACTIVE" });
        }

        const designation = await Designation.findById(req.params.id);
        if (!designation) {
            return res.status(404).json({ success: false, message: "Designation not found" });
        }

        designation.status = status;
        await designation.save();

        res.status(200).json({ success: true, data: designation, message: `Designation marked as ${status}` });
    } catch (error) {
        next(error);
    }
};

const deleteDesignation = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid designation ID format" });
        }

        const designation = await Designation.findById(req.params.id);
        if (!designation) {
            return res.status(404).json({ success: false, message: "Designation not found" });
        }

        const inUse = await User.exists({ designation: designation._id });
        if (inUse) {
            return res.status(409).json({
                success: false,
                message: "Designation is assigned to an employee. Remove it from the employee first, or mark it INACTIVE",
            });
        }

        await designation.deleteOne();
        res.status(200).json({ success: true, message: "Designation deleted successfully" });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createDesignation,
    getDesignations,
    getDesignationById,
    getDesignationsByDepartment,
    updateDesignation,
    changeDesignationStatus,
    deleteDesignation,
};
