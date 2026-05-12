const mongoose = require('mongoose')

const RefreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  role: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  createdAt: { type: Date, default: Date.now },
})

module.exports = mongoose.models.RefreshToken || mongoose.model('RefreshToken', RefreshTokenSchema)
