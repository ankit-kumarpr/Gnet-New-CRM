const mongoose = require("mongoose");
const User = require("../models/User");
const OfferLetter = require("../models/OfferLetter");
const OfferCounter = require("../models/OfferCounter");
const SoftwareSetting = require("../models/SoftwareSetting");
const { buildOfferLetterPdf } = require("../utils/offerLetterPdf");
const { sendOfferLetter } = require("../utils/mailer");

const canIssue = (user) => {
    if (!user) return false;
    if (user.userType === "ADMIN") return true;
    const { permissionGranted } = require("../utils/permissions");
    return permissionGranted(user, ["MANAGE_EMPLOYEES", "EDIT_EMPLOYEES"]);
};

const present = (letter) => ({
    _id: letter._id,
    refNumber: letter.refNumber,
    sentAt: letter.sentAt,
    sentTo: letter.sentTo || "",
    createdAt: letter.createdAt,
});

const prefixFrom = (setting) => {
    const saved = String(setting?.offerPrefix || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (saved.length >= 2) return saved.slice(0, 8);
    const initials = String(setting?.companyName || "")
        .split(/\s+/)
        .map((word) => word[0] || "")
        .join("")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 4);
    return initials.length >= 2 ? initials : "GN";
};

const loadEmployee = async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        const error = new Error("Invalid employee ID format");
        error.status = 400;
        throw error;
    }
    const employee = await User.findById(id)
        .select("-password -refreshToken")
        .populate("department", "name")
        .populate("designation", "name")
        .populate("employeeType", "name")
        .populate("workMode", "name")
        .populate("reportingManager", "name");
    if (!employee || employee.userType !== "EMPLOYEE") {
        const error = new Error("Employee not found");
        error.status = 404;
        throw error;
    }
    return employee;
};

const loadSetting = async () => SoftwareSetting.findOne({ key: "software" }).lean();

const nextSequence = async (prefix, year) => {
    const counter = await OfferCounter.findOneAndUpdate(
        { key: `offer:${prefix}:${year}` },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    return counter.seq;
};

const ensureLetter = async (employeeId, userId) => {
    const existing = await OfferLetter.findOne({ employee: employeeId });
    if (existing) return existing;

    const setting = await loadSetting();
    const prefix = prefixFrom(setting);
    const year = new Date().getFullYear();
    const sequence = await nextSequence(prefix, year);
    const refNumber = `${prefix}/OL/${String(sequence).padStart(3, "0")}/${year}`;
    try {
        return await OfferLetter.create({
            employee: employeeId,
            refNumber,
            prefix,
            year,
            sequence,
            createdBy: userId,
        });
    } catch (error) {
        if (error.code === 11000) {
            const again = await OfferLetter.findOne({ employee: employeeId });
            if (again) return again;
        }
        throw error;
    }
};

const pdfFor = async (employee, letter) => {
    const setting = (await loadSetting()) || {};
    return buildOfferLetterPdf({ employee, setting, letter });
};

const deny = (res) => res.status(403).json({ success: false, message: "You cannot issue an offer letter" });

const getOfferLetter = async (req, res, next) => {
    try {
        if (!canIssue(req.user)) return deny(res);
        await loadEmployee(req.params.id);
        const letter = await OfferLetter.findOne({ employee: req.params.id });
        res.status(200).json({ success: true, data: letter ? present(letter) : null });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const generateOfferLetter = async (req, res, next) => {
    try {
        if (!canIssue(req.user)) return deny(res);
        const employee = await loadEmployee(req.params.id);
        const letter = await ensureLetter(employee._id, req.user._id);
        res.status(200).json({ success: true, data: present(letter) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const downloadOfferLetter = async (req, res, next) => {
    try {
        if (!canIssue(req.user)) return deny(res);
        const employee = await loadEmployee(req.params.id);
        const letter = await OfferLetter.findOne({ employee: employee._id });
        if (!letter) {
            return res.status(404).json({ success: false, message: "Generate the offer letter first" });
        }
        const pdf = await pdfFor(employee, letter);
        const filename = `Joining-Letter-${letter.refNumber.replace(/\//g, "-")}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
        res.status(200).send(pdf);
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const sendOfferLetterMail = async (req, res, next) => {
    try {
        if (!canIssue(req.user)) return deny(res);
        const employee = await loadEmployee(req.params.id);
        const letter = await OfferLetter.findOne({ employee: employee._id });
        if (!letter) {
            return res.status(404).json({ success: false, message: "Generate the offer letter first" });
        }
        const setting = (await loadSetting()) || {};
        const pdf = await pdfFor(employee, letter);
        const result = await sendOfferLetter({
            name: employee.name,
            email: employee.email,
            companyName: setting.companyName || "CRM",
            refNumber: letter.refNumber,
            pdf,
        });
        if (!result.sent) {
            return res.status(400).json({ success: false, message: result.reason || "Could not send the offer letter" });
        }
        letter.sentAt = new Date();
        letter.sentTo = employee.email;
        await letter.save();
        res.status(200).json({ success: true, message: `Offer letter sent to ${employee.email}`, data: present(letter) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

module.exports = {
    getOfferLetter,
    generateOfferLetter,
    downloadOfferLetter,
    sendOfferLetterMail,
};
