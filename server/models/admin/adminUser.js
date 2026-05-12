const mongoose = require('mongoose')
const { nanoid } = require('nanoid')

const adminSchema = new mongoose.Schema(
  {
    adminId: {
      type: String,
      required: true,
      unique: true,
      default: () => `ADM-${nanoid(8).toUpperCase()}`,
    },
    adminName: {
      type: String,
      required: true,
      trim: true,
    },
    adminEmail: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, 'Please use a valid email address.'],
    },
    adminPassword: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['admin'],
      default: 'admin',
    },
    isSuperAdmin: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

const Admin = mongoose.model('Admin', adminSchema)

module.exports = Admin
