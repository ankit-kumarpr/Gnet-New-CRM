const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const Client = require("../models/Client");
const Service = require("../models/Service");
const User = require("../models/User");
const Project = require("../models/Project");
const SoftwareSetting = require("../models/SoftwareSetting");
const generateId = require("../utils/generateId");
const { sendClientWelcome } = require("../utils/mailer");
const { isInReminderWindow } = require("../utils/clientPaymentReminders");
const { permissionGranted } = require("../utils/permissions");

const seesEveryClient = (user) => user?.userType === "ADMIN" || permissionGranted(user, ["MANAGE_CLIENTS"]);

const assignedClientIds = async (userId) => {
    const projects = await Project.find({
        $or: [
            { reportingManager: userId },
            { workingEmployees: userId },
            { "serviceAssignments.employee": userId },
        ],
    })
        .select("client")
        .lean();
    return [...new Set(projects.map((row) => row.client).filter(Boolean).map(String))]
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
};

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

const readPhone = (value, label, required) => {
    const phone = String(value || "").trim();
    if (!phone) {
        if (required) fail(`${label} is required`);
        return "";
    }
    if (!/^[0-9]{10}$/.test(phone)) fail(`${label} must be 10 digits`);
    return phone;
};

const readEmail = (value, { required = false } = {}) => {
    const email = String(value || "").trim().toLowerCase();
    if (!email) {
        if (required) fail("Client email is required for portal login");
        return undefined;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid email");
    return email;
};

const readReportingManager = async (value) => {
    const id = String(value || "").trim();
    if (!id || !mongoose.Types.ObjectId.isValid(id)) fail("Select a reporting manager");
    const user = await User.findOne({
        _id: id,
        status: "ACTIVE",
        userType: { $in: ["ADMIN", "EMPLOYEE"] },
    }).select("_id name");
    if (!user) fail("Select an active reporting manager");
    return user;
};

const readText = (value, max, label) => {
    const text = String(value || "").trim();
    if (text.length > max) fail(`${label} cannot be longer than ${max} characters`);
    return text;
};

const readAddress = (value) => {
    const source = value && typeof value === "object" ? value : {};
    const pincode = String(source.pincode || "").trim();
    if (pincode && !/^[0-9]{6}$/.test(pincode)) fail("Pincode must be 6 digits");
    return {
        street: readText(source.street, 200, "Street"),
        city: readText(source.city, 80, "City"),
        state: readText(source.state, 80, "State"),
        pincode,
        landmark: readText(source.landmark, 120, "Landmark"),
    };
};

const readServices = async (value) => {
    if (!Array.isArray(value) || value.length === 0) fail("Select at least one service");
    const ids = [...new Set(value.map((id) => String(id || "").trim()).filter(Boolean))];
    if (!ids.length) fail("Select at least one service");
    if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) fail("Invalid service selected");
    const found = await Service.countDocuments({ _id: { $in: ids } });
    if (found !== ids.length) fail("One or more services were not found");
    return ids;
};

/** Optional renewal payment rows — blank rows skipped; empty array clears */
const readPayments = (body, existingPayments = []) => {
    const raw = body.payments;
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) fail("Payments must be an array");

    const existingById = new Map(
        (existingPayments || [])
            .filter((row) => row && row._id)
            .map((row) => [String(row._id), row]),
    );

    const payments = [];
    for (const row of raw) {
        if (!row || typeof row !== "object") continue;
        const dateRaw = row.date;
        const amountRaw = row.amount;
        const noteRaw = row.note;
        const hasDate = dateRaw !== undefined && dateRaw !== null && String(dateRaw).trim() !== "";
        const hasAmount = amountRaw !== undefined && amountRaw !== null && String(amountRaw).trim() !== "";
        const hasNote = noteRaw !== undefined && noteRaw !== null && String(noteRaw).trim() !== "";
        if (!hasDate && !hasAmount && !hasNote) continue;
        if (!hasDate) fail("Each payment row needs a renewal / payment date");

        const parsed = new Date(String(dateRaw).trim());
        if (Number.isNaN(parsed.getTime())) fail("Invalid payment / renewal date");

        let amount = null;
        if (hasAmount) {
            const n = Number(amountRaw);
            if (!Number.isFinite(n) || n < 0) fail("Payment amount must be a valid number ≥ 0");
            amount = Math.round(n * 100) / 100;
        }

        const prev = row._id ? existingById.get(String(row._id)) : null;
        const entry = {
            date: parsed,
            amount,
            note: readText(noteRaw, 200, "Payment note"),
            paid: Boolean(prev?.paid),
            paidAt: prev?.paidAt || null,
            paidBy: prev?.paidBy || null,
            lastRemindedOn: prev?.lastRemindedOn || null,
        };
        if (prev?._id) entry._id = prev._id;
        payments.push(entry);
    }

    payments.sort((a, b) => a.date - b.date);
    return payments;
};

const startOfDay = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
};

const endOfDay = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(23, 59, 59, 999);
    return d;
};

const readClient = async (body, { requireEmail = false, existingPayments = [] } = {}) => {
    const name = readText(body.name, 120, "Client name");
    if (name.length < 2) fail("Client name must be at least 2 characters");
    const manager = await readReportingManager(body.reportingManager);
    return {
        name,
        email: readEmail(body.email, { required: requireEmail }),
        phone: readPhone(body.phone, "Phone number", true),
        whatsapp: readPhone(body.whatsapp, "WhatsApp number", false),
        address: readAddress(body.address),
        remark: readText(body.remark, 2000, "Remark"),
        services: await readServices(body.services),
        reportingManager: manager._id,
        reportingManagerName: manager.name,
        payments: readPayments(body, existingPayments),
    };
};

const createClient = async (req, res, next) => {
    try {
        const fields = await readClient(req.body, { requireEmail: true });
        const clientId = await generateId("CLT");
        const plainPassword = clientId;

        const { DEFAULT_CLIENT_PERMISSIONS } = require("../utils/permissions");
        const client = await Client.create({
            name: fields.name,
            email: fields.email,
            phone: fields.phone,
            whatsapp: fields.whatsapp,
            address: fields.address,
            remark: fields.remark,
            payments: fields.payments,
            services: fields.services,
            reportingManager: fields.reportingManager,
            clientId,
            password: plainPassword,
            permissions: [...DEFAULT_CLIENT_PERMISSIONS],
            createdBy: req.user._id,
        });

        const setting = await SoftwareSetting.findOne({ key: "software" }).select("companyName").lean();
        let mail = { sent: false };
        try {
            mail = await sendClientWelcome({
                name: client.name,
                email: client.email,
                clientId,
                password: plainPassword,
                companyName: setting?.companyName || "",
                reportingManagerName: fields.reportingManagerName,
            });
        } catch (mailError) {
            mail = { sent: false, reason: mailError.message };
        }

        const { notify } = require("../utils/notify");
        await notify({
            type: "CLIENT_NEW",
            title: `New client onboarded: ${client.name}`,
            body: `${client.clientId} · ${client.email || client.phone}`,
            href: `/dashboard/clients/${client._id}`,
            actorId: req.user._id,
            extraUserIds: [fields.reportingManager],
        });

        const data = await Client.findById(client._id)
            .populate("services", "name description")
            .populate("reportingManager", "name email phone")
            .lean();
        res.status(201).json({
            success: true,
            data,
            mail,
            message: mail.sent
                ? "Client created and welcome mail sent"
                : `Client created. Welcome mail not sent${mail.reason ? `: ${mail.reason}` : ""}`,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: "A client with this email or ID already exists" });
        }
        if (error.status) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const getClients = async (req, res, next) => {
    try {
        const {
            search,
            page = 1,
            limit = 10,
            paymentFilter = "all",
            renewalFrom,
            renewalTo,
        } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);
        const and = [];

        if (!seesEveryClient(req.user)) {
            const ids = await assignedClientIds(req.user._id);
            and.push({ _id: { $in: ids } });
        }

        if (search) {
            const regex = { $regex: escapeRegex(search), $options: "i" };
            and.push({
                $or: [{ name: regex }, { email: regex }, { phone: regex }, { whatsapp: regex }, { clientId: regex }],
            });
        }

        const today = startOfDay(new Date());
        const mode = String(paymentFilter || "all").toLowerCase();

        if (mode === "set") {
            and.push({ "payments.0": { $exists: true } });
        } else if (mode === "unset") {
            and.push({
                $or: [
                    { payments: { $exists: false } },
                    { payments: { $size: 0 } },
                    { payments: null },
                ],
            });
        } else if (mode === "unpaid") {
            and.push({ payments: { $elemMatch: { paid: { $ne: true } } } });
        } else if (mode === "paid") {
            and.push({ payments: { $elemMatch: { paid: true } } });
        } else if (mode === "notify") {
            const until = endOfDay(new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000));
            and.push({
                payments: {
                    $elemMatch: {
                        paid: { $ne: true },
                        date: { $lte: until },
                    },
                },
            });
        } else if (mode === "overdue") {
            and.push({
                payments: {
                    $elemMatch: {
                        paid: { $ne: true },
                        date: { $lt: today },
                    },
                },
            });
        } else if (mode === "due30") {
            const until = new Date(today);
            until.setDate(until.getDate() + 30);
            until.setHours(23, 59, 59, 999);
            and.push({
                payments: {
                    $elemMatch: {
                        paid: { $ne: true },
                        date: { $gte: today, $lte: until },
                    },
                },
            });
        } else if (mode === "thismonth") {
            const from = new Date(today.getFullYear(), today.getMonth(), 1);
            const to = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
            and.push({
                payments: {
                    $elemMatch: {
                        paid: { $ne: true },
                        date: { $gte: from, $lte: to },
                    },
                },
            });
        }

        if (mode !== "unset") {
            const from = renewalFrom ? startOfDay(renewalFrom) : null;
            const to = renewalTo ? endOfDay(renewalTo) : null;
            if (from || to) {
                const match = { paid: { $ne: true } };
                const dateMatch = {};
                if (from) dateMatch.$gte = from;
                if (to) dateMatch.$lte = to;
                and.push({ payments: { $elemMatch: { ...match, date: dateMatch } } });
            }
        }

        const filter = and.length ? { $and: and } : {};
        const sort = { createdAt: -1 };

        const [total, clients] = await Promise.all([
            Client.countDocuments(filter),
            Client.find(filter)
                .populate("services", "name description")
                .populate("reportingManager", "name")
                .skip(skip)
                .limit(limitNum)
                .sort(sort)
                .lean(),
        ]);

        res.status(200).json({
            success: true,
            data: clients,
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum },
        });
    } catch (error) {
        next(error);
    }
};

const getClientById = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid client ID format" });
        }
        if (!seesEveryClient(req.user)) {
            const ids = await assignedClientIds(req.user._id);
            if (!ids.some((id) => String(id) === String(req.params.id))) {
                return res.status(403).json({ success: false, message: "You can only view clients assigned to you" });
            }
        }
        const client = await Client.findById(req.params.id)
            .populate("services", "name description")
            .populate("reportingManager", "name email phone")
            .lean();
        if (!client) {
            return res.status(404).json({ success: false, message: "Client not found" });
        }
        res.status(200).json({ success: true, data: client });
    } catch (error) {
        next(error);
    }
};

const updateClient = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid client ID format" });
        }
        const client = await Client.findById(req.params.id);
        if (!client) {
            return res.status(404).json({ success: false, message: "Client not found" });
        }

        const fields = await readClient(req.body, {
            requireEmail: true,
            existingPayments: client.payments || [],
        });
        client.name = fields.name;
        client.email = fields.email;
        client.phone = fields.phone;
        client.whatsapp = fields.whatsapp;
        client.address = fields.address;
        client.remark = fields.remark;
        client.payments = fields.payments;
        client.services = fields.services;
        client.reportingManager = fields.reportingManager;
        await client.save();

        const data = await Client.findById(client._id)
            .populate("services", "name description")
            .populate("reportingManager", "name email phone")
            .lean();
        res.status(200).json({ success: true, data });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: "A client with this email already exists" });
        }
        if (error.status) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const deleteClient = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid client ID format" });
        }
        const client = await Client.findById(req.params.id);
        if (!client) {
            return res.status(404).json({ success: false, message: "Client not found" });
        }
        await client.deleteOne();
        res.status(200).json({ success: true, message: "Client deleted successfully" });
    } catch (error) {
        next(error);
    }
};

const updateClientPermissions = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { permissions } = req.body;
        if (!Array.isArray(permissions)) {
            return res.status(400).json({ success: false, message: "Permissions must be an array of string keys" });
        }
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid client id" });
        }
        const client = await Client.findById(id);
        if (!client) {
            return res.status(404).json({ success: false, message: "Client not found" });
        }
        client.permissions = permissions.map((item) => String(item || "").trim()).filter(Boolean);
        await client.save();
        res.status(200).json({
            success: true,
            message: "Client permissions updated successfully",
            data: {
                id: client._id,
                name: client.name,
                permissions: client.permissions,
            },
        });
    } catch (error) {
        next(error);
    }
};

const markClientPaymentPaid = async (req, res, next) => {
    try {
        const { id, paymentId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(paymentId)) {
            return res.status(400).json({ success: false, message: "Invalid client or payment id" });
        }
        const client = await Client.findById(id);
        if (!client) {
            return res.status(404).json({ success: false, message: "Client not found" });
        }
        const payment = client.payments.id(paymentId);
        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment row not found" });
        }

        const markPaid = req.body?.paid === false ? false : true;
        if (markPaid) {
            payment.paid = true;
            payment.paidAt = new Date();
            payment.paidBy = req.user._id;
        } else {
            payment.paid = false;
            payment.paidAt = null;
            payment.paidBy = null;
            payment.lastRemindedOn = null;
        }
        await client.save();

        const data = await Client.findById(client._id)
            .populate("services", "name description")
            .populate("reportingManager", "name email phone")
            .lean();
        res.status(200).json({
            success: true,
            message: markPaid ? "Payment marked as done" : "Payment marked as unpaid",
            data,
        });
    } catch (error) {
        next(error);
    }
};

const exportClientPayments = async (req, res, next) => {
    try {
        const { paymentFilter = "notify", renewalFrom, renewalTo } = req.query;
        const today = startOfDay(new Date());
        const mode = String(paymentFilter || "notify").toLowerCase();
        const and = [{ "payments.0": { $exists: true } }];

        if (mode === "notify") {
            const until = endOfDay(new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000));
            and.push({
                payments: {
                    $elemMatch: { paid: { $ne: true }, date: { $lte: until } },
                },
            });
        } else if (mode === "unpaid" || mode === "overdue" || mode === "due30" || mode === "thismonth") {
            // same list filters — export matching unpaid rows
            if (mode === "unpaid") {
                and.push({ payments: { $elemMatch: { paid: { $ne: true } } } });
            } else if (mode === "overdue") {
                and.push({ payments: { $elemMatch: { paid: { $ne: true }, date: { $lt: today } } } });
            } else if (mode === "due30") {
                const until = endOfDay(new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000));
                and.push({
                    payments: {
                        $elemMatch: { paid: { $ne: true }, date: { $gte: today, $lte: until } },
                    },
                });
            } else if (mode === "thismonth") {
                const from = new Date(today.getFullYear(), today.getMonth(), 1);
                const to = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
                and.push({
                    payments: {
                        $elemMatch: { paid: { $ne: true }, date: { $gte: from, $lte: to } },
                    },
                });
            }
        } else if (mode === "paid") {
            and.push({ payments: { $elemMatch: { paid: true } } });
        } else if (mode === "set") {
            // all payment rows
        }

        const from = renewalFrom ? startOfDay(renewalFrom) : null;
        const to = renewalTo ? endOfDay(renewalTo) : null;
        if (from || to) {
            const dateMatch = {};
            if (from) dateMatch.$gte = from;
            if (to) dateMatch.$lte = to;
            and.push({ payments: { $elemMatch: { date: dateMatch } } });
        }

        const clients = await Client.find({ $and: and })
            .populate("reportingManager", "name")
            .populate("services", "name")
            .sort({ name: 1 })
            .lean();

        const rows = [];
        for (const client of clients) {
            for (const payment of client.payments || []) {
                const paid = Boolean(payment.paid);
                if (mode === "notify" || mode === "unpaid" || mode === "overdue" || mode === "due30" || mode === "thismonth") {
                    if (paid) continue;
                }
                if (mode === "paid" && !paid) continue;
                if (mode === "notify" && !isInReminderWindow(payment.date, today)) continue;
                if (mode === "overdue" && !(startOfDay(payment.date) < today)) continue;
                if (from && startOfDay(payment.date) < from) continue;
                if (to && startOfDay(payment.date) > to) continue;

                const daysLeft = Math.ceil((startOfDay(payment.date) - today) / (24 * 60 * 60 * 1000));
                rows.push({
                    clientId: client.clientId || "",
                    name: client.name || "",
                    email: client.email || "",
                    phone: client.phone || "",
                    manager: client.reportingManager?.name || "",
                    services: (client.services || []).map((s) => s.name).join(", "),
                    date: payment.date,
                    amount: payment.amount,
                    note: payment.note || "",
                    status: paid ? "PAID" : daysLeft < 0 ? "OVERDUE" : daysLeft === 0 ? "DUE TODAY" : `DUE IN ${daysLeft}D`,
                    paidAt: payment.paidAt || "",
                });
            }
        }

        rows.sort((a, b) => new Date(a.date) - new Date(b.date));

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Renewals");
        sheet.columns = [
            { header: "Client ID", key: "clientId", width: 14 },
            { header: "Client name", key: "name", width: 28 },
            { header: "Email", key: "email", width: 28 },
            { header: "Phone", key: "phone", width: 14 },
            { header: "Reporting manager", key: "manager", width: 22 },
            { header: "Services", key: "services", width: 28 },
            { header: "Renewal date", key: "date", width: 16 },
            { header: "Amount", key: "amount", width: 12 },
            { header: "Status", key: "status", width: 14 },
            { header: "Note", key: "note", width: 24 },
            { header: "Paid at", key: "paidAt", width: 18 },
        ];
        const header = sheet.getRow(1);
        header.font = { bold: true, color: { argb: "FFFFFFFF" } };
        header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
        header.alignment = { vertical: "middle" };
        sheet.views = [{ state: "frozen", ySplit: 1 }];

        for (const row of rows) {
            sheet.addRow({
                ...row,
                date: row.date ? new Date(row.date) : "",
                paidAt: row.paidAt ? new Date(row.paidAt) : "",
            });
        }
        sheet.getColumn("date").numFmt = "dd-mmm-yyyy";
        sheet.getColumn("paidAt").numFmt = "dd-mmm-yyyy hh:mm";
        sheet.getColumn("amount").numFmt = "#,##0.00";

        const buffer = await workbook.xlsx.writeBuffer();
        const stamp = today.toISOString().slice(0, 10);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="client-renewals-${stamp}.xlsx"`);
        res.status(200).send(Buffer.from(buffer));
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createClient,
    getClients,
    getClientById,
    updateClient,
    deleteClient,
    updateClientPermissions,
    markClientPaymentPaid,
    exportClientPayments,
};
