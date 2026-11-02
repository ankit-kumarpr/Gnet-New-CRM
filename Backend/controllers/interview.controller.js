const mongoose = require("mongoose");
const Interview = require("../models/Interview");
const { STATUSES } = require("../models/Interview");
const User = require("../models/User");
const SoftwareSetting = require("../models/SoftwareSetting");
const { uploadResume, destroyCloudinaryFile } = require("../config/cloudinary");
const { sendInterviewRejection } = require("../utils/mailer");

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

const readText = (value, max, label) => {
    const text = String(value || "").trim();
    if (text.length > max) fail(`${label} cannot be longer than ${max} characters`);
    return text;
};

const readDay = (value, label, required) => {
    const text = String(value || "").trim();
    if (!text) {
        if (!required) return null;
        fail(`${label} is required`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) fail(`${label} must be a valid date`);
    const date = new Date(`${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) fail(`${label} must be a valid date`);
    return date;
};

const dayRange = (value) => {
    const start = readDay(value, "Date", true);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { $gte: start, $lt: end };
};

const readInterviewer = async (value, currentId) => {
    const id = String(value || "").trim();
    if (!id || !mongoose.Types.ObjectId.isValid(id)) fail("Select an interviewer");
    if (currentId && String(currentId) === id) return id;
    const user = await User.findOne({
        _id: id,
        status: "ACTIVE",
        userType: { $in: ["ADMIN", "EMPLOYEE"] },
    }).select("_id");
    if (!user) fail("Select an active interviewer");
    return user._id;
};

const readEmail = (value, { required = false } = {}) => {
    const email = String(value || "").trim().toLowerCase();
    if (!email) {
        if (required) fail("Candidate email is required");
        return "";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid candidate email");
    if (email.length > 120) fail("Email cannot be longer than 120 characters");
    return email;
};

const readInterview = async (body, currentInterviewer) => {
    const candidateName = readText(body.candidateName, 120, "Candidate name");
    if (candidateName.length < 2) fail("Candidate name must be at least 2 characters");
    const phone = String(body.phone || "").trim();
    if (!/^[0-9]{10}$/.test(phone)) fail("Phone number must be 10 digits");
    const role = readText(body.role, 120, "Role");
    if (role.length < 2) fail("Role must be at least 2 characters");
    const round = readText(body.round, 80, "Round");
    if (!round) fail("Round is required");
    const status = body.status || "SCHEDULED";
    if (!STATUSES.includes(status)) fail("Select a valid interview status");
    const email = readEmail(body.email, { required: true });
    const interviewDate = readDay(body.interviewDate, "Interview date", true);
    const nextRoundDate = status === "NEXT_ROUND"
        ? readDay(body.nextRoundDate, "Next round date", true)
        : null;

    return {
        candidateName,
        phone,
        email,
        role,
        round,
        interviewDate,
        status,
        interviewer: await readInterviewer(body.interviewer, currentInterviewer),
        note: readText(body.note, 2000, "Note"),
        nextRoundDate,
    };
};

const presentResume = (resume) => (resume?.url ? { name: resume.name, url: resume.url } : null);

const present = (row) => ({
    ...row,
    resume: presentResume(row.resume),
});

const withPeople = (query) => query
    .populate("interviewer", "name")
    .populate("createdBy", "name");

const saveResume = async (file, current) => {
    if (!file) return current || null;
    const result = await uploadResume(file);
    if (current?.publicId) await destroyCloudinaryFile(current.publicId, current.resourceType);
    const name = String(file.originalname || "resume").split(/[/\\]/).pop().slice(0, 80);
    return {
        name: name || "resume",
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: file.mimetype.startsWith("image/") ? "image" : "raw",
        format: result.format || "",
    };
};

const createInterview = async (req, res, next) => {
    try {
        const fields = await readInterview(req.body);
        let mail = null;
        let rejectionMailSentAt = null;
        if (fields.status === "NOT_SELECTED") {
            const setting = await SoftwareSetting.findOne({ key: "software" }).select("companyName").lean();
            mail = await sendInterviewRejection({
                name: fields.candidateName,
                email: fields.email,
                role: fields.role,
                companyName: setting?.companyName || "",
            });
            if (mail.sent) rejectionMailSentAt = new Date();
        }

        const interview = await Interview.create({
            ...fields,
            resume: await saveResume(req.file, null),
            rejectionMailSentAt,
            createdBy: req.user._id,
        });
        const data = await withPeople(Interview.findById(interview._id)).lean();
        res.status(201).json({ success: true, data: present(data), mail });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const getInterviews = async (req, res, next) => {
    try {
        const { search, status, role, round, interviewer, interviewDate, nextRoundDate, page = 1, limit = 10 } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);
        const filter = {};

        if (status) {
            if (!STATUSES.includes(status)) return res.status(400).json({ success: false, message: "Invalid interview status" });
            filter.status = status;
        }
        if (role) filter.role = { $regex: escapeRegex(role), $options: "i" };
        if (round) filter.round = { $regex: escapeRegex(round), $options: "i" };
        if (interviewer) {
            if (!mongoose.Types.ObjectId.isValid(interviewer)) {
                return res.status(400).json({ success: false, message: "Invalid interviewer" });
            }
            filter.interviewer = interviewer;
        }
        if (interviewDate) filter.interviewDate = dayRange(interviewDate);
        if (nextRoundDate) filter.nextRoundDate = dayRange(nextRoundDate);
        if (search) {
            const regex = { $regex: escapeRegex(search), $options: "i" };
            filter.$or = [{ candidateName: regex }, { phone: regex }, { email: regex }, { role: regex }];
        }

        const [total, rows] = await Promise.all([
            Interview.countDocuments(filter),
            withPeople(Interview.find(filter)).sort({ interviewDate: -1, createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        ]);

        res.status(200).json({
            success: true,
            data: rows.map(present),
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum },
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const getInterviewers = async (req, res, next) => {
    try {
        const people = await User.find({ status: "ACTIVE", userType: { $in: ["ADMIN", "EMPLOYEE"] } })
            .select("name")
            .sort({ name: 1 })
            .limit(500)
            .lean();
        res.status(200).json({ success: true, data: people });
    } catch (error) {
        next(error);
    }
};

const getInterviewById = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid interview ID format" });
        }
        const interview = await withPeople(Interview.findById(req.params.id)).lean();
        if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });
        res.status(200).json({ success: true, data: present(interview) });
    } catch (error) {
        next(error);
    }
};

const updateInterview = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid interview ID format" });
        }
        const interview = await Interview.findById(req.params.id);
        if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });

        const previousStatus = interview.status;
        const fields = await readInterview(req.body, interview.interviewer);
        Object.assign(interview, fields);
        if (req.body.removeResume === "1" && !req.file && interview.resume?.publicId) {
            await destroyCloudinaryFile(interview.resume.publicId, interview.resume.resourceType);
            interview.resume = null;
        }
        if (req.file) interview.resume = await saveResume(req.file, interview.resume);

        let mail = null;
        const becameNotSelected = previousStatus !== "NOT_SELECTED" && interview.status === "NOT_SELECTED";
        if (becameNotSelected) {
            const setting = await SoftwareSetting.findOne({ key: "software" }).select("companyName").lean();
            mail = await sendInterviewRejection({
                name: interview.candidateName,
                email: interview.email,
                role: interview.role,
                companyName: setting?.companyName || "",
            });
            if (mail.sent) interview.rejectionMailSentAt = new Date();
        }

        await interview.save();

        const data = await withPeople(Interview.findById(interview._id)).lean();
        res.status(200).json({
            success: true,
            data: present(data),
            mail,
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const deleteInterview = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid interview ID format" });
        }
        const interview = await Interview.findById(req.params.id);
        if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });
        if (interview.resume?.publicId) {
            await destroyCloudinaryFile(interview.resume.publicId, interview.resume.resourceType);
        }
        await interview.deleteOne();
        res.status(200).json({ success: true, message: "Interview deleted" });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createInterview,
    getInterviews,
    getInterviewers,
    getInterviewById,
    updateInterview,
    deleteInterview,
};
