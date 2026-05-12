const Patient = require('../models/patient/patientRegistration');
const Doctor = require('../models/privateHealthWorker/doctor/doctorRegistration');
const bcrypt = require('bcrypt');
const { signToken } = require('./jwtAuth')

// Unified login: try patient first, then doctor
const loginUnified = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalized = String(email).trim().toLowerCase();

    // Try patient
    const patient = await Patient.findOne({ patientEmail: normalized });
    if (patient) {
      const match = await bcrypt.compare(password, patient.patientPassword);
      if (match) {
        const payload = { id: patient.patientId, role: 'patient', patientId: patient.patientId }
        const token = signToken(payload)
        const { signRefreshToken } = require('./jwtAuth')
        const refreshToken = await signRefreshToken(payload)
        return res.status(200).json({
          message: 'Login successful',
          token,
          refreshToken,
          user: {
            patientId: patient.patientId,
            patientFirstName: patient.patientFirstName,
            patientLastName: patient.patientLastName,
            patientEmail: patient.patientEmail,
            role: 'patient',
            profileImage: patient.profileImage,
          },
        });
      }
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Try doctor
    const doctor = await Doctor.findOne({ doctorEmail: normalized });
    if (doctor) {
      const match = await bcrypt.compare(password, doctor.doctorPassword);
      if (match) {
        const payload = { id: doctor.doctorId, role: 'doctor', doctorId: doctor.doctorId }
        const token = signToken(payload)
        const { signRefreshToken } = require('./jwtAuth')
        const refreshToken = await signRefreshToken(payload)
        return res.status(200).json({
          message: 'Login successful',
          token,
          refreshToken,
          user: {
            doctorId: doctor.doctorId,
            doctorFirstName: doctor.doctorFirstName,
            doctorLastName: doctor.doctorLastName,
            doctorEmail: doctor.doctorEmail,
            role: 'doctor',
            profileImage: doctor.profileImage,
          },
        });
      }
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    return res.status(404).json({ message: 'User not found' });
  } catch (error) {
    console.error('Unified login error:', error);
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

module.exports = {
  loginUnified,
};
