const { Readable } = require("stream");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const employeeDocTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "application/pdf"]);

const uploadEmployeeDocuments = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024, files: 8 },
    fileFilter: (req, file, cb) => {
        if (!employeeDocTypes.has(file.mimetype)) {
            const error = new Error("Document must be a PDF, jpg, png, webp, or avif file");
            error.status = 400;
            return cb(error);
        }
        cb(null, true);
    },
});

const logoTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

const uploadLogoFile = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (!logoTypes.has(file.mimetype)) {
            const error = new Error("Logo must be a jpg, png, webp, or avif image");
            error.status = 400;
            return cb(error);
        }
        cb(null, true);
    },
});

const receiveLogo = (req, res, next) => {
    uploadLogoFile.single("logo")(req, res, (error) => {
        if (!error) return next();
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "Logo must be 2 MB or smaller"
            : error.message || "Could not read the logo";
        return res.status(400).json({ success: false, message });
    });
};

const receiveChatAvatar = (req, res, next) => {
    uploadLogoFile.single("avatar")(req, res, (error) => {
        if (!error) return next();
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "Group photo must be 2 MB or smaller"
            : error.message || "Could not read the group photo";
        return res.status(400).json({ success: false, message });
    });
};

const receiveOfferBannerImage = (req, res, next) => {
    uploadLogoFile.single("image")(req, res, (error) => {
        if (!error) return next();
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "Banner image must be 2 MB or smaller"
            : error.message || "Could not read the banner image";
        return res.status(400).json({ success: false, message });
    });
};

const resumeTypes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/webp",
]);

const uploadResumeFile = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (!resumeTypes.has(file.mimetype)) {
            const error = new Error("Resume must be a PDF, Word file, jpg, png, or webp");
            error.status = 400;
            return cb(error);
        }
        cb(null, true);
    },
});

const receiveResume = (req, res, next) => {
    uploadResumeFile.single("resume")(req, res, (error) => {
        if (!error) return next();
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "Resume must be 8 MB or smaller"
            : error.message || "Could not read the resume";
        return res.status(400).json({ success: false, message });
    });
};

const receiveTicketFile = (req, res, next) => {
    uploadEmployeeDocuments.single("file")(req, res, (error) => {
        if (!error) return next();
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "File must be 8 MB or smaller"
            : error.message || "Could not read the file";
        return res.status(400).json({ success: false, message });
    });
};

const receiveLeaveDocument = (req, res, next) => {
    uploadEmployeeDocuments.single("document")(req, res, (error) => {
        if (!error) return next();
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "Document must be 8 MB or smaller"
            : error.message || "Could not read the document";
        return res.status(400).json({ success: false, message });
    });
};

const receiveReportFiles = (req, res, next) => {
    uploadEmployeeDocuments.array("files", 8)(req, res, (error) => {
        if (!error) return next();
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "Each file must be 8 MB or smaller"
            : error.code === "LIMIT_FILE_COUNT"
                ? "You can add up to 8 files"
                : error.message || "Could not read the file";
        return res.status(400).json({ success: false, message });
    });
};

const receiveEmployeeDocuments = (req, res, next) => {
    uploadEmployeeDocuments.array("documents", 8)(req, res, (error) => {
        if (!error) return next();
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "Each document must be 8 MB or smaller"
            : error.message || "Could not read the document";
        return res.status(400).json({ success: false, message });
    });
};

const uploadReportFile = (file) => new Promise((resolve, reject) => {
    const resourceType = file.mimetype === "application/pdf" ? "raw" : "image";
    const stream = cloudinary.uploader.upload_stream(
        { folder: "crm/daily-reports", resource_type: resourceType },
        (error, result) => (error ? reject(error) : resolve(result))
    );
    Readable.from(file.buffer).pipe(stream);
});

const uploadEmployeeFile = (file) => new Promise((resolve, reject) => {
    const resourceType = file.mimetype === "application/pdf" ? "raw" : "image";
    const stream = cloudinary.uploader.upload_stream(
        { folder: "crm/employee-documents", resource_type: resourceType },
        (error, result) => (error ? reject(error) : resolve(result))
    );
    Readable.from(file.buffer).pipe(stream);
});

const uploadResume = (file) => new Promise((resolve, reject) => {
    const resourceType = file.mimetype.startsWith("image/") ? "image" : "raw";
    const stream = cloudinary.uploader.upload_stream(
        { folder: "crm/interview-resumes", resource_type: resourceType },
        (error, result) => (error ? reject(error) : resolve(result))
    );
    Readable.from(file.buffer).pipe(stream);
});

const uploadUrgentFile = (file) => new Promise((resolve, reject) => {
    const resourceType = file.mimetype === "application/pdf" ? "raw" : "image";
    const stream = cloudinary.uploader.upload_stream(
        { folder: "crm/urgent-work", resource_type: resourceType },
        (error, result) => (error ? reject(error) : resolve(result))
    );
    Readable.from(file.buffer).pipe(stream);
});

const uploadTicketFile = (file) => new Promise((resolve, reject) => {
    const resourceType = file.mimetype === "application/pdf" ? "raw" : "image";
    const stream = cloudinary.uploader.upload_stream(
        { folder: "crm/ticket-files", resource_type: resourceType },
        (error, result) => (error ? reject(error) : resolve(result))
    );
    Readable.from(file.buffer).pipe(stream);
});

const uploadLeaveFile = (file) => new Promise((resolve, reject) => {
    const resourceType = file.mimetype === "application/pdf" ? "raw" : "image";
    const stream = cloudinary.uploader.upload_stream(
        { folder: "crm/leave-documents", resource_type: resourceType },
        (error, result) => (error ? reject(error) : resolve(result))
    );
    Readable.from(file.buffer).pipe(stream);
});

const uploadLogo = (file) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
        { folder: "crm/software-logo", resource_type: "image" },
        (error, result) => (error ? reject(error) : resolve(result))
    );
    Readable.from(file.buffer).pipe(stream);
});

const uploadChatAvatar = (file) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
        { folder: "crm/chat-avatars", resource_type: "image" },
        (error, result) => (error ? reject(error) : resolve(result))
    );
    Readable.from(file.buffer).pipe(stream);
});

const uploadOfferBanner = (file) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
        { folder: "crm/offer-banners", resource_type: "image" },
        (error, result) => (error ? reject(error) : resolve(result))
    );
    Readable.from(file.buffer).pipe(stream);
});

const chatFileTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "application/zip",
    "application/x-zip-compressed",
]);

const uploadChatFileMulter = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (!chatFileTypes.has(file.mimetype)) {
            const error = new Error("File type not allowed. Use image, PDF, Word, Excel, text, or zip");
            error.status = 400;
            return cb(error);
        }
        cb(null, true);
    },
});

const receiveChatFile = (req, res, next) => {
    uploadChatFileMulter.single("file")(req, res, (error) => {
        if (!error) return next();
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "File must be 10 MB or smaller"
            : error.message || "Could not read the file";
        return res.status(400).json({ success: false, message });
    });
};

const uploadChatFile = (file) => new Promise((resolve, reject) => {
    const isImage = String(file.mimetype || "").startsWith("image/");
    const resourceType = isImage ? "image" : "raw";
    const stream = cloudinary.uploader.upload_stream(
        {
            folder: "crm/chat-files",
            resource_type: resourceType,
            use_filename: true,
            unique_filename: true,
        },
        (error, result) => (error ? reject(error) : resolve({ ...result, resource_type: resourceType })),
    );
    Readable.from(file.buffer).pipe(stream);
});

const attendancePhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const uploadAttendancePhotoFile = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (!attendancePhotoTypes.has(file.mimetype)) {
            const error = new Error("Punch photo must be a jpg, png, or webp image");
            error.status = 400;
            return cb(error);
        }
        cb(null, true);
    },
});

const receiveAttendancePhoto = (req, res, next) => {
    uploadAttendancePhotoFile.single("photo")(req, res, (error) => {
        if (!error) return next();
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "Punch photo must be 3 MB or smaller"
            : error.message || "Could not read the punch photo";
        return res.status(400).json({ success: false, message });
    });
};

const uploadAttendancePhoto = (file) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
        { folder: "crm/attendance", resource_type: "image" },
        (error, result) => (error ? reject(error) : resolve(result))
    );
    Readable.from(file.buffer).pipe(stream);
});

const uploadProfilePhotoFile = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (!logoTypes.has(file.mimetype)) {
            const error = new Error("Profile photo must be a jpg, png, webp, or avif image");
            error.status = 400;
            return cb(error);
        }
        cb(null, true);
    },
});

const receiveProfilePhoto = (req, res, next) => {
    uploadProfilePhotoFile.single("photo")(req, res, (error) => {
        if (!error) return next();
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "Profile photo must be 2 MB or smaller"
            : error.message || "Could not read the profile photo";
        return res.status(400).json({ success: false, message });
    });
};

const uploadProfilePhoto = (file) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
        { folder: "crm/profile-avatars", resource_type: "image", transformation: [{ width: 512, height: 512, crop: "fill", gravity: "face" }] },
        (error, result) => (error ? reject(error) : resolve(result))
    );
    Readable.from(file.buffer).pipe(stream);
});

const receiveLeadSheet = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        const name = String(file.originalname || "").toLowerCase();
        if (!name.endsWith(".xlsx")) {
            const error = new Error("Upload the Excel file in .xlsx format");
            error.status = 400;
            return cb(error);
        }
        cb(null, true);
    },
}).single("file");

const destroyCloudinaryFile = (publicId, resourceType) => {
    if (!publicId) return Promise.resolve();
    return cloudinary.uploader.destroy(publicId, { resource_type: resourceType || "image" }).catch(() => {});
};

const ringtoneTypes = new Set([
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/ogg",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/x-m4a",
]);

const uploadRingtoneFile = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        const name = String(file.originalname || "").toLowerCase();
        const okExt = /\.(mp3|wav|ogg|webm|m4a|aac)$/.test(name);
        if (!ringtoneTypes.has(file.mimetype) && !okExt) {
            const error = new Error("Ringtone must be mp3, wav, ogg, m4a, or aac (max 3 MB)");
            error.status = 400;
            return cb(error);
        }
        cb(null, true);
    },
});

const receiveRingtone = (req, res, next) => {
    uploadRingtoneFile.single("ringtone")(req, res, (error) => {
        if (!error) return next();
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "Ringtone must be 3 MB or smaller"
            : error.message || "Could not read the ringtone";
        return res.status(400).json({ success: false, message });
    });
};

/** Audio files upload as Cloudinary "video" resource type */
const uploadRingtone = (file) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
        {
            folder: "crm/notification-ringtones",
            resource_type: "video",
            use_filename: true,
            unique_filename: true,
        },
        (error, result) => (error ? reject(error) : resolve(result)),
    );
    Readable.from(file.buffer).pipe(stream);
});

module.exports = {
    receiveReportFiles,
    receiveEmployeeDocuments,
    receiveTicketFile,
    receiveLeaveDocument,
    receiveResume,
    receiveLogo,
    receiveChatAvatar,
    receiveOfferBannerImage,
    receiveChatFile,
    receiveLeadSheet,
    receiveAttendancePhoto,
    receiveProfilePhoto,
    receiveRingtone,
    uploadReportFile,
    uploadEmployeeFile,
    uploadUrgentFile,
    uploadTicketFile,
    uploadLeaveFile,
    uploadResume,
    uploadLogo,
    uploadChatAvatar,
    uploadOfferBanner,
    uploadChatFile,
    uploadAttendancePhoto,
    uploadProfilePhoto,
    uploadRingtone,
    destroyCloudinaryFile,
};
