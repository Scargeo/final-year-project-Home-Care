const mongoose = require('mongoose')

const labResultSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, default: 'application/pdf', trim: true },
    // For backwards compatibility we allow storing base64 fileData,
    // but prefer storing cloud-hosted URLs with a publicId
    fileData: { type: String },
    url: { type: String, default: '' },
    publicId: { type: String, default: '' },
    attachmentId: { type: String, default: '' },
    size: { type: Number },
    resourceType: { type: String, default: 'raw' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const healthRecordSchema = new mongoose.Schema(
  {
    patientRef: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    medicalHistory: {
      type: String,
      default: '',
      trim: true,
      maxlength: 8000,
    },
    prescriptions: {
      type: String,
      default: '',
      trim: true,
      maxlength: 8000,
    },
    allergies: {
      type: String,
      default: '',
      trim: true,
      maxlength: 8000,
    },
    labResults: {
      type: [labResultSchema],
      default: [],
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model('HealthRecord', healthRecordSchema)