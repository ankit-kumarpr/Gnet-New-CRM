const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const Project = require("../models/Project");
const UrgentWork = require("../models/UrgentWork");
const LeaveRequest = require("../models/LeaveRequest");
const LeaveType = require("../models/LeaveType");
const Interview = require("../models/Interview");
const Ticket = require("../models/Ticket");
const Client = require("../models/Client");
const User = require("../models/User");
const Department = require("../models/Department");
const Service = require("../models/Service");
const { seesAllLeads, leadTeamIds } = require("../utils/leadAccess");

const LEAD_PERMS = ["VIEW_LEADS", "MANAGE_LEADS", "CREATE_LEADS", "EDIT_LEADS", "DELETE_LEADS"];
const PROJECT_PERMS = ["VIEW_PROJECTS", "MANAGE_PROJECTS", "CREATE_PROJECTS", "EDIT_PROJECTS", "DELETE_PROJECTS"];
const STAFF_PERMS = ["VIEW_EMPLOYEES", "MANAGE_EMPLOYEES", "CREATE_EMPLOYEES", "EDIT_EMPLOYEES", "DELETE_EMPLOYEES"];
const INTERVIEW_PERMS = ["VIEW_INTERVIEWS", "MANAGE_INTERVIEWS", "CREATE_INTERVIEWS", "EDIT_INTERVIEWS", "DELETE_INTERVIEWS"];
const CLIENT_PERMS = ["VIEW_CLIENTS", "MANAGE_CLIENTS", "CREATE_CLIENTS", "EDIT_CLIENTS", "DELETE_CLIENTS"];

const SOURCE_LABELS = { GMB: "GMB", COLD_CALL: "Cold call", META_ADS: "Meta ads", WEBSITE: "Website", REFERRAL: "Referral", OTHER: "Other" };
const LEAD_STATUS = { NEW: "New", CONTACTED: "Contacted", INTERESTED: "Interested", FOLLOW_UP: "Follow up", PROPOSAL: "Proposal", CONVERTED: "Converted", PAYMENT: "Payment", LOST: "Lost" };
const PROJECT_STATUS = { START: "Start", WORKING: "Working", PENDING: "Pending", COMPLETED: "Completed", HOLD: "Hold" };
const PRIORITY = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };

const fail = (message) => {
    const error = new Error(message);
    error.status = 400;
    throw error;
};

const { permissionGranted } = require("../utils/permissions");
const hasPerm = (user, keys) => permissionGranted(user, keys);

const parsePagination = (page, limit) => {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * limitNum;
    return { pageNum, limitNum, skip };
};

const escapeRegex = (str) => String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readObjectId = (value, label) => {
    const text = String(value || "").trim();
    if (!text) return null;
    if (!mongoose.Types.ObjectId.isValid(text)) fail(`${label} is not valid`);
    return new mongoose.Types.ObjectId(text);
};

const oneOf = (value, allowed, label) => {
    const text = String(value || "").trim();
    if (!text) return "";
    if (!allowed.includes(text)) fail(`${label} is not valid`);
    return text;
};

const narrowPerson = (filter, field, personId) => {
    if (!personId) return;
    const current = filter[field]?.$in;
    if (current && !current.some((id) => String(id) === String(personId))) {
        filter[field] = { $in: [] };
        return;
    }
    filter[field] = personId;
};

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value) || 0);

const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

const readDay = (value, label) => {
    const text = String(value || "").trim();
    if (!text) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) fail(`${label} must be a valid date`);
    const date = new Date(`${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) fail(`${label} must be a valid date`);
    return date;
};

const dayQuery = (from, to) => {
    const start = readDay(from, "From date");
    const end = readDay(to, "To date");
    if (start && end && start > end) fail("From date cannot be after to date");
    if (!start && !end) return null;
    const query = {};
    if (start) query.$gte = start;
    if (end) {
        const next = new Date(end);
        next.setDate(next.getDate() + 1);
        query.$lt = next;
    }
    return query;
};

const todayRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next = new Date(start);
    next.setDate(next.getDate() + 1);
    return { start, next };
};

const andFilter = (base, extra) => {
    const filter = { ...extra };
    if (base.$or) filter.$and = [...(filter.$and || []), { $or: base.$or }];
    return filter;
};

const pageOf = (rows, skip, limitNum) => rows.slice(skip, skip + limitNum);

const leadScope = async (user) => {
    if (seesAllLeads(user)) return {};
    const team = await leadTeamIds(user);
    return { $or: [{ assignedTo: { $in: team } }, { createdBy: { $in: team } }] };
};

const seesEveryProject = (user) => user.userType === "ADMIN" || hasPerm(user, PROJECT_PERMS);

const projectScope = async (user) => {
    const base = { isDeleted: { $ne: true } };
    if (seesEveryProject(user)) return base;
    const team = await leadTeamIds(user);
    return { ...base, $or: [{ reportingManager: { $in: team } }, { workingEmployees: { $in: team } }] };
};

const teamScope = async (user, field) => {
    if (user.userType === "ADMIN") return {};
    const team = await leadTeamIds(user);
    return { [field]: { $in: team } };
};

const can = {
    leads: (user) => hasPerm(user, LEAD_PERMS),
    staff: (user) => hasPerm(user, STAFF_PERMS),
    interviews: (user) => hasPerm(user, INTERVIEW_PERMS),
    clients: (user) => hasPerm(user, CLIENT_PERMS),
    work: () => true,
};

const optionsOf = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));
const SOURCE_OPTIONS = optionsOf(SOURCE_LABELS);
const LEAD_STATUS_OPTIONS = optionsOf(LEAD_STATUS);
const PROJECT_STATUS_OPTIONS = optionsOf(PROJECT_STATUS);
const PRIORITY_OPTIONS = optionsOf(PRIORITY);
const LEAVE_STATUS_OPTIONS = [
    { value: "PENDING", label: "Pending" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
];
const INTERVIEW_STATUS_OPTIONS = [
    { value: "SCHEDULED", label: "Scheduled" },
    { value: "NEXT_ROUND", label: "Next round" },
    { value: "SELECTED", label: "Selected" },
    { value: "NOT_SELECTED", label: "Not selected" },
];
const TICKET_STATUS_OPTIONS = [
    { value: "OPEN", label: "Open" },
    { value: "SOLVED", label: "Solved" },
    { value: "CLOSED", label: "Closed" },
];
const OVERDUE_OPTIONS = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];
const BUCKET_OPTIONS = [
    { value: "overdue", label: "Overdue" },
    { value: "today", label: "Today" },
    { value: "upcoming", label: "Upcoming" },
];
const ACTIVE_OPTIONS = [{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Not active" }];

const searchFilter = { key: "search", label: "Search", kind: "search" };
const sourceFilter = { key: "source", label: "Source", kind: "select", options: SOURCE_OPTIONS };
const serviceFilter = { key: "service", label: "Service", kind: "services" };
const person = (key, label) => ({ key, label, kind: "people" });

const report = (id, name, filters, extra = {}) => ({ id, name, dates: true, filters, ...extra });

const catalogFor = (user) => {
    const groups = [];
    const business = [report("overview", "Overview", [])];
    if (can.leads(user)) {
        business.push(
            report("revenue-employee", "Revenue by employee", [person("employee", "Employee"), sourceFilter, serviceFilter]),
            report("revenue-source", "Revenue by source", [sourceFilter, person("employee", "Employee"), serviceFilter]),
            report("revenue-service", "Revenue by service", [serviceFilter, person("employee", "Employee"), sourceFilter]),
            report("lead-funnel", "Lead funnel", [person("employee", "Assigned to"), sourceFilter, serviceFilter, { key: "status", label: "Status", kind: "select", options: LEAD_STATUS_OPTIONS }]),
            report("unpaid-sales", "Converted, not paid", [searchFilter, person("employee", "Sale by"), person("assigned", "Assigned to"), sourceFilter, serviceFilter]),
            report("lost-leads", "Lost leads", [searchFilter, person("assigned", "Assigned to"), sourceFilter, serviceFilter]),
            report("follow-ups", "Follow-ups", [person("employee", "Employee"), { key: "bucket", label: "When", kind: "select", options: BUCKET_OPTIONS }, sourceFilter]),
        );
    }
    groups.push({ name: "Business", reports: business });
    groups.push({
        name: "Work",
        reports: [
            report("projects", "Projects", [searchFilter, { key: "status", label: "Status", kind: "select", options: PROJECT_STATUS_OPTIONS }, { key: "priority", label: "Priority", kind: "select", options: PRIORITY_OPTIONS }, person("manager", "Reporting manager"), person("employee", "Working employee"), { key: "overdue", label: "Overdue", kind: "select", options: OVERDUE_OPTIONS }]),
            report("urgent-work", "Urgent work", [{ key: "project", label: "Project", kind: "projects" }, person("employee", "Assigned to"), { key: "priority", label: "Priority", kind: "select", options: PRIORITY_OPTIONS }]),
        ],
    });
    const people = [
        report("leave", "Leave", [person("employee", "Employee"), { key: "status", label: "Status", kind: "select", options: LEAVE_STATUS_OPTIONS }, { key: "leaveType", label: "Leave type", kind: "leaveTypes" }]),
        report("tickets", "Help tickets", [searchFilter, person("employee", "Raised by"), { key: "status", label: "Status", kind: "select", options: TICKET_STATUS_OPTIONS }, { key: "priority", label: "Priority", kind: "select", options: PRIORITY_OPTIONS }]),
    ];
    if (can.staff(user)) people.unshift(report("headcount", "Headcount", [{ key: "department", label: "Department", kind: "departments" }, { key: "status", label: "Status", kind: "select", options: ACTIVE_OPTIONS }], { dates: false }));
    if (can.interviews(user)) people.push(report("interviews", "Interviews", [searchFilter, person("interviewer", "Interviewer"), { key: "status", label: "Status", kind: "select", options: INTERVIEW_STATUS_OPTIONS }]));
    if (can.clients(user)) people.push(report("clients", "Clients", [searchFilter, serviceFilter]));
    groups.push({ name: "People", reports: people });
    return groups.filter((group) => group.reports.length);
};

const allowedType = (user, type) => catalogFor(user).some((group) => group.reports.some((item) => item.id === type));

const applyLeadQuery = (filter, query, options = {}) => {
    const source = oneOf(query.source, Object.keys(SOURCE_LABELS), "Source");
    if (source) filter.source = source;
    const service = readObjectId(query.service, "Service");
    if (service) filter.services = service;
    if (options.status) {
        const status = oneOf(query.status, Object.keys(LEAD_STATUS), "Status");
        if (status) filter.status = status;
    }
    if (options.employeeField) {
        const personId = readObjectId(query.employee, "Employee");
        if (personId) filter[options.employeeField] = personId;
    }
    if (options.assigned) {
        const assigned = readObjectId(query.assigned, "Assigned to");
        if (assigned) filter.assignedTo = assigned;
    }
    return filter;
};

const revenueMatch = async (user, query) => {
    const filter = andFilter(await leadScope(user), { status: "PAYMENT" });
    const range = dayQuery(query.from, query.to);
    if (range) filter.paymentAt = range;
    return applyLeadQuery(filter, query, { employeeField: "soldBy" });
};

const createdMatch = async (user, query, extra = {}) => {
    const filter = andFilter(await leadScope(user), extra);
    const range = dayQuery(query.from, query.to);
    if (range) filter.createdAt = range;
    return filter;
};

const revenueByEmployee = async (user, query, skip, limitNum) => {
    const match = await revenueMatch(user, query);
    const [rows, totalRow] = await Promise.all([
        Lead.aggregate([
            { $match: match },
            { $group: { _id: "$soldBy", payments: { $sum: 1 }, revenue: { $sum: "$amount" } } },
            { $lookup: { from: User.collection.name, localField: "_id", foreignField: "_id", as: "person" } },
            { $sort: { revenue: -1, payments: -1 } },
        ]),
        Lead.aggregate([{ $match: match }, { $group: { _id: null, payments: { $sum: 1 }, revenue: { $sum: "$amount" } } }]),
    ]);
    const total = totalRow[0] || { payments: 0, revenue: 0 };
    return {
        title: "Revenue by employee",
        description: "Payment amount is counted for the person who marked the lead converted.",
        summary: [
            { label: "Revenue", value: money(total.revenue) },
            { label: "Payments", value: String(total.payments) },
        ],
        columns: ["Employee", "Payments", "Revenue"],
        rows: pageOf(rows, skip, limitNum).map((row) => [row.person[0]?.name || "—", String(row.payments), money(row.revenue)]),
        total: rows.length,
    };
};

const revenueBySource = async (user, query, skip, limitNum) => {
    const match = await revenueMatch(user, query);
    const [rows, totalRow] = await Promise.all([
        Lead.aggregate([
            { $match: match },
            { $group: { _id: "$source", payments: { $sum: 1 }, revenue: { $sum: "$amount" } } },
            { $sort: { revenue: -1 } },
        ]),
        Lead.aggregate([{ $match: match }, { $group: { _id: null, payments: { $sum: 1 }, revenue: { $sum: "$amount" } } }]),
    ]);
    const total = totalRow[0] || { payments: 0, revenue: 0 };
    return {
        title: "Revenue by source",
        description: "Collected amount grouped by where the lead came from.",
        summary: [
            { label: "Revenue", value: money(total.revenue) },
            { label: "Payments", value: String(total.payments) },
        ],
        columns: ["Source", "Payments", "Revenue"],
        rows: pageOf(rows, skip, limitNum).map((row) => [SOURCE_LABELS[row._id] || row._id || "—", String(row.payments), money(row.revenue)]),
        total: rows.length,
    };
};

const revenueByService = async (user, query, skip, limitNum) => {
    const match = await revenueMatch(user, query);
    const serviceId = readObjectId(query.service, "Service");
    const servicePipeline = [{ $match: match }, { $unwind: "$services" }];
    if (serviceId) servicePipeline.push({ $match: { services: serviceId } });
    servicePipeline.push(
        { $group: { _id: "$services", payments: { $sum: 1 }, revenue: { $sum: "$amount" } } },
        { $lookup: { from: Service.collection.name, localField: "_id", foreignField: "_id", as: "service" } },
        { $sort: { revenue: -1 } },
    );
    const [rows, totalRow] = await Promise.all([
        Lead.aggregate(servicePipeline),
        Lead.aggregate([{ $match: match }, { $group: { _id: null, payments: { $sum: 1 }, revenue: { $sum: "$amount" } } }]),
    ]);
    const total = totalRow[0] || { payments: 0, revenue: 0 };
    return {
        title: "Revenue by service",
        description: "A lead with two services appears in both. The total above is the real collection, counted once.",
        summary: [
            { label: "Revenue", value: money(total.revenue) },
            { label: "Payments", value: String(total.payments) },
        ],
        columns: ["Service", "Payments", "Amount on those leads"],
        rows: pageOf(rows, skip, limitNum).map((row) => [row.service[0]?.name || "—", String(row.payments), money(row.revenue)]),
        total: rows.length,
    };
};

const leadFunnel = async (user, query, skip, limitNum) => {
    const match = applyLeadQuery(await createdMatch(user, query), query, { status: true, employeeField: "assignedTo" });
    const rows = await Lead.aggregate([
        { $match: match },
        { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const order = Object.keys(LEAD_STATUS);
    const counts = new Map(rows.map((row) => [row._id, row.count]));
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const won = (counts.get("CONVERTED") || 0) + (counts.get("PAYMENT") || 0);
    const selectedStatus = oneOf(query.status, order, "Status");
    const list = order.filter((status) => !selectedStatus || status === selectedStatus).map((status) => ({ status, count: counts.get(status) || 0 }));
    return {
        title: "Lead funnel",
        description: "Leads added in the selected dates, grouped by the status they have now.",
        summary: [
            { label: "Leads", value: String(total) },
            { label: "Converted or paid", value: String(won) },
            { label: "Conversion", value: total ? `${Math.round((won / total) * 100)}%` : "0%" },
        ],
        columns: ["Status", "Leads"],
        rows: pageOf(list, skip, limitNum).map((row) => [LEAD_STATUS[row.status], String(row.count)]),
        total: list.length,
    };
};

const detailLeads = async ({ title, description, user, query, extra, dateField, skip, limitNum, columns, mapRow, employeeField, assigned }) => {
    const filter = andFilter(await leadScope(user), extra);
    const range = dayQuery(query.from, query.to);
    if (range) filter[dateField] = range;
    applyLeadQuery(filter, query, { employeeField, assigned });
    if (query.search) {
        const regex = { $regex: escapeRegex(query.search), $options: "i" };
        filter.$and = [...(filter.$and || []), { $or: [{ name: regex }, { phone: regex }, { companyName: regex }] }];
    }
    const [total, rows] = await Promise.all([
        Lead.countDocuments(filter),
        Lead.find(filter)
            .populate("assignedTo", "name")
            .populate("soldBy", "name")
            .populate("services", "name")
            .sort({ [dateField]: -1, createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
    ]);
    return {
        title,
        description,
        summary: [{ label: "Leads", value: String(total) }],
        columns,
        rows: rows.map(mapRow),
        total,
        search: true,
    };
};

const unpaidSales = (user, query, skip, limitNum) => detailLeads({
    title: "Converted, not paid",
    description: "Leads marked converted that are not on payment yet.",
    user,
    query,
    extra: { status: "CONVERTED" },
    dateField: "convertedAt",
    skip,
    limitNum,
    employeeField: "soldBy",
    assigned: true,
    columns: ["Lead", "Phone", "Source", "Assigned to", "Sale by", "Converted"],
    mapRow: (lead) => [
        lead.name,
        lead.phone,
        SOURCE_LABELS[lead.source] || lead.source,
        lead.assignedTo?.name || "—",
        lead.soldBy?.name || "—",
        formatDate(lead.convertedAt),
    ],
});

const lostLeads = (user, query, skip, limitNum) => detailLeads({
    title: "Lost leads",
    description: "Leads marked lost, with the reason.",
    user,
    query,
    extra: { status: "LOST" },
    dateField: "updatedAt",
    skip,
    limitNum,
    assigned: true,
    columns: ["Lead", "Phone", "Source", "Assigned to", "Reason"],
    mapRow: (lead) => [lead.name, lead.phone, SOURCE_LABELS[lead.source] || lead.source, lead.assignedTo?.name || "—", lead.lostReason || "—"],
});

const followUps = async (user, query, skip, limitNum) => {
    const { start, next } = todayRange();
    const match = andFilter(await leadScope(user), {
        status: { $nin: ["LOST", "CONVERTED", "PAYMENT"] },
        nextFollowUpAt: { $ne: null },
    });
    const employee = readObjectId(query.employee, "Employee");
    if (employee) match.assignedTo = employee;
    const source = oneOf(query.source, Object.keys(SOURCE_LABELS), "Source");
    if (source) match.source = source;
    const bucket = oneOf(query.bucket, ["overdue", "today", "upcoming"], "When");
    let when = { $ne: null };
    const range = dayQuery(query.from, query.to);
    if (range) when = { ...range };
    if (bucket === "overdue") when = { ...when, $lt: when.$lt && when.$lt < start ? when.$lt : start };
    if (bucket === "today") {
        when.$gte = when.$gte && when.$gte > start ? when.$gte : start;
        when.$lt = when.$lt && when.$lt < next ? when.$lt : next;
    }
    if (bucket === "upcoming") when.$gte = when.$gte && when.$gte > next ? when.$gte : next;
    if (bucket) delete when.$ne;
    match.nextFollowUpAt = when;
    const rows = await Lead.aggregate([
        { $match: match },
        {
            $group: {
                _id: "$assignedTo",
                overdue: { $sum: { $cond: [{ $lt: ["$nextFollowUpAt", start] }, 1, 0] } },
                today: { $sum: { $cond: [{ $and: [{ $gte: ["$nextFollowUpAt", start] }, { $lt: ["$nextFollowUpAt", next] }] }, 1, 0] } },
                upcoming: { $sum: { $cond: [{ $gte: ["$nextFollowUpAt", next] }, 1, 0] } },
            },
        },
        { $lookup: { from: User.collection.name, localField: "_id", foreignField: "_id", as: "person" } },
        { $sort: { overdue: -1, today: -1 } },
    ]);
    const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
    return {
        title: "Follow-ups",
        description: "Open leads with a next follow-up, counted for the person the lead is assigned to.",
        summary: [
            { label: "Overdue", value: String(sum("overdue")) },
            { label: "Today", value: String(sum("today")) },
            { label: "Upcoming", value: String(sum("upcoming")) },
        ],
        columns: ["Employee", "Overdue", "Today", "Upcoming"],
        rows: pageOf(rows, skip, limitNum).map((row) => [row.person[0]?.name || "—", String(row.overdue), String(row.today), String(row.upcoming)]),
        total: rows.length,
    };
};

const projectsReport = async (user, query, skip, limitNum) => {
    const clauses = [];
    const scope = await projectScope(user);
    if (scope.$or) clauses.push({ $or: scope.$or });
    const filter = { isDeleted: { $ne: true } };
    const range = dayQuery(query.from, query.to);
    if (range) filter.eod = range;
    const status = oneOf(query.status, Object.keys(PROJECT_STATUS), "Status");
    if (status === "START") clauses.push({ $or: [{ status: "START" }, { status: { $exists: false } }, { status: null }] });
    else if (status) filter.status = status;
    const priority = oneOf(query.priority, Object.keys(PRIORITY), "Priority");
    if (priority) filter.priority = priority;
    const manager = readObjectId(query.manager, "Reporting manager");
    if (manager) filter.reportingManager = manager;
    const employee = readObjectId(query.employee, "Working employee");
    if (employee) filter.workingEmployees = employee;
    const overdueFlag = oneOf(query.overdue, ["yes", "no"], "Overdue");
    const { start } = todayRange();
    if (overdueFlag === "yes") clauses.push({ status: { $ne: "COMPLETED" }, eod: { $lt: start } });
    if (overdueFlag === "no") clauses.push({ $or: [{ status: "COMPLETED" }, { eod: { $gte: start } }] });
    if (query.search) filter.name = { $regex: escapeRegex(query.search), $options: "i" };
    if (clauses.length) filter.$and = clauses;
    const overdueFilter = { ...filter };
    if (overdueFlag === "no" || status === "COMPLETED") {
        overdueFilter._id = { $in: [] };
    } else {
        const eod = { ...(filter.eod || {}) };
        if (!eod.$lt || eod.$lt > start) eod.$lt = start;
        overdueFilter.eod = eod;
        if (!overdueFilter.status) overdueFilter.status = { $ne: "COMPLETED" };
        if (eod.$gte && eod.$gte >= start) overdueFilter._id = { $in: [] };
    }
    const [total, rows, byStatus, overdue] = await Promise.all([
        Project.countDocuments(filter),
        Project.find(filter).populate("reportingManager", "name").sort({ eod: 1 }).skip(skip).limit(limitNum).lean(),
        Project.aggregate([{ $match: filter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
        overdueFlag === "yes" ? Project.countDocuments(filter) : Project.countDocuments(overdueFilter),
    ]);
    const statusText = byStatus.map((row) => `${PROJECT_STATUS[row._id] || row._id} ${row.count}`).join(", ") || "None";
    return {
        title: "Projects",
        description: "Current project status. Overdue means the EOD has passed and the project is not completed.",
        summary: [
            { label: "Projects", value: String(total) },
            { label: "Overdue", value: String(overdue) },
            { label: "By status", value: statusText },
        ],
        columns: ["Project", "Status", "Priority", "Reporting manager", "EOD", "Overdue"],
        rows: rows.map((row) => [
            row.name,
            PROJECT_STATUS[row.status] || "Start",
            PRIORITY[row.priority] || row.priority,
            row.reportingManager?.name || "—",
            formatDate(row.eod),
            row.status !== "COMPLETED" && row.eod && new Date(row.eod) < start ? "Yes" : "No",
        ]),
        total,
        search: true,
    };
};

const urgentReport = async (user, query, skip, limitNum) => {
    const { start } = todayRange();
    const filter = {};
    if (!seesEveryProject(user)) {
        const team = await leadTeamIds(user);
        filter.$or = [{ createdBy: { $in: team } }, { assignees: { $in: team } }];
    }
    const range = dayQuery(query.from, query.to);
    filter.eod = range ? { ...range, $lt: range.$lt && range.$lt < start ? range.$lt : start } : { $lt: start };
    if (range?.$gte) filter.eod.$gte = range.$gte;
    const projectId = readObjectId(query.project, "Project");
    if (projectId) filter.project = projectId;
    const employee = readObjectId(query.employee, "Assigned to");
    if (employee) filter.assignees = employee;
    const priority = oneOf(query.priority, Object.keys(PRIORITY), "Priority");
    if (priority) filter.priority = priority;
    const [total, rows] = await Promise.all([
        UrgentWork.countDocuments(filter),
        UrgentWork.find(filter).populate("project", "name").populate("assignees", "name").sort({ eod: 1 }).skip(skip).limit(limitNum).lean(),
    ]);
    return {
        title: "Urgent work",
        description: "Work whose EOD has passed.",
        summary: [{ label: "Overdue", value: String(total) }],
        columns: ["Project", "Priority", "EOD", "Assigned"],
        rows: rows.map((row) => [
            row.project?.name || "—",
            PRIORITY[row.priority] || row.priority,
            formatDate(row.eod),
            (row.assignees || []).map((person) => person.name).filter(Boolean).join(", ") || "—",
        ]),
        total,
    };
};

const leaveReport = async (user, query, skip, limitNum) => {
    const filter = { ...(await teamScope(user, "employee")) };
    const range = dayQuery(query.from, query.to);
    if (range) filter.startDate = range;
    narrowPerson(filter, "employee", readObjectId(query.employee, "Employee"));
    const status = oneOf(query.status, ["PENDING", "APPROVED", "REJECTED"], "Status");
    if (status) filter.status = status;
    const leaveType = readObjectId(query.leaveType, "Leave type");
    if (leaveType) filter.leaveType = leaveType;
    const [total, rows, grouped] = await Promise.all([
        LeaveRequest.countDocuments(filter),
        LeaveRequest.find(filter).populate("employee", "name").populate("leaveType", "name").sort({ startDate: -1 }).skip(skip).limit(limitNum).lean(),
        LeaveRequest.aggregate([
            { $match: filter },
            { $group: { _id: "$status", count: { $sum: 1 }, days: { $sum: "$days" } } },
        ]),
    ]);
    const pick = (status) => grouped.find((row) => row._id === status) || { count: 0, days: 0 };
    return {
        title: "Leave",
        description: "Leave requests for you and the people who report to you.",
        summary: [
            { label: "Pending", value: `${pick("PENDING").count} (${pick("PENDING").days} days)` },
            { label: "Approved", value: `${pick("APPROVED").count} (${pick("APPROVED").days} days)` },
            { label: "Rejected", value: `${pick("REJECTED").count}` },
        ],
        columns: ["Employee", "Type", "Status", "Days", "From", "To"],
        rows: rows.map((row) => [
            row.employee?.name || "—",
            row.leaveType?.name || "—",
            row.status === "PENDING" ? "Pending" : row.status === "APPROVED" ? "Approved" : "Rejected",
            String(row.days),
            formatDate(row.startDate),
            formatDate(row.endDate),
        ]),
        total,
    };
};

const headcount = async (_user, query, skip, limitNum) => {
    const match = { userType: "EMPLOYEE" };
    const department = readObjectId(query.department, "Department");
    if (department) match.department = department;
    const status = oneOf(query.status, ["ACTIVE", "INACTIVE"], "Status");
    if (status === "ACTIVE") match.status = "ACTIVE";
    if (status === "INACTIVE") match.status = { $ne: "ACTIVE" };
    const rows = await User.aggregate([
        { $match: match },
        { $group: { _id: "$department", active: { $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] } }, inactive: { $sum: { $cond: [{ $ne: ["$status", "ACTIVE"] }, 1, 0] } } } },
        { $lookup: { from: Department.collection.name, localField: "_id", foreignField: "_id", as: "department" } },
        { $sort: { active: -1 } },
    ]);
    const active = rows.reduce((sum, row) => sum + row.active, 0);
    const inactive = rows.reduce((sum, row) => sum + row.inactive, 0);
    return {
        title: "Headcount",
        description: "Employees grouped by department.",
        summary: [
            { label: "Active", value: String(active) },
            { label: "Not active", value: String(inactive) },
        ],
        columns: ["Department", "Active", "Not active"],
        rows: pageOf(rows, skip, limitNum).map((row) => [row.department[0]?.name || "No department", String(row.active), String(row.inactive)]),
        total: rows.length,
    };
};

const interviewsReport = async (_user, query, skip, limitNum) => {
    const filter = {};
    const range = dayQuery(query.from, query.to);
    if (range) filter.interviewDate = range;
    if (query.search) {
        const regex = { $regex: escapeRegex(query.search), $options: "i" };
        filter.$or = [{ candidateName: regex }, { phone: regex }, { role: regex }];
    }
    const status = oneOf(query.status, ["SCHEDULED", "NEXT_ROUND", "SELECTED", "NOT_SELECTED"], "Status");
    if (status) filter.status = status;
    const interviewer = readObjectId(query.interviewer, "Interviewer");
    if (interviewer) filter.interviewer = interviewer;
    const [total, rows, grouped] = await Promise.all([
        Interview.countDocuments(filter),
        Interview.find(filter).populate("interviewer", "name").sort({ interviewDate: -1 }).skip(skip).limit(limitNum).lean(),
        Interview.aggregate([{ $match: filter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);
    const count = (status) => grouped.find((row) => row._id === status)?.count || 0;
    return {
        title: "Interviews",
        description: "Candidates grouped by the current round result.",
        summary: [
            { label: "Scheduled", value: String(count("SCHEDULED")) },
            { label: "Next round", value: String(count("NEXT_ROUND")) },
            { label: "Selected", value: String(count("SELECTED")) },
            { label: "Not selected", value: String(count("NOT_SELECTED")) },
        ],
        columns: ["Candidate", "Phone", "Role", "Round", "Status", "Date", "Interviewer"],
        rows: rows.map((row) => [
            row.candidateName,
            row.phone,
            row.role,
            row.round,
            row.status === "NEXT_ROUND" ? "Next round" : row.status === "NOT_SELECTED" ? "Not selected" : row.status === "SELECTED" ? "Selected" : "Scheduled",
            formatDate(row.interviewDate),
            row.interviewer?.name || "—",
        ]),
        total,
        search: true,
    };
};

const ticketsReport = async (user, query, skip, limitNum) => {
    const filter = { ...(await teamScope(user, "raisedBy")) };
    const range = dayQuery(query.from, query.to);
    if (range) filter.createdAt = range;
    if (query.search) filter.subject = { $regex: escapeRegex(query.search), $options: "i" };
    narrowPerson(filter, "raisedBy", readObjectId(query.employee, "Raised by"));
    const status = oneOf(query.status, ["OPEN", "SOLVED", "CLOSED"], "Status");
    if (status) filter.status = status;
    const priority = oneOf(query.priority, Object.keys(PRIORITY), "Priority");
    if (priority) filter.priority = priority;
    const [total, rows, grouped] = await Promise.all([
        Ticket.countDocuments(filter),
        Ticket.find(filter).populate("raisedBy", "name").sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        Ticket.aggregate([{ $match: filter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);
    const count = (status) => grouped.find((row) => row._id === status)?.count || 0;
    return {
        title: "Help tickets",
        description: "Tickets raised by you and the people who report to you.",
        summary: [
            { label: "Open", value: String(count("OPEN")) },
            { label: "Solved", value: String(count("SOLVED")) },
            { label: "Closed", value: String(count("CLOSED")) },
        ],
        columns: ["Subject", "Status", "Priority", "Raised by", "Added"],
        rows: rows.map((row) => [
            row.subject,
            row.status === "OPEN" ? "Open" : row.status === "SOLVED" ? "Solved" : "Closed",
            PRIORITY[row.priority] || row.priority,
            row.raisedBy?.name || "—",
            formatDate(row.createdAt),
        ]),
        total,
        search: true,
    };
};

const clientsReport = async (_user, query, skip, limitNum) => {
    const filter = {};
    const range = dayQuery(query.from, query.to);
    if (range) filter.createdAt = range;
    if (query.search) {
        const regex = { $regex: escapeRegex(query.search), $options: "i" };
        filter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }
    const service = readObjectId(query.service, "Service");
    if (service) filter.services = service;
    const [total, rows] = await Promise.all([
        Client.countDocuments(filter),
        Client.find(filter).populate("services", "name").sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    ]);
    return {
        title: "Clients",
        description: "Clients added in the selected dates.",
        summary: [{ label: "Clients", value: String(total) }],
        columns: ["Client", "Phone", "City", "Services", "Added"],
        rows: rows.map((row) => [
            row.name,
            row.phone,
            row.address?.city || "—",
            (row.services || []).map((service) => service.name).filter(Boolean).join(", ") || "—",
            formatDate(row.createdAt),
        ]),
        total,
        search: true,
    };
};

const overview = async (user, query) => {
    const cards = [];
    const lines = [];
    if (can.leads(user)) {
        const datesOnly = { from: query.from, to: query.to };
        const leadMatch = await createdMatch(user, datesOnly);
        const paidMatch = await revenueMatch(user, datesOnly);
        const [leads, won, paid] = await Promise.all([
            Lead.countDocuments(leadMatch),
            Lead.countDocuments({ ...leadMatch, status: { $in: ["CONVERTED", "PAYMENT"] } }),
            Lead.aggregate([{ $match: paidMatch }, { $group: { _id: null, revenue: { $sum: "$amount" }, count: { $sum: 1 } } }]),
        ]);
        const revenue = paid[0]?.revenue || 0;
        const payments = paid[0]?.count || 0;
        cards.push({ label: "Leads added", value: String(leads) }, { label: "Converted or paid", value: String(won) }, { label: "Revenue", value: money(revenue) });
        lines.push(["Leads added", String(leads), "—"], ["Converted or paid", String(won), "—"], ["Payments", String(payments), money(revenue)]);
    }
    const { start } = todayRange();
    const projectFilter = await projectScope(user);
    const overdueProjects = await Project.countDocuments({ ...projectFilter, status: { $ne: "COMPLETED" }, eod: { $lt: start } });
    cards.push({ label: "Overdue projects", value: String(overdueProjects) });
    lines.push(["Overdue projects", String(overdueProjects), "—"]);
    const leaveFilter = await teamScope(user, "employee");
    const pendingLeave = await LeaveRequest.countDocuments({ ...leaveFilter, status: "PENDING" });
    cards.push({ label: "Pending leave", value: String(pendingLeave) });
    lines.push(["Pending leave", String(pendingLeave), "—"]);
    const ticketFilter = await teamScope(user, "raisedBy");
    const openTickets = await Ticket.countDocuments({ ...ticketFilter, status: "OPEN" });
    cards.push({ label: "Open tickets", value: String(openTickets) });
    lines.push(["Open tickets", String(openTickets), "—"]);
    return {
        title: "Overview",
        description: "A snapshot for the selected dates. Project, leave, and ticket counts follow what you are allowed to see.",
        summary: cards,
        columns: ["Item", "Count", "Amount"],
        rows: lines,
        total: lines.length,
    };
};

const runners = {
    overview,
    "revenue-employee": revenueByEmployee,
    "revenue-source": revenueBySource,
    "revenue-service": revenueByService,
    "lead-funnel": leadFunnel,
    "unpaid-sales": unpaidSales,
    "lost-leads": lostLeads,
    "follow-ups": followUps,
    projects: projectsReport,
    "urgent-work": urgentReport,
    leave: leaveReport,
    headcount,
    interviews: interviewsReport,
    tickets: ticketsReport,
    clients: clientsReport,
};

const getReportOptions = async (req, res, next) => {
    try {
        const wide = req.user.userType === "ADMIN"
            || seesAllLeads(req.user)
            || seesEveryProject(req.user)
            || hasPerm(req.user, STAFF_PERMS)
            || hasPerm(req.user, INTERVIEW_PERMS);
        const peopleFilter = { status: "ACTIVE", userType: { $in: ["ADMIN", "EMPLOYEE"] } };
        if (!wide) {
            const team = await leadTeamIds(req.user);
            const projects = await Project.find(await projectScope(req.user)).select("reportingManager workingEmployees").lean();
            const ids = new Set(team.map((id) => String(id)));
            projects.forEach((item) => {
                if (item.reportingManager) ids.add(String(item.reportingManager));
                (item.workingEmployees || []).forEach((id) => ids.add(String(id)));
            });
            peopleFilter._id = { $in: [...ids] };
        }
        const [people, services, projects, departments, leaveTypes] = await Promise.all([
            User.find(peopleFilter).select("name").sort({ name: 1 }).limit(500).lean(),
            Service.find().select("name").sort({ name: 1 }).limit(500).lean(),
            Project.find(await projectScope(req.user)).select("name").sort({ name: 1 }).limit(500).lean(),
            hasPerm(req.user, STAFF_PERMS) ? Department.find().select("name").sort({ name: 1 }).limit(200).lean() : [],
            LeaveType.find({ status: "ACTIVE" }).select("name").sort({ name: 1 }).limit(100).lean(),
        ]);
        res.status(200).json({ success: true, data: { people, services, projects, departments, leaveTypes } });
    } catch (error) {
        next(error);
    }
};

const getReportCatalog = async (req, res, next) => {
    try {
        res.status(200).json({ success: true, data: catalogFor(req.user) });
    } catch (error) {
        next(error);
    }
};

const getReport = async (req, res, next) => {
    try {
        const type = String(req.query.type || "overview");
        if (!runners[type] || !allowedType(req.user, type)) {
            return res.status(403).json({ success: false, message: "You cannot open this report" });
        }
        const { pageNum, limitNum, skip } = parsePagination(req.query.page, req.query.limit);
        const report = await runners[type](req.user, req.query, skip, limitNum);
        res.status(200).json({
            success: true,
            data: {
                type,
                ...report,
                pagination: {
                    total: report.total,
                    page: pageNum,
                    pages: Math.ceil(report.total / limitNum) || 1,
                    limit: limitNum,
                },
            },
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

module.exports = { getReportCatalog, getReport, getReportOptions };
