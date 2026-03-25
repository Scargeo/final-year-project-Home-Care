const mongoose = require('mongoose');

// Define the rider schema
const riderSchema = new mongoose.Schema({
    riderId: {
        type: String,
        required: true,
        unique: true, 
    },
    riderFirstName: {
        type: String,
        required: true,
        minlenght: [2, "First name"],
        maxlenght: 20,
    },
    riderLastName: {
        type: String,
        required: true,
        minlenght: [2, "Last name"],
        maxlenght: 20,
    },
    riderEmail: {
        type: String,
        required: true,
        unique: true,
        match: [/\S+@\S+\.\S+/, 'Please use a valid email address.'],
    },
    riderLincenseNumber: {
        type: String,
        required: true,
        unique: true,
        match: [/^[A-Z]{2}\d{6}$/, 'Please use a valid license number (e.g., AB123456).'],
    },
    riderPhone: {
        type: String,
        required: true,
        unique: true,
        match: [/^\d{10}$/, 'Please use a valid 10-digit phone number.'],
    },
    riderPassword: {
        type: String,
        required: true,
        match: [/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}/, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.'],
    },
    riderAddress: {
        type: String,
        required: true,
    },
}, { timestamps: true });

// Create the Rider model
const Rider = mongoose.model('Rider', riderSchema);

module.exports = Rider;