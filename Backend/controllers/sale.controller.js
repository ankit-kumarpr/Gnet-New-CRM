const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const { SOURCES } = require("../models/Lead");

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

const readDay = (value, label) => {
    const text = String(value || "").trim();
    if (!text) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) fail(`${label} must be a valid date`);
    const date = new Date(`${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) fail(`${label} must be a valid date`);
    return date;
};

const seesAllSales = (user) => {
    if (user.userType === "ADMIN") return true;
    const { permissionGranted } = require("../utils/permissions");
    return permissionGranted(user, ["VIEW_LEADS", "MANAGE_LEADS", "VIEW_SALES", "VIEW_PAYMENTS", "VIEW_REVENUE"]);
};

const readPerson = (value, label) => {
    const id = String(value || "").trim();
    if (!id) return "";
    if (!mongoose.Types.ObjectId.isValid(id)) fail(label);
    return id;
};

const listDeals = (mode) => async (req, res, next) => {
    try {
        const { search, source, status, assignedTo, soldBy, paymentBy, from, to, page = 1, limit = 10 } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);
        const filter = {};
        const clauses = [];
        const paid = mode === "payment" || mode === "revenue";
        const dateField = paid ? "paymentAt" : "convertedAt";

        if (paid) {
            filter.status = "PAYMENT";
        } else if (status) {
            if (!["CONVERTED", "PAYMENT"].includes(status)) {
                return res.status(400).json({ success: false, message: "Invalid sale status" });
            }
            filter.status = status;
        } else {
            filter.status = { $in: ["CONVERTED", "PAYMENT"] };
        }

        if (source) {
            if (!SOURCES.includes(source)) return res.status(400).json({ success: false, message: "Invalid source" });
            filter.source = source;
        }

        const seesAll = seesAllSales(req.user);
        if (!seesAll) {
            clauses.push({ $or: [{ soldBy: req.user._id }, { assignedTo: req.user._id }] });
        } else {
            const assignee = readPerson(assignedTo, "Invalid assigned person");
            const seller = readPerson(soldBy, "Invalid sale person");
            const payer = paid ? readPerson(paymentBy, "Invalid payment person") : "";
            if (assignee) filter.assignedTo = new mongoose.Types.ObjectId(assignee);
            if (seller) filter.soldBy = new mongoose.Types.ObjectId(seller);
            if (payer) filter.paymentBy = new mongoose.Types.ObjectId(payer);
        }

        const start = readDay(from, "From date");
        const end = readDay(to, "To date");
        if (start && end && start > end) return res.status(400).json({ success: false, message: "From date cannot be after to date" });
        if (start || end) {
            filter[dateField] = {};
            if (start) filter[dateField].$gte = start;
            if (end) {
                const next = new Date(end);
                next.setDate(next.getDate() + 1);
                filter[dateField].$lt = next;
            }
        }

        if (search) {
            const regex = { $regex: escapeRegex(search), $options: "i" };
            clauses.push({ $or: [{ name: regex }, { phone: regex }, { companyName: regex }, { address: regex }] });
        }
        if (clauses.length) filter.$and = clauses;

        const [total, rows, summed] = await Promise.all([
            Lead.countDocuments(filter),
            Lead.find(filter)
                .populate("services", "name")
                .populate("assignedTo", "name")
                .populate("soldBy", "name")
                .populate("paymentBy", "name")
                .populate("createdBy", "name")
                .sort({ [dateField]: -1, createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            mode === "revenue"
                ? Lead.aggregate([{ $match: filter }, { $group: { _id: null, amount: { $sum: "$amount" } } }])
                : Promise.resolve([]),
        ]);

        res.status(200).json({
            success: true,
            seesAll,
            totalAmount: mode === "revenue" ? Math.round(((summed[0]?.amount) || 0) * 100) / 100 : undefined,
            data: rows,
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum },
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

module.exports = {
    listSales: listDeals("sale"),
    listPayments: listDeals("payment"),
    listRevenue: listDeals("revenue"),
};
