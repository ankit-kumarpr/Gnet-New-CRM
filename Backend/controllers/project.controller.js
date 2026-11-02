const mongoose = require("mongoose");
const Project = require("../models/Project");
const { PRIORITIES, STATUSES } = require("../models/Project");
const User = require("../models/User");
const Client = require("../models/Client");
const { downlineIds } = require("../utils/reporting");
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePagination = (page, limit) => {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * limitNum;
    return { pageNum, limitNum, skip };
};

const fail = (message) => {
    const error = new Error(message);
    error.status = 400;
    throw error;
};

const cleanHtml = (value) => {
    const text = String(value || "")
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
        .replace(/\son\w+=("[^"]*"|'[^']*')/gi, "")
        .trim();
    const plain = text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    if (!plain) return "";
    if (text.length > 20000) fail("Description is too long");
    return text;
};

const readText = (value, max, label) => {
    const text = String(value || "").trim();
    if (text.length > max) fail(`${label} cannot be longer than ${max} characters`);
    return text;
};

const readDay = (value, label) => {
    const text = String(value || "").trim();
    if (!text) fail(`${label} is required`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) fail(`${label} must be a valid date`);
    const date = new Date(`${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) fail(`${label} must be a valid date`);
    return date;
};

const dayRange = (value) => {
    const start = readDay(value, "EOD");
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { $gte: start, $lt: end };
};

const activePeople = async (ids) => {
    if (!ids.length) return [];
    return User.find({
        _id: { $in: ids },
        status: "ACTIVE",
        userType: { $in: ["ADMIN", "EMPLOYEE"] },
    }).select("_id");
};

const readPeople = async (value, label, { min, allowed = [] }) => {
    const raw = Array.isArray(value) ? value : String(value || "").split(",").filter(Boolean);
    const ids = [...new Set(raw.map((item) => String(item || "").trim()).filter(Boolean))];
    if (ids.length < min) fail(label === "reporting manager" ? "Select a reporting manager" : "Select at least one working employee");
    if (ids.length > 50) fail("You can select up to 50 employees");
    if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) fail(label === "reporting manager" ? "Select a reporting manager" : "Select valid working employees");

    const kept = new Set(allowed.map((id) => String(id)));
    const fresh = ids.filter((id) => !kept.has(id));
    const found = await activePeople(fresh);
    if (found.length !== fresh.length) fail("Select active employees");
    return ids;
};

const { summarizeWork, suggestModeFromName } = require("../utils/workPlanBuilder");

const readServiceAssignments = async (clientId, assignmentsValue, current = {}) => {
    const id = String(clientId || "").trim();
    if (!id || !mongoose.Types.ObjectId.isValid(id)) fail("Select a client");
    const client = await Client.findById(id).populate("services", "name").lean();
    if (!client) fail("Client not found");

    const serviceById = new Map((client.services || []).map((item) => [String(item._id || item), item]));
    const allowedServices = new Set([...serviceById.keys()]);
    if (!allowedServices.size) fail("This client has no services yet. Add services on the client first.");

    if (!Array.isArray(assignmentsValue) || !assignmentsValue.length) {
        fail("Assign an employee and work for each service");
    }

    const seenServices = new Set();
    const assignments = [];
    for (const row of assignmentsValue) {
        const service = String(row?.service || "").trim();
        const employee = String(row?.employee || "").trim();
        let work = readText(row?.work, 2000, "Service work");
        const workPlan = row?.workPlan && typeof row.workPlan === "object" ? row.workPlan : null;
        if (!service || !mongoose.Types.ObjectId.isValid(service)) fail("Select a valid service");
        if (!allowedServices.has(service)) fail("Select services that belong to this client");
        if (seenServices.has(service)) fail("Each service can only be assigned once");
        seenServices.add(service);
        if (!employee || !mongoose.Types.ObjectId.isValid(employee)) fail("Select an employee for each service");

        if (workPlan) {
            const mode = String(workPlan.mode || suggestModeFromName(serviceById.get(service)?.name || "")).toUpperCase();
            const summary = summarizeWork(mode, workPlan.deliverables || [], workPlan.phases || []);
            if (!summary) fail("Set deliverables or phase % for each service work plan");
            work = summary.slice(0, 2000);
        }
        if (!work) fail("Enter what needs to be done for each service");

        const serviceName = serviceById.get(service)?.name || "service";
        const eodRaw = String(row?.eod || "").trim();
        const serviceEod = eodRaw ? readDay(eodRaw, `${serviceName} EOD`) : null;

        assignments.push({ service, employee, work, workPlan, eod: serviceEod });
    }

    if ([...allowedServices].some((service) => !seenServices.has(service))) {
        fail("Assign an employee and work for every client service");
    }

    const employeeIds = [...new Set(assignments.map((item) => item.employee))];
    const workingEmployees = await readPeople(employeeIds, "working employee", {
        min: 1,
        allowed: [
            ...(current.workingEmployees || []),
            ...((current.serviceAssignments || []).map((item) => item.employee).filter(Boolean)),
        ],
    });

    return {
        client: id,
        services: assignments.map((item) => item.service),
        serviceAssignments: assignments.map(({ service, employee, work, eod }) => ({ service, employee, work, eod })),
        workPlans: assignments.map(({ service, employee, workPlan, eod }) => ({ service, employee, workPlan, eod })),
        workingEmployees,
        serviceNames: Object.fromEntries([...serviceById.entries()].map(([key, value]) => [key, value?.name || ""])),
    };
};

const readProject = async (body, current = {}) => {
    const name = readText(body.name, 120, "Project name");
    if (name.length < 2) fail("Project name must be at least 2 characters");
    const priority = body.priority || "MEDIUM";
    if (!PRIORITIES.includes(priority)) fail("Select a valid priority");

    const {
        client,
        services,
        serviceAssignments,
        workPlans,
        workingEmployees,
        serviceNames,
    } = await readServiceAssignments(
        body.client,
        body.serviceAssignments,
        current
    );

    const reportingManager = (await readPeople(body.reportingManager, "reporting manager", {
        min: 1,
        allowed: current.reportingManager ? [current.reportingManager] : [],
    }))[0];

    const projectEod = readDay(body.eod, "EOD");
    const withEod = serviceAssignments.map((row) => ({
        ...row,
        eod: row.eod || projectEod,
    }));

    return {
        name,
        description: cleanHtml(body.description),
        client,
        services,
        serviceAssignments: withEod.map(({ service, employee, work, eod }) => ({ service, employee, work, eod })),
        workPlans: (workPlans || []).map((row, index) => ({
            ...row,
            eod: row.eod || withEod[index]?.eod || projectEod,
        })),
        serviceNames,
        reportingManager,
        workingEmployees,
        priority,
        eod: projectEod,
        remark: readText(body.remark, 2000, "Remark"),
    };
};

const syncProjectWorkPlans = async ({ project, fields, userId, startDate }) => {
    const { upsertWorkPlan } = require("../utils/workPlanBuilder");
    const plans = fields.workPlans || [];
    for (const row of plans) {
        if (!row.workPlan) continue;
        await upsertWorkPlan({
            clientId: fields.client,
            projectId: project._id,
            serviceId: row.service,
            serviceName: fields.serviceNames?.[String(row.service)] || "",
            mode: row.workPlan.mode,
            startDate: startDate || new Date(),
            endDate: row.eod || fields.eod,
            reportingManager: fields.reportingManager,
            assignees: [row.employee].filter(Boolean),
            deliverables: row.workPlan.deliverables,
            phases: row.workPlan.phases,
            createdBy: userId,
        });
    }
};

const { permissionGranted } = require("../utils/permissions");
const PROJECT_ACCESS = ["VIEW_PROJECTS", "MANAGE_PROJECTS", "CREATE_PROJECTS", "EDIT_PROJECTS", "DELETE_PROJECTS"];

// VIEW_PROJECTS = module access (own assignments). Only manage/admin see every project.
const seesEveryProject = (user) => user?.userType === "ADMIN" || permissionGranted(user, ["MANAGE_PROJECTS"]);

const isOnProject = (project, userId) => {
    const managerId = project.reportingManager?._id || project.reportingManager;
    if (String(managerId) === String(userId)) return true;
    if ((project.workingEmployees || []).some((person) => String(person?._id || person) === String(userId))) return true;
    return (project.serviceAssignments || []).some((row) => String(row?.employee?._id || row?.employee) === String(userId));
};

const canSeeProject = (project, user) => {
    if (!project) return false;
    if (seesEveryProject(user)) return true;
    return isOnProject(project, user._id);
};

const memberIds = (project) => {
    const managerId = String(project.reportingManager?._id || project.reportingManager || "");
    const workers = (project.workingEmployees || []).map((person) => String(person?._id || person));
    const assigned = (project.serviceAssignments || []).map((row) => String(row?.employee?._id || row?.employee || ""));
    return [managerId, ...workers, ...assigned].filter(Boolean);
};

const isSeniorOf = (project, downline) => memberIds(project).some((id) => downline.has(id));

const canUpdateStatus = (project, user, downline) => {
    if (!project) return false;
    if (user.userType === "ADMIN") return true;
    if (isOnProject(project, user._id)) return true;
    return isSeniorOf(project, downline);
};

const canOpenProject = async (project, user) => {
    if (canSeeProject(project, user)) return true;
    if (!project) return false;
    const downline = new Set((await downlineIds(user._id)).map((item) => String(item)));
    return isSeniorOf(project, downline);
};

const presentProject = (project, extra = {}) => ({
    ...project,
    status: STATUSES.includes(project?.status) ? project.status : "START",
    ...extra,
});

const canSeeAllAssignments = (project, user, downline) => {
    if (!project || !user) return false;
    if (seesEveryProject(user)) return true;
    const managerId = project.reportingManager?._id || project.reportingManager;
    if (String(managerId) === String(user._id)) return true;
    return isSeniorOf(project, downline);
};

const shapeForViewer = (project, user, downline, extra = {}) => {
    const data = presentProject(project, {
        canUpdateStatus: canUpdateStatus(project, user, downline),
        ...extra,
    });
    if (canSeeAllAssignments(project, user, downline)) {
        return { ...data, canSeeAllAssignments: true };
    }

    const mine = (data.serviceAssignments || []).filter(
        (row) => String(row?.employee?._id || row?.employee) === String(user._id)
    );
    return {
        ...data,
        canSeeAllAssignments: false,
        serviceAssignments: mine,
        services: mine.map((row) => row.service).filter(Boolean),
        workingEmployees: (data.workingEmployees || []).filter(
            (person) => String(person?._id || person) === String(user._id)
        ),
    };
};

const withPeople = (query) => query
    .populate("client", "name phone email")
    .populate("services", "name")
    .populate("serviceAssignments.service", "name")
    .populate("serviceAssignments.employee", "name")
    .populate("reportingManager", "name")
    .populate("workingEmployees", "name")
    .populate("createdBy", "name");

const createProject = async (req, res, next) => {
    try {
        const fields = await readProject(req.body);
        const {
            workPlans,
            serviceNames,
            ...projectFields
        } = fields;
        const project = await Project.create({ ...projectFields, status: "START", createdBy: req.user._id });
        await syncProjectWorkPlans({
            project,
            fields: { ...fields, workPlans, serviceNames },
            userId: req.user._id,
            startDate: new Date(),
        });
        const { notify } = require("../utils/notify");
        const assigneeIds = [
            fields.reportingManager,
            ...(fields.workingEmployees || []),
            ...((fields.serviceAssignments || []).map((row) => row.employee)),
        ].filter(Boolean);
        await notify({
            type: "PROJECT_NEW",
            title: `New project: ${project.name}`,
            body: "Project started",
            href: `/dashboard/projects/${project._id}`,
            actorId: req.user._id,
            extraUserIds: assigneeIds,
        });
        const data = await withPeople(Project.findById(project._id)).lean();
        const downline = req.user.userType === "ADMIN"
            ? new Set()
            : new Set((await downlineIds(req.user._id)).map((item) => String(item)));
        res.status(201).json({
            success: true,
            data: shapeForViewer(data, req.user, downline),
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const getProjects = async (req, res, next) => {
    try {
        const { search, priority, status, reportingManager, employee, eod, page = 1, limit = 10 } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);
        const filter = {};
        const clauses = [];
        if (!seesEveryProject(req.user)) {
            const downline = await downlineIds(req.user._id);
            const visiblePeople = [req.user._id, ...downline];
            clauses.push({
                $or: [
                    { reportingManager: { $in: visiblePeople } },
                    { workingEmployees: { $in: visiblePeople } },
                    { "serviceAssignments.employee": { $in: visiblePeople } },
                ],
            });
        }

        if (priority) {
            if (!PRIORITIES.includes(priority)) return res.status(400).json({ success: false, message: "Invalid priority" });
            filter.priority = priority;
        }
        if (status) {
            if (!STATUSES.includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });
            if (status === "START") {
                clauses.push({ $or: [{ status: "START" }, { status: { $exists: false } }, { status: null }] });
            } else {
                filter.status = status;
            }
        }
        if (reportingManager && seesEveryProject(req.user)) {
            if (!mongoose.Types.ObjectId.isValid(reportingManager)) {
                return res.status(400).json({ success: false, message: "Invalid reporting manager" });
            }
            filter.reportingManager = reportingManager;
        }
        if (employee) {
            if (!mongoose.Types.ObjectId.isValid(employee)) {
                return res.status(400).json({ success: false, message: "Invalid employee" });
            }
            clauses.push({
                $or: [
                    { workingEmployees: employee },
                    { "serviceAssignments.employee": employee },
                ],
            });
        }
        if (eod) filter.eod = dayRange(eod);
        if (search) {
            const regex = { $regex: escapeRegex(search), $options: "i" };
            const matchedClients = await Client.find({ name: regex }).select("_id").limit(50).lean();
            const clientIds = matchedClients.map((item) => item._id);
            clauses.push({
                $or: [
                    { name: regex },
                    { remark: regex },
                    ...(clientIds.length ? [{ client: { $in: clientIds } }] : []),
                ],
            });
        }
        if (clauses.length) filter.$and = clauses;

        const [total, rows, downlineList] = await Promise.all([
            Project.countDocuments(filter),
            withPeople(Project.find(filter)).sort({ eod: 1, createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            req.user.userType === "ADMIN" ? Promise.resolve([]) : downlineIds(req.user._id),
        ]);
        const downline = new Set(downlineList.map((item) => String(item)));

        res.status(200).json({
            success: true,
            data: rows.map((row) => shapeForViewer(row, req.user, downline)),
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum },
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const getProjectEmployees = async (req, res, next) => {
    try {
        const people = await User.find({ status: "ACTIVE", userType: { $in: ["ADMIN", "EMPLOYEE"] } })
            .select("name")
            .sort({ name: 1 })
            .limit(500)
            .lean();
        res.status(200).json({ success: true, data: people });
    } catch (error) {
        next(error);
    }
};

const getProjectClients = async (req, res, next) => {
    try {
        const clients = await Client.find({})
            .select("name phone email services")
            .populate("services", "name")
            .sort({ name: 1 })
            .limit(500)
            .lean();
        res.status(200).json({ success: true, data: clients });
    } catch (error) {
        next(error);
    }
};

const getProjectById = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid project ID format" });
        }
        const project = await withPeople(Project.findById(req.params.id)).lean();
        if (!(await canOpenProject(project, req.user))) return res.status(404).json({ success: false, message: "Project not found" });
        const downline = req.user.userType === "ADMIN"
            ? new Set()
            : new Set((await downlineIds(req.user._id)).map((item) => String(item)));
        res.status(200).json({
            success: true,
            data: shapeForViewer(project, req.user, downline),
        });
    } catch (error) {
        next(error);
    }
};

const updateProject = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid project ID format" });
        }
        const project = await Project.findById(req.params.id);
        if (!canSeeProject(project, req.user)) return res.status(404).json({ success: false, message: "Project not found" });

        const fields = await readProject(req.body, {
            reportingManager: project.reportingManager,
            workingEmployees: project.workingEmployees,
            serviceAssignments: project.serviceAssignments,
        });
        const { workPlans, serviceNames, ...projectFields } = fields;
        Object.assign(project, projectFields);
        await project.save();
        await syncProjectWorkPlans({
            project,
            fields: { ...fields, workPlans, serviceNames },
            userId: req.user._id,
            startDate: project.createdAt || new Date(),
        });

        const data = await withPeople(Project.findById(project._id)).lean();
        const downline = req.user.userType === "ADMIN"
            ? new Set()
            : new Set((await downlineIds(req.user._id)).map((item) => String(item)));
        res.status(200).json({
            success: true,
            data: shapeForViewer(data, req.user, downline),
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const updateProjectStatus = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid project ID format" });
        }
        const status = String(req.body.status || "").trim();
        if (!STATUSES.includes(status)) return res.status(400).json({ success: false, message: "Select a valid status" });

        const project = await Project.findById(req.params.id);
        if (!(await canOpenProject(project, req.user))) return res.status(404).json({ success: false, message: "Project not found" });
        const downline = req.user.userType === "ADMIN"
            ? new Set()
            : new Set((await downlineIds(req.user._id)).map((item) => String(item)));
        if (!canUpdateStatus(project, req.user, downline)) {
            return res.status(403).json({ success: false, message: "You cannot update this project status" });
        }

        const previous = project.status;
        project.status = status;
        await project.save();
        if (status === "PENDING" && previous !== "PENDING") {
            const { notify } = require("../utils/notify");
            await notify({
                type: "PROJECT_PENDING",
                title: `Project pending: ${project.name}`,
                body: `${req.user.name || "Someone"} marked it pending`,
                href: `/dashboard/projects/${project._id}`,
                actorId: req.user._id,
                extraUserIds: [project.reportingManager, ...(project.workingEmployees || [])],
            });
        }
        const data = await withPeople(Project.findById(project._id)).lean();
        res.status(200).json({
            success: true,
            data: shapeForViewer(data, req.user, downline, { canUpdateStatus: true }),
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const deleteProject = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid project ID format" });
        }
        const project = await Project.findById(req.params.id);
        if (!canSeeProject(project, req.user)) return res.status(404).json({ success: false, message: "Project not found" });
        project.isDeleted = true;
        project.deletedAt = new Date();
        project.deletedBy = req.user._id;
        await project.save();
        res.status(200).json({
            success: true,
            message: "Project deleted",
            data: {
                _id: project._id,
                deletedAt: project.deletedAt,
                deletedBy: req.user._id,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createProject,
    getProjects,
    getProjectEmployees,
    getProjectClients,
    getProjectById,
    updateProject,
    updateProjectStatus,
    deleteProject,
};
