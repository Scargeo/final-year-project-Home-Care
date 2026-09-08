const Patient = require('../models/patient/patientRegistration')
const Doctor = require('../models/privateHealthWorker/doctor/doctorRegistration')
const Nurse = require('../models/privateHealthWorker/nurse/privateNurseRegistration')
const Admin = require('../models/admin/adminUser')

function emailPattern(email) {
  return new RegExp(`^${String(email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
}

async function findAccountByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) return null

  const pattern = emailPattern(normalizedEmail)
  const [patient, doctor, nurse, admin] = await Promise.all([
    Patient.findOne({ patientEmail: pattern }).select('_id').lean(),
    Doctor.findOne({ doctorEmail: pattern }).select('_id').lean(),
    Nurse.findOne({ nurseEmail: pattern }).select('_id').lean(),
    Admin.findOne({ adminEmail: pattern }).select('_id').lean(),
  ])

  return patient || doctor || nurse || admin || null
}

module.exports = { findAccountByEmail }
