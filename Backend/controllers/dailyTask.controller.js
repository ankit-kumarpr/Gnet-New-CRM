const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const DailyTask = require("../models/DailyTask");
const { PRIORITIES, STATUSES } = require("../models/DailyTask");
const User = require("../models/User");
const SoftwareSetting = require("../models/SoftwareSetting");
const { downlineIds } = require("../utils/reporting");

const STATUS_LABELS = {
    PENDING: "Pending",
    DONE: "Done",
    PARTIAL: "Partially pending",
    HOLD: "Hold",
};

const PRIORITY_LABELS = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    URGENT: "Urgent",
};

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
const isAdmin = (user) => user?.userType === "ADMIN";

const TASK_ACCESS = ["VIEW_DAILY_TASKS", "MANAGE_DAILY_TASKS", "CREATE_DAILY_TASKS", "EDIT_DAILY_TASKS", "DELETE_DAILY_TASKS"];

// VIEW_DAILY_TASKS = own/team assigned tasks. Only manage/admin see every task.
const seesEveryTask = (user) => isAdmin(user) || permissionGranted(user, ["MANAGE_DAILY_TASKS"]);

const readText = (value, max, label, { required = false } = {}) => {
    const text = String(value || "").trim();
    if (!text) {
        if (required) fail(`${label} is required`);
        return "";
    }
    if (text.length > max) fail(`${label} cannot be longer than ${max} characters`);
    return text;
};

const readDay = (value, label = "Date") => {
    const text = String(value || "").trim();
    if (!text) fail(`${label} is required`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) fail(`${label} must be a valid date`);
    const date = new Date(`${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) fail(`${label} must be a valid date`);
    return date;
};

const dayRange = (value) => {
    const start = readDay(value);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { $gte: start, $lt: end };
};

const formatDay = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
};

const parseStatuses = (value) => {
    if (!value) return [];
    const statuses = [...new Set(String(value).split(",").map((item) => item.trim()).filter(Boolean))];
    if (!statuses.length || statuses.some((item) => !STATUSES.includes(item))) {
        fail("Invalid status");
    }
    return statuses;
};

const dateSpan = (from, to) => {
    if (!from && !to) return null;
    if (from && to) {
        const start = readDay(from, "From date");
        const end = readDay(to, "To date");
        if (end < start) fail("To date cannot be before from date");
        const until = new Date(end);
        until.setDate(until.getDate() + 1);
        return { $gte: start, $lt: until };
    }
    if (from) {
        const start = readDay(from, "From date");
        return { $gte: start };
    }
    const end = readDay(to, "To date");
    const until = new Date(end);
    until.setDate(until.getDate() + 1);
    return { $lt: until };
};

const buildTaskFilter = async (user, query = {}) => {
    const filter = {};
    const visible = await visiblePeople(user);
    if (visible) filter.assignee = { $in: visible };

    if (query.assignee) {
        if (!mongoose.Types.ObjectId.isValid(query.assignee)) fail("Invalid employee");
        if (visible && !visible.some((id) => String(id) === String(query.assignee))) {
            fail("You cannot view this employee", 403);
        }
        filter.assignee = query.assignee;
    }

    if (query.date) filter.date = dayRange(query.date);
    const span = dateSpan(query.from, query.to);
    if (span) filter.date = span;

    const statuses = parseStatuses(query.status);
    if (statuses.length === 1) filter.status = statuses[0];
    else if (statuses.length > 1) filter.status = { $in: statuses };

    if (query.priority) {
        if (!PRIORITIES.includes(query.priority)) fail("Invalid priority");
        filter.priority = query.priority;
    }

    if (query.search) {
        const regex = { $regex: escapeRegex(query.search), $options: "i" };
        filter.$or = [
            { title: regex },
            { work: regex },
            { workDone: regex },
            { pendingWork: regex },
            { remark: regex },
        ];
    }

    return filter;
};

const visiblePeople = async (user) => {
    if (seesEveryTask(user)) return null;
    const downline = await downlineIds(user._id);
    return [user._id, ...downline];
};

const canAssignTo = async (user, assigneeId) => {
    if (seesEveryTask(user)) return true;
    const allowed = new Set((await visiblePeople(user)).map((id) => String(id)));
    return allowed.has(String(assigneeId));
};

const loadDownlineSet = async (user) => {
    if (!user || isAdmin(user) || seesEveryTask(user)) return null;
    return new Set((await downlineIds(user._id)).map((id) => String(id)));
};

const canSeeTask = async (task, user, downlineSet = null) => {
    if (!task) return false;
    if (seesEveryTask(user)) return true;
    const assigneeId = String(task.assignee?._id || task.assignee);
    if (assigneeId === String(user._id)) return true;
    if (String(task.createdBy?._id || task.createdBy) === String(user._id)) return true;
    const downline = downlineSet || await loadDownlineSet(user);
    return downline ? downline.has(assigneeId) : false;
};

const canEditTask = async (task, user, downlineSet = null) => {
    if (!task) return false;
    if (isAdmin(user)) return true;
    if (String(task.createdBy?._id || task.createdBy) === String(user._id)) return true;
    const assigneeId = String(task.assignee?._id || task.assignee);
    if (assigneeId === String(user._id)) return true;
    const downline = downlineSet || await loadDownlineSet(user);
    return downline ? downline.has(assigneeId) : false;
};

const canDeleteTask = async (task, user, downlineSet = null) => {
    if (!task) return false;
    if (isAdmin(user)) return true;
    if (String(task.createdBy?._id || task.createdBy) === String(user._id)) return true;
    const assigneeId = String(task.assignee?._id || task.assignee);
    const downline = downlineSet || await loadDownlineSet(user);
    return downline ? downline.has(assigneeId) : false;
};

const withPeople = (query) => query
    .populate("assignee", "name")
    .populate("createdBy", "name");

const presentTask = (task, flags = {}) => ({
    ...task,
    status: STATUSES.includes(task?.status) ? task.status : "PENDING",
    ...flags,
});

const readAssignee = async (value, user) => {
    const id = String(value || "").trim();
    if (!id || !mongoose.Types.ObjectId.isValid(id)) fail("Select an employee");
    if (!(await canAssignTo(user, id))) fail("You can only assign tasks to yourself or your team");
    const person = await User.findOne({
        _id: id,
        status: "ACTIVE",
        userType: { $in: ["ADMIN", "EMPLOYEE"] },
    }).select("_id");
    if (!person) fail("Select an active employee");
    return person._id;
};

const readProgress = (body, { requireProgress = false } = {}) => {
    const status = body.status || "PENDING";
    if (!STATUSES.includes(status)) fail("Select a valid status");

    const workDone = readText(body.workDone, 2000, "Work done");
    const pendingWork = readText(body.pendingWork, 2000, "Pending work");

    if (requireProgress && !workDone) fail("Enter what work was completed");
    if (status === "PARTIAL" && (requireProgress || pendingWork || workDone) && !pendingWork) {
        fail("Enter what is still pending");
    }
    if (status === "DONE") {
        return { status, workDone, pendingWork: "" };
    }
    if (status === "PENDING") {
        return { status, workDone: workDone || "", pendingWork: "" };
    }
    return { status, workDone, pendingWork };
};

const readFields = async (body, user) => {
    const title = readText(body.title, 200, "Title", { required: true });
    if (title.length < 2) fail("Title must be at least 2 characters");
    const work = readText(body.work, 2000, "Work", { required: true });
    const priority = body.priority || "MEDIUM";
    if (!PRIORITIES.includes(priority)) fail("Select a valid priority");
    const progress = readProgress(body, { requireProgress: false });
    return {
        assignee: await readAssignee(body.assignee, user),
        date: readDay(body.date),
        title,
        work,
        priority,
        ...progress,
        remark: readText(body.remark, 2000, "Remark"),
    };
};

const getDailyTaskOptions = async (req, res, next) => {
    try {
        const peopleFilter = { status: "ACTIVE", userType: { $in: ["ADMIN", "EMPLOYEE"] } };
        const visible = await visiblePeople(req.user);
        if (visible) peopleFilter._id = { $in: visible };

        const employees = await User.find(peopleFilter)
            .select("name")
            .sort({ name: 1 })
            .limit(500)
            .lean();

        res.status(200).json({
            success: true,
            data: {
                employees,
                priorities: PRIORITIES,
                statuses: STATUSES,
            },
        });
    } catch (error) {
        next(error);
    }
};

const createDailyTask = async (req, res, next) => {
    try {
        const fields = await readFields(req.body, req.user);
        const task = await DailyTask.create({ ...fields, createdBy: req.user._id });
        const data = await withPeople(DailyTask.findById(task._id)).lean();
        res.status(201).json({
            success: true,
            data: presentTask(data, {
                canEdit: true,
                canDelete: true,
            }),
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const getDailyTasks = async (req, res, next) => {
    try {
        const { search, assignee, date, status, priority, page = 1, limit = 10 } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);
        const filter = {};
        const clauses = [];

        const visible = await visiblePeople(req.user);
        if (visible) filter.assignee = { $in: visible };

        if (assignee) {
            if (!mongoose.Types.ObjectId.isValid(assignee)) {
                return res.status(400).json({ success: false, message: "Invalid employee" });
            }
            if (visible && !visible.some((id) => String(id) === String(assignee))) {
                return res.status(403).json({ success: false, message: "You cannot view this employee" });
            }
            filter.assignee = assignee;
        }
        if (date) filter.date = dayRange(date);
        if (status) {
            const statuses = [...new Set(String(status).split(",").map((item) => item.trim()).filter(Boolean))];
            if (!statuses.length || statuses.some((item) => !STATUSES.includes(item))) {
                return res.status(400).json({ success: false, message: "Invalid status" });
            }
            filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
        }
        if (priority) {
            if (!PRIORITIES.includes(priority)) return res.status(400).json({ success: false, message: "Invalid priority" });
            filter.priority = priority;
        }
        if (search) {
            const regex = { $regex: escapeRegex(search), $options: "i" };
            clauses.push({
                $or: [
                    { title: regex },
                    { work: regex },
                    { workDone: regex },
                    { pendingWork: regex },
                    { remark: regex },
                ],
            });
        }
        if (clauses.length) filter.$and = clauses;

        const countFilter = { isDeleted: { $ne: true }, ...filter };
        delete countFilter.status;
        if (typeof countFilter.assignee === "string" && mongoose.Types.ObjectId.isValid(countFilter.assignee)) {
            countFilter.assignee = new mongoose.Types.ObjectId(countFilter.assignee);
        } else if (countFilter.assignee?.$in) {
            countFilter.assignee = {
                $in: countFilter.assignee.$in.map((id) => (
                    id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
                )),
            };
        }

        const [total, rows, statusCounts] = await Promise.all([
            DailyTask.countDocuments(filter),
            withPeople(DailyTask.find(filter)).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            DailyTask.aggregate([
                { $match: countFilter },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ]),
        ]);

        const counts = Object.fromEntries(STATUSES.map((item) => [item, 0]));
        statusCounts.forEach((row) => {
            if (row._id && counts[row._id] != null) counts[row._id] = row.count;
        });
        counts.OPEN = (counts.PENDING || 0) + (counts.PARTIAL || 0);
        counts.ALL = STATUSES.reduce((sum, item) => sum + (counts[item] || 0), 0);

        const downlineSet = await loadDownlineSet(req.user);
        const data = rows.map((row) => presentTask(row, {
            canEdit: isAdmin(req.user)
                || String(row.createdBy?._id || row.createdBy) === String(req.user._id)
                || String(row.assignee?._id || row.assignee) === String(req.user._id)
                || Boolean(downlineSet?.has(String(row.assignee?._id || row.assignee))),
            canDelete: isAdmin(req.user)
                || String(row.createdBy?._id || row.createdBy) === String(req.user._id)
                || Boolean(downlineSet?.has(String(row.assignee?._id || row.assignee))),
        }));

        res.status(200).json({
            success: true,
            data,
            counts,
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum },
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const getDailyTaskById = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid task ID format" });
        }
        const task = await withPeople(DailyTask.findById(req.params.id)).lean();
        if (!(await canSeeTask(task, req.user))) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }
        res.status(200).json({
            success: true,
            data: presentTask(task, {
                canEdit: await canEditTask(task, req.user),
                canDelete: await canDeleteTask(task, req.user),
            }),
        });
    } catch (error) {
        next(error);
    }
};

const updateDailyTask = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid task ID format" });
        }
        const task = await DailyTask.findById(req.params.id);
        if (!(await canEditTask(task, req.user))) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }

        const fields = await readFields(req.body, req.user);
        Object.assign(task, fields);
        await task.save();

        const data = await withPeople(DailyTask.findById(task._id)).lean();
        res.status(200).json({
            success: true,
            data: presentTask(data, {
                canEdit: true,
                canDelete: await canDeleteTask(data, req.user),
            }),
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const updateDailyTaskStatus = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid task ID format" });
        }

        const task = await DailyTask.findById(req.params.id);
        if (!(await canEditTask(task, req.user))) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }

        const progress = readProgress(req.body, { requireProgress: true });
        Object.assign(task, progress);
        await task.save();
        const data = await withPeople(DailyTask.findById(task._id)).lean();

        const { notify } = require("../utils/notify");
        const who = data.assignee?.name || req.user.name || "Employee";
        await notify({
            type: "DAILY_TASK_UPDATE",
            title: `${who} submitted evening update`,
            body: `${data.title} · ${progress.status}`,
            href: "/dashboard/daily-tasks",
            actorId: req.user._id,
            extraUserIds: [],
        });

        res.status(200).json({
            success: true,
            data: presentTask(data, {
                canEdit: true,
                canDelete: await canDeleteTask(data, req.user),
            }),
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const getDailyTaskAlerts = async (req, res, next) => {
    try {
        const filter = {
            status: { $in: ["PENDING", "PARTIAL"] },
        };
        const visible = await visiblePeople(req.user);
        if (visible) filter.assignee = { $in: visible };

        const [rows, pending, partial] = await Promise.all([
            withPeople(DailyTask.find(filter))
                .sort({ date: 1, priority: -1, createdAt: 1 })
                .limit(20)
                .lean(),
            DailyTask.countDocuments({ ...filter, status: "PENDING" }),
            DailyTask.countDocuments({ ...filter, status: "PARTIAL" }),
        ]);

        res.status(200).json({
            success: true,
            data: {
                openCount: pending + partial,
                pending,
                partial,
                tasks: rows.map((row) => ({
                    _id: row._id,
                    title: row.title,
                    work: row.work,
                    status: row.status,
                    priority: row.priority,
                    date: row.date,
                    pendingWork: row.pendingWork || "",
                    assignee: row.assignee ? { _id: row.assignee._id, name: row.assignee.name } : null,
                })),
            },
        });
    } catch (error) {
        next(error);
    }
};

const exportDailyTasks = async (req, res, next) => {
    try {
        if (!req.query.from || !req.query.to) {
            return res.status(400).json({ success: false, message: "Select from and to date for the report" });
        }

        const filter = await buildTaskFilter(req.user, req.query);
        const [rows, brand, assignee] = await Promise.all([
            withPeople(DailyTask.find(filter)).sort({ date: 1, status: 1, createdAt: 1 }).limit(10000).lean(),
            SoftwareSetting.findOne({ key: "software" }).select("companyName").lean(),
            req.query.assignee && mongoose.Types.ObjectId.isValid(req.query.assignee)
                ? User.findById(req.query.assignee).select("name").lean()
                : Promise.resolve(null),
        ]);

        const summary = Object.fromEntries(STATUSES.map((item) => [item, 0]));
        rows.forEach((row) => {
            if (summary[row.status] != null) summary[row.status] += 1;
        });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = brand?.companyName || "CRM";
        workbook.created = new Date();

        const sheet = workbook.addWorksheet("Daily Task Report", {
            views: [{ state: "frozen", ySplit: 10 }],
            pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
        });

        const company = brand?.companyName?.trim() || "Company";
        const statusText = req.query.status
            ? parseStatuses(req.query.status).map((item) => STATUS_LABELS[item] || item).join(", ")
            : "All statuses";
        const generatedAt = new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date());

        sheet.mergeCells("A1:J1");
        sheet.getCell("A1").value = company;
        sheet.getCell("A1").font = { bold: true, size: 18, color: { argb: "FF064E3B" } };
        sheet.getCell("A1").alignment = { vertical: "middle" };

        sheet.mergeCells("A2:J2");
        sheet.getCell("A2").value = "Daily Task Report";
        sheet.getCell("A2").font = { bold: true, size: 14, color: { argb: "FF0F766E" } };

        sheet.mergeCells("A3:J3");
        sheet.getCell("A3").value = `Period: ${formatDay(req.query.from)} to ${formatDay(req.query.to)}`;
        sheet.getCell("A3").font = { size: 11, color: { argb: "FF334155" } };

        sheet.mergeCells("A4:J4");
        sheet.getCell("A4").value = [
            `Status: ${statusText}`,
            `Employee: ${assignee?.name || "All visible employees"}`,
            `Generated by: ${req.user.name || "User"}`,
            `Generated at: ${generatedAt}`,
        ].join("  |  ");
        sheet.getCell("A4").font = { size: 10, color: { argb: "FF64748B" } };

        sheet.addRow([]);
        const summaryRow = sheet.addRow([
            "Summary",
            `Pending: ${summary.PENDING}`,
            `Partially pending: ${summary.PARTIAL}`,
            `Hold: ${summary.HOLD}`,
            `Done: ${summary.DONE}`,
            `Total: ${rows.length}`,
        ]);
        summaryRow.font = { bold: true, color: { argb: "FF065F46" } };
        summaryRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECFDF5" } };

        sheet.addRow([]);
        sheet.addRow([]);

        const headers = [
            "Date",
            "Employee",
            "Title",
            "Assigned work",
            "Priority",
            "Status",
            "Work done",
            "Pending / Hold note",
            "Remark",
            "Assigned by",
        ];
        const headerRow = sheet.addRow(headers);
        headerRow.height = 24;
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
            cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
            cell.border = {
                top: { style: "thin", color: { argb: "FF047857" } },
                bottom: { style: "thin", color: { argb: "FF047857" } },
                left: { style: "thin", color: { argb: "FF047857" } },
                right: { style: "thin", color: { argb: "FF047857" } },
            };
        });

        const statusFill = {
            PENDING: "FFFEF3C7",
            PARTIAL: "FFFFEDD5",
            HOLD: "FFF1F5F9",
            DONE: "FFD1FAE5",
        };

        rows.forEach((row) => {
            const dataRow = sheet.addRow([
                formatDay(row.date),
                row.assignee?.name || "",
                row.title || "",
                row.work || "",
                PRIORITY_LABELS[row.priority] || row.priority || "",
                STATUS_LABELS[row.status] || row.status || "",
                row.workDone || "",
                row.pendingWork || "",
                row.remark || "",
                row.createdBy?.name || "",
            ]);
            dataRow.eachCell((cell) => {
                cell.alignment = { vertical: "top", wrapText: true };
                cell.border = {
                    top: { style: "thin", color: { argb: "FFE2E8F0" } },
                    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
                    left: { style: "thin", color: { argb: "FFE2E8F0" } },
                    right: { style: "thin", color: { argb: "FFE2E8F0" } },
                };
            });
            const fill = statusFill[row.status];
            if (fill) {
                dataRow.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
                dataRow.getCell(6).font = { bold: true };
            }
        });

        if (!rows.length) {
            const empty = sheet.addRow(["No tasks found for the selected filters."]);
            sheet.mergeCells(`A${empty.number}:J${empty.number}`);
            empty.getCell(1).font = { italic: true, color: { argb: "FF64748B" } };
        }

        sheet.columns = [
            { width: 14 },
            { width: 18 },
            { width: 28 },
            { width: 34 },
            { width: 12 },
            { width: 18 },
            { width: 30 },
            { width: 28 },
            { width: 22 },
            { width: 16 },
        ];

        if (rows.length) {
            sheet.autoFilter = {
                from: { row: headerRow.number, column: 1 },
                to: { row: headerRow.number + rows.length, column: headers.length },
            };
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const filename = `daily-task-report-${req.query.from}-to-${req.query.to}.xlsx`;
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.status(200).send(Buffer.from(buffer));
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const deleteDailyTask = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid task ID format" });
        }
        const task = await DailyTask.findById(req.params.id);
        if (!(await canDeleteTask(task, req.user))) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }
        task.isDeleted = true;
        task.deletedAt = new Date();
        task.deletedBy = req.user._id;
        await task.save();
        res.status(200).json({
            success: true,
            message: "Task deleted",
            data: {
                _id: task._id,
                deletedAt: task.deletedAt,
                deletedBy: req.user._id,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createDailyTask,
    getDailyTasks,
    getDailyTaskOptions,
    getDailyTaskAlerts,
    getDailyTaskById,
    updateDailyTask,
    updateDailyTaskStatus,
    exportDailyTasks,
    deleteDailyTask,
};
