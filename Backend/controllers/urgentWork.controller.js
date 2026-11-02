const mongoose = require("mongoose");
const UrgentWork = require("../models/UrgentWork");
const { PRIORITIES, STATUSES } = require("../models/UrgentWork");
const Project = require("../models/Project");
const User = require("../models/User");
const { uploadUrgentFile, destroyCloudinaryFile } = require("../config/cloudinary");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePagination = (page, limit) => {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * limitNum;
    return { pageNum, limitNum, skip };
};

const fail = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    throw error;
};

const { permissionGranted } = require("../utils/permissions");
const isAdmin = (user) => user.userType === "ADMIN";

const PROJECT_ACCESS = ["VIEW_PROJECTS", "MANAGE_PROJECTS", "CREATE_PROJECTS", "EDIT_PROJECTS", "DELETE_PROJECTS"];
const URGENT_ACCESS = ["VIEW_URGENT_WORK", "MANAGE_URGENT_WORK", "CREATE_URGENT_WORK", "EDIT_URGENT_WORK", "DELETE_URGENT_WORK"];

const seesEveryProject = (user) => user?.userType === "ADMIN" || permissionGranted(user, ["MANAGE_PROJECTS"]);
const seesEveryUrgent = (user) => isAdmin(user) || permissionGranted(user, ["MANAGE_URGENT_WORK"]);

const canUseProject = (project, user) => {
    if (!project) return false;
    if (seesEveryProject(user)) return true;
    const managerId = project.reportingManager?._id || project.reportingManager;
    if (String(managerId) === String(user._id)) return true;
    if ((project.workingEmployees || []).some((person) => String(person?._id || person) === String(user._id))) return true;
    return (project.serviceAssignments || []).some((row) => String(row?.employee?._id || row?.employee) === String(user._id));
};

const canSeeWork = (row, user) => {
    if (!row) return false;
    if (isAdmin(user) || seesEveryUrgent(user)) return true;
    if (String(row.createdBy?._id || row.createdBy) === String(user._id)) return true;
    return (row.assignees || []).some((person) => String(person?._id || person) === String(user._id));
};

const canChangeWork = (row, user) => {
    if (!row) return false;
    if (isAdmin(user) || permissionGranted(user, ["EDIT_URGENT_WORK", "MANAGE_URGENT_WORK", "DELETE_URGENT_WORK"])) return true;
    return String(row.createdBy?._id || row.createdBy) === String(user._id);
};

const canUpdateStatus = (row, user) => {
    if (!row) return false;
    if (isAdmin(user) || permissionGranted(user, ["EDIT_URGENT_WORK", "MANAGE_URGENT_WORK"])) return true;
    if (String(row.createdBy?._id || row.createdBy) === String(user._id)) return true;
    return (row.assignees || []).some((person) => String(person?._id || person) === String(user._id));
};

const cleanHtml = (value) => {
    const text = String(value || "")
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
        .replace(/\son\w+=("[^"]*"|'[^']*')/gi, "")
        .trim();
    const plain = text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    if (!plain) fail("Work is required");
    if (text.length > 20000) fail("Work is too long");
    return text;
};

const readDay = (value) => {
    const text = String(value || "").trim();
    if (!text) fail("EOD is required");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) fail("EOD must be a valid date");
    const date = new Date(`${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) fail("EOD must be a valid date");
    return date;
};

const dayRange = (value) => {
    const start = readDay(value);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { $gte: start, $lt: end };
};

const readAssignees = async (value, allowed = []) => {
    const raw = Array.isArray(value) ? value : String(value || "").split(",").filter(Boolean);
    const ids = [...new Set(raw.map((item) => String(item || "").trim()).filter(Boolean))];
    if (!ids.length) fail("Select at least one employee");
    if (ids.length > 50) fail("You can assign up to 50 employees");
    if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) fail("Select valid employees");
    const kept = new Set(allowed.map((id) => String(id)));
    const fresh = ids.filter((id) => !kept.has(id));
    if (fresh.length) {
        const found = await User.find({
            _id: { $in: fresh },
            status: "ACTIVE",
            userType: { $in: ["ADMIN", "EMPLOYEE"] },
        }).select("_id");
        if (found.length !== fresh.length) fail("Select active employees");
    }
    return ids;
};

const readProjectId = async (value, user) => {
    const id = String(value || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) fail("Select a project");
    const project = await Project.findById(id).select("reportingManager workingEmployees");
    if (!canUseProject(project, user)) fail("Select a project you can use");
    return project._id;
};

const readFields = async (body, user, current = {}) => {
    const priority = body.priority || "MEDIUM";
    if (!PRIORITIES.includes(priority)) fail("Select a valid priority");
    return {
        project: await readProjectId(body.project, user),
        work: cleanHtml(body.work),
        assignees: await readAssignees(body.assignees, current.assignees || []),
        priority,
        eod: readDay(body.eod),
    };
};

const presentFile = (file) => (file?.url ? { name: file.name, url: file.url } : null);

const present = (row, user) => ({
    ...row,
    status: row.status || "PENDING",
    file: presentFile(row.file),
    canEdit: canChangeWork(row, user),
    canUpdateStatus: canUpdateStatus(row, user),
});

const withLinks = (query) => query
    .populate("project", "name")
    .populate("assignees", "name")
    .populate("createdBy", "name");

const saveFile = async (file) => {
    const result = await uploadUrgentFile(file);
    const name = String(file.originalname || "file").split(/[/\\]/).pop().slice(0, 80);
    return {
        name: name || "file",
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: file.mimetype === "application/pdf" ? "raw" : "image",
        format: result.format || "",
    };
};

const createUrgentWork = async (req, res, next) => {
    let stored = null;
    try {
        const fields = await readFields(req.body, req.user);
        if (req.file) stored = await saveFile(req.file);
        const row = await UrgentWork.create({ ...fields, file: stored, createdBy: req.user._id });
        const { notify } = require("../utils/notify");
        const workText = String(fields.work || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        await notify({
            type: "URGENT_WORK",
            title: "Urgent work assigned",
            body: workText.slice(0, 120) || "New urgent work",
            href: `/dashboard/urgent-work/${row._id}`,
            actorId: req.user._id,
            extraUserIds: fields.assignees || [],
        });
        const data = await withLinks(UrgentWork.findById(row._id)).lean();
        res.status(201).json({ success: true, data: present(data, req.user) });
    } catch (error) {
        if (stored?.publicId) await destroyCloudinaryFile(stored.publicId, stored.resourceType);
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const getUrgentWorks = async (req, res, next) => {
    try {
        const { project, priority, employee, eod, page = 1, limit = 10 } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);
        const filter = {};
        if (!isAdmin(req.user)) {
            filter.$or = [{ createdBy: req.user._id }, { assignees: req.user._id }];
        }
        if (project) {
            if (!mongoose.Types.ObjectId.isValid(project)) return res.status(400).json({ success: false, message: "Invalid project" });
            filter.project = project;
        }
        if (priority) {
            if (!PRIORITIES.includes(priority)) return res.status(400).json({ success: false, message: "Invalid priority" });
            filter.priority = priority;
        }
        if (employee) {
            if (!mongoose.Types.ObjectId.isValid(employee)) return res.status(400).json({ success: false, message: "Invalid employee" });
            filter.assignees = employee;
        }
        if (eod) filter.eod = dayRange(eod);

        const [total, rows] = await Promise.all([
            UrgentWork.countDocuments(filter),
            withLinks(UrgentWork.find(filter)).sort({ eod: 1, createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        ]);

        res.status(200).json({
            success: true,
            data: rows.map((row) => present(row, req.user)),
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum },
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const getUrgentWorkOptions = async (req, res, next) => {
    try {
        const projectFilter = {};
        if (!seesEveryProject(req.user)) {
            projectFilter.$or = [
                { reportingManager: req.user._id },
                { workingEmployees: req.user._id },
                { "serviceAssignments.employee": req.user._id },
            ];
        }
        const [projects, employees] = await Promise.all([
            Project.find(projectFilter).select("name").sort({ name: 1 }).limit(500).lean(),
            User.find({ status: "ACTIVE", userType: { $in: ["ADMIN", "EMPLOYEE"] } }).select("name").sort({ name: 1 }).limit(500).lean(),
        ]);
        res.status(200).json({ success: true, data: { projects, employees } });
    } catch (error) {
        next(error);
    }
};

const loadVisible = async (id, user) => {
    if (!mongoose.Types.ObjectId.isValid(id)) fail("Invalid work ID format");
    const row = await UrgentWork.findById(id);
    if (!canSeeWork(row, user)) fail("Urgent work not found", 404);
    return row;
};

const getUrgentWorkById = async (req, res, next) => {
    try {
        const row = await loadVisible(req.params.id, req.user);
        const data = await withLinks(UrgentWork.findById(row._id)).lean();
        res.status(200).json({ success: true, data: present(data, req.user) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const updateUrgentWork = async (req, res, next) => {
    try {
        const row = await loadVisible(req.params.id, req.user);
        if (!canChangeWork(row, req.user)) return res.status(403).json({ success: false, message: "You can only edit urgent work you created" });
        const fields = await readFields(req.body, req.user, { assignees: row.assignees });
        Object.assign(row, fields);
        if (req.body.removeFile === "1" && !req.file && row.file?.publicId) {
            await destroyCloudinaryFile(row.file.publicId, row.file.resourceType);
            row.file = null;
        }
        if (req.file) {
            const nextFile = await saveFile(req.file);
            if (row.file?.publicId) await destroyCloudinaryFile(row.file.publicId, row.file.resourceType);
            row.file = nextFile;
        }
        await row.save();
        const data = await withLinks(UrgentWork.findById(row._id)).lean();
        res.status(200).json({ success: true, data: present(data, req.user) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const deleteUrgentWork = async (req, res, next) => {
    try {
        const row = await loadVisible(req.params.id, req.user);
        if (!canChangeWork(row, req.user)) return res.status(403).json({ success: false, message: "You can only delete urgent work you created" });
        if (row.file?.publicId) await destroyCloudinaryFile(row.file.publicId, row.file.resourceType);
        await row.deleteOne();
        res.status(200).json({ success: true, message: "Urgent work deleted" });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const updateUrgentWorkStatus = async (req, res, next) => {
    try {
        const row = await loadVisible(req.params.id, req.user);
        if (!canUpdateStatus(row, req.user)) {
            return res.status(403).json({ success: false, message: "You cannot update this urgent work status" });
        }
        const status = String(req.body.status || "").trim().toUpperCase();
        if (!STATUSES.includes(status)) {
            return res.status(400).json({ success: false, message: "Status must be PENDING or DONE" });
        }
        row.status = status;
        await row.save();
        const data = await withLinks(UrgentWork.findById(row._id)).lean();
        res.status(200).json({ success: true, data: present(data, req.user) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

module.exports = {
    createUrgentWork,
    getUrgentWorks,
    getUrgentWorkOptions,
    getUrgentWorkById,
    updateUrgentWork,
    updateUrgentWorkStatus,
    deleteUrgentWork,
};
