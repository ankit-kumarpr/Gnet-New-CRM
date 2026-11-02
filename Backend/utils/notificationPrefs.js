const SoftwareSetting = require("../models/SoftwareSetting");

const FALLBACK_RINGTONE = "/sounds/notification.mp3";

const DEFAULTS = Object.freeze({
    soundEnabled: true,
    toastEnabled: true,
    ringtoneUrl: "",
    ringtonePublicId: "",
    ringtoneName: "",
});

const asBool = (value, fallback) => {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === 1 || value === "1") return true;
    if (value === "false" || value === 0 || value === "0") return false;
    return fallback;
};

const normalizeDefaults = (raw = {}) => ({
    soundEnabled: asBool(raw.soundEnabled, DEFAULTS.soundEnabled),
    toastEnabled: asBool(raw.toastEnabled, DEFAULTS.toastEnabled),
    ringtoneUrl: String(raw.ringtoneUrl || "").trim(),
    ringtonePublicId: String(raw.ringtonePublicId || "").trim(),
    ringtoneName: String(raw.ringtoneName || "").trim().slice(0, 120),
});

const normalizePersonal = (raw = {}) => ({
    useCustom: Boolean(raw.useCustom),
    soundEnabled: asBool(raw.soundEnabled, DEFAULTS.soundEnabled),
    toastEnabled: asBool(raw.toastEnabled, DEFAULTS.toastEnabled),
    ringtoneUrl: String(raw.ringtoneUrl || "").trim(),
    ringtonePublicId: String(raw.ringtonePublicId || "").trim(),
    ringtoneName: String(raw.ringtoneName || "").trim().slice(0, 120),
});

const loadAdminDefaults = async () => {
    const setting = await SoftwareSetting.findOne({ key: "software" })
        .select("notificationDefaults")
        .lean();
    return normalizeDefaults(setting?.notificationDefaults || {});
};

/**
 * Personal prefs win only when useCustom=true; otherwise admin defaults apply.
 * Ringtone: personal uploaded file > admin uploaded file > built-in fallback path.
 */
const resolveEffectivePrefs = (personal, adminDefaults) => {
    const defaults = normalizeDefaults(adminDefaults);
    const mine = normalizePersonal(personal || {});
    if (!mine.useCustom) {
        return {
            soundEnabled: defaults.soundEnabled,
            toastEnabled: defaults.toastEnabled,
            ringtoneUrl: defaults.ringtoneUrl || FALLBACK_RINGTONE,
            ringtoneName: defaults.ringtoneName || (defaults.ringtoneUrl ? "Admin ringtone" : "Default ringtone"),
            useCustom: false,
            source: "admin",
        };
    }
    return {
        soundEnabled: mine.soundEnabled,
        toastEnabled: mine.toastEnabled,
        ringtoneUrl: mine.ringtoneUrl || defaults.ringtoneUrl || FALLBACK_RINGTONE,
        ringtoneName: mine.ringtoneName
            || (mine.ringtoneUrl ? "My ringtone" : (defaults.ringtoneName || "Default ringtone")),
        useCustom: true,
        source: "personal",
    };
};

const presentPrefsPayload = (personal, adminDefaults) => {
    const defaults = normalizeDefaults(adminDefaults);
    const mine = normalizePersonal(personal || {});
    const effective = resolveEffectivePrefs(mine, defaults);
    return {
        defaults: {
            ...defaults,
            ringtoneUrl: defaults.ringtoneUrl || "",
            hasRingtone: Boolean(defaults.ringtoneUrl),
        },
        personal: {
            ...mine,
            hasRingtone: Boolean(mine.ringtoneUrl),
        },
        effective: {
            soundEnabled: effective.soundEnabled,
            toastEnabled: effective.toastEnabled,
            ringtoneUrl: effective.ringtoneUrl,
            ringtoneName: effective.ringtoneName,
            source: effective.source,
            useCustom: effective.useCustom,
        },
        fallbackRingtone: FALLBACK_RINGTONE,
    };
};

module.exports = {
    DEFAULTS,
    FALLBACK_RINGTONE,
    normalizeDefaults,
    normalizePersonal,
    loadAdminDefaults,
    resolveEffectivePrefs,
    presentPrefsPayload,
};
