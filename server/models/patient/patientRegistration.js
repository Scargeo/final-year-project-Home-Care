const mongoose = require('mongoose');
const {nanoid} = require('nanoid');

// Define the patient registration schema
const patientRegistrationSchema = new mongoose.Schema({
    patientId: {
        type: String,
        default: () => nanoid(8), // Generate a unique patient ID using nanoid
        unique: true,
    },
    patientFirstName: {
        type: String,
        required: true,
        trim: true,
        minlength: [2, "First name must be at least 2 characters long."],
        maxlength: [20, "First name must be 20 characters or fewer."],
    },
    patientLastName: {
        type: String,
        required: true,
        trim: true,
        minlength: [2, "Last name must be at least 2 characters long."],
        maxlength: [20, "Last name must be 20 characters or fewer."],
    },
    patientEmail: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/\S+@\S+\.\S+/, 'Please use a valid email address.'],
    },
    patientPhone: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        match: [/^\d{10}$/, 'Please use a valid 10-digit phone number.'],
    },
    patientPassword: {
        type: String,
        required: true,
        minlength: [8, 'Password must be at least 8 characters long.'],
        match: [/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}/, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.'],
    },
    patientAddress: {
        type: String,
        required: true,
        trim: true,
    },

}, { timestamps: true });

// Create the PatientRegistration model
const Patients = mongoose.model('Patients', patientRegistrationSchema);

module.exports = Patients;