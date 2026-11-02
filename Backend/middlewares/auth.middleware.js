const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Client = require("../models/Client");
const { permissionGranted, resolveClientPermissions, resolveEmployeePermissions } = require("../utils/permissions");

const authenticate = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Not authorized — no token provided",
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        } catch (err) {
            if (err.name === "TokenExpiredError") {
                return res.status(401).json({
                    success: false,
                    message: "Access token expired — please refresh",
                    code: "TOKEN_EXPIRED",
                });
            }
            if (err.name === "JsonWebTokenError") {
                return res.status(401).json({
                    success: false,
                    message: "Invalid token — please login again",
                    code: "TOKEN_INVALID",
                });
            }
            if (err.name === "NotBeforeError") {
                return res.status(401).json({
                    success: false,
                    message: "Token not yet active",
                    code: "TOKEN_NOT_ACTIVE",
                });
            }
            return res.status(401).json({
                success: false,
                message: "Token verification failed",
            });
        }

        if (decoded.kind === "CLIENT") {
            const client = await Client.findById(decoded.id)
                .select("-password")
                .populate("reportingManager", "name")
                .populate("services", "name");
            if (!client) {
                return res.status(401).json({
                    success: false,
                    message: "Client belonging to this token no longer exists",
                    code: "USER_NOT_FOUND",
                });
            }
            req.user = client;
            req.user.userType = "CLIENT";
            req.user.permissions = resolveClientPermissions(client);
            req.authKind = "CLIENT";
            return next();
        }

        const user = await User.findById(decoded.id).select("-password -refreshToken").populate("designation");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User belonging to this token no longer exists",
                code: "USER_NOT_FOUND",
            });
        }

        if (user.status === "BLOCKED") {
            return res.status(403).json({
                success: false,
                message: "Your account has been blocked. Please contact support.",
                code: "ACCOUNT_BLOCKED",
            });
        }

        if (user.status === "INACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive. Please contact support.",
                code: "ACCOUNT_INACTIVE",
            });
        }

        req.user = user;
        req.user.permissions = resolveEmployeePermissions(user);
        req.authKind = "USER";
        next();
    } catch (error) {
        next(error);
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Not authenticated" });
        }

        if (!roles.includes(req.user.userType)) {
            return res.status(403).json({
                success: false,
                message: "Forbidden — you do not have permission to access this resource",
                code: "FORBIDDEN",
            });
        }

        next();
    };
};

const checkPermission = (...requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Not authenticated" });
        }

        if (permissionGranted(req.user, requiredPermissions)) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: "Forbidden — missing required permission",
            code: "PERMISSION_DENIED",
        });
    };
};

module.exports = { authenticate, authorize, checkPermission };
