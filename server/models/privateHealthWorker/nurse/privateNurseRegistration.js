const mongoose = require('mongoose');
const {nanoid} = require('nanoid');

// Define the privateNurse schema
const privateNurseSchema = new mongoose.Schema({
    uid: {
        type: String,
        required: true,
        unique: true,
        default: function() {
            return 'PNUR-' + nanoid(8).toUpperCase();
        },
    },
    nurseFirstName: {
        type: String,
        required: true,
        minlenght: [2, "First name"],
        maxlenght: 20,
    },
    nurseLastName: {
        type: String,
        required: true,
        minlenght: [2, "Last name"],
        maxlenght: 20,
    },
    nurseEmail: {
        type: String,
        required: true,
        unique: true,
        match: [/\S+@\S+\.\S+/, 'Please use a valid email address.'],
    },
    nursePhone: {
        type: String,
        required: true,
        unique: true,
        match: [/^\d{10}$/, 'Please use a valid 10-digit phone number.'],
    },
    nursePassword: {
        type: String,
        required: true,
        hash: true,
    },
    nurseAddress: {
        type: String,
        required: true,
    },
    specialization: {
        type: String,
        trim: true,
    },
    yearsOfExperience: {
        type: Number,
        default: 0,
    },
    profileImage: {
        url: String,
        publicId: String,
        mimeType: String,
        uploadedAt: Date,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    notificationPrefs: {
        appointmentAlerts: { type: Boolean, default: true },
        patientMessages: { type: Boolean, default: true },
        systemUpdates: { type: Boolean, default: true },
        newPatients: { type: Boolean, default: true },
        emergencyCalls: { type: Boolean, default: true },
    },
    privacyPrefs: {
        patientDataEncryption: { type: Boolean, default: true },
        auditLogging: { type: Boolean, default: true },
        enableTwoFactor: { type: Boolean, default: false },
        allowDataSharing: { type: Boolean, default: false },
    },
    personalizationPrefs: {
        language: { type: String, default: 'en' },
        dateFormat: { type: String, default: 'MM/DD/YYYY' },
        timeZone: { type: String, default: 'UTC' },
        theme: { type: String, default: 'light' },
        showPatientAlerts: { type: Boolean, default: true },
        compactView: { type: Boolean, default: false },
    },
    isAvailable: {
        type: Boolean,
        default: true,
    },
    role: {
        type: String,
        enum: ['nurse'],
        default: 'nurse',
    },
}, { timestamps: true });

// Create the PrivateNurse model
const PrivateNurse = mongoose.model('PrivateNurse', privateNurseSchema);

module.exports = PrivateNurse;