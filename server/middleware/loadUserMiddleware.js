const Patient = require('../models/patient/patientRegistration')
const Doctor = require('../models/privateHealthWorker/doctor/doctorRegistration')
const Nurse = require('../models/privateHealthWorker/nurse/privateNurseRegistration')
const Admin = require('../models/admin/adminUser')
const { verifyToken } = require('./jwtAuth')

// Loads the full user object into req.user when possible.
// Only trusts JWT Authorization: Bearer <token>. Legacy header auth is intentionally removed.
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
        let record = null
        try {
          if (payload.role === 'patient') {
            record = await Patient.findOne({ patientId: payload.id })
            if (record) req.user = { id: payload.id, role: 'patient', record }
          } else if (payload.role === 'doctor') {
            record = await Doctor.findOne({ doctorId: payload.id })
            if (record) req.user = { id: payload.id, role: 'doctor', record }
          } else if (payload.role === 'nurse') {
            record = await Nurse.findOne({ uid: payload.id })
            if (record) req.user = { id: payload.id, role: 'nurse', record }
          } else if (payload.role === 'admin') {
            record = await Admin.findOne({ adminId: payload.id })
            if (record) req.user = { id: payload.id, role: 'admin', record }
          }
        } catch (e) {
          // A transient DB read error should not abruptly drop an authenticated
          // healthcare provider from emergency/SOS response flows.
          console.warn('Failed to load user record from token payload', e.message)
        }

        // Safety net for legitimate authenticated users: a valid signed JWT
        // already proves the user logged in with this role. If the full DB record
        // could not be resolved (e.g. transient DB hiccup) we still allow the
        // identity through so healthcare providers can respond to SOS emergencies
        // and admins can keep using the admin console without being dropped.
        if (!record) {
          req.user = { id: payload.id, role: payload.role, record: null }
        }
      }

      return next()
    }

    // Legacy header auth is intentionally disabled: it allows impersonation and is a security risk.
    // Only JWT bearer tokens are trusted for identifying users.
    return next()
  } catch (err) {
    console.error('loadUser middleware error', err)
    return next()
  }
}
