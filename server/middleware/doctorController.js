const Doctor = require('../models/privateHealthWorker/doctor/doctorRegistration');
const PendingEmailVerification = require('../models/token/pendingEmailVerification');
const bcrypt = require('bcrypt');
const { sendVerificationEmail } = require('../lib/emailService');
const { isLocalDevelopmentRequest } = require('../lib/verificationMode')
const { signToken } = require('./jwtAuth')
const { findAccountByEmail } = require('../lib/accountIdentity')

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizePhone(value) {
  return String(value || '').replace(/\s+/g, '').trim()
}

function createOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Controller function to handle doctor registration
const registerDoctor = async (req, res) => {
  try {
    const {
      doctorFirstName,
      doctorLastName,
      doctorEmail,
      doctorPhone,
      doctorPassword,
      doctorAddress,
      specialization,
      licenseNumber,
      yearsOfExperience,
    } = req.body;

    const normalizedEmail = normalizeEmail(doctorEmail)
    const normalizedPhone = normalizePhone(doctorPhone)
    const trimmedFirstName = String(doctorFirstName || '').trim()
    const trimmedLastName = String(doctorLastName || '').trim()
    const trimmedAddress = String(doctorAddress || '').trim()

    if (!trimmedFirstName || !trimmedLastName || !normalizedEmail || !normalizedPhone || !doctorPassword || !trimmedAddress) {
      return res.status(400).json({ message: 'First name, last name, email, phone, password, and address are required.' })
    }

    if (!/^\d{10}$/.test(normalizedPhone)) {
      return res.status(400).json({ message: 'Please provide a valid 10-digit phone number, for example 0245566880.' })
    }

    const [existingEmail, existingDoctor] = await Promise.all([
      findAccountByEmail(normalizedEmail),
      Doctor.findOne({ doctorPhone: normalizedPhone }).lean(),
    ])
    if (existingEmail || existingDoctor) {
      return res.status(409).json({ message: 'An account with this email or phone number already exists.' })
    }

    const pending = await PendingEmailVerification.findOne({ role: 'doctor', email: normalizedEmail })
    if (pending) {
      await PendingEmailVerification.deleteOne({ _id: pending._id })
    }

    const hashedPassword = await bcrypt.hash(String(doctorPassword), 12)
    if (!isLocalDevelopmentRequest(req)) {
      const doctor = await Doctor.create({
        doctorFirstName: trimmedFirstName,
        doctorLastName: trimmedLastName,
        doctorEmail: normalizedEmail,
        doctorPhone: normalizedPhone,
        doctorPassword: hashedPassword,
        doctorAddress: trimmedAddress,
        specialization: String(specialization || '').trim(),
        licenseNumber: String(licenseNumber || '').trim(),
        yearsOfExperience: Number.isFinite(Number(yearsOfExperience)) ? Number(yearsOfExperience) : 0,
        isVerified: true,
        emailVerified: true,
      })

      return res.status(201).json({
        message: 'Doctor account created successfully.',
        verificationRequired: false,
        email: normalizedEmail,
        role: 'doctor',
        user: { doctorId: doctor.doctorId, doctorEmail: doctor.doctorEmail, role: 'doctor' },
      })
    }

    const token = createOtp()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await sendVerificationEmail(normalizedEmail, `${trimmedFirstName} ${trimmedLastName}`, token)

    await PendingEmailVerification.create({
      role: 'doctor',
      email: normalizedEmail,
      phone: normalizedPhone,
      token,
      expiresAt,
      lastOtpSentAt: new Date(),
      payload: {
        doctorFirstName: trimmedFirstName,
        doctorLastName: trimmedLastName,
        doctorEmail: normalizedEmail,
        doctorPhone: normalizedPhone,
        doctorPasswordHash: hashedPassword,
        doctorAddress: trimmedAddress,
        specialization: String(specialization || '').trim(),
        licenseNumber: String(licenseNumber || '').trim(),
        yearsOfExperience: Number.isFinite(Number(yearsOfExperience)) ? Number(yearsOfExperience) : 0,
      },
    })

    return res.status(200).json({
      message: 'Verification code sent to your email. Please verify to complete doctor account creation.',
      email: normalizedEmail,
      role: 'doctor',
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    const emailError = String(error?.message || '').toLowerCase().includes('gmail') || error?.code === 'EAUTH'
    res.status(500).json({
      message: emailError ? 'Could not send the verification code. Check the Gmail address and 16-character app password in server/.env.' : 'Error registering doctor',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

// Login controller function to handle doctor login
const loginDoctor = async (req, res) => {
  try {
    const { doctorEmail, doctorPassword } = req.body;
    // Find the doctor by email
    const doctor = await Doctor.findOne({ doctorEmail });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    if (doctor.emailVerified === false) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' })
    }
    // Check if the password matches
    const isMatch = await bcrypt.compare(doctorPassword, doctor.doctorPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const userPayload = {
      id: doctor.doctorId,
      role: 'doctor',
      doctorId: doctor.doctorId,
      doctorEmail: doctor.doctorEmail,
    }

    const token = signToken(userPayload)

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        doctorId: doctor.doctorId,
        doctorFirstName: doctor.doctorFirstName,
        doctorLastName: doctor.doctorLastName,
        doctorEmail: doctor.doctorEmail,
        role: 'doctor',
        profileImage: doctor.profileImage,
        emailVerified: Boolean(doctor.emailVerified),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error logging in doctor',
      error: error.message,
    });
  }
};

module.exports = {
  registerDoctor,
  loginDoctor,
};
