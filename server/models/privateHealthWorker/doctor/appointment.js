const mongoose = require('mongoose')

const appointmentSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    doctorId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    patientId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    patientPhone: {
      type: String,
      trim: true,
    },
    appointmentDate: {
      type: Date,
      required: true,
      index: true,
    },
    appointmentTime: {
      type: String,
      required: true,
      trim: true,
    },
    duration: {
      type: Number,
      default: 30,
    },
    status: {
      type: String,
      enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'no-show'],
      default: 'scheduled',
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    triageCategory: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    triageConfidence: {
      type: Number,
      min: 0,
      max: 1,
    },
    triageSummary: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    triageMatchedTerms: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    rebookedFromAppointmentId: {
      type: String,
      trim: true,
      default: null,
    },
    consultationType: {
      type: String,
      enum: ['messaging', 'video', 'phone'],
      default: 'messaging',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Appointment', appointmentSchema)
