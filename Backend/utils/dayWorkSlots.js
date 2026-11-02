const mongoose = require("mongoose");
const ClientWorkPlan = require("../models/ClientWorkPlan");
const { startOfDay, addDays } = require("./workPlanSchedule");

/**
 * Load work plans that have slots in [from, to], but return ONLY those day slots
 * (not the full historical slots array). Critical for daily board / dashboard scale.
 */
const loadPlansWithDaySlots = async (from, to, { leanPopulate = true } = {}) => {
    const start = startOfDay(from);
    const endExclusive = addDays(startOfDay(to), 1);

    const plans = await ClientWorkPlan.aggregate([
        {
            $match: {
                "slots.date": { $gte: start, $lt: endExclusive },
            },
        },
        {
            $project: {
                client: 1,
                project: 1,
                service: 1,
                reportingManager: 1,
                assignees: 1,
                mode: 1,
                createdBy: 1,
                slots: {
                    $filter: {
                        input: "$slots",
                        as: "slot",
                        cond: {
                            $and: [
                                { $gte: ["$$slot.date", start] },
                                { $lt: ["$$slot.date", endExclusive] },
                            ],
                        },
                    },
                },
            },
        },
        { $match: { "slots.0": { $exists: true } } },
    ]);

    if (!leanPopulate || !plans.length) {
        return { plans, start, endExclusive };
    }

    const userIds = new Set();
    const clientIds = new Set();
    const projectIds = new Set();
    const serviceIds = new Set();

    for (const plan of plans) {
        if (plan.client) clientIds.add(String(plan.client));
        if (plan.project) projectIds.add(String(plan.project));
        if (plan.service) serviceIds.add(String(plan.service));
        if (plan.reportingManager) userIds.add(String(plan.reportingManager));
        for (const id of plan.assignees || []) userIds.add(String(id));
        for (const slot of plan.slots || []) {
            if (slot.assignee) userIds.add(String(slot.assignee));
        }
    }

    const toObjectIds = (ids) => [...ids].filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));

    const [Client, Project, Service, User] = [
        require("../models/Client"),
        require("../models/Project"),
        require("../models/Service"),
        require("../models/User"),
    ];

    const [clients, projects, services, users] = await Promise.all([
        clientIds.size
            ? Client.find({ _id: { $in: toObjectIds(clientIds) } }).select("name").lean()
            : [],
        projectIds.size
            ? Project.find({ _id: { $in: toObjectIds(projectIds) } }).select("name").lean()
            : [],
        serviceIds.size
            ? Service.find({ _id: { $in: toObjectIds(serviceIds) } }).select("name").lean()
            : [],
        userIds.size
            ? User.find({ _id: { $in: toObjectIds(userIds) } }).select("name").lean()
            : [],
    ]);

    const clientMap = new Map(clients.map((row) => [String(row._id), row]));
    const projectMap = new Map(projects.map((row) => [String(row._id), row]));
    const serviceMap = new Map(services.map((row) => [String(row._id), row]));
    const userMap = new Map(users.map((row) => [String(row._id), row]));

    for (const plan of plans) {
        plan.client = clientMap.get(String(plan.client)) || null;
        plan.project = projectMap.get(String(plan.project)) || null;
        plan.service = serviceMap.get(String(plan.service)) || null;
        plan.reportingManager = userMap.get(String(plan.reportingManager)) || null;
        plan.assignees = (plan.assignees || [])
            .map((id) => userMap.get(String(id)))
            .filter(Boolean);
        for (const slot of plan.slots || []) {
            slot.assignee = slot.assignee ? (userMap.get(String(slot.assignee)) || null) : null;
        }
    }

    return { plans, start, endExclusive };
};

module.exports = { loadPlansWithDaySlots };
