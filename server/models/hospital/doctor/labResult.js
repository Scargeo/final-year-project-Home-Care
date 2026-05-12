const mongoose = require('mongoose');

/**
 * Lab Result Schema
 * Stores doctor-uploaded lab results, extracted text, and AI interpretations
 */
const labResultSchema = new mongoose.Schema(
  {
    // Doctor who uploaded the result
    doctorId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    
    // Patient associated with the lab result
    patientName: {
      type: String,
      trim: true,
    },
    patientPhone: {
      type: String,
      trim: true,
    },
    
    // File information
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileUrl: {
      type: String,
      trim: true,
    },
    fileType: {
      type: String,
      enum: ['pdf', 'image', 'text'],
      default: 'pdf',
    },
    
    // Extracted raw text from the file
    rawText: {
      type: String,
      trim: true,
    },
    
    // Lab test type/category (e.g., "Blood Work", "Chemistry Panel", "Lipid Profile")
    testType: {
      type: String,
      trim: true,
    },
    
    // AI-generated interpretation and insights
    interpretation: {
      summary: {
        type: String,
        trim: true,
      },
      keyFindings: [{
        type: String,
        trim: true,
      }],
      normalValues: [{
        testName: String,
        value: String,
        status: {
          type: String,
          enum: ['normal', 'low', 'high', 'critical'],
          default: 'normal',
        },
      }],
      abnormalValues: [{
        testName: String,
        value: String,
        status: {
          type: String,
          enum: ['low', 'high', 'critical'],
          default: 'high',
        },
        interpretation: String,
      }],
      recommendations: [{
        type: String,
        trim: true,
      }],
      alertsOrConcerns: [{
        type: String,
        trim: true,
      }],
    },
    
    // Processing status
    status: {
      type: String,
      enum: ['pending', 'extracted', 'analyzed', 'completed', 'failed'],
      default: 'pending',
    },
    
    // Error message if processing failed
    errorMessage: {
      type: String,
      trim: true,
    },
    
    // AI model used for interpretation
    aiModel: {
      type: String,
      trim: true,
    },
    
    // Notes added by the doctor
    doctorNotes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Index for faster queries by doctor and creation date
labResultSchema.index({ doctorId: 1, createdAt: -1 });

module.exports = mongoose.model('LabResult', labResultSchema);
