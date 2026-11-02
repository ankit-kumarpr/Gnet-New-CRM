const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const Lead = require("../models/Lead");
const Project = require("../models/Project");
const UrgentWork = require("../models/UrgentWork");
const Client = require("../models/Client");
const User = require("../models/User");
const { startOfDay, addDays } = require("../utils/workPlanSchedule");
const { downlineIds } = require("../utils/reporting");
const { loadPlansWithDaySlots } = require("../utils/dayWorkSlots");
const { isInReminderWindow } = require("../utils/clientPaymentReminders");

const dayStart = (date = new Date()) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

const dayEnd = (date = new Date()) => {
    const d = dayStart(date);
    d.setDate(d.getDate() + 1);
    return d;
};

const canSeeAll = (user) => user?.userType === "ADMIN";

const presentItem = (row, userId) => ({
    id: String(row._id),
    type: row.type,
    title: row.title,
    body: row.body || "",
    href: row.href || "/dashboard",
    at: row.createdAt,
    read: (row.readBy || []).some((id) => String(id) === String(userId)),
    source: "event",
});

const getNotificationFeed = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const since = new Date();
        since.setDate(since.getDate() - 14);

        const stored = await Notification.find({
            audience: userId,
            createdAt: { $gte: since },
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        const items = stored.map((row) => presentItem(row, userId));
        const unreadCount = items.filter((row) => !row.read).length;

        // Live reminders for today (not stored; always current).
        const reminders = [];
        const start = dayStart();
        const end = dayEnd();
        const team = canSeeAll(req.user) ? null : [userId, ...(await downlineIds(userId))];
        const teamIds = team ? new Set(team.map(String)) : null;

        const leadDueFilter = { nextFollowUpAt: { $gte: start, $lt: end }, status: { $nin: ["LOST", "PAYMENT"] } };
        if (team) {
            leadDueFilter.$or = [{ assignedTo: { $in: team } }, { createdBy: { $in: team } }];
        }
        const dueLeads = await Lead.find(leadDueFilter)
            .select("name nextFollowUpAt")
            .sort({ nextFollowUpAt: 1 })
            .limit(8)
            .lean();

        for (const lead of dueLeads) {
            reminders.push({
                id: `reminder:followup:${lead._id}`,
                type: "FOLLOW_UP_DUE",
                title: `Follow-up due: ${lead.name}`,
                body: "Scheduled for today",
                href: `/dashboard/leads/${lead._id}`,
                at: lead.nextFollowUpAt,
                read: false,
                source: "reminder",
            });
        }

        const projectFilter = {
            status: { $in: ["PENDING", "START", "WORKING"] },
            eod: { $lt: start },
        };
        if (team) {
            projectFilter.$or = [
                { reportingManager: { $in: team } },
                { workingEmployees: { $in: team } },
                { "serviceAssignments.employee": { $in: team } },
            ];
        }
        const overdueProjects = await Project.find(projectFilter)
            .select("name eod status")
            .sort({ eod: 1 })
            .limit(8)
            .lean();

        for (const project of overdueProjects) {
            reminders.push({
                id: `reminder:project:${project._id}`,
                type: "PROJECT_PENDING",
                title: `Overdue project: ${project.name}`,
                body: "Past EOD and still open",
                href: `/dashboard/projects/${project._id}`,
                at: project.eod,
                read: false,
                source: "reminder",
            });
        }

        const todayStart = startOfDay(new Date());
        const todayEnd = addDays(todayStart, 1);
        const { plans: plansToday } = await loadPlansWithDaySlots(todayStart, todayStart);

        let pending = 0;
        let partial = 0;
        const taskRows = [];

        for (const plan of plansToday) {
            const isAdmin = canSeeAll(req.user);
            const manager = String(plan.reportingManager?._id || plan.reportingManager || "");
            const daySlots = (plan.slots || []).filter((slot) => {
                if (isAdmin) return true;
                const assignee = String(slot.assignee?._id || slot.assignee || "");
                if (manager === String(userId)) return true;
                if (teamIds?.has(assignee)) return true;
                return assignee === String(userId);
            });
            if (!daySlots.length) continue;
            const done = daySlots.filter((slot) => slot.status === "DONE").length;
            const status = done >= daySlots.length ? "DONE" : done > 0 ? "PARTIAL" : "PENDING";
            if (status === "PENDING") pending += 1;
            if (status === "PARTIAL") partial += 1;
            if (status !== "DONE") {
                taskRows.push({
                    _id: `${plan._id}-${todayStart.getTime()}`,
                    title: `${plan.client?.name || "Client"} · ${plan.service?.name || "Service"}`,
                    status,
                    date: todayStart,
                    assignee: daySlots[0]?.assignee
                        ? { _id: daySlots[0].assignee._id, name: daySlots[0].assignee.name }
                        : null,
                });
            }
        }

        const urgentFilter = {
            eod: { $gte: todayStart, $lt: todayEnd },
            status: { $ne: "DONE" },
        };
        if (!canSeeAll(req.user)) {
            urgentFilter.$or = [{ createdBy: userId }, { assignees: userId }];
        }
        const urgentOpen = await UrgentWork.find(urgentFilter)
            .populate("project", "name")
            .populate("assignees", "name")
            .limit(50)
            .lean();
        for (const row of urgentOpen) {
            pending += 1;
            taskRows.push({
                _id: `urgent-${row._id}`,
                title: `Urgent · ${row.project?.name || "Project"}`,
                status: "PENDING",
                date: todayStart,
                assignee: row.assignees?.[0]
                    ? { _id: row.assignees[0]._id, name: row.assignees[0].name }
                    : null,
            });
        }

        const openTasks = pending + partial;
        if (openTasks > 0) {
            reminders.unshift({
                id: "reminder:daily-tasks-open",
                type: "DAILY_TASK_UPDATE",
                title: `${openTasks} work item${openTasks === 1 ? "" : "s"} open today`,
                body: `${pending} pending · ${partial} partial`,
                href: "/dashboard/daily-tasks",
                at: new Date(),
                read: false,
                source: "reminder",
            });
        }

        const paymentFilter = {
            payments: {
                $elemMatch: {
                    paid: { $ne: true },
                    date: { $lte: addDays(start, 6) },
                },
            },
        };
        if (team) {
            paymentFilter.reportingManager = { $in: team };
        }
        const duePaymentClients = await Client.find(paymentFilter)
            .select("name payments reportingManager")
            .limit(40)
            .lean();
        let paymentHits = 0;
        for (const client of duePaymentClients) {
            if (!canSeeAll(req.user)) {
                const manager = String(client.reportingManager || "");
                if (teamIds && !teamIds.has(manager) && manager !== String(userId)) continue;
            }
            for (const payment of client.payments || []) {
                if (payment.paid || !isInReminderWindow(payment.date, start)) continue;
                paymentHits += 1;
                if (reminders.filter((r) => r.type === "CLIENT_PAYMENT_DUE").length >= 8) continue;
                const daysLeft = Math.ceil((dayStart(payment.date) - start) / (24 * 60 * 60 * 1000));
                const when =
                    daysLeft < 0
                        ? `overdue by ${Math.abs(daysLeft)}d`
                        : daysLeft === 0
                            ? "due today"
                            : `in ${daysLeft}d`;
                reminders.push({
                    id: `reminder:payment:${client._id}:${payment._id}`,
                    type: "CLIENT_PAYMENT_DUE",
                    title: `Client renewal ${when}: ${client.name}`,
                    body: payment.amount != null
                        ? `₹${Number(payment.amount).toLocaleString("en-IN")} · mark paid to stop alerts`
                        : "Mark paid to stop alerts",
                    href: `/dashboard/clients/${client._id}`,
                    at: payment.date,
                    read: false,
                    source: "reminder",
                });
            }
        }
        if (paymentHits > 8) {
            reminders.unshift({
                id: "reminder:payments-summary",
                type: "CLIENT_PAYMENT_DUE",
                title: `${paymentHits} client renewals need attention`,
                body: "Open clients list · filter Due for notify · export Excel",
                href: "/dashboard/clients",
                at: new Date(),
                read: false,
                source: "reminder",
            });
        }

        // Prefer stored events first, then reminders (dedupe by similar href/title loosely via id)
        const reminderIds = new Set(reminders.map((row) => row.id));
        const merged = [...items.filter((row) => !reminderIds.has(row.id)), ...reminders]
            .sort((a, b) => new Date(b.at) - new Date(a.at))
            .slice(0, 40);

        const badgeCount = unreadCount + reminders.filter((row) => row.source === "reminder").length;

        res.status(200).json({
            success: true,
            data: {
                unreadCount,
                badgeCount,
                items: merged,
                tasks: {
                    openCount: openTasks,
                    pending,
                    partial,
                    tasks: taskRows.map((row) => ({
                        _id: row._id,
                        title: row.title,
                        status: row.status,
                        date: row.date,
                        assignee: row.assignee ? { _id: row.assignee._id, name: row.assignee.name } : null,
                    })),
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

const markNotificationRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (String(id).startsWith("reminder:")) {
            return res.status(200).json({ success: true, data: { id, read: true } });
        }
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid notification ID" });
        }
        const row = await Notification.findOne({ _id: id, audience: req.user._id });
        if (!row) return res.status(404).json({ success: false, message: "Notification not found" });
        if (!row.readBy.some((uid) => String(uid) === String(req.user._id))) {
            row.readBy.push(req.user._id);
            await row.save();
        }
        res.status(200).json({ success: true, data: { id, read: true } });
    } catch (error) {
        next(error);
    }
};

const markAllNotificationsRead = async (req, res, next) => {
    try {
        await Notification.updateMany(
            { audience: req.user._id, readBy: { $ne: req.user._id } },
            { $addToSet: { readBy: req.user._id } },
        );
        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getNotificationFeed,
    markNotificationRead,
    markAllNotificationsRead,
};
