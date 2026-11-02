const SoftwareSetting = require("../models/SoftwareSetting");
const { uploadLogo, uploadRingtone, destroyCloudinaryFile } = require("../config/cloudinary");
const { normalizeDefaults } = require("../utils/notificationPrefs");

const TEXT_FIELDS = {
    companyName: { max: 120, min: 2, label: "Company name" },
    companyAddress: { max: 300, label: "Company address" },
    companyPhone: { max: 20, label: "Company phone" },
    companyEmail: { max: 120, label: "Company email", email: true },
    companyWebsite: { max: 160, label: "Website" },
    offerPrefix: { max: 8, label: "Offer letter prefix", prefix: true },
    probationPeriod: { max: 40, label: "Probation period" },
    workingHours: { max: 80, label: "Working hours" },
    signatoryName: { max: 80, label: "Signatory name" },
    signatoryTitle: { max: 80, label: "Signatory title" },
};

const CLEARABLE = [...Object.keys(TEXT_FIELDS), "logo", "ringtone"];

const canManage = (user) => {
    if (!user) return false;
    if (user.userType === "ADMIN") return true;
    const { permissionGranted } = require("../utils/permissions");
    return permissionGranted(user, ["MANAGE_SETTINGS"]);
};

const DEFAULT_COMPANY = "GrandeurNet";

const normalizeCompanyName = (value) => {
    const name = String(value || "").trim();
    if (!name) return DEFAULT_COMPANY;
    // Old default brand — always show GrandeurNet.
    if (/^ak\s*techs?$/i.test(name)) return DEFAULT_COMPANY;
    return name;
};

const brandPresent = (doc) => ({
    companyName: normalizeCompanyName(doc?.companyName),
    logoUrl: doc?.logoUrl || "",
});

const present = (doc) => ({
    ...brandPresent(doc),
    companyAddress: doc?.companyAddress || "",
    companyPhone: doc?.companyPhone || "",
    companyEmail: doc?.companyEmail || "",
    companyWebsite: doc?.companyWebsite || "",
    offerPrefix: doc?.offerPrefix || "",
    probationPeriod: doc?.probationPeriod || "",
    workingHours: doc?.workingHours || "",
    signatoryName: doc?.signatoryName || "",
    signatoryTitle: doc?.signatoryTitle || "",
    officeLatitude: Number.isFinite(doc?.officeLatitude) ? doc.officeLatitude : null,
    officeLongitude: Number.isFinite(doc?.officeLongitude) ? doc.officeLongitude : null,
    officeRadiusMeters: Number.isFinite(doc?.officeRadiusMeters) ? doc.officeRadiusMeters : 20,
    notificationDefaults: normalizeDefaults(doc?.notificationDefaults || {}),
    eveningReportEnabled: doc?.eveningReportEnabled !== false,
    eveningReportTime: doc?.eveningReportTime || "18:30",
    lastEveningReportRunDate: doc?.lastEveningReportRunDate || "",
    updatedAt: doc?.updatedAt || null,
});

const loadSetting = async () => {
    let setting = await SoftwareSetting.findOne({ key: "software" });
    if (!setting) {
        setting = await SoftwareSetting.create({ key: "software", companyName: DEFAULT_COMPANY });
        return setting;
    }
    // One-time cleanup of old AK Techs brand in DB.
    if (/^ak\s*techs?$/i.test(String(setting.companyName || "").trim()) || !String(setting.companyName || "").trim()) {
        setting.companyName = DEFAULT_COMPANY;
        await setting.save();
    }
    return setting;
};

const getBrand = async (req, res, next) => {
    try {
        const setting = await loadSetting();
        res.status(200).json({
            success: true,
            data: brandPresent({
                companyName: setting.companyName,
                logoUrl: setting.logoUrl,
            }),
        });
    } catch (error) {
        next(error);
    }
};

const getSettings = async (req, res, next) => {
    try {
        if (!canManage(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot open software settings" });
        }
        const setting = await loadSetting();
        res.status(200).json({ success: true, data: present(setting) });
    } catch (error) {
        next(error);
    }
};

const updateSettings = async (req, res, next) => {
    try {
        if (!canManage(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot update software settings" });
        }

        const setting = await loadSetting();
        const body = req.body || {};
        const updated = [];

        for (const [key, rule] of Object.entries(TEXT_FIELDS)) {
            if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
            let value = String(body[key] ?? "").trim();
            if (value.length > rule.max) {
                return res.status(400).json({ success: false, message: `${rule.label} cannot be longer than ${rule.max} characters` });
            }
            if (value && rule.min && value.length < rule.min) {
                return res.status(400).json({ success: false, message: `${rule.label} must be at least ${rule.min} characters` });
            }
            if (value && rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                return res.status(400).json({ success: false, message: "Enter a valid company email" });
            }
            if (rule.prefix) {
                value = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                if (value && value.length < 2) {
                    return res.status(400).json({ success: false, message: "Offer letter prefix must be at least 2 letters" });
                }
            }
            if (key === "companyPhone" && value && !/^[0-9+\-\s]{6,20}$/.test(value)) {
                return res.status(400).json({ success: false, message: "Enter a valid company phone" });
            }
            setting[key] = value;
            updated.push(key);
        }

        const hasLat = Object.prototype.hasOwnProperty.call(body, "officeLatitude");
        const hasLng = Object.prototype.hasOwnProperty.call(body, "officeLongitude");
        const hasRadius = Object.prototype.hasOwnProperty.call(body, "officeRadiusMeters");
        if (hasLat || hasLng || hasRadius) {
            if (hasLat !== hasLng) {
                return res.status(400).json({ success: false, message: "Save both office latitude and longitude" });
            }
            if (hasLat) {
                const latitude = Number(body.officeLatitude);
                const longitude = Number(body.officeLongitude);
                if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
                    return res.status(400).json({ success: false, message: "Office latitude must be between -90 and 90" });
                }
                if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
                    return res.status(400).json({ success: false, message: "Office longitude must be between -180 and 180" });
                }
                setting.officeLatitude = latitude;
                setting.officeLongitude = longitude;
            }
            if (hasRadius) {
                const rawRadius = String(body.officeRadiusMeters ?? "").trim();
                const radius = Number(rawRadius);
                if (!/^\d+$/.test(rawRadius) || radius < 5 || radius > 5000) {
                    return res.status(400).json({ success: false, message: "Office range must be a whole number from 5 to 5000 meters" });
                }
                const latitudeReady = Number.isFinite(hasLat ? Number(body.officeLatitude) : setting.officeLatitude);
                const longitudeReady = Number.isFinite(hasLng ? Number(body.officeLongitude) : setting.officeLongitude);
                if (!latitudeReady || !longitudeReady) {
                    return res.status(400).json({ success: false, message: "Save the office location before changing the range" });
                }
                setting.officeRadiusMeters = radius;
            }
            updated.push("office");
        }

        if (req.file) {
            const result = await uploadLogo(req.file);
            if (setting.logoPublicId) await destroyCloudinaryFile(setting.logoPublicId, "image");
            setting.logoUrl = result.secure_url || "";
            setting.logoPublicId = result.public_id || "";
            updated.push("logo");
        }

        if (Object.prototype.hasOwnProperty.call(body, "notificationDefaults")
            || Object.prototype.hasOwnProperty.call(body, "soundEnabled")
            || Object.prototype.hasOwnProperty.call(body, "toastEnabled")) {
            const incoming = body.notificationDefaults && typeof body.notificationDefaults === "object"
                ? body.notificationDefaults
                : body;
            const next = normalizeDefaults({
                ...(setting.notificationDefaults?.toObject?.() || setting.notificationDefaults || {}),
                ...incoming,
            });
            setting.notificationDefaults = next;
            updated.push("notificationDefaults");
        }

        if (Object.prototype.hasOwnProperty.call(body, "eveningReportEnabled")) {
            setting.eveningReportEnabled = body.eveningReportEnabled === true || body.eveningReportEnabled === "true";
            updated.push("eveningReportEnabled");
        }
        if (Object.prototype.hasOwnProperty.call(body, "eveningReportTime")) {
            const time = String(body.eveningReportTime || "").trim();
            if (!/^\d{1,2}:\d{2}$/.test(time)) {
                return res.status(400).json({ success: false, message: "Evening report time must be HH:mm" });
            }
            const [hh, mm] = time.split(":").map(Number);
            if (hh > 23 || mm > 59) {
                return res.status(400).json({ success: false, message: "Evening report time must be a valid clock time" });
            }
            setting.eveningReportTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
            updated.push("eveningReportTime");
        }

        if (!updated.length) {
            return res.status(400).json({ success: false, message: "Send a setting to update" });
        }

        setting.updatedBy = req.user._id;
        await setting.save();
        res.status(200).json({
            success: true,
            message: updated.length === 1 ? "Setting updated" : "Settings updated",
            updated,
            data: present(setting),
        });
    } catch (error) {
        next(error);
    }
};

const clearSettingField = async (req, res, next) => {
    try {
        if (!canManage(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot update software settings" });
        }
        const field = req.params.field;
        if (!CLEARABLE.includes(field)) {
            return res.status(400).json({ success: false, message: "Unknown setting field" });
        }

        const setting = await loadSetting();
        if (TEXT_FIELDS[field]) setting[field] = "";
        if (field === "logo") {
            if (setting.logoPublicId) await destroyCloudinaryFile(setting.logoPublicId, "image");
            setting.logoUrl = "";
            setting.logoPublicId = "";
        }
        if (field === "ringtone") {
            const defaults = normalizeDefaults(setting.notificationDefaults || {});
            if (defaults.ringtonePublicId) await destroyCloudinaryFile(defaults.ringtonePublicId, "video");
            setting.notificationDefaults = {
                ...defaults,
                ringtoneUrl: "",
                ringtonePublicId: "",
                ringtoneName: "",
            };
        }
        setting.updatedBy = req.user._id;
        await setting.save();
        res.status(200).json({ success: true, message: "Setting cleared", data: present(setting) });
    } catch (error) {
        next(error);
    }
};

const uploadDefaultRingtone = async (req, res, next) => {
    try {
        if (!canManage(req.user)) {
            return res.status(403).json({ success: false, message: "You cannot update software settings" });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Choose an mp3/wav ringtone file" });
        }
        const setting = await loadSetting();
        const current = normalizeDefaults(setting.notificationDefaults || {});
        const result = await uploadRingtone(req.file);
        if (current.ringtonePublicId) await destroyCloudinaryFile(current.ringtonePublicId, "video");
        setting.notificationDefaults = {
            ...current,
            ringtoneUrl: result.secure_url || "",
            ringtonePublicId: result.public_id || "",
            ringtoneName: String(req.file.originalname || "ringtone").slice(0, 120),
        };
        setting.updatedBy = req.user._id;
        await setting.save();
        res.status(200).json({
            success: true,
            message: "Default notification ringtone uploaded",
            data: present(setting),
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { getBrand, getSettings, updateSettings, clearSettingField, uploadDefaultRingtone };
