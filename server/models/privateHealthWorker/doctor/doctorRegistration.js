const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

// Define the doctor schema
const doctorSchema = new mongoose.Schema(
  {
    doctorId: {
      type: String,
      required: true,
      unique: true,
      default: function () {
        return 'DOC-' + nanoid(8).toUpperCase();
      },
    },
    doctorFirstName: {
      type: String,
      required: true,
      trim: true,
    },
    doctorLastName: {
      type: String,
      required: true,
      trim: true,
    },
    doctorEmail: {
      type: String,
      required: true,
      unique: true,
      match: [/\S+@\S+\.\S+/, 'Please use a valid email address.'],
    },
    doctorPhone: {
      type: String,
      required: true,
      trim: true,
    },
    doctorPassword: {
      type: String,
      required: true,
    },
    doctorAddress: {
      type: String,
      trim: true,
    },
    specialization: {
      type: String,
      trim: true,
    },
    licenseNumber: {
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
    role: {
      type: String,
      enum: ['doctor'],
      default: 'doctor',
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
    // Indicates whether the doctor is currently accepting new appointments
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Create the Doctor model
const Doctor = mongoose.model('Doctor', doctorSchema);

module.exports = Doctor;
