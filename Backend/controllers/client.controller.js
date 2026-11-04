const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const ExcelJS = require("exceljs");
const Client = require("../models/Client");
const Service = require("../models/Service");
const User = require("../models/User");
const Project = require("../models/Project");
const SoftwareSetting = require("../models/SoftwareSetting");
const generateId = require("../utils/generateId");
const { generateIds } = generateId;
const { sendClientWelcome } = require("../utils/mailer");
const { isInReminderWindow } = require("../utils/clientPaymentReminders");
const { permissionGranted, DEFAULT_CLIENT_PERMISSIONS } = require("../utils/permissions");

const CLIENT_BULK_HEADERS = [
    "Name",
    "Email",
    "Phone",
    "WhatsApp",
    "Services",
    "Reporting manager",
    "Street",
    "City",
    "State",
    "Pincode",
    "Landmark",
    "Remark",
];
const CLIENT_BULK_MAX = 300;

const canCreateClient = (user) => {
    if (user?.userType === "ADMIN") return true;
    return permissionGranted(user, ["CREATE_CLIENTS", "MANAGE_CLIENTS"]);
};

const cellText = (value) => {
    if (value == null) return "";
    if (value instanceof Date) return "";
    if (typeof value === "number") return String(value);
    if (typeof value === "object") {
        if (value.text) return String(value.text).trim();
        if (value.result != null) return cellText(value.result);
        if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || "").join("").trim();
    }
    return String(value).trim();
};

const phoneText = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
    return cellText(value).replace(/\D/g, "");
};

const sendWorkbook = async (res, workbook, filename) => {
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(Buffer.from(buffer));
};

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

const downloadClientSample = async (req, res, next) => {
    try {
        if (!canCreateClient(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot add clients" });
        }
        const [services, people] = await Promise.all([
            Service.find().select("name").sort({ name: 1 }).limit(200).lean(),
            User.find({ status: "ACTIVE", userType: { $in: ["ADMIN", "EMPLOYEE"] } })
                .select("name")
                .sort({ name: 1 })
                .limit(500)
                .lean(),
        ]);
        const serviceName = services[0]?.name || "Service name";
        const managerName = people.find((p) => String(p._id) === String(req.user._id))?.name
            || people[0]?.name
            || req.user.name
            || "";

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Clients");
        sheet.addRow(CLIENT_BULK_HEADERS);
        sheet.addRow([
            "Sample Client",
            "sample.client@email.com",
            "9999999999",
            "9999999999",
            serviceName,
            managerName,
            "Street sample",
            "City",
            "State",
            "110001",
            "",
            "Replace this row",
        ]);
        const header = sheet.getRow(1);
        header.font = { bold: true, color: { argb: "FFFFFFFF" } };
        header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
        header.alignment = { vertical: "middle" };
        header.height = 22;
        sheet.views = [{ state: "frozen", ySplit: 1 }];
        sheet.autoFilter = { from: "A1", to: "L1" };
        sheet.columns = CLIENT_BULK_HEADERS.map(() => ({ width: 20 }));

        const notes = workbook.addWorksheet("Notes");
        notes.getColumn(1).width = 110;
        [
            "Delete the sample row on the Clients sheet before you upload.",
            "Name, Email, Phone, Services, and Reporting manager are required.",
            "Phone and WhatsApp must be 10 digits. Pincode must be 6 digits if filled.",
            "Services must already exist. Separate more than one service with a comma.",
            services.length
                ? `Services you can use: ${services.map((item) => item.name).join(", ")}.`
                : "Add a service in the app before uploading clients.",
            "Reporting manager must match an active Admin/Employee name exactly.",
            people.length
                ? `Managers you can use: ${people.map((item) => item.name).join(", ")}.`
                : "No active managers found.",
            `You can upload up to ${CLIENT_BULK_MAX} clients in one file.`,
            "Bulk add is fast: welcome emails are skipped. Login ID and password are the client ID (CLT-######).",
        ].forEach((line) => notes.addRow([line]));

        await sendWorkbook(res, workbook, "client-sample.xlsx");
    } catch (error) {
        next(error);
    }
};

const importClients = async (req, res, next) => {
    try {
        if (!canCreateClient(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot add clients" });
        }
        if (!req.file?.buffer) {
            return res.status(400).json({ success: false, message: "Choose an Excel file" });
        }

        const workbook = new ExcelJS.Workbook();
        try {
            await workbook.xlsx.load(req.file.buffer);
        } catch {
            return res.status(400).json({
                success: false,
                message: "This Excel file could not be read. Download the sample and use that format.",
            });
        }

        const sheet = workbook.getWorksheet("Clients") || workbook.worksheets[0];
        if (!sheet) return res.status(400).json({ success: false, message: "The Excel file has no sheet" });

        const headerRow = sheet.getRow(1);
        const indexes = {};
        headerRow.eachCell((cell, index) => {
            const heading = cellText(cell.value).toLowerCase();
            if (heading === "name" || heading === "client name") indexes.name = index;
            if (heading === "email") indexes.email = index;
            if (["phone", "phone number", "mobile"].includes(heading)) indexes.phone = index;
            if (["whatsapp", "whatsapp number"].includes(heading)) indexes.whatsapp = index;
            if (["services", "service"].includes(heading)) indexes.services = index;
            if (["reporting manager", "manager", "reportingmanager"].includes(heading)) indexes.manager = index;
            if (heading === "street" || heading === "address") indexes.street = index;
            if (heading === "city") indexes.city = index;
            if (heading === "state") indexes.state = index;
            if (heading === "pincode" || heading === "pin code") indexes.pincode = index;
            if (heading === "landmark") indexes.landmark = index;
            if (["remark", "remarks"].includes(heading)) indexes.remark = index;
        });
        if (!indexes.name || !indexes.email || !indexes.phone || !indexes.services || !indexes.manager) {
            return res.status(400).json({
                success: false,
                message: "Use the sample file. Name, Email, Phone, Services, and Reporting manager columns are required.",
            });
        }

        const [services, people] = await Promise.all([
            Service.find().select("name").lean(),
            User.find({ status: "ACTIVE", userType: { $in: ["ADMIN", "EMPLOYEE"] } }).select("name").lean(),
        ]);
        const serviceByName = new Map(services.map((item) => [item.name.trim().toLowerCase(), item._id]));
        const peopleByName = new Map();
        people.forEach((person) => {
            const key = person.name.trim().toLowerCase();
            peopleByName.set(key, (peopleByName.get(key) || []).concat(person));
        });

        const pending = [];
        const errors = [];
        const emailsInFile = new Set();
        let seen = 0;
        let overflow = false;

        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const read = (key) => (indexes[key] ? row.getCell(indexes[key]).value : "");
            const name = cellText(read("name"));
            const email = cellText(read("email")).toLowerCase();
            const phone = phoneText(read("phone"));
            const whatsapp = phoneText(read("whatsapp"));
            const serviceCell = cellText(read("services"));
            const manager = cellText(read("manager"));
            const street = cellText(read("street"));
            const city = cellText(read("city"));
            const state = cellText(read("state"));
            const pincode = cellText(read("pincode")).replace(/\D/g, "").slice(0, 6);
            const landmark = cellText(read("landmark"));
            const remark = cellText(read("remark"));

            if (!name && !email && !phone && !serviceCell && !manager) return;
            if (name.toLowerCase() === "sample client" && phone === "9999999999") return;

            seen += 1;
            if (seen > CLIENT_BULK_MAX) {
                overflow = true;
                return;
            }

            const problems = [];
            if (name.length < 2) problems.push("Name must be at least 2 characters");
            if (name.length > 120) problems.push("Name is too long");
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push("Enter a valid email");
            if (emailsInFile.has(email)) problems.push("This email is repeated in the file");
            if (!/^[0-9]{10}$/.test(phone)) problems.push("Phone number must be 10 digits");
            if (whatsapp && !/^[0-9]{10}$/.test(whatsapp)) problems.push("WhatsApp must be 10 digits");
            if (street.length > 200) problems.push("Street is too long");
            if (city.length > 80) problems.push("City is too long");
            if (state.length > 80) problems.push("State is too long");
            if (landmark.length > 120) problems.push("Landmark is too long");
            if (remark.length > 2000) problems.push("Remark is too long");
            if (pincode && !/^[0-9]{6}$/.test(pincode)) problems.push("Pincode must be 6 digits");

            const serviceNames = serviceCell.split(/[,;]/).map((item) => item.trim()).filter(Boolean);
            const serviceIds = [];
            if (!serviceNames.length) problems.push("Add at least one service");
            serviceNames.forEach((serviceName) => {
                const id = serviceByName.get(serviceName.toLowerCase());
                if (!id) problems.push(`Service not found: ${serviceName}`);
                else if (!serviceIds.some((item) => String(item) === String(id))) serviceIds.push(id);
            });

            let reportingManager = null;
            if (!manager) problems.push("Reporting manager is required");
            else {
                const matches = peopleByName.get(manager.toLowerCase()) || [];
                if (matches.length === 1) reportingManager = matches[0]._id;
                else if (matches.length > 1) problems.push(`More than one person is named ${manager}`);
                else problems.push(`Reporting manager not found: ${manager}`);
            }

            if (problems.length) {
                errors.push({ row: rowNumber, message: problems[0] });
                return;
            }

            emailsInFile.add(email);
            pending.push({
                row: rowNumber,
                name,
                email,
                phone,
                whatsapp: whatsapp || "",
                address: { street, city, state, pincode, landmark },
                remark,
                services: serviceIds,
                reportingManager,
            });
        });

        if (overflow) {
            return res.status(400).json({
                success: false,
                message: `You can upload up to ${CLIENT_BULK_MAX} clients in one file`,
            });
        }
        if (!pending.length && !errors.length) {
            return res.status(400).json({
                success: false,
                message: "No clients to add. Replace the sample row with your clients.",
            });
        }

        if (pending.length) {
            const existing = await Client.find({ email: { $in: pending.map((item) => item.email) } })
                .select("email")
                .lean();
            const taken = new Set(existing.map((item) => String(item.email || "").toLowerCase()));
            const unique = [];
            for (const item of pending) {
                if (taken.has(item.email)) {
                    errors.push({ row: item.row, message: "A client with this email already exists" });
                } else {
                    unique.push(item);
                }
            }

            if (unique.length) {
                const clientIds = await generateIds("CLT", unique.length);
                const passwords = await Promise.all(
                    clientIds.map((id) => bcrypt.hash(id, 10)),
                );
                const docs = unique.map((item, index) => ({
                    name: item.name,
                    email: item.email,
                    phone: item.phone,
                    whatsapp: item.whatsapp,
                    address: item.address,
                    remark: item.remark,
                    services: item.services,
                    reportingManager: item.reportingManager,
                    clientId: clientIds[index],
                    password: passwords[index],
                    permissions: [...DEFAULT_CLIENT_PERMISSIONS],
                    createdBy: req.user._id,
                    payments: [],
                }));

                await Client.insertMany(docs, { ordered: false });

                try {
                    const { notify } = require("../utils/notify");
                    await notify({
                        type: "CLIENT_NEW",
                        title: `${docs.length} clients added in bulk`,
                        body: `Uploaded by ${req.user.name || "user"}`,
                        href: "/dashboard/clients",
                        actorId: req.user._id,
                    });
                } catch {
                    // non-blocking
                }
            }

            return res.status(201).json({
                success: true,
                created: unique.length,
                failed: errors.length,
                errors: errors.slice(0, 40),
                message: unique.length
                    ? `Added ${unique.length} clients. Login password is each client ID.`
                    : "No client was added",
            });
        }

        res.status(201).json({
            success: true,
            created: 0,
            failed: errors.length,
            errors: errors.slice(0, 40),
            message: "No client was added",
        });
    } catch (error) {
        if (error?.writeErrors?.length) {
            return res.status(201).json({
                success: true,
                created: Math.max(0, (error.insertedDocs?.length || 0)),
                failed: error.writeErrors.length,
                errors: error.writeErrors.slice(0, 40).map((item) => ({
                    row: null,
                    message: item.errmsg || "Could not save this client",
                })),
            });
        }
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
    downloadClientSample,
    importClients,
};
