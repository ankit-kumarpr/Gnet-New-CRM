require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const compression = require("compression");
const mongoose = require("mongoose");
const { connectDB } = require("./config/db");

const app = express();

// ─── Trust Proxy ────────────────────────────────────────────────────────────
// NGINX/Cloudflare send X-Forwarded-For. express-rate-limit throws
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR if trust proxy is false.
// VPS: TRUST_PROXY=1  (or NODE_ENV=production)
const trustProxyRaw = String(process.env.TRUST_PROXY ?? "").trim().toLowerCase();
let trustProxySetting = process.env.NODE_ENV === "production" ? 1 : false;
if (trustProxyRaw === "false" || trustProxyRaw === "0") trustProxySetting = false;
else if (trustProxyRaw === "true") trustProxySetting = 1;
else if (/^\d+$/.test(trustProxyRaw)) trustProxySetting = Number(trustProxyRaw);
app.set("trust proxy", trustProxySetting);

// ─── Database ────────────────────────────────────────────────────────────────
connectDB();

// ─── 1. Helmet — Security Headers ────────────────────────────────────────────
// Hardened: disables X-Powered-By, sets CSP, HSTS, XSS filters, etc.
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'"],
                imgSrc: ["'self'", "data:"],
                connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                frameSrc: ["'none'"],
                upgradeInsecureRequests: [],
            },
        },
        hsts: {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
        },
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
        noSniff: true,
        xssFilter: true,
        hidePoweredBy: true,
        frameguard: { action: "deny" },
    })
);

// ─── 2. CORS ─────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : ["http://localhost:3000", "http://localhost:5173"];

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow non-browser / same-origin tools (no Origin header)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            if (process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
                return callback(null, true);
            }
            return callback(new Error(`CORS policy: origin ${origin} is not allowed`));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Refresh-Token"],
        exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining"],
        maxAge: 86400,
    })
);

// ─── 3. Compression ──────────────────────────────────────────────────────────
// Gzip all responses — cuts bandwidth by ~70% under load
app.use(compression({ level: 6, threshold: 1024 }));

// ─── 4. Body Parsers ─────────────────────────────────────────────────────────
// Hard cap on body size — prevents payload-based DoS
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(cookieParser());

// ─── 5. NoSQL Injection Sanitization (body only — Express 5 query is read-only)
const stripOperators = (value) => {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(stripOperators);
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
        if (key.startsWith("$") || key.includes(".")) continue;
        out[key] = stripOperators(nested);
    }
    return out;
};
app.use((req, _res, next) => {
    if (req.body && typeof req.body === "object") {
        req.body = mongoSanitize.sanitize(req.body, { replaceWith: "_" });
        req.body = stripOperators(req.body);
    }
    next();
});

// ─── 6. HTTP Parameter Pollution Protection ───────────────────────────────────
app.use(hpp({
    whitelist: [
        "status",
        "priority",
        "assignee",
        "assignees",
        "services",
        "permissions",
    ],
}));

// ─── 7. Global Rate Limiter ───────────────────────────────────────────────────
// Tuned for SPA polling + shared office NAT (many users behind one IP).
// Override with RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS in .env if needed.
const rateWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000;
const rateMax = Number(process.env.RATE_LIMIT_MAX) || 1200;
const globalLimiter = rateLimit({
    windowMs: rateWindowMs,
    max: rateMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests from this IP, please try again shortly",
    },
    skip: (req) => req.path === "/api/v1/health",
});
app.use(globalLimiter);

// ─── 8. Routes ───────────────────────────────────────────────────────────────
app.use("/api/v1/settings", require("./routes/settings.routes"));
app.use("/api/v1/auth", require("./routes/auth.routes"));
app.use("/api/v1/admin", require("./routes/admin.routes"));
app.use("/api/v1/chat", require("./routes/chat.routes"));
app.use("/api/v1/offer-banners", require("./routes/offerBanner.routes"));

app.get("/api/v1/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "API is running",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    // CORS error
    if (err.message && err.message.startsWith("CORS policy")) {
        return res.status(403).json({ success: false, message: err.message });
    }

    // Mongoose — invalid ObjectId (e.g. /departments/abc)
    if (err.name === "CastError") {
        return res.status(400).json({
            success: false,
            message: `Invalid ${err.path}: '${err.value}' is not a valid ID`,
        });
    }

    // Mongoose — duplicate key (unique index violation)
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || "field";
        return res.status(409).json({
            success: false,
            message: `Duplicate value: '${err.keyValue?.[field]}' already exists for ${field}`,
        });
    }

    // Mongoose — schema validation errors
    if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map((e) => e.message);
        return res.status(400).json({
            success: false,
            message: messages.join(", "),
        });
    }

    // JWT errors (should be caught in middleware, but belt-and-suspenders)
    if (err.name === "JsonWebTokenError") {
        return res.status(401).json({ success: false, message: "Invalid token" });
    }
    if (err.name === "TokenExpiredError") {
        return res.status(401).json({ success: false, message: "Token expired", code: "TOKEN_EXPIRED" });
    }

    // Generic server error — never leak stack in production
    const status = err.status || err.statusCode || 500;
    console.error(`[${new Date().toISOString()}] ERROR ${status}:`, err.stack || err.message);

    res.status(status).json({
        success: false,
        message: process.env.NODE_ENV === "production" ? "Internal Server Error" : (err.message || "Internal Server Error"),
    });
});

module.exports = app;
