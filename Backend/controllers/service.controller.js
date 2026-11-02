const mongoose = require("mongoose");
const Service = require("../models/Service");
const Client = require("../models/Client");
const Lead = require("../models/Lead");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePagination = (page, limit) => {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * limitNum;
    return { pageNum, limitNum, skip };
};

const cleanDescription = (value) => {
    if (value === undefined) return undefined;
    const text = String(value)
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
        .replace(/\son\w+=("[^"]*"|'[^']*')/gi, "")
        .trim();
    const plain = text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    if (!plain) return "";
    if (text.length > 20000) {
        const error = new Error("Description is too long");
        error.status = 400;
        throw error;
    }
    return text;
};

const readServiceFields = (body, { requireName }) => {
    const name = body.name === undefined ? undefined : String(body.name).trim();
    const description = cleanDescription(body.description);

    if (requireName && !name) {
        const error = new Error("Service name is required");
        error.status = 400;
        throw error;
    }
    if (name !== undefined && !name) {
        const error = new Error("Service name is required");
        error.status = 400;
        throw error;
    }
    if (name !== undefined && name.length > 120) {
        const error = new Error("Service name cannot be longer than 120 characters");
        error.status = 400;
        throw error;
    }
    return { name, description };
};

const createService = async (req, res, next) => {
    try {
        const { name, description } = readServiceFields(req.body, { requireName: true });
        const service = await Service.create({
            name,
            description: description || "",
            createdBy: req.user._id,
        });
        res.status(201).json({ success: true, data: service });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const getServices = async (req, res, next) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const { pageNum, limitNum, skip } = parsePagination(page, limit);
        const filter = {};

        if (search) {
            const regex = { $regex: escapeRegex(search), $options: "i" };
            filter.$or = [{ name: regex }, { description: regex }];
        }

        const [total, services] = await Promise.all([
            Service.countDocuments(filter),
            Service.find(filter).skip(skip).limit(limitNum).sort({ createdAt: -1 }).lean(),
        ]);

        res.status(200).json({
            success: true,
            data: services,
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum },
        });
    } catch (error) {
        next(error);
    }
};

const getServiceById = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid service ID format" });
        }

        const service = await Service.findById(req.params.id).lean();
        if (!service) {
            return res.status(404).json({ success: false, message: "Service not found" });
        }

        res.status(200).json({ success: true, data: service });
    } catch (error) {
        next(error);
    }
};

const updateService = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid service ID format" });
        }

        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ success: false, message: "Service not found" });
        }

        const { name, description } = readServiceFields(req.body, { requireName: false });
        if (name !== undefined) service.name = name;
        if (description !== undefined) service.description = description;
        await service.save();

        res.status(200).json({ success: true, data: service });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const deleteService = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid service ID format" });
        }

        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ success: false, message: "Service not found" });
        }

        const [usedByClient, usedByLead] = await Promise.all([
            Client.exists({ services: service._id }),
            Lead.exists({ services: service._id }),
        ]);
        if (usedByClient || usedByLead) {
            return res.status(409).json({ success: false, message: "Service is assigned to a client or lead. Remove it there first" });
        }

        await service.deleteOne();
        res.status(200).json({ success: true, message: "Service deleted successfully" });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createService,
    getServices,
    getServiceById,
    updateService,
    deleteService,
};
