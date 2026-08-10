const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        mongoose.connection.on('connected', () => {
            console.log('MongoDB Connected', mongoose.connection.host, mongoose.connection.name);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected — retrying automatically in the background.');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected', mongoose.connection.host, mongoose.connection.name);
        });

        mongoose.connection.on('error', (error) => {
            // Transient DNS/network errors (e.g., getaddrinfo ENOTFOUND) should not
            // crash the process. Mongoose will keep retrying in the background.
            console.warn('MongoDB connection error (transient):', error?.message || error);
        });

        await mongoose.connect(process.env.MONGO_STRING, {
            maxPoolSize: 50,
            // Fail fast when the Atlas cluster is temporarily unreachable instead of
            // buffering commands for 30s and surfacing raw ENOTFOUND stack traces.
            serverSelectionTimeoutMS: 15000,
            connectTimeoutMS: 15000,
            socketTimeoutMS: 60000,
            heartbeatFrequencyMS: 10000,
            family: 4,
        });
    } catch (error) {
        console.error(`MongoDB initial connection failed: ${error?.message || error}`);
        // Do not process.exit(1): a transient DNS blip at boot should not kill the
        // backend. Mongoose will keep reconnecting in the background.
        throw error;
    }
};

module.exports = connectDB;

