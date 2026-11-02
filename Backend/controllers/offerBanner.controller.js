const mongoose = require("mongoose");
const OfferBanner = require("../models/OfferBanner");
const { uploadOfferBanner, destroyCloudinaryFile } = require("../config/cloudinary");

const fail = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    throw error;
};

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePagination = (page, limit) => {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
};

const parseOptionalDate = (value, label) => {
    if (value === undefined || value === null || value === "") return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) fail(`${label} is not a valid date`);
    return date;
};

const readFields = (body) => {
    const title = body.title === undefined ? undefined : String(body.title || "").trim();
    const subtitle = body.subtitle === undefined ? undefined : String(body.subtitle || "").trim();
    const linkUrl = body.linkUrl === undefined ? undefined : String(body.linkUrl || "").trim();
    const status = body.status === undefined ? undefined : String(body.status || "").trim().toUpperCase();
    const sortOrder = body.sortOrder === undefined ? undefined : Number(body.sortOrder);
    const startsAt = body.startsAt === undefined ? undefined : parseOptionalDate(body.startsAt, "Start date");
    const endsAt = body.endsAt === undefined ? undefined : parseOptionalDate(body.endsAt, "End date");

    if (title !== undefined && title.length > 120) fail("Banner title is too long");
    if (subtitle !== undefined && subtitle.length > 240) fail("Banner subtitle is too long");
    if (linkUrl !== undefined && linkUrl.length > 500) fail("Link URL is too long");
    if (status !== undefined && !["ACTIVE", "INACTIVE"].includes(status)) fail("Status must be ACTIVE or INACTIVE");
    if (sortOrder !== undefined && (!Number.isFinite(sortOrder) || Math.abs(sortOrder) > 100000)) {
        fail("Sort order is not valid");
    }
    if (startsAt && endsAt && startsAt > endsAt) fail("Start date cannot be after end date");

    return { title, subtitle, linkUrl, status, sortOrder, startsAt, endsAt };
};

const presentBanner = (doc) => ({
    _id: doc._id,
    title: doc.title,
    subtitle: doc.subtitle || "",
    imageUrl: doc.imageUrl || "",
    linkUrl: doc.linkUrl || "",
    sortOrder: doc.sortOrder || 0,
    status: doc.status,
    startsAt: doc.startsAt || null,
    endsAt: doc.endsAt || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
});

const activeWindowFilter = () => {
    const now = new Date();
    return {
        status: "ACTIVE",
        $and: [
            { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
            { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
        ],
    };
};

const listActiveOfferBanners = async (req, res, next) => {
    try {
        const rows = await OfferBanner.find(activeWindowFilter())
            .sort({ sortOrder: 1, createdAt: -1 })
            .limit(20)
            .lean();
        res.status(200).json({ success: true, data: rows.map(presentBanner) });
    } catch (error) {
        next(error);
    }
};

const listOfferBanners = async (req, res, next) => {
    try {
        const { search, status, page = 1, limit = 10 } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);
        const filter = {};

        if (status) {
            const value = String(status).trim().toUpperCase();
            if (!["ACTIVE", "INACTIVE"].includes(value)) fail("Status filter is not valid");
            filter.status = value;
        }
        if (search) {
            const regex = { $regex: escapeRegex(search), $options: "i" };
            filter.$or = [{ title: regex }, { subtitle: regex }];
        }

        const [total, rows] = await Promise.all([
            OfferBanner.countDocuments(filter),
            OfferBanner.find(filter)
                .sort({ sortOrder: 1, createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
        ]);

        res.status(200).json({
            success: true,
            data: rows.map(presentBanner),
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum) || 1,
                limit: limitNum,
            },
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const getOfferBannerById = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Invalid banner id");
        const row = await OfferBanner.findById(req.params.id).lean();
        if (!row) fail("Banner not found", 404);
        res.status(200).json({ success: true, data: presentBanner(row) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const createOfferBanner = async (req, res, next) => {
    let uploaded = null;
    try {
        const fields = readFields(req.body || {});
        if (req.file) {
            const result = await uploadOfferBanner(req.file);
            uploaded = { url: result.secure_url, publicId: result.public_id };
        }

        if (!fields.title && !fields.subtitle && !uploaded?.url && !fields.linkUrl) {
            fail("Add at least an image, title, subtitle, or link");
        }

        const row = await OfferBanner.create({
            title: fields.title || "",
            subtitle: fields.subtitle || "",
            linkUrl: fields.linkUrl || "",
            sortOrder: Number.isFinite(fields.sortOrder) ? fields.sortOrder : 0,
            status: fields.status || "ACTIVE",
            startsAt: fields.startsAt === undefined ? null : fields.startsAt,
            endsAt: fields.endsAt === undefined ? null : fields.endsAt,
            imageUrl: uploaded?.url || "",
            imagePublicId: uploaded?.publicId || "",
            createdBy: req.user._id,
        });

        uploaded = null;
        res.status(201).json({ success: true, data: presentBanner(row) });
    } catch (error) {
        if (uploaded?.publicId) await destroyCloudinaryFile(uploaded.publicId, "image");
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const updateOfferBanner = async (req, res, next) => {
    let uploaded = null;
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Invalid banner id");
        const row = await OfferBanner.findById(req.params.id);
        if (!row) fail("Banner not found", 404);

        const fields = readFields(req.body || {});
        if (fields.title !== undefined) row.title = fields.title;
        if (fields.subtitle !== undefined) row.subtitle = fields.subtitle;
        if (fields.linkUrl !== undefined) row.linkUrl = fields.linkUrl;
        if (fields.sortOrder !== undefined) row.sortOrder = fields.sortOrder;
        if (fields.status !== undefined) row.status = fields.status;
        if (fields.startsAt !== undefined) row.startsAt = fields.startsAt;
        if (fields.endsAt !== undefined) row.endsAt = fields.endsAt;

        const clearImage = String(req.body?.clearImage || "") === "true" || String(req.body?.clearImage || "") === "1";
        const oldPublicId = row.imagePublicId;

        if (req.file) {
            const result = await uploadOfferBanner(req.file);
            uploaded = { url: result.secure_url, publicId: result.public_id };
            row.imageUrl = uploaded.url;
            row.imagePublicId = uploaded.publicId;
        } else if (clearImage) {
            row.imageUrl = "";
            row.imagePublicId = "";
        }

        const nextTitle = row.title || "";
        const nextSubtitle = row.subtitle || "";
        const nextLink = row.linkUrl || "";
        const nextImage = row.imageUrl || "";
        if (!nextTitle && !nextSubtitle && !nextLink && !nextImage) {
            fail("Banner needs at least an image, title, subtitle, or link");
        }

        await row.save();
        uploaded = null;

        if ((req.file || clearImage) && oldPublicId) {
            await destroyCloudinaryFile(oldPublicId, "image");
        }

        res.status(200).json({ success: true, data: presentBanner(row) });
    } catch (error) {
        if (uploaded?.publicId) await destroyCloudinaryFile(uploaded.publicId, "image");
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const changeOfferBannerStatus = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Invalid banner id");
        const status = String(req.body?.status || "").trim().toUpperCase();
        if (!["ACTIVE", "INACTIVE"].includes(status)) fail("Status must be ACTIVE or INACTIVE");
        const row = await OfferBanner.findByIdAndUpdate(
            req.params.id,
            { $set: { status } },
            { new: true },
        ).lean();
        if (!row) fail("Banner not found", 404);
        res.status(200).json({ success: true, data: presentBanner(row) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const deleteOfferBanner = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Invalid banner id");
        const row = await OfferBanner.findByIdAndDelete(req.params.id).lean();
        if (!row) fail("Banner not found", 404);
        if (row.imagePublicId) await destroyCloudinaryFile(row.imagePublicId, "image");
        res.status(200).json({ success: true, message: "Banner deleted" });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

module.exports = {
    listActiveOfferBanners,
    listOfferBanners,
    getOfferBannerById,
    createOfferBanner,
    updateOfferBanner,
    changeOfferBannerStatus,
    deleteOfferBanner,
};
