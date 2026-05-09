const Patient = require('../models/patient/patientRegistration')
const Doctor = require('../models/privateHealthWorker/doctor/doctorRegistration')
const { verifyToken } = require('./jwtAuth')

// Loads the full user object into req.user when possible.
// Prefers JWT Authorization: Bearer <token>. Falls back to legacy headers x-user-id/x-user-role.
module.exports.loadUser = async function (req, res, next) {
  try {
    if (String(process.env.DISABLE_AUTH || '') === 'true') return next()

    // Try Authorization bearer token first
    const authHeader = String(req.get('authorization') || req.get('Authorization') || '').trim()
    if (authHeader) {
      const payload = verifyToken(authHeader)
      if (payload && payload.id && payload.role) {
        try {
          if (payload.role === 'patient') {
            const patient = await Patient.findOne({ patientId: payload.id })
            if (patient) req.user = { id: payload.id, role: 'patient', record: patient }
          } else if (payload.role === 'doctor') {
            const doctor = await Doctor.findOne({ doctorId: payload.id })
            if (doctor) req.user = { id: payload.id, role: 'doctor', record: doctor }
          }
        } catch (e) {
          console.warn('Failed to load user from token payload', e.message)
        }
        return next()
      }
    }

    // Fallback to header-based auth for development
    const userId = String(req.get('x-user-id') || '').trim()
    const userRole = String(req.get('x-user-role') || '').trim().toLowerCase()

    if (!userId || !userRole) return next()

    if (userRole === 'patient') {
      try {
        const patient = await Patient.findOne({ patientId: userId })
        if (patient) {
          req.user = { id: userId, role: 'patient', record: patient }
        }
      } catch (e) {
        console.warn('Failed to load patient record in loadUser middleware', e.message)
      }
    } else if (userRole === 'doctor') {
      try {
        const doctor = await Doctor.findOne({ doctorId: userId })
        if (doctor) {
          req.user = { id: userId, role: 'doctor', record: doctor }
        }
      } catch (e) {
        console.warn('Failed to load doctor record in loadUser middleware', e.message)
      }
    }

    return next()
  } catch (err) {
    console.error('loadUser middleware error', err)
    return next()
  }
}
