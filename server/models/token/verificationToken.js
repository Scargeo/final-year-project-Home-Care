const mongoose = require('mongoose');

const verificationTokenSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // Auto-delete 24 hours after creation
  },
}, { timestamps: true });

const VerificationToken = mongoose.model('VerificationToken', verificationTokenSchema);

module.exports = VerificationToken;
