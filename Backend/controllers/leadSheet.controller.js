const ExcelJS = require("exceljs");
const Lead = require("../models/Lead");
const { SOURCES } = require("../models/Lead");
const Service = require("../models/Service");
const User = require("../models/User");
const { leadTeamIds } = require("../utils/leadAccess");
const { buildLeadListFilter } = require("./lead.controller");

const SOURCE_LABELS = {
    GMB: "GMB",
    COLD_CALL: "Cold call",
    META_ADS: "Meta ads",
    WEBSITE: "Website",
    REFERRAL: "Referral",
    OTHER: "Other",
};

const STATUS_LABELS = {
    NEW: "New",
    CONTACTED: "Contacted",
    INTERESTED: "Interested",
    FOLLOW_UP: "Follow up",
    PROPOSAL: "Proposal",
    CONVERTED: "Converted",
    PAYMENT: "Payment",
    LOST: "Lost",
};

const HEADERS = ["Name", "Phone", "Company", "Address", "Source", "Services", "Remark", "Assigned to"];

const canCreateLead = (user) => {
    if (user.userType === "ADMIN") return true;
    const { permissionGranted } = require("../utils/permissions");
    return permissionGranted(user, ["CREATE_LEADS", "MANAGE_LEADS"]);
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

const sourceFromCell = (value) => {
    const raw = cellText(value);
    const compact = raw.toLowerCase().replace(/[\s-]+/g, "_");
    const aliases = {
        gmb: "GMB",
        cold_call: "COLD_CALL",
        meta_ads: "META_ADS",
        meta: "META_ADS",
        website: "WEBSITE",
        referral: "REFERRAL",
        other: "OTHER",
    };
    if (SOURCES.includes(raw.toUpperCase())) return raw.toUpperCase();
    return aliases[compact] || "";
};

const formatWhen = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
};

const sendWorkbook = async (res, workbook, filename) => {
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(Buffer.from(buffer));
};

const styleHeader = (sheet) => {
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF312E81" } };
    header.alignment = { vertical: "middle" };
    header.height = 22;
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: "A1", to: "H1" };
};

const downloadLeadSample = async (req, res, next) => {
    try {
        if (!canCreateLead(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot add leads" });
        }
        const [services, allowedIds] = await Promise.all([
            Service.find().select("name").sort({ name: 1 }).limit(200).lean(),
            req.user.userType === "ADMIN" ? Promise.resolve(null) : leadTeamIds(req.user),
        ]);
        const peopleFilter = { status: "ACTIVE", userType: { $in: ["ADMIN", "EMPLOYEE"] } };
        if (allowedIds) peopleFilter._id = { $in: allowedIds };
        const people = await User.find(peopleFilter).select("name").sort({ name: 1 }).limit(500).lean();
        const serviceName = services[0]?.name || "Service name";

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Leads");
        sheet.addRow(HEADERS);
        sheet.addRow(["Sample Name", "9999999999", "Sample Company", "Sample address", "Cold call", serviceName, "Replace this row", req.user.name || ""]);
        styleHeader(sheet);
        sheet.columns = [
            { width: 24 }, { width: 16 }, { width: 24 }, { width: 28 },
            { width: 16 }, { width: 28 }, { width: 28 }, { width: 24 },
        ];

        const notes = workbook.addWorksheet("Notes");
        notes.getColumn(1).width = 110;
        const lines = [
            "Delete the sample row on the Leads sheet before you upload.",
            "Name and phone are required. Phone must be 10 digits.",
            `Source must be one of: ${Object.values(SOURCE_LABELS).join(", ")}.`,
            "Services must already exist. Separate more than one service with a comma.",
            services.length ? `Services you can use: ${services.map((item) => item.name).join(", ")}.` : "Add a service in the app before uploading leads.",
            "Assigned to can be blank. A blank cell assigns the lead to you.",
            req.user.userType === "ADMIN"
                ? "You can assign a lead to any active person."
                : "You can assign a lead only to yourself or someone on your team.",
            people.length ? `People you can assign: ${people.map((item) => item.name).join(", ")}.` : "",
            "You can upload up to 300 leads in one file.",
        ].filter(Boolean);
        lines.forEach((line) => notes.addRow([line]));

        await sendWorkbook(res, workbook, "lead-sample.xlsx");
    } catch (error) {
        next(error);
    }
};

const importLeads = async (req, res, next) => {
    try {
        if (!canCreateLead(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot add leads" });
        }
        if (!req.file?.buffer) {
            return res.status(400).json({ success: false, message: "Choose an Excel file" });
        }

        const workbook = new ExcelJS.Workbook();
        try {
            await workbook.xlsx.load(req.file.buffer);
        } catch {
            return res.status(400).json({ success: false, message: "This Excel file could not be read. Download the sample and use that format." });
        }
        const sheet = workbook.getWorksheet("Leads") || workbook.worksheets[0];
        if (!sheet) return res.status(400).json({ success: false, message: "The Excel file has no sheet" });

        const headerRow = sheet.getRow(1);
        const indexes = {};
        headerRow.eachCell((cell, index) => {
            const heading = cellText(cell.value).toLowerCase();
            if (heading === "name") indexes.name = index;
            if (["phone", "phone number", "mobile"].includes(heading)) indexes.phone = index;
            if (["company", "company name"].includes(heading)) indexes.company = index;
            if (heading === "address") indexes.address = index;
            if (heading === "source") indexes.source = index;
            if (["services", "service"].includes(heading)) indexes.services = index;
            if (["remark", "remarks"].includes(heading)) indexes.remark = index;
            if (["assigned to", "assigned", "assignee"].includes(heading)) indexes.assigned = index;
        });
        if (!indexes.name || !indexes.phone || !indexes.source || !indexes.services) {
            return res.status(400).json({ success: false, message: "Use the sample file. Name, Phone, Source, and Services columns are required." });
        }

        const [services, allowedIds] = await Promise.all([
            Service.find().select("name").lean(),
            req.user.userType === "ADMIN" ? Promise.resolve(null) : leadTeamIds(req.user),
        ]);
        const peopleFilter = { status: "ACTIVE", userType: { $in: ["ADMIN", "EMPLOYEE"] } };
        if (allowedIds) peopleFilter._id = { $in: allowedIds };
        const people = await User.find(peopleFilter).select("name").lean();
        const serviceByName = new Map(services.map((item) => [item.name.trim().toLowerCase(), item._id]));
        const peopleByName = new Map();
        people.forEach((person) => {
            const key = person.name.trim().toLowerCase();
            peopleByName.set(key, (peopleByName.get(key) || []).concat(person));
        });

        const docs = [];
        const errors = [];
        let seen = 0;
        let overflow = false;
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const read = (key) => (indexes[key] ? row.getCell(indexes[key]).value : "");
            const name = cellText(read("name"));
            const phone = phoneText(read("phone"));
            const company = cellText(read("company"));
            const address = cellText(read("address"));
            const sourceCell = read("source");
            const serviceCell = cellText(read("services"));
            const remark = cellText(read("remark"));
            const assigned = cellText(read("assigned"));
            if (!name && !phone && !serviceCell && !assigned) return;
            if (name.toLowerCase() === "sample name" && phone === "9999999999") return;
            seen += 1;
            if (seen > 300) {
                overflow = true;
                return;
            }
            const problems = [];
            if (name.length < 2) problems.push("Name must be at least 2 characters");
            if (name.length > 120) problems.push("Name is too long");
            if (!/^[0-9]{10}$/.test(phone)) problems.push("Phone number must be 10 digits");
            if (company.length > 120) problems.push("Company name is too long");
            if (address.length > 300) problems.push("Address is too long");
            if (remark.length > 2000) problems.push("Remark is too long");
            const source = sourceFromCell(sourceCell);
            if (!source) problems.push("Source must be GMB, Cold call, Meta ads, Website, Referral, or Other");
            const serviceNames = serviceCell.split(/[,;]/).map((item) => item.trim()).filter(Boolean);
            const serviceIds = [];
            if (!serviceNames.length) problems.push("Add at least one service");
            serviceNames.forEach((serviceName) => {
                const id = serviceByName.get(serviceName.toLowerCase());
                if (!id) problems.push(`Service not found: ${serviceName}`);
                else if (!serviceIds.some((item) => String(item) === String(id))) serviceIds.push(id);
            });
            let assignedTo = req.user._id;
            if (assigned) {
                const matches = peopleByName.get(assigned.toLowerCase()) || [];
                if (matches.length === 1) assignedTo = matches[0]._id;
                else if (matches.length > 1) problems.push(`More than one person is named ${assigned}`);
                else problems.push(`${assigned} cannot be assigned this lead`);
            }
            if (problems.length) {
                errors.push({ row: rowNumber, message: problems[0] });
                return;
            }
            docs.push({
                name,
                phone,
                companyName: company,
                address,
                source,
                services: serviceIds,
                remark,
                assignedTo,
                createdBy: req.user._id,
                status: "NEW",
                nextFollowUpAt: null,
                lostReason: "",
            });
        });

        if (overflow) {
            return res.status(400).json({ success: false, message: "You can upload up to 300 leads in one file" });
        }
        if (!docs.length && !errors.length) {
            return res.status(400).json({ success: false, message: "No leads to add. Replace the sample row with your leads." });
        }
        if (docs.length) await Lead.insertMany(docs);
        res.status(201).json({
            success: true,
            created: docs.length,
            failed: errors.length,
            errors: errors.slice(0, 30),
        });
    } catch (error) {
        next(error);
    }
};

const exportLeads = async (req, res, next) => {
    try {
        const filter = await buildLeadListFilter(req.user, req.query);
        const rows = await Lead.find(filter)
            .populate("services", "name")
            .populate("createdBy", "name")
            .populate("assignedTo", "name")
            .populate("soldBy", "name")
            .populate("paymentBy", "name")
            .sort({ createdAt: -1 })
            .limit(5000)
            .lean();

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Leads");
        const exportHeaders = [
            "Name", "Phone", "Company", "Address", "Source", "Services", "Status",
            "Assigned to", "Created by", "Remark", "Next follow-up", "Sale by",
            "Converted", "Payment by", "Payment", "Revenue", "Lost reason", "Added",
        ];
        sheet.addRow(exportHeaders);
        rows.forEach((lead) => {
            sheet.addRow([
                lead.name || "",
                lead.phone || "",
                lead.companyName || "",
                lead.address || "",
                SOURCE_LABELS[lead.source] || lead.source || "",
                (lead.services || []).map((service) => service.name).filter(Boolean).join(", "),
                STATUS_LABELS[lead.status] || lead.status || "",
                lead.assignedTo?.name || "",
                lead.createdBy?.name || "",
                lead.remark || "",
                formatWhen(lead.nextFollowUpAt),
                lead.soldBy?.name || "",
                formatWhen(lead.convertedAt),
                lead.paymentBy?.name || "",
                formatWhen(lead.paymentAt),
                Number(lead.amount) || 0,
                lead.lostReason || "",
                formatWhen(lead.createdAt),
            ]);
        });
        const header = sheet.getRow(1);
        header.font = { bold: true, color: { argb: "FFFFFFFF" } };
        header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF312E81" } };
        sheet.views = [{ state: "frozen", ySplit: 1 }];
        sheet.columns.forEach((column) => { column.width = 20; });
        await sendWorkbook(res, workbook, "leads.xlsx");
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

module.exports = { downloadLeadSample, importLeads, exportLeads };
