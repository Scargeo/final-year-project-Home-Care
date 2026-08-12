const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const pendingRegistrationSchema = new mongoose.Schema({
  tempId: { type: String, default: () => nanoid(10), unique: true },
  patientFirstName: { type: String, required: true },
  patientLastName: { type: String, required: true },
  patientEmail: { type: String, required: true, lowercase: true, trim: true },
  patientPhone: { type: String, required: true, trim: true },
  patientPasswordHash: { type: String, required: true },
  patientAddress: { type: String, required: true },
  token: { type: String, required: true }, // OTP
  tokenInvalidatedAt: { type: Date },
  expiresAt: { type: Date, required: true, index: true },
  lastOtpSentAt: { type: Date },
}, { timestamps: true });

const PendingRegistration = mongoose.model('PendingRegistration', pendingRegistrationSchema);
module.exports = PendingRegistration;
