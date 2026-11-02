const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const uri = process.env.MONGOURL || process.env.MONGO_URI;
        if (!uri) {
            throw new Error("MONGOURL (or MONGO_URI) is not set in .env");
        }
        const conn = await mongoose.connect(uri, {
            // Pool sized for concurrent CRM traffic; override via .env if needed
            maxPoolSize: Number(process.env.MONGO_POOL_SIZE) || 50,
            minPoolSize: Number(process.env.MONGO_POOL_MIN) || 5,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            maxIdleTimeMS: 60000,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB connection error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = { connectDB };
