const Patient = require('../models/patient/patientRegistration');
const Doctor = require('../models/privateHealthWorker/doctor/doctorRegistration');
const Nurse = require('../models/privateHealthWorker/nurse/privateNurseRegistration');
const PendingEmailVerification = require('../models/token/pendingEmailVerification');
const PrivateNurseRequirement = require('../models/privateHealthWorker/nurse/privateNurseRequirement');
const bcrypt = require('bcrypt');
const { signToken, signRefreshToken } = require('./jwtAuth')
const { sendVerificationEmail } = require('../lib/emailService');

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase()
}

function normalizePhone(value) {
    return String(value || '').replace(/\s+/g, '').trim()
}

function isStrongPassword(value) {
    return /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}/.test(String(value || ''))
}

function createOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

function buildSafeNurseUser(nurse) {
    return {
        nurseId: nurse.uid || nurse.nurseId || nurse._id,
        nurseFirstName: nurse.nurseFirstName,
        nurseLastName: nurse.nurseLastName,
        nurseEmail: nurse.nurseEmail,
        nursePhone: nurse.nursePhone,
        nurseAddress: nurse.nurseAddress,
        specialization: nurse.specialization,
        yearsOfExperience: nurse.yearsOfExperience,
        role: 'nurse',
        isVerified: Boolean(nurse.isVerified),
        emailVerified: Boolean(nurse.emailVerified),
        profileImage: nurse.profileImage || null,
    }
}

async function findBlockedIdentity(normalizedEmail, normalizedPhone) {
    // Treat email/phone uniqueness as a cross-role gate so one identity cannot be reused across accounts.
    const [patient, doctor, nurse] = await Promise.all([
        Patient.findOne({ $or: [{ patientEmail: normalizedEmail }, { patientPhone: normalizedPhone }] }).lean(),
        Doctor.findOne({ $or: [{ doctorEmail: normalizedEmail }, { doctorPhone: normalizedPhone }] }).lean(),
        Nurse.findOne({ $or: [{ nurseEmail: normalizedEmail }, { nursePhone: normalizedPhone }] }).lean(),
    ])

    return patient || doctor || nurse || null
}

// Controller function to handle nurse registration
const registerNurse = async (req, res) => {
    try {
        const {
            nurseFirstName,
            nurseLastName,
            nurseEmail,
            nursePhone,
            nursePassword,
            nurseAddress,
            specialization,
            yearsOfExperience,
        } = req.body || {}

        const normalizedEmail = normalizeEmail(nurseEmail)
        const normalizedPhone = normalizePhone(nursePhone)
        const trimmedFirstName = String(nurseFirstName || '').trim()
        const trimmedLastName = String(nurseLastName || '').trim()
        const trimmedAddress = String(nurseAddress || '').trim()
        const trimmedSpecialization = String(specialization || '').trim()

        if (!trimmedFirstName || !trimmedLastName || !normalizedEmail || !normalizedPhone || !nursePassword || !trimmedAddress) {
            return res.status(400).json({ message: 'First name, last name, email, phone, password, and address are required.' })
        }

        if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(normalizedEmail)) {
            return res.status(400).json({ message: 'Please provide a valid email address.' })
        }

        if (!/^\d{10}$/.test(normalizedPhone)) {
            return res.status(400).json({ message: 'Please provide a valid 10-digit phone number.' })
        }

        if (!isStrongPassword(nursePassword)) {
            return res.status(400).json({
                message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, one special character, and be at least 8 characters long.',
            })
        }

        const blockedIdentity = await findBlockedIdentity(normalizedEmail, normalizedPhone)
        if (blockedIdentity) {
            // Anti-abuse gate: one email/phone pair cannot be reused across patient, doctor, or nurse accounts.
            return res.status(409).json({ message: 'An account with this email or phone number already exists.' })
        }

        await PendingEmailVerification.deleteMany({ role: 'nurse', $or: [{ email: normalizedEmail }, { phone: normalizedPhone }] })

        const hashedPassword = await bcrypt.hash(String(nursePassword), 12)
        const token = createOtp()
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

        await PendingEmailVerification.create({
            role: 'nurse',
            email: normalizedEmail,
            phone: normalizedPhone,
            token,
            expiresAt,
            lastOtpSentAt: new Date(),
            payload: {
                nurseFirstName: trimmedFirstName,
                nurseLastName: trimmedLastName,
                nurseEmail: normalizedEmail,
                nursePhone: normalizedPhone,
                nursePasswordHash: hashedPassword,
                nurseAddress: trimmedAddress,
                specialization: trimmedSpecialization,
                yearsOfExperience: Number.isFinite(Number(yearsOfExperience)) ? Number(yearsOfExperience) : 0,
            },
        })

        await sendVerificationEmail(normalizedEmail, `${trimmedFirstName} ${trimmedLastName}`, token)

        return res.status(200).json({
            message: 'Verification code sent to your email. Please verify to complete nurse account creation.',
            email: normalizedEmail,
            role: 'nurse',
            expiresAt: expiresAt.toISOString(),
        })
    } catch (error) {
        return res.status(500).json({ message: 'Error registering nurse', error: error.message })
    }
}

// Login controller function to handle nurse login.
// Nurses must be approved before they can obtain a token.
const loginNurse = async (req, res) => {
    try {
        const { nurseEmail, nursePassword } = req.body || {}
        const normalizedEmail = normalizeEmail(nurseEmail)

        if (!normalizedEmail || !nursePassword) {
            return res.status(400).json({ message: 'Email and password are required.' })
        }

        const nurse = await Nurse.findOne({ nurseEmail: normalizedEmail })
        if (!nurse) {
            return res.status(404).json({ message: 'Nurse not found' })
        }

        if (nurse.emailVerified === false) {
            return res.status(403).json({ message: 'Please verify your email before logging in.' })
        }

        if (!nurse.isVerified) {
            return res.status(403).json({ message: 'Nurse account is pending admin approval.' })
        }

        const isMatch = await bcrypt.compare(String(nursePassword), nurse.nursePassword)
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' })
        }

        const userPayload = {
            id: nurse.uid || nurse._id,
            role: 'nurse',
            nurseId: nurse.uid || nurse._id,
            nurseEmail: nurse.nurseEmail,
        }

        const token = signToken(userPayload)
        const refreshToken = await signRefreshToken(userPayload)

        return res.status(200).json({
            message: 'Login successful',
            token,
            refreshToken,
            user: buildSafeNurseUser(nurse),
        })
    }
    catch (error) {
        return res.status(500).json({ message: 'Error logging in nurse', error: error.message })
    }
}

module.exports = {
    registerNurse,
    loginNurse,
};  
