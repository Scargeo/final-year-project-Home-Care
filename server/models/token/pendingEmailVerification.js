const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const pendingEmailVerificationSchema = new mongoose.Schema({
  verificationId: { type: String, default: () => nanoid(12), unique: true },
  role: { type: String, required: true, enum: ['patient', 'doctor', 'nurse'] },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  phone: { type: String, required: true, trim: true, index: true },
  token: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  lastOtpSentAt: { type: Date },
  tokenInvalidatedAt: { type: Date },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

pendingEmailVerificationSchema.index({ role: 1, email: 1 }, { unique: true })
pendingEmailVerificationSchema.index({ role: 1, phone: 1 }, { unique: true })

const PendingEmailVerification = mongoose.model('PendingEmailVerification', pendingEmailVerificationSchema);

module.exports = PendingEmailVerification;