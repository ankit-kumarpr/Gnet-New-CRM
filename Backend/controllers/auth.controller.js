const crypto = require("crypto");
const User = require("../models/User");
const Client = require("../models/Client");
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require("../utils/tokenUtils");
const { setRefreshCookie, clearRefreshCookie } = require("../utils/authCookies");
const { loadUserProfile } = require("../utils/userProfile");

// ─── Helper ───────────────────────────────────────────────────────────────────
// Timing-safe string comparison — prevents timing attacks on secret comparison
const timingSafeCompare = (a, b) => {
    try {
        return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
        return false; // buffers different length — definitely not equal
    }
};

// @desc    Register Admin
// @route   POST /api/v1/auth/admin/register
// @access  Public (Requires Secret)
const registerAdmin = async (req, res, next) => {
    try {
        const { admin_secret, name, email, phone, password, address } = req.body;

        // Timing-safe secret comparison — no brute-force timing leak
        if (!admin_secret || !timingSafeCompare(admin_secret, process.env.ADMIN_CREATION_SECRET)) {
            return res.status(403).json({ success: false, message: "Invalid admin creation secret" });
        }

        // Check if admin already exists with email or phone
        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.status(409).json({ success: false, message: "User with email or phone already exists" });
        }

        const newAdmin = await User.create({
            name, email, phone, password, address, userType: "ADMIN",
        });

        res.status(201).json({
            success: true,
            message: "Admin created successfully",
            data: { id: newAdmin._id, name: newAdmin.name, email: newAdmin.email },
        });
    } catch (error) {
        next(error);
    }
};

const { resolveClientPermissions, resolveEmployeePermissions } = require("../utils/permissions");

const issueClientSession = async (client, res) => {
    const accessToken = generateAccessToken(client._id, "CLIENT");
    const refreshTokenValue = generateRefreshToken(client._id, "CLIENT");
    client.refreshToken = refreshTokenValue;
    await client.save();

    setRefreshCookie(res, refreshTokenValue);
    const permissions = resolveClientPermissions(client);

    return res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
            accessToken,
            refreshToken: refreshTokenValue,
            user: {
                id: client._id,
                userType: "CLIENT",
                name: client.name,
                email: client.email,
                clientId: client.clientId,
                phone: client.phone,
                avatarUrl: client.avatar?.url || "",
                avatar: client.avatar || { url: "", publicId: "" },
                permissions,
                reportingManager: client.reportingManager
                    ? {
                        _id: client.reportingManager._id,
                        name: client.reportingManager.name,
                    }
                    : null,
            },
        },
    });
};

// @desc    Login staff (email) or client (Client ID) — same endpoint
// @route   POST /api/v1/auth/login
// @access  Public
const login = async (req, res, next) => {
    try {
        const identifier = String(req.body.email || req.body.clientId || "").trim();
        const password = String(req.body.password || "").trim();
        if (!identifier || !password) {
            return res.status(400).json({ success: false, message: "Email/Client ID and password are required" });
        }

        const looksLikeEmail = identifier.includes("@");
        if (looksLikeEmail) {
            const user = await User.findOne({ email: identifier.toLowerCase() })
                .populate("department", "name")
                .populate("designation", "name")
                .populate("employeeType", "name")
                .populate("workMode", "name");

            if (user) {
                if (user.status === "BLOCKED") {
                    return res.status(403).json({ success: false, message: "Account is blocked. Contact support." });
                }
                if (user.status === "INACTIVE") {
                    return res.status(403).json({ success: false, message: "Account is not active. Contact support." });
                }

                const isMatch = await user.matchPassword(password);
                if (!isMatch) {
                    return res.status(401).json({ success: false, message: "Invalid email or password" });
                }

                const accessToken = generateAccessToken(user._id);
                const refreshToken = generateRefreshToken(user._id);
                user.refreshToken = refreshToken;
                await user.save();

                setRefreshCookie(res, refreshToken);

                return res.status(200).json({
                    success: true,
                    message: "Login successful",
                    data: {
                        accessToken,
                        refreshToken,
                        user: {
                            id: user._id,
                            userType: user.userType,
                            name: user.name,
                            email: user.email,
                            phone: user.phone,
                            avatarUrl: user.avatar?.url || "",
                            avatar: user.avatar || { url: "", publicId: "" },
                            ...(user.employeeId && { employeeId: user.employeeId }),
                            ...(user.department && { department: user.department }),
                            ...(user.designation && { designation: user.designation }),
                            ...(user.employeeType && { employeeType: user.employeeType }),
                            ...(user.workMode && { workMode: user.workMode }),
                            permissions: resolveEmployeePermissions(user),
                        },
                    },
                });
            }
        }

        const clientId = identifier.toUpperCase();
        const client = await Client.findOne({ clientId }).select("+password +refreshToken")
            .populate("reportingManager", "name");
        if (!client) {
            return res.status(401).json({
                success: false,
                message: looksLikeEmail ? "Invalid email or password" : "Invalid Client ID or password",
            });
        }

        const isMatch = await client.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid Client ID or password" });
        }

        return issueClientSession(client, res);
    } catch (error) {
        next(error);
    }
};

/** @deprecated use POST /auth/login with Client ID in `email` field */
const loginClient = async (req, res, next) => {
    try {
        req.body.email = req.body.clientId || req.body.email;
        return login(req, res, next);
    } catch (error) {
        next(error);
    }
};

// @desc    Refresh token
// @route   POST /api/v1/auth/refresh-token
// @access  Public
const refreshToken = async (req, res, next) => {
    try {
        // Cookie (preferred) or body/header fallback for cross-origin SPA
        const token = req.cookies.refreshToken
            || String(req.body?.refreshToken || "").trim()
            || String(req.headers["x-refresh-token"] || "").trim();
        if (!token) {
            return res.status(401).json({ success: false, message: "No refresh token provided" });
        }

        let decoded;
        try {
            decoded = verifyRefreshToken(token);
        } catch (err) {
            if (err.name === "TokenExpiredError") {
                return res.status(401).json({
                    success: false,
                    message: "Refresh token expired — please login again",
                    code: "REFRESH_TOKEN_EXPIRED",
                });
            }
            return res.status(401).json({ success: false, message: "Invalid refresh token" });
        }

        if (decoded.kind === "CLIENT") {
            const client = await Client.findById(decoded.id).select("+refreshToken");
            if (!client || client.refreshToken !== token) {
                if (client) {
                    client.refreshToken = null;
                    await client.save();
                }
                return res.status(401).json({
                    success: false,
                    message: "Invalid refresh token — please login again",
                    code: "TOKEN_REUSE_DETECTED",
                });
            }
            const newAccessToken = generateAccessToken(client._id, "CLIENT");
            const newRefreshToken = generateRefreshToken(client._id, "CLIENT");
            client.refreshToken = newRefreshToken;
            await client.save();
            setRefreshCookie(res, newRefreshToken);
            return res.status(200).json({
                success: true,
                message: "Token refreshed",
                data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
            });
        }

        const user = await User.findById(decoded.id);

        if (!user || user.refreshToken !== token) {
            if (user) {
                user.refreshToken = null;
                await user.save();
            }
            return res.status(401).json({
                success: false,
                message: "Invalid refresh token — please login again",
                code: "TOKEN_REUSE_DETECTED",
            });
        }

        if (user.status === "BLOCKED" || user.status === "INACTIVE") {
            user.refreshToken = null;
            await user.save();
            clearRefreshCookie(res);
            return res.status(403).json({ success: false, message: "Account is not active" });
        }

        const newAccessToken = generateAccessToken(user._id);
        const newRefreshToken = generateRefreshToken(user._id);

        user.refreshToken = newRefreshToken;
        await user.save();

        setRefreshCookie(res, newRefreshToken);

        res.status(200).json({
            success: true,
            message: "Token refreshed",
            data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Logout user
// @route   POST /api/v1/auth/logout
// @access  Private
const logout = async (req, res, next) => {
    try {
        if (req.authKind === "CLIENT" || req.user.userType === "CLIENT") {
            await Client.findByIdAndUpdate(req.user._id, { refreshToken: null });
        } else {
            req.user.refreshToken = null;
            await req.user.save();
        }

        clearRefreshCookie(res);

        res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        next(error);
    }
};

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
const getMe = async (req, res, next) => {
    try {
        if (req.authKind === "CLIENT" || req.user.userType === "CLIENT") {
            const client = await Client.findById(req.user._id)
                .select("-password -refreshToken")
                .populate("reportingManager", "name")
                .populate("services", "name");
            if (!client) {
                return res.status(404).json({ success: false, message: "Client not found" });
            }
            const obj = client.toObject();
            return res.status(200).json({
                success: true,
                data: {
                    ...obj,
                    id: client._id,
                    userType: "CLIENT",
                    permissions: resolveClientPermissions(client),
                },
            });
        }

        const user = await User.findById(req.user.id || req.user._id)
            .select("-password -refreshToken")
            .populate("department", "name")
            .populate("designation", "name")
            .populate("employeeType", "name")
            .populate("workMode", "name");

        // Guard: user could be deleted after token was issued
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const obj = user.toObject ? user.toObject() : user;
        res.status(200).json({
            success: true,
            data: {
                ...obj,
                id: user._id,
                permissions: resolveEmployeePermissions(user),
            },
        });
    } catch (error) {
        next(error);
    }
};

const getMyProfile = async (req, res, next) => {
    try {
        if (req.authKind === "CLIENT" || req.user.userType === "CLIENT") {
            return getMe(req, res, next);
        }
        const profile = await loadUserProfile(req.user._id || req.user.id);
        if (!profile) {
            return res.status(404).json({ success: false, message: "Profile not found" });
        }
        res.status(200).json({ success: true, ...profile });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const presentAvatar = (doc) => ({
    url: doc?.avatar?.url || "",
    publicId: doc?.avatar?.publicId || "",
});

const updateMyProfilePhoto = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Choose a profile photo" });
        }
        const { uploadProfilePhoto, destroyCloudinaryFile } = require("../config/cloudinary");
        const isClient = req.authKind === "CLIENT" || req.user.userType === "CLIENT";
        const Model = isClient ? Client : User;
        const doc = await Model.findById(req.user._id || req.user.id);
        if (!doc) {
            return res.status(404).json({ success: false, message: isClient ? "Client not found" : "User not found" });
        }

        const uploaded = await uploadProfilePhoto(req.file);
        const previousPublicId = doc.avatar?.publicId;
        doc.avatar = {
            url: uploaded.secure_url || uploaded.url || "",
            publicId: uploaded.public_id || "",
        };
        if (!doc.avatar.url || !doc.avatar.publicId) {
            return res.status(500).json({ success: false, message: "Could not save the profile photo" });
        }
        await doc.save();
        if (previousPublicId && previousPublicId !== doc.avatar.publicId) {
            await destroyCloudinaryFile(previousPublicId, "image");
        }

        res.status(200).json({
            success: true,
            message: "Profile photo updated",
            data: {
                id: doc._id,
                avatar: presentAvatar(doc),
                avatarUrl: doc.avatar.url,
            },
        });
    } catch (error) {
        next(error);
    }
};

const removeMyProfilePhoto = async (req, res, next) => {
    try {
        const { destroyCloudinaryFile } = require("../config/cloudinary");
        const isClient = req.authKind === "CLIENT" || req.user.userType === "CLIENT";
        const Model = isClient ? Client : User;
        const doc = await Model.findById(req.user._id || req.user.id);
        if (!doc) {
            return res.status(404).json({ success: false, message: isClient ? "Client not found" : "User not found" });
        }
        const previousPublicId = doc.avatar?.publicId;
        doc.avatar = { url: "", publicId: "" };
        await doc.save();
        if (previousPublicId) await destroyCloudinaryFile(previousPublicId, "image");
        res.status(200).json({
            success: true,
            message: "Profile photo removed",
            data: { id: doc._id, avatar: presentAvatar(doc), avatarUrl: "" },
        });
    } catch (error) {
        next(error);
    }
};

const {
    loadAdminDefaults,
    normalizePersonal,
    presentPrefsPayload,
} = require("../utils/notificationPrefs");
const { uploadRingtone, destroyCloudinaryFile } = require("../config/cloudinary");

const prefsModelFor = (req) => {
    const isClient = req.authKind === "CLIENT" || req.user?.userType === "CLIENT";
    return { isClient, Model: isClient ? Client : User };
};

const getMyNotificationPrefs = async (req, res, next) => {
    try {
        const adminDefaults = await loadAdminDefaults();
        const personal = req.user?.notificationPrefs;
        res.status(200).json({
            success: true,
            data: presentPrefsPayload(personal, adminDefaults),
        });
    } catch (error) {
        next(error);
    }
};

const updateMyNotificationPrefs = async (req, res, next) => {
    try {
        const body = req.body || {};
        const { isClient, Model } = prefsModelFor(req);
        const doc = await Model.findById(req.user._id);
        if (!doc) {
            return res.status(404).json({ success: false, message: isClient ? "Client not found" : "User not found" });
        }
        const current = normalizePersonal(doc.notificationPrefs || {});
        const next = normalizePersonal({
            ...current,
            useCustom: body.useCustom,
            soundEnabled: body.soundEnabled,
            toastEnabled: body.toastEnabled,
            // keep existing ringtone unless cleared via dedicated endpoint
            ringtoneUrl: current.ringtoneUrl,
            ringtonePublicId: current.ringtonePublicId,
            ringtoneName: current.ringtoneName,
        });
        doc.notificationPrefs = next;
        await doc.save();
        const adminDefaults = await loadAdminDefaults();
        res.status(200).json({
            success: true,
            message: next.useCustom ? "Personal notification settings saved" : "Using admin notification defaults",
            data: presentPrefsPayload(doc.notificationPrefs, adminDefaults),
        });
    } catch (error) {
        next(error);
    }
};

const uploadMyNotificationRingtone = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Choose an mp3/wav ringtone file" });
        }
        const { isClient, Model } = prefsModelFor(req);
        const doc = await Model.findById(req.user._id);
        if (!doc) {
            return res.status(404).json({ success: false, message: isClient ? "Client not found" : "User not found" });
        }
        const current = normalizePersonal(doc.notificationPrefs || {});
        const result = await uploadRingtone(req.file);
        if (current.ringtonePublicId) await destroyCloudinaryFile(current.ringtonePublicId, "video");
        doc.notificationPrefs = {
            ...current,
            useCustom: true,
            ringtoneUrl: result.secure_url || "",
            ringtonePublicId: result.public_id || "",
            ringtoneName: String(req.file.originalname || "ringtone").slice(0, 120),
        };
        await doc.save();
        const adminDefaults = await loadAdminDefaults();
        res.status(200).json({
            success: true,
            message: "Personal ringtone uploaded",
            data: presentPrefsPayload(doc.notificationPrefs, adminDefaults),
        });
    } catch (error) {
        next(error);
    }
};

const removeMyNotificationRingtone = async (req, res, next) => {
    try {
        const { isClient, Model } = prefsModelFor(req);
        const doc = await Model.findById(req.user._id);
        if (!doc) {
            return res.status(404).json({ success: false, message: isClient ? "Client not found" : "User not found" });
        }
        const current = normalizePersonal(doc.notificationPrefs || {});
        if (current.ringtonePublicId) await destroyCloudinaryFile(current.ringtonePublicId, "video");
        doc.notificationPrefs = {
            ...current,
            ringtoneUrl: "",
            ringtonePublicId: "",
            ringtoneName: "",
        };
        await doc.save();
        const adminDefaults = await loadAdminDefaults();
        res.status(200).json({
            success: true,
            message: "Personal ringtone removed",
            data: presentPrefsPayload(doc.notificationPrefs, adminDefaults),
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    registerAdmin,
    login,
    loginClient,
    refreshToken,
    logout,
    getMe,
    getMyProfile,
    updateMyProfilePhoto,
    removeMyProfilePhoto,
    getMyNotificationPrefs,
    updateMyNotificationPrefs,
    uploadMyNotificationRingtone,
    removeMyNotificationRingtone,
};
