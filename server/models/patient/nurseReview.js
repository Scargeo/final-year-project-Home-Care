const mongoose = require('mongoose')

const nurseReviewSchema = new mongoose.Schema(
  {
    homeCareRequestId: { type: String, required: true, unique: true, index: true, trim: true },
    patientId: { type: String, required: true, index: true, trim: true },
    nurseId: { type: String, required: true, index: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true, maxlength: 1000 },
  },
  { timestamps: true },
)

module.exports = mongoose.models.NurseReview || mongoose.model('NurseReview', nurseReviewSchema)