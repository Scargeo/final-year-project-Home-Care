const mongoose = require('mongoose');

const providerSnapshotSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    specialty: { type: String, default: '' },
  },
  { _id: false },
);

const timelineItemSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    label: { type: String, required: true },
    at: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const noteItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    at: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

// SOS alerts are persisted so providers can track updates across sessions.
const sosAlertSchema = new mongoose.Schema(
  {
    patientName: { type: String, default: 'Unknown patient', trim: true },
    patientPhone: { type: String, default: '', trim: true },
    location: { type: String, required: true, trim: true },
    address: { type: String, default: '', trim: true },
    symptoms: { type: String, default: 'Emergency help requested', trim: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'resolved'],
      default: 'pending',
      index: true,
    },
    acceptedAt: { type: Date, default: null },
    respondedBy: { type: String, default: null, trim: true },
    chatRoomId: { type: String, required: true, trim: true, index: true },
    notifiedTo: { type: [providerSnapshotSchema], default: [] },
    timeline: { type: [timelineItemSchema], default: [] },
    notes: { type: [noteItemSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model('SOSAlerts', sosAlertSchema);
