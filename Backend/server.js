const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const { attachChatSocket } = require("./socket/chat.socket");
const { startClientPaymentReminderJob } = require("./utils/clientPaymentReminders");
const { startEveningReportJob } = require("./utils/eveningReportGenerator");

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const normalizeOrigin = (value) => String(value || "").trim().replace(/\/$/, "");
const allowedOrigins = new Set(
    (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:5173")
        .split(",")
        .map(normalizeOrigin)
        .filter(Boolean)
);
if (process.env.FRONTEND_URL) allowedOrigins.add(normalizeOrigin(process.env.FRONTEND_URL));

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            const normalized = normalizeOrigin(origin);
            if (allowedOrigins.has(normalized)) return callback(null, true);
            if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
                return callback(null, true);
            }
            return callback(null, false);
        },
        credentials: true,
    },
    path: "/socket.io",
});

app.set("io", io);
attachChatSocket(io);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
    startClientPaymentReminderJob();
    startEveningReportJob();
});

process.on("unhandledRejection", (reason) => {
    console.error(`[${new Date().toISOString()}] UNHANDLED REJECTION:`, reason);
});

process.on("uncaughtException", (err) => {
    console.error(`[${new Date().toISOString()}] UNCAUGHT EXCEPTION:`, err.stack || err.message);
    server.close(() => {
        process.exit(1);
    });
    setTimeout(() => process.exit(1), 5000).unref();
});

process.on("SIGTERM", () => {
    console.log(`[${new Date().toISOString()}] SIGTERM received. Shutting down gracefully...`);
    server.close(() => {
        console.log("Server closed. Goodbye.");
        process.exit(0);
    });
});

process.on("SIGINT", () => {
    console.log(`[${new Date().toISOString()}] SIGINT received. Shutting down gracefully...`);
    server.close(() => process.exit(0));
});
