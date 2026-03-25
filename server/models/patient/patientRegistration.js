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
        minlenght: [2, "First name"],
        maxlenght: 20,
    },
    patientLastName: {
        type: String,
        required: true,
        minlenght: [2, "Last name"],
        maxlenght: 20,
    },
    patientEmail: {
        type: String,
        required: true,
        unique: true,
        match: [/\S+@\S+\.\S+/, 'Please use a valid email address.'],
    },
    patientPhone: {
        type: String,
        required: true,
        unique: true,
        match: [/^\d{10}$/, 'Please use a valid 10-digit phone number.'],
    },
    patientPassword: {
        type: String,
        required: true,
        match: [/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}/, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.'],
    },
    patientAddress: {
        type: String,
        required: true,
    },

}, { timestamps: true });

// Create the PatientRegistration model
const Patients = mongoose.model('Patients', patientRegistrationSchema);

module.exports = Patients;