const mongoose = require('mongoose')

const patientQueueSchema = new mongoose.Schema(
  {
    queueId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    doctorId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    patientId: {
      type: String,
      required: true,
      trim: true,
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    patientPhone: {
      type: String,
      trim: true,
    },
    queuePosition: {
      type: Number,
      required: true,
      default: 1,
    },
    status: {
      type: String,
      enum: ['waiting', 'in-consultation', 'completed', 'cancelled'],
      default: 'waiting',
      index: true,
    },
    checkInTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    estimatedWaitTime: {
      type: Number,
      default: 15,
    },
    priority: {
      type: String,
      enum: ['normal', 'high', 'urgent'],
      default: 'normal',
    },
    visitReason: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model('PatientQueue', patientQueueSchema)
