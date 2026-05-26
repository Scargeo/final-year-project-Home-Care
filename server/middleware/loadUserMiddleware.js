const Patient = require('../models/patient/patientRegistration')
const Doctor = require('../models/privateHealthWorker/doctor/doctorRegistration')
const Nurse = require('../models/privateHealthWorker/nurse/privateNurseRegistration')
const Admin = require('../models/admin/adminUser')
const { verifyToken } = require('./jwtAuth')

// Loads the full user object into req.user when possible.
// Prefers JWT Authorization: Bearer <token>. Falls back to legacy headers x-user-id/x-user-role.
module.exports.loadUser = async function (req, res, next) {
  try {
    // Allow a global disable only in non-production for local development/testing
    if (String(process.env.DISABLE_AUTH || '').toLowerCase() === 'true' && String(process.env.NODE_ENV || '').toLowerCase() !== 'production') {
      return next()
    }

    // Try Authorization bearer token first
    const authHeader = String(req.get('authorization') || req.get('Authorization') || '').trim()
    if (authHeader) {
      const payload = verifyToken(authHeader)
      if (!payload) {
        return res.status(401).json({ message: 'Invalid or expired token' })
      }

      if (payload && payload.id && payload.role) {
        try {
          if (payload.role === 'patient') {
            const patient = await Patient.findOne({ patientId: payload.id })
            if (patient) req.user = { id: payload.id, role: 'patient', record: patient }
          } else if (payload.role === 'doctor') {
            const doctor = await Doctor.findOne({ doctorId: payload.id })
            if (doctor) req.user = { id: payload.id, role: 'doctor', record: doctor }
          } else if (payload.role === 'nurse') {
            const nurse = await Nurse.findOne({ uid: payload.id })
            if (nurse) req.user = { id: payload.id, role: 'nurse', record: nurse }
          } else if (payload.role === 'admin') {
            const admin = await Admin.findOne({ adminId: payload.id })
            if (admin) req.user = { id: payload.id, role: 'admin', record: admin }
          }
        } catch (e) {
          console.warn('Failed to load user from token payload', e.message)
        }
      }

      return next()
    }

    // Fallback to header-based auth only when explicitly allowed (development only)
    const allowLegacy = String(process.env.NODE_ENV || '').toLowerCase() !== 'production' && String(process.env.ALLOW_LEGACY_HEADERS || '').toLowerCase() === 'true'
    if (!allowLegacy) return next()

    const userId = String(req.get('x-user-id') || '').trim()
    const userRole = String(req.get('x-user-role') || '').trim().toLowerCase()
    if (!userId || !userRole) return next()

    try {
      if (userRole === 'patient') {
        const patient = await Patient.findOne({ patientId: userId })
        if (patient) req.user = { id: userId, role: 'patient', record: patient }
      } else if (userRole === 'doctor') {
        const doctor = await Doctor.findOne({ doctorId: userId })
        if (doctor) req.user = { id: userId, role: 'doctor', record: doctor }
      } else if (userRole === 'nurse') {
        const nurse = await Nurse.findOne({ uid: userId })
        if (nurse) req.user = { id: userId, role: 'nurse', record: nurse }
      } else if (userRole === 'admin') {
        const admin = await Admin.findOne({ adminId: userId })
        if (admin) req.user = { id: userId, role: 'admin', record: admin }
      }
    } catch (e) {
      console.warn('Failed to load user from legacy headers', e.message)
    }

    return next()
  } catch (err) {
    console.error('loadUser middleware error', err)
    return next()
  }
}
