const mongoose = require('mongoose')

const attachmentSchema = new mongoose.Schema(
  {
    ownerRef: { type: String, required: true, index: true, trim: true },
    purpose: { type: String, enum: ['profile', 'document', 'post', 'other'], default: 'other' },
    originalName: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number },
    resourceType: { type: String, default: 'image' },
    uploadedAt: { type: Date, default: Date.now },
    meta: { type: Object, default: {} },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Attachment', attachmentSchema)
