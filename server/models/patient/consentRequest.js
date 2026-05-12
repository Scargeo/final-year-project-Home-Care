const mongoose = require('mongoose')
const { nanoid } = require('nanoid')

const consentRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      default: () => `CR-${nanoid(8).toUpperCase()}`,
    },
    patientId: { type: String, required: true, index: true },
    doctorId: { type: String, required: true, index: true },
    appointmentId: { type: String, trim: true },
    message: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending', index: true },
    requestedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
    // When patient accepts, they may share a subset of records (keys or attachments)
    sharedRecords: { type: Array, default: [] },
    sharedAttachments: { type: Array, default: [] },
  },
  { timestamps: true },
)

module.exports = mongoose.model('ConsentRequest', consentRequestSchema)
