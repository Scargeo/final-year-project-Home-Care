const mongoose = require('mongoose')
const { nanoid } = require('nanoid')

const STATUS_FLOW = ['pending', 'under review', 'assigned', 'accepted', 'in progress', 'completed']

const homeCareRequestSchema = new mongoose.Schema(
  {
    homeCareRequestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      default: () => `HC-${nanoid(10).toUpperCase()}`,
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
      default: '',
      trim: true,
    },
    serviceType: {
      type: String,
      enum: ['nursing care', 'elderly care', 'post-hospitalization care', 'physiotherapy'],
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    verificationPhoto: {
      attachmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment', required: true },
      url: { type: String, required: true, trim: true },
      publicId: { type: String, required: true, trim: true },
      mimeType: { type: String, default: 'image/jpeg', trim: true },
      capturedAt: { type: Date, required: true },
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    locationCoords: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    preferredDate: {
      type: Date,
      index: true,
    },
    preferredTime: {
      type: String,
      default: '',
      trim: true,
    },
    emergencyContactName: {
      type: String,
      default: '',
      trim: true,
    },
    emergencyContactPhone: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: [...STATUS_FLOW, 'cancelled'],
      default: 'pending',
      index: true,
    },
    assignedNurseId: {
      type: String,
      default: '',
      index: true,
      trim: true,
    },
    assignedNurseName: {
      type: String,
      default: '',
      trim: true,
    },
    assignmentReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: { type: Date, default: null },
    assignedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    inProgressAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    declineReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    careRecords: {
      type: [
        {
          type: { type: String, default: 'care' },
          note: { type: String, default: '', trim: true, maxlength: 2000 },
          recordedBy: { type: String, default: '' },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    observations: {
      type: [
        {
          note: { type: String, default: '', trim: true, maxlength: 2000 },
          recordedBy: { type: String, default: '' },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    timeline: {
      type: [
        {
          type: { type: String, default: 'status' },
          label: { type: String, default: '' },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
)

module.exports = mongoose.models.HomeCareRequest || mongoose.model('HomeCareRequest', homeCareRequestSchema)
