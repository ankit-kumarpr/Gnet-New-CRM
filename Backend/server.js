const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const { attachChatSocket } = require("./socket/chat.socket");
const { startClientPaymentReminderJob } = require("./utils/clientPaymentReminders");
const { startEveningReportJob } = require("./utils/eveningReportGenerator");

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : ["http://localhost:3000", "http://localhost:5173"];

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            if (process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
                return callback(null, true);
            }
            return callback(new Error("CORS blocked"));
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
