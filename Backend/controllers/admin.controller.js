const mongoose = require("mongoose");
const User = require("../models/User");
const Department = require("../models/Department");
const Designation = require("../models/Designation");
const EmployeeType = require("../models/EmployeeType");
const WorkMode = require("../models/WorkMode");
const generateId = require("../utils/generateId");
const { downlineIds } = require("../utils/reporting");
const { loadUserProfile } = require("../utils/userProfile");
const { uploadEmployeeFile, destroyCloudinaryFile } = require("../config/cloudinary");
const { sendEmployeeWelcome } = require("../utils/mailer");
const LeaveAssignment = require("../models/LeaveAssignment");
const LeaveRequest = require("../models/LeaveRequest");

// ─── Helper ───────────────────────────────────────────────────────────────────
// Escapes special regex characters to prevent ReDoS attacks
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Safe pagination parser — guards against NaN, negative, and absurdly large values
const parsePagination = (page, limit) => {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100); // cap at 100
    const skip = (pageNum - 1) * limitNum;
    return { pageNum, limitNum, skip };
};

const parseEmployeePayload = (req, res, next) => {
    if (typeof req.body.address === "string") {
        try {
            req.body.address = JSON.parse(req.body.address);
        } catch {
            return res.status(400).json({ success: false, message: "Address is not valid" });
        }
    }
    if (typeof req.body.documentNames === "string") {
        try {
            req.body.documentNames = JSON.parse(req.body.documentNames);
        } catch {
            return res.status(400).json({ success: false, message: "Document names are not valid" });
        }
    }
    if (typeof req.body.removeDocumentIds === "string") {
        try {
            req.body.removeDocumentIds = JSON.parse(req.body.removeDocumentIds);
        } catch {
            return res.status(400).json({ success: false, message: "Document removal list is not valid" });
        }
    }
    next();
};

const saveEmployeeDocuments = async (files, names) => {
    const uploads = files || [];
    const labels = Array.isArray(names) ? names.map((name) => String(name || "").trim()) : [];
    if (!uploads.length && !labels.length) return [];
    if (uploads.length !== labels.length || labels.some((name) => !name || name.length > 80)) {
        const error = new Error("Each document needs a name and a PDF or image");
        error.status = 400;
        throw error;
    }
    const saved = [];
    try {
        for (let index = 0; index < uploads.length; index += 1) {
            const file = uploads[index];
            const result = await uploadEmployeeFile(file);
            saved.push({
                name: labels[index],
                url: result.secure_url,
                publicId: result.public_id,
                resourceType: result.resource_type,
                format: result.format || (file.mimetype === "application/pdf" ? "pdf" : ""),
            });
        }
        return saved;
    } catch (error) {
        await Promise.all(saved.map((doc) => destroyCloudinaryFile(doc.publicId, doc.resourceType)));
        throw error;
    }
};

const assertReportingManager = async (managerId, employeeId) => {
    if (managerId === undefined || managerId === null || String(managerId).trim() === "") return null;
    if (!mongoose.Types.ObjectId.isValid(managerId)) {
        const error = new Error("Invalid reporting manager");
        error.status = 400;
        throw error;
    }
    if (employeeId && String(managerId) === String(employeeId)) {
        const error = new Error("An employee cannot report to themselves");
        error.status = 400;
        throw error;
    }
    const manager = await User.findOne({ _id: managerId, userType: "EMPLOYEE", status: "ACTIVE" }).select("_id");
    if (!manager) {
        const error = new Error("Reporting manager must be an active employee");
        error.status = 400;
        throw error;
    }
    if (employeeId) {
        const below = await downlineIds(employeeId);
        if (below.some((id) => String(id) === String(managerId))) {
            const error = new Error("That person is already below this employee");
            error.status = 400;
            throw error;
        }
    }
    return manager._id;
};

const assignActiveMaster = async (Model, id, label) => {
    if (id === undefined) return undefined;
    if (id === null || String(id).trim() === "") return null;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        const error = new Error(`Invalid ${label} ID`);
        error.status = 400;
        throw error;
    }
    const record = await Model.findById(id).select("_id status");
    if (!record) {
        const error = new Error(`${label} not found`);
        error.status = 404;
        throw error;
    }
    if (record.status !== "ACTIVE") {
        const error = new Error(`Cannot assign an INACTIVE ${label}`);
        error.status = 400;
        throw error;
    }
    return record._id;
};

const parseAmount = (value, label, required) => {
    if (value === undefined || value === null || String(value).trim() === "") {
        if (!required) return undefined;
        const error = new Error(`${label} is required`);
        error.status = 400;
        throw error;
    }
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
        const error = new Error(`${label} must be a valid amount`);
        error.status = 400;
        throw error;
    }
    return amount;
};

const parseDateField = (value, label, required) => {
    if (value === undefined || value === null || String(value).trim() === "") {
        if (!required) return undefined;
        const error = new Error(`${label} is required`);
        error.status = 400;
        throw error;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        const error = new Error(`${label} is not a valid date`);
        error.status = 400;
        throw error;
    }
    return date;
};

const parseResponsibility = (value, required) => {
    if (value === undefined || value === null || String(value).trim() === "") {
        if (!required) return undefined;
        const error = new Error("Responsibility is required");
        error.status = 400;
        throw error;
    }
    const text = String(value)
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
        .replace(/\son\w+=("[^"]*"|'[^']*')/gi, "")
        .trim();
    const plain = text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    if (!plain) {
        if (!required) return undefined;
        const error = new Error("Responsibility is required");
        error.status = 400;
        throw error;
    }
    if (text.length > 20000) {
        const error = new Error("Responsibility is too long");
        error.status = 400;
        throw error;
    }
    return text;
};

const assertPhone = (phone) => {
    if (!/^[0-9]{10}$/.test(String(phone || ""))) {
        const error = new Error("Phone number must be 10 digits");
        error.status = 400;
        throw error;
    }
};
// @route   POST /api/v1/admin/employees/create
// @access  Private/Admin
const createEmployee = async (req, res, next) => {
    try {
        const { name, email, phone, password, address, department, designation, permissions, employeeType, workMode, salary, joiningDate, dob, responsibility } = req.body;

        // Validate department ObjectId format before DB call
        if (!mongoose.Types.ObjectId.isValid(department)) {
            return res.status(400).json({ success: false, message: "Invalid department ID format" });
        }
        if (!mongoose.Types.ObjectId.isValid(designation)) {
            return res.status(400).json({ success: false, message: "Invalid designation ID format" });
        }

        // 1. Validate Department exists and is ACTIVE
        const dept = await Department.findById(department);
        if (!dept) {
            return res.status(404).json({ success: false, message: "Department not found" });
        }
        if (dept.status !== "ACTIVE") {
            return res.status(400).json({ success: false, message: "Cannot assign an INACTIVE department" });
        }

        // 2. Validate Designation exists and is ACTIVE
        const desig = await Designation.findById(designation);
        if (!desig) {
            return res.status(404).json({ success: false, message: "Designation not found" });
        }
        if (desig.status !== "ACTIVE") {
            return res.status(400).json({ success: false, message: "Cannot assign an INACTIVE designation" });
        }

        // 3. Validate Designation belongs to Department
        if (desig.department.toString() !== dept._id.toString()) {
            return res.status(400).json({
                success: false,
                message: "Validation Error: The selected Designation does not belong to the selected Department",
            });
        }

        // 4. Validate unique email and phone
        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.status(409).json({ success: false, message: "User with email or phone already exists" });
        }

        let reportingManager = null;
        let employeeTypeId;
        let workModeId;
        let salaryAmount;
        let joining;
        let dateOfBirth;
        let duty;
        try {
            reportingManager = await assertReportingManager(req.body.reportingManager, null);
            employeeTypeId = await assignActiveMaster(EmployeeType, employeeType, "employee type");
            workModeId = await assignActiveMaster(WorkMode, workMode, "work mode");
            if (!employeeTypeId) {
                const error = new Error("Employee type is required");
                error.status = 400;
                throw error;
            }
            if (!workModeId) {
                const error = new Error("Work mode is required");
                error.status = 400;
                throw error;
            }
            salaryAmount = parseAmount(salary, "Salary", true);
            joining = parseDateField(joiningDate, "Joining date", true);
            dateOfBirth = parseDateField(dob, "Date of birth", true);
            if (dateOfBirth > new Date()) {
                const error = new Error("Date of birth cannot be in the future");
                error.status = 400;
                throw error;
            }
            assertPhone(phone);
            duty = parseResponsibility(responsibility, true);
        } catch (error) {
            return res.status(error.status || 400).json({ success: false, message: error.message });
        }

        const employeeId = await generateId("EMP");
        let documents = [];
        try {
            documents = await saveEmployeeDocuments(req.files, req.body.documentNames);
        } catch (error) {
            return res.status(error.status || 500).json({ success: false, message: error.message || "Could not save documents" });
        }

        try {
            const newEmployee = await User.create({
                name, email, phone, password, address,
                userType: "EMPLOYEE",
                employeeId,
                department: dept._id,
                designation: desig._id,
                reportingManager,
                permissions,
                documents,
                employeeType: employeeTypeId,
                workMode: workModeId,
                salary: salaryAmount,
                joiningDate: joining,
                dob: dateOfBirth,
                responsibility: duty,
            });

            let emailSent = false;
            let emailReason = "";
            try {
                const SoftwareSetting = require("../models/SoftwareSetting");
                const setting = await SoftwareSetting.findOne({ key: "software" }).select("companyName").lean();
                const mail = await sendEmployeeWelcome({
                    name,
                    email,
                    password,
                    employeeId,
                    companyName: setting?.companyName || "",
                    designationName: desig.name || "",
                });
                emailSent = mail.sent;
                emailReason = mail.reason || "";
                if (!emailSent) {
                    console.error("Welcome email skipped:", emailReason);
                }
            } catch (mailError) {
                emailReason = mailError.message || "Welcome email failed";
                console.error("Welcome email failed:", emailReason);
            }

            const { notify } = require("../utils/notify");
            await notify({
                type: "EMPLOYEE_NEW",
                title: `New employee: ${name}`,
                body: `${desig.name || "Employee"} · ${employeeId}`,
                href: `/dashboard/employees/${newEmployee._id}`,
                actorId: req.user._id,
                extraUserIds: [reportingManager].filter(Boolean),
            });

            res.status(201).json({
                success: true,
                emailSent,
                message: emailSent
                    ? "Employee created and login details mailed (Employee ID + password)"
                    : `Employee created, but welcome email was not sent${emailReason ? `: ${emailReason}` : ""}`,
                data: {
                    id: newEmployee._id,
                    employeeId: newEmployee.employeeId,
                    name: newEmployee.name,
                    email: newEmployee.email,
                    employeeType: newEmployee.employeeType,
                    workMode: newEmployee.workMode,
                    salary: newEmployee.salary,
                    joiningDate: newEmployee.joiningDate,
                    dob: newEmployee.dob,
                    responsibility: newEmployee.responsibility,
                    documents: newEmployee.documents,
                },
            });
        } catch (error) {
            await Promise.all(documents.map((doc) => destroyCloudinaryFile(doc.publicId, doc.resourceType)));
            throw error;
        }
    } catch (error) {
        next(error);
    }
};

// @desc    List Employees
// @route   GET /api/v1/admin/employees/list
// @access  Private/Admin
const getEmployees = async (req, res, next) => {
    try {
        if (req.query.picker === "1") {
            const pickerSearch = String(req.query.search || "").trim();
            const pickerFilter = { userType: "EMPLOYEE", status: "ACTIVE" };
            if (pickerSearch) {
                const safeSearch = escapeRegex(pickerSearch);
                pickerFilter.$or = [
                    { name: { $regex: safeSearch, $options: "i" } },
                    { email: { $regex: safeSearch, $options: "i" } },
                    { phone: { $regex: safeSearch, $options: "i" } },
                    { employeeId: { $regex: safeSearch, $options: "i" } },
                ];
            }
            const people = await User.find(pickerFilter)
                .select("name employeeId designation")
                .populate("designation", "name")
                .sort({ name: 1 })
                .limit(Math.min(parseInt(req.query.limit, 10) || 50, 100))
                .lean();
            return res.status(200).json({ success: true, data: people });
        }

        const { department, designation, search, manager, page = 1, limit = 10 } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);

        let filter = {};
        filter.userType = "EMPLOYEE";

        // Department filter — accept ObjectId or name string
        if (department) {
            if (mongoose.Types.ObjectId.isValid(department)) {
                filter.department = department;
            } else {
                const dept = await Department.findOne({
                    name: { $regex: new RegExp(`^${escapeRegex(department)}$`, "i") },
                });
                filter.department = dept ? dept._id : null;
            }
        }

        // Designation filter — accept ObjectId or name string
        if (designation) {
            if (mongoose.Types.ObjectId.isValid(designation)) {
                filter.designation = designation;
            } else {
                const desig = await Designation.findOne({
                    name: { $regex: new RegExp(`^${escapeRegex(designation)}$`, "i") },
                });
                filter.designation = desig ? desig._id : null;
            }
        }

        // Search by name, email, or phone — regex escaped to prevent ReDoS
        if (search) {
            const safeSearch = escapeRegex(search);
            filter.$or = [
                { name: { $regex: safeSearch, $options: "i" } },
                { email: { $regex: safeSearch, $options: "i" } },
                { phone: { $regex: safeSearch, $options: "i" } },
                { employeeId: { $regex: safeSearch, $options: "i" } },
            ];
        }
        if (manager) {
            if (!mongoose.Types.ObjectId.isValid(manager)) {
                return res.status(400).json({ success: false, message: "Invalid manager" });
            }
            filter.reportingManager = manager;
        }

        const [total, employees] = await Promise.all([
            User.countDocuments(filter),
            User.find(filter)
                .select("-password -refreshToken")
                .populate("department", "name")
                .populate("designation", "name")
                .populate("employeeType", "name")
                .populate("workMode", "name")
                .populate("reportingManager", "name employeeId")
                .skip(skip)
                .limit(limitNum)
                .sort({ createdAt: -1 })
                .lean(),
        ]);

        res.status(200).json({
            success: true,
            data: employees,
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum),
                limit: limitNum,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get Employee Details by ID
// @route   GET /api/v1/admin/employees/details/:id
// @access  Private/Admin
const getEmployeeById = async (req, res, next) => {
    try {
        const profile = await loadUserProfile(req.params.id, { employeesOnly: true });
        if (!profile) {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }
        res.status(200).json({ success: true, ...profile });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

// @desc    Update Employee
// @route   PATCH /api/v1/admin/employees/update/:id
// @access  Private/Admin
const updateEmployee = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, phone, address, department, designation, permissions, removeDocumentIds, employeeType, workMode, salary, joiningDate, dob, responsibility } = req.body;

        const employee = await User.findById(id);
        if (!employee || employee.userType !== "EMPLOYEE") {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }

        if (department && !mongoose.Types.ObjectId.isValid(department)) {
            return res.status(400).json({ success: false, message: "Invalid department ID" });
        }
        if (designation && !mongoose.Types.ObjectId.isValid(designation)) {
            return res.status(400).json({ success: false, message: "Invalid designation ID" });
        }

        if (name) employee.name = name;
        if (phone) {
            assertPhone(phone);
            employee.phone = phone;
        }
        if (address) employee.address = address;
        if (department) employee.department = department;
        if (designation) employee.designation = designation;
        try {
            if (Object.prototype.hasOwnProperty.call(req.body, "employeeType")) {
                const nextType = await assignActiveMaster(EmployeeType, employeeType, "employee type");
                if (!nextType) {
                    return res.status(400).json({ success: false, message: "Employee type is required" });
                }
                employee.employeeType = nextType;
            }
            if (Object.prototype.hasOwnProperty.call(req.body, "workMode")) {
                const nextMode = await assignActiveMaster(WorkMode, workMode, "work mode");
                if (!nextMode) {
                    return res.status(400).json({ success: false, message: "Work mode is required" });
                }
                employee.workMode = nextMode;
            }
            if (Object.prototype.hasOwnProperty.call(req.body, "salary")) {
                employee.salary = parseAmount(salary, "Salary", true);
            }
            if (Object.prototype.hasOwnProperty.call(req.body, "joiningDate")) {
                employee.joiningDate = parseDateField(joiningDate, "Joining date", true);
            }
            if (Object.prototype.hasOwnProperty.call(req.body, "dob")) {
                const dateOfBirth = parseDateField(dob, "Date of birth", true);
                if (dateOfBirth > new Date()) {
                    return res.status(400).json({ success: false, message: "Date of birth cannot be in the future" });
                }
                employee.dob = dateOfBirth;
            }
            if (Object.prototype.hasOwnProperty.call(req.body, "responsibility")) {
                employee.responsibility = parseResponsibility(responsibility, true);
            }
        } catch (error) {
            return res.status(error.status || 400).json({ success: false, message: error.message });
        }
        if (Object.prototype.hasOwnProperty.call(req.body, "reportingManager")) {
            try {
                employee.reportingManager = await assertReportingManager(req.body.reportingManager, employee._id);
            } catch (error) {
                return res.status(error.status || 400).json({ success: false, message: error.message });
            }
        }
        if (permissions) employee.permissions = permissions;

        const removeIds = Array.isArray(removeDocumentIds) ? removeDocumentIds.map(String) : [];
        const removed = (employee.documents || []).filter((doc) => removeIds.includes(String(doc._id)));
        if (removed.length) {
            employee.documents = employee.documents.filter((doc) => !removeIds.includes(String(doc._id)));
        }
        let added = [];
        try {
            added = await saveEmployeeDocuments(req.files, req.body.documentNames);
        } catch (error) {
            return res.status(error.status || 500).json({ success: false, message: error.message || "Could not save documents" });
        }
        if ((employee.documents?.length || 0) + added.length > 8) {
            await Promise.all(added.map((doc) => destroyCloudinaryFile(doc.publicId, doc.resourceType)));
            return res.status(400).json({ success: false, message: "An employee can have up to 8 documents" });
        }
        employee.documents = [...(employee.documents || []), ...added];

        try {
            await employee.save();
        } catch (error) {
            await Promise.all(added.map((doc) => destroyCloudinaryFile(doc.publicId, doc.resourceType)));
            throw error;
        }
        await Promise.all(removed.map((doc) => destroyCloudinaryFile(doc.publicId, doc.resourceType)));

        const saved = employee.toObject();
        delete saved.password;
        delete saved.refreshToken;

        res.status(200).json({
            success: true,
            message: "Employee updated successfully",
            data: saved
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Change Employee Status (Soft Delete)
// @route   PATCH /api/v1/admin/employees/status/:id
// @access  Private/Admin
const changeEmployeeStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["ACTIVE", "INACTIVE"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const employee = await User.findById(id);
        if (!employee || employee.userType !== "EMPLOYEE") {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }

        employee.status = status;
        await employee.save();

        res.status(200).json({
            success: true,
            message: "Employee status updated successfully"
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete an Employee
// @route   DELETE /api/v1/admin/employees/:id
// @access  Private/Admin
const deleteEmployee = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid employee ID format" });
        }
        if (String(req.user._id) === String(id)) {
            return res.status(400).json({ success: false, message: "You cannot delete your own account" });
        }

        const employee = await User.findOne({ _id: id, userType: "EMPLOYEE" });
        if (!employee) {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }

        const documents = employee.documents || [];
        await User.updateMany({ reportingManager: employee._id }, { $unset: { reportingManager: "" } });
        const leaveFiles = await LeaveRequest.find({ employee: employee._id }).select("document");
        await LeaveAssignment.deleteMany({ employee: employee._id });
        await LeaveRequest.deleteMany({ employee: employee._id });
        await employee.deleteOne();
        await Promise.all(leaveFiles.map((row) => destroyCloudinaryFile(row.document?.publicId, row.document?.resourceType)));
        await Promise.all(documents.map((doc) => destroyCloudinaryFile(doc.publicId, doc.resourceType)));

        res.status(200).json({ success: true, message: "Employee deleted successfully" });
    } catch (error) {
        next(error);
    }
};

// @desc    Update User Permissions
// @route   PUT /api/v1/admin/users/:id/permissions
// @access  Private/Admin
const updateUserPermissions = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { permissions } = req.body;

        if (!Array.isArray(permissions)) {
            return res.status(400).json({ success: false, message: "Permissions must be an array of string keys" });
        }

        const userDoc = await User.findById(id);
        if (!userDoc) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        userDoc.permissions = permissions;
        await userDoc.save();

        res.status(200).json({
            success: true,
            message: "User permissions updated successfully",
            data: {
                id: userDoc._id,
                name: userDoc.name,
                permissions: userDoc.permissions
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { createEmployee, getEmployees, getEmployeeById, updateEmployee, changeEmployeeStatus, deleteEmployee, updateUserPermissions, parseEmployeePayload };

