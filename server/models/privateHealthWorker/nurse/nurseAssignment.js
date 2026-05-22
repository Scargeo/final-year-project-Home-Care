const mongoose = require('mongoose')
const { nanoid } = require('nanoid')

const nurseAssignmentSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      default: () => `NASG-${nanoid(10).toUpperCase()}`,
    },
    sourceAppointmentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    roomId: {
      type: String,
      default: '',
      index: true,
      trim: true,
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
    nurseId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    nurseName: {
      type: String,
      required: true,
      trim: true,
    },
    specialization: {
      type: String,
      default: '',
      trim: true,
    },
    condition: {
      type: String,
      default: '',
      trim: true,
    },
    drug: {
      type: String,
      default: '',
      trim: true,
    },
    careWeekStart: {
      type: Date,
      required: true,
      index: true,
    },
    careWeekEnd: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'contacted', 'completed', 'cancelled'],
      default: 'active',
      index: true,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    contactedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    sourceReason: {
      type: String,
      default: '',
      trim: true,
    },
    aiSummary: {
      type: String,
      default: '',
      trim: true,
    },
    aiMatchedTerms: {
      type: [String],
      default: [],
    },
    aiConfidence: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    selectionReason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true },
)

module.exports = mongoose.models.NurseAssignment || mongoose.model('NurseAssignment', nurseAssignmentSchema)