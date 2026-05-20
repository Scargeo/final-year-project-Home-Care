const mongoose = require('mongoose')

const roomFileSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    url: { type: String, trim: true, default: '' },
    mimeType: { type: String, trim: true, default: '' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const consultationRoomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    appointmentId: {
      type: String,
      trim: true,
      index: true,
      default: '',
    },
    patientId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    doctorId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    doctorJoinedAt: {
      type: Date,
      default: null,
    },
    patientJoinedAt: {
      type: Date,
      default: null,
    },
    bothJoinedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    callRequestStatus: {
      type: String,
      enum: ['idle', 'pending', 'approved', 'declined'],
      default: 'idle',
      index: true,
    },
    callRequestType: {
      type: String,
      enum: ['audio', 'video'],
      default: '',
    },
    callRequestedBy: {
      type: String,
      trim: true,
      default: '',
    },
    callRequestedAt: {
      type: Date,
      default: null,
    },
    callRespondedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 10000,
      default: '',
    },
    prescription: {
      type: String,
      trim: true,
      maxlength: 10000,
      default: '',
    },
    allergies: {
      type: String,
      trim: true,
      maxlength: 8000,
      default: '',
    },
    files: {
      type: [roomFileSchema],
      default: [],
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model('ConsultationRoom', consultationRoomSchema)
