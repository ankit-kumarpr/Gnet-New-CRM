const Lead = require("../models/Lead");
const Project = require("../models/Project");
const Ticket = require("../models/Ticket");
const LeaveRequest = require("../models/LeaveRequest");
const Attendance = require("../models/Attendance");
const UrgentWork = require("../models/UrgentWork");
const Interview = require("../models/Interview");
const Client = require("../models/Client");
const User = require("../models/User");
const Department = require("../models/Department");
const EmployeeType = require("../models/EmployeeType");
const WorkMode = require("../models/WorkMode");
const { seesAllLeads, leadTeamIds } = require("../utils/leadAccess");
const { startOfDay, addDays: addPlanDays } = require("../utils/workPlanSchedule");
const { loadPlansWithDaySlots } = require("../utils/dayWorkSlots");

const LEAD_PERMS = ["VIEW_LEADS", "MANAGE_LEADS", "CREATE_LEADS", "EDIT_LEADS", "DELETE_LEADS"];
const PROJECT_PERMS = ["VIEW_PROJECTS", "MANAGE_PROJECTS", "CREATE_PROJECTS", "EDIT_PROJECTS", "DELETE_PROJECTS"];
const STAFF_PERMS = ["VIEW_EMPLOYEES", "MANAGE_EMPLOYEES", "CREATE_EMPLOYEES", "EDIT_EMPLOYEES", "DELETE_EMPLOYEES"];
const DEPT_PERMS = ["VIEW_DEPARTMENTS", "MANAGE_DEPARTMENTS", "CREATE_DEPARTMENTS", "EDIT_DEPARTMENTS", "DELETE_DEPARTMENTS"];
const INTERVIEW_PERMS = ["VIEW_INTERVIEWS", "MANAGE_INTERVIEWS", "CREATE_INTERVIEWS", "EDIT_INTERVIEWS", "DELETE_INTERVIEWS"];
const CLIENT_PERMS = ["VIEW_CLIENTS", "MANAGE_CLIENTS", "CREATE_CLIENTS", "EDIT_CLIENTS", "DELETE_CLIENTS"];

const { permissionGranted } = require("../utils/permissions");
const hasPerm = (user, keys) => permissionGranted(user, keys);

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);

const whenLabel = (value) => {
    if (!value) return "";
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
};

const dayLabel = (value) => {
    if (!value) return "";
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(value));
};

const monthLabel = (value) => new Intl.DateTimeFormat("en-IN", { month: "short" }).format(value);

const startOfToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const addDays = (date, days) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const dayKey = (value) => {
    const date = new Date(value);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
};

const withScope = (scope, extra) => {
    if (!scope?.$or) return { ...scope, ...extra };
    return { $and: [{ $or: scope.$or }, extra] };
};

const todayWorkProgress = async (viewer) => {
    const today = startOfDay(new Date());
    const tomorrow = addPlanDays(today, 1);
    const admin = viewer.userType === "ADMIN";
    const team = admin ? null : await leadTeamIds(viewer);
    const teamSet = admin ? null : new Set((team || []).map(String));

    const { plans } = await loadPlansWithDaySlots(today, today);

    const byEmp = new Map();
    for (const plan of plans) {
        const managerId = String(plan.reportingManager?._id || plan.reportingManager || "");
        for (const slot of plan.slots || []) {
            const empId = String(slot.assignee?._id || slot.assignee || "");
            if (!empId) continue;
            if (!admin) {
                const visible = teamSet.has(empId) || managerId === String(viewer._id) || empId === String(viewer._id);
                if (!visible) continue;
            }
            if (!byEmp.has(empId)) {
                byEmp.set(empId, {
                    id: empId,
                    name: slot.assignee?.name || "Employee",
                    total: 0,
                    done: 0,
                });
            }
            const row = byEmp.get(empId);
            row.total += 1;
            if (slot.status === "DONE") row.done += 1;
            if (slot.assignee?.name) row.name = slot.assignee.name;
        }
    }

    const employees = [...byEmp.values()]
        .map((row) => {
            const pending = row.total - row.done;
            const percent = row.total ? Math.round((row.done / row.total) * 1000) / 10 : 0;
            return {
                ...row,
                pending,
                percent,
                status: percent >= 100 ? "DONE" : percent > 0 ? "PARTIAL" : "PENDING",
            };
        })
        .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));

    const teamTotal = employees.reduce((sum, row) => sum + row.total, 0);
    const teamDone = employees.reduce((sum, row) => sum + row.done, 0);
    const averagePercent = teamTotal ? Math.round((teamDone / teamTotal) * 1000) / 10 : 0;

    return {
        asOf: new Date().toISOString(),
        averagePercent,
        totalItems: teamTotal,
        doneItems: teamDone,
        pendingItems: Math.max(0, teamTotal - teamDone),
        employees,
    };
};

const shareRows = async (field, Model) => {
    const groups = await User.aggregate([
        { $match: { userType: "EMPLOYEE", status: "ACTIVE" } },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    ]);
    const ids = groups.map((row) => row._id).filter(Boolean);
    const docs = ids.length ? await Model.find({ _id: { $in: ids } }).select("name").lean() : [];
    const names = new Map(docs.map((doc) => [String(doc._id), doc.name]));
    const total = groups.reduce((sum, row) => sum + row.count, 0);
    return groups
        .map((row) => ({
            id: row._id ? String(row._id) : "",
            name: row._id ? (names.get(String(row._id)) || "Unknown") : "Unassigned",
            count: row.count,
            percent: total ? Math.round((row.count / total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

const getDashboard = async (req, res, next) => {
    try {
        const user = req.user;
        const admin = user.userType === "ADMIN";
        const staff = hasPerm(user, STAFF_PERMS);
        const today = startOfToday();
        const tomorrow = addDays(today, 1);
        const yesterday = addDays(today, -1);
        const from30 = addDays(today, -29);
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const hiringStart = new Date(today.getFullYear(), today.getMonth() - 5, 1);
        const monthName = new Intl.DateTimeFormat("en-IN", { month: "long" }).format(today);
        const seesProjects = admin || hasPerm(user, PROJECT_PERMS);
        const team = admin ? null : await leadTeamIds(user);
        const leadsFilter = seesAllLeads(user) ? {} : { $or: [{ assignedTo: { $in: team } }, { createdBy: { $in: team } }] };
        const projectsFilter = seesProjects
            ? { isDeleted: { $ne: true } }
            : { isDeleted: { $ne: true }, $or: [{ reportingManager: { $in: team } }, { workingEmployees: { $in: team } }] };
        const ticketFilter = admin ? {} : { raisedBy: { $in: team } };
        const leaveFilter = admin ? {} : { employee: { $in: team } };
        const workFilter = seesProjects
            ? { eod: { $lt: today } }
            : { $or: [{ createdBy: { $in: team } }, { assignees: { $in: team } }], eod: { $lt: today } };

        const activeEmployees = admin
            ? await User.find({ userType: "EMPLOYEE", status: "ACTIVE" }).select("_id").lean()
            : [];
        const activeIds = activeEmployees.map((row) => row._id);
        const activeSet = new Set(activeIds.map((id) => String(id)));

        const [
            totalEmployees,
            activeCount,
            departmentCount,
            joiningDates,
            departments,
            employeeTypes,
            workModes,
            punches,
            approvedLeave,
            leaveCreated,
            pendingLeave,
            personal,
            recentEmployees,
            recentLeaves,
            recentPunches,
            leadStats,
            projectStats,
            tickets,
            work,
            interviews,
            clients,
            dueLeads,
            lateProjects,
        ] = await Promise.all([
            staff ? User.countDocuments({ userType: "EMPLOYEE" }) : null,
            staff && !admin ? User.countDocuments({ userType: "EMPLOYEE", status: "ACTIVE" }) : null,
            staff && hasPerm(user, DEPT_PERMS) ? Department.countDocuments({ status: "ACTIVE" }) : null,
            staff
                ? User.find({ userType: "EMPLOYEE", joiningDate: { $gte: hiringStart, $lt: nextMonth } }).select("joiningDate").lean()
                : [],
            staff ? shareRows("department", Department) : [],
            staff ? shareRows("employeeType", EmployeeType) : [],
            staff ? shareRows("workMode", WorkMode) : [],
            admin && activeIds.length
                ? Attendance.aggregate([
                    {
                        $match: {
                            date: { $gte: from30, $lte: today },
                            user: { $in: activeIds },
                        },
                    },
                    {
                        $group: {
                            _id: { date: "$date", user: "$user" },
                        },
                    },
                    {
                        $group: {
                            _id: "$_id.date",
                            users: { $addToSet: "$_id.user" },
                        },
                    },
                ])
                : [],
            admin
                ? LeaveRequest.find({ status: "APPROVED", startDate: { $lte: today }, endDate: { $gte: from30 } })
                    .select("employee startDate endDate")
                    .limit(20000)
                    .lean()
                : [],
            LeaveRequest.find({ ...leaveFilter, createdAt: { $gte: from30, $lt: tomorrow } }).select("status createdAt").lean(),
            LeaveRequest.countDocuments({ ...leaveFilter, status: "PENDING" }),
            Attendance.findOne({ user: user._id, date: today }).select("punchIn.at punchOut.at").lean(),
            staff
                ? User.find({ userType: "EMPLOYEE" }).select("name createdAt").sort({ createdAt: -1 }).limit(5).lean()
                : [],
            LeaveRequest.find(leaveFilter).select("status createdAt reviewedAt employee").populate("employee", "name").sort({ updatedAt: -1 }).limit(5).lean(),
            admin
                ? Attendance.find({ date: today }).select("user punchIn.at").populate("user", "name").sort({ "punchIn.at": -1 }).limit(5).lean()
                : [],
            hasPerm(user, LEAD_PERMS)
                ? Lead.aggregate([
                    { $match: leadsFilter },
                    {
                        $group: {
                            _id: null,
                            open: { $sum: { $cond: [{ $in: ["$status", ["NEW", "CONTACTED", "INTERESTED", "FOLLOW_UP", "PROPOSAL"]] }, 1, 0] } },
                            due: { $sum: { $cond: [{ $and: [{ $not: [{ $in: ["$status", ["LOST", "CONVERTED", "PAYMENT"]] }] }, { $ne: ["$nextFollowUpAt", null] }, { $lt: ["$nextFollowUpAt", tomorrow] }] }, 1, 0] } },
                            sales: { $sum: { $cond: [{ $and: [{ $in: ["$status", ["CONVERTED", "PAYMENT"]] }, { $gte: ["$convertedAt", monthStart] }, { $lt: ["$convertedAt", nextMonth] }] }, 1, 0] } },
                            revenue: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "PAYMENT"] }, { $gte: ["$paymentAt", monthStart] }, { $lt: ["$paymentAt", nextMonth] }] }, "$amount", 0] } },
                        },
                    },
                ])
                : [],
            Project.aggregate([
                { $match: projectsFilter },
                {
                    $group: {
                        _id: null,
                        open: { $sum: { $cond: [{ $ne: ["$status", "COMPLETED"] }, 1, 0] } },
                        overdue: { $sum: { $cond: [{ $and: [{ $ne: ["$status", "COMPLETED"] }, { $lt: ["$eod", today] }] }, 1, 0] } },
                    },
                },
            ]),
            Ticket.countDocuments({ ...ticketFilter, status: "OPEN" }),
            UrgentWork.countDocuments(workFilter),
            hasPerm(user, INTERVIEW_PERMS) ? Interview.countDocuments({ status: { $in: ["SCHEDULED", "NEXT_ROUND"] } }) : null,
            hasPerm(user, CLIENT_PERMS) ? Client.countDocuments() : null,
            hasPerm(user, LEAD_PERMS)
                ? Lead.find(withScope(leadsFilter, {
                    status: { $nin: ["LOST", "CONVERTED", "PAYMENT"] },
                    nextFollowUpAt: { $ne: null, $lt: tomorrow },
                })).select("name nextFollowUpAt").sort({ nextFollowUpAt: 1 }).limit(5).lean()
                : [],
            Project.find(withScope(projectsFilter, { status: { $ne: "COMPLETED" }, eod: { $lt: today } }))
                .select("name eod").sort({ eod: 1 }).limit(5).lean(),
        ]);

        const punchedByDay = new Map();
        (punches || []).forEach((row) => {
            const key = dayKey(row._id);
            if (!punchedByDay.has(key)) punchedByDay.set(key, new Set());
            for (const userId of row.users || []) {
                punchedByDay.get(key).add(String(userId));
            }
        });
        const todayKey = dayKey(today);
        const presentSet = punchedByDay.get(todayKey) || new Set();
        const leaveByDay = new Map();
        approvedLeave.forEach((row) => {
            const employeeId = String(row.employee);
            if (!activeSet.has(employeeId)) return;
            const start = new Date(Math.max(new Date(row.startDate).getTime(), from30.getTime()));
            const end = new Date(Math.min(new Date(row.endDate).getTime(), today.getTime()));
            for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
                const key = dayKey(cursor);
                if (punchedByDay.get(key)?.has(employeeId)) continue;
                if (!leaveByDay.has(key)) leaveByDay.set(key, new Set());
                leaveByDay.get(key).add(employeeId);
            }
        });

        const presentMap = new Map([...punchedByDay.entries()].map(([key, ids]) => [key, ids.size]));
        const attendanceSeries = [];
        for (let cursor = new Date(from30); cursor <= today; cursor = addDays(cursor, 1)) {
            const key = dayKey(cursor);
            attendanceSeries.push({
                date: key,
                label: dayLabel(cursor),
                present: presentMap.get(key) || 0,
                onLeave: leaveByDay.get(key)?.size || 0,
            });
        }

        const leaveBuckets = new Map();
        for (let cursor = new Date(from30); cursor <= today; cursor = addDays(cursor, 1)) {
            leaveBuckets.set(dayKey(cursor), { date: dayKey(cursor), label: dayLabel(cursor), pending: 0, approved: 0, rejected: 0 });
        }
        leaveCreated.forEach((row) => {
            const bucket = leaveBuckets.get(dayKey(row.createdAt));
            const key = String(row.status || "").toLowerCase();
            if (bucket && Object.prototype.hasOwnProperty.call(bucket, key)) bucket[key] += 1;
        });
        const leaveSeries = [...leaveBuckets.values()];
        const leaveTotals = leaveSeries.reduce((sum, row) => ({
            pending: sum.pending + row.pending,
            approved: sum.approved + row.approved,
            rejected: sum.rejected + row.rejected,
        }), { pending: 0, approved: 0, rejected: 0 });

        const hiringMap = new Map();
        for (let index = 0; index < 6; index += 1) {
            const point = new Date(today.getFullYear(), today.getMonth() - 5 + index, 1);
            hiringMap.set(`${point.getFullYear()}-${point.getMonth()}`, { label: monthLabel(point), count: 0 });
        }
        let joinersThisMonth = 0;
        let joinersLastMonth = 0;
        joiningDates.forEach((row) => {
            const date = new Date(row.joiningDate);
            const bucket = hiringMap.get(`${date.getFullYear()}-${date.getMonth()}`);
            if (bucket) bucket.count += 1;
            if (date >= monthStart && date < nextMonth) joinersThisMonth += 1;
            if (date >= prevMonth && date < monthStart) joinersLastMonth += 1;
        });

        const activeTotal = admin ? activeIds.length : activeCount;
        const onLeaveToday = leaveByDay.get(todayKey)?.size || 0;
        const presentToday = presentSet.size;
        const presentYesterday = punchedByDay.get(dayKey(yesterday))?.size || 0;
        const absentToday = admin ? Math.max(activeTotal - presentToday - onLeaveToday, 0) : null;

        const activity = [];
        recentEmployees.forEach((row) => {
            activity.push({ id: `employee-${row._id}`, title: `${row.name} was added`, at: row.createdAt, href: `/dashboard/employees/${row._id}` });
        });
        recentLeaves.forEach((row) => {
            const name = row.employee?.name || "An employee";
            const title = row.status === "APPROVED"
                ? `Leave approved for ${name}`
                : row.status === "REJECTED"
                    ? `Leave rejected for ${name}`
                    : `${name} requested leave`;
            activity.push({
                id: `leave-${row._id}`,
                title,
                at: row.status === "PENDING" ? row.createdAt : (row.reviewedAt || row.createdAt),
                href: "/dashboard/leave",
            });
        });
        recentPunches.forEach((row) => {
            if (!row.punchIn?.at) return;
            activity.push({
                id: `punch-${row._id}`,
                title: `${row.user?.name || "An employee"} punched in`,
                at: row.punchIn.at,
                href: "/dashboard/attendance-report",
            });
        });
        activity.sort((a, b) => new Date(b.at) - new Date(a.at));

        const personalState = personal?.punchOut?.at ? "out" : personal?.punchIn?.at ? "in" : "none";
        const leadRow = leadStats[0] || { open: 0, due: 0, sales: 0, revenue: 0 };
        const projectRow = projectStats[0] || { open: 0, overdue: 0 };
        const operations = [
            { key: "projects", label: "Open projects", value: String(projectRow.open), hint: "Not completed", href: "/dashboard/projects" },
            { key: "projects-late", label: "Overdue projects", value: String(projectRow.overdue), hint: "EOD has passed", href: "/dashboard/projects" },
            { key: "tickets", label: "Open tickets", value: String(tickets), hint: "Help still open", href: "/dashboard/help" },
            { key: "work", label: "Overdue work", value: String(work), hint: "EOD has passed", href: "/dashboard/urgent-work" },
        ];
        if (hasPerm(user, LEAD_PERMS)) {
            operations.unshift(
                { key: "leads", label: "Open leads", value: String(leadRow.open), hint: "Not converted or lost", href: "/dashboard/leads" },
                { key: "follow", label: "Follow-ups due", value: String(leadRow.due), hint: "Overdue and today", href: "/dashboard/follow-ups" },
                { key: "sales", label: "Sales", value: String(leadRow.sales), hint: monthName, href: "/dashboard/sales" },
                { key: "revenue", label: "Revenue", value: money(leadRow.revenue), hint: monthName, href: "/dashboard/revenue" },
            );
        }
        if (clients != null) operations.push({ key: "clients", label: "Clients", value: String(clients), hint: "On record", href: "/dashboard/clients" });
        if (interviews != null) operations.push({ key: "interviews", label: "Open interviews", value: String(interviews), hint: "Scheduled or next round", href: "/dashboard/interviews" });

        const lists = [];
        if (dueLeads.length) {
            lists.push({
                title: "Follow-ups due",
                href: "/dashboard/follow-ups",
                rows: dueLeads.map((row) => ({ id: String(row._id), label: row.name, meta: whenLabel(row.nextFollowUpAt), href: `/dashboard/leads/${row._id}` })),
            });
        }
        if (lateProjects.length) {
            lists.push({
                title: "Overdue projects",
                href: "/dashboard/projects",
                rows: lateProjects.map((row) => ({ id: String(row._id), label: row.name, meta: dayLabel(row.eod), href: `/dashboard/projects/${row._id}` })),
            });
        }

        const todayWork = await todayWorkProgress(user);

        res.status(200).json({
            success: true,
            data: {
                dateLabel: new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(today),
                admin,
                staff,
                personal: { state: personalState, at: personal?.punchIn?.at || null },
                workforce: staff ? {
                    totalEmployees,
                    activeEmployees: activeTotal,
                    departments: departmentCount,
                    joinersThisMonth,
                    joinersLastMonth,
                    presentToday: admin ? presentToday : null,
                    presentYesterday: admin ? presentYesterday : null,
                    absentToday,
                    onLeaveToday: admin ? onLeaveToday : null,
                    departmentsChart: departments,
                    employeeTypes,
                    workModes,
                    hiring: [...hiringMap.values()],
                } : null,
                attendance: admin ? attendanceSeries : [],
                leave: { pending: pendingLeave, totals: leaveTotals, series: leaveSeries },
                activity: activity.slice(0, 8).map((row) => ({ ...row, at: row.at ? new Date(row.at).toISOString() : null })),
                operations,
                lists,
                todayWork,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { getDashboard };
