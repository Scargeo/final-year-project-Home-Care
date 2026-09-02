const Patient = require('../models/patient/patientRegistration');
const VerificationToken = require('../models/token/verificationToken');
const PendingEmailVerification = require('../models/token/pendingEmailVerification');
const bcrypt = require('bcrypt');
const { sendVerificationEmail } = require('../lib/emailService');

function createOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function createOtpDifferentFrom(previousToken) {
    let nextToken = createOtp();
    while (previousToken && nextToken === String(previousToken)) {
        nextToken = createOtp();
    }
    return nextToken;
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase()
}

function normalizePhone(value) {
    return String(value || '').replace(/\s+/g, '').trim()
}

function getPendingFullName(pending) {
    const payload = pending?.payload || {}
    return [
        payload.patientFirstName || payload.doctorFirstName || payload.nurseFirstName,
        payload.patientLastName || payload.doctorLastName || payload.nurseLastName,
    ].filter(Boolean).join(' ').trim()
}

async function createOrReplacePendingVerification({ role, email, phone, payload, name }) {
    const normalizedEmail = normalizeEmail(email)
    const normalizedPhone = normalizePhone(phone)
    const verificationOtp = createOtp()
    const tokenExpiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await PendingEmailVerification.deleteMany({ role, $or: [{ email: normalizedEmail }, { phone: normalizedPhone }] })

    const pending = new PendingEmailVerification({
        role,
        email: normalizedEmail,
        phone: normalizedPhone,
        token: verificationOtp,
        expiresAt: tokenExpiresAt,
        lastOtpSentAt: new Date(),
        payload,
    })

    await pending.save()
    await sendVerificationEmail(normalizedEmail, name, verificationOtp)

    return { pending, tokenExpiresAt }
}

// Controller function to handle patient registration
const registerPatient = async (req, res) => {
    try {
        const {patientFirstName, patientLastName, patientEmail,
            patientPhone, patientPassword, patientAddress} = req.body || {};

        if (!patientFirstName || !patientLastName || !patientEmail || !patientPhone || !patientPassword || !patientAddress) {
            return res.status(400).json({ message: 'Missing required registration fields' });
        }

        const normalizedEmail = normalizeEmail(patientEmail)
        const normalizedPhone = normalizePhone(patientPhone)

        if (!/^\d{10}$/.test(normalizedPhone)) {
            return res.status(400).json({ message: 'Please provide a valid 10-digit phone number, for example 0245566880.' })
        }

        const [existingEmail, existingPhone, pendingEmail, pendingPhone] = await Promise.all([
            Patient.findOne({ patientEmail: normalizedEmail }).lean(),
            Patient.findOne({ patientPhone: normalizedPhone }).lean(),
            PendingEmailVerification.findOne({ role: 'patient', email: normalizedEmail }).lean(),
            PendingEmailVerification.findOne({ role: 'patient', phone: normalizedPhone }).lean(),
        ])

        if (existingEmail) return res.status(409).json({ message: 'An account with this email already exists.' })
        if (existingPhone) return res.status(409).json({ message: 'An account with this phone number already exists.' })

        // If the user clicks create account again, overwrite any older pending OTPs.
        if (pendingEmail || pendingPhone) {
            await PendingEmailVerification.deleteMany({
                $or: [
                    { email: normalizedEmail },
                    { phone: normalizedPhone },
                ],
            })
        }

        const hash = await bcrypt.hash(patientPassword, 10);
        const fullName = `${patientFirstName} ${patientLastName}`;

        await createOrReplacePendingVerification({
            role: 'patient',
            email: normalizedEmail,
            phone: normalizedPhone,
            name: fullName,
            payload: {
                patientFirstName,
                patientLastName,
                patientEmail: normalizedEmail,
                patientPhone: normalizedPhone,
                patientPasswordHash: hash,
                patientAddress,
            },
        })

        return res.status(200).json({
            message: 'Verification code sent to email. Please enter the code to complete registration.',
            expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            email: normalizedEmail,
            role: 'patient',
        });
    } catch (error) {
        console.error('Error registering patient:', error);
        return res.status(500).json({ message: 'Error completing registration', error: error.message });
    }
};

const resendVerificationCode = async (req, res) => {
    try {
        const { email, role = 'patient' } = req.body || {};
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const pending = await PendingEmailVerification.findOne({ role, email: normalizedEmail });
        if (!pending) {
            return res.status(404).json({ message: 'No pending registration found for this email. Please sign up again.' });
        }

        const now = Date.now();
        const lastSentAt = pending.lastOtpSentAt ? new Date(pending.lastOtpSentAt).getTime() : 0;
        const cooldownMs = 60 * 1000;
        if (lastSentAt && now - lastSentAt < cooldownMs) {
            return res.status(429).json({ message: 'Please wait before requesting another code.' });
        }

        pending.tokenInvalidatedAt = new Date(now);
        pending.token = createOtpDifferentFrom(pending.token);
        pending.expiresAt = new Date(now + 5 * 60 * 1000);
        pending.lastOtpSentAt = new Date(now);
        await pending.save();

        const fullName = getPendingFullName(pending) || normalizedEmail;
        await sendVerificationEmail(normalizedEmail, fullName, pending.token);

        return res.status(200).json({
            message: 'A new verification code has been sent to your email.',
            expiresAt: pending.expiresAt.toISOString(),
        });
    } catch (error) {
        console.error('Error resending verification code:', error);
        return res.status(500).json({ message: 'Failed to resend verification code', error: error.message });
    }
}

//const mongoose = require('mongoose');
const { signToken } = require('./jwtAuth')

// Login controller function to handle patient login
const loginPatient = async (req, res) => {
    try {

        const {patientEmail, patientPassword} = req.body;
        // Find the patient by email (must select password since it is excluded by default)
        const patient = await Patient.findOne({ patientEmail }).select('+patientPassword');
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }
        
        // Check if email is verified
        if (patient.emailVerified === false && !patient.isVerified) {
            return res.status(403).json({ 
                message: 'Please verify your email before logging in. Check your email for the verification link.',
                isVerified: false,
            });
        }
        
        // Check if the password matches
        const isMatch = await bcrypt.compare(patientPassword, patient.patientPassword);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const userPayload = {
            id: patient.patientId,
            role: 'patient',
            patientId: patient.patientId,
            patientEmail: patient.patientEmail,
        }

        const token = signToken(userPayload)

        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                patientId: patient.patientId,
                patientFirstName: patient.patientFirstName,
                patientLastName: patient.patientLastName,
                patientEmail: patient.patientEmail,
                role: 'patient',
                profileImage: patient.profileImage,
                isVerified: patient.isVerified,
                emailVerified: Boolean(patient.emailVerified),
            },
        });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in patient', error: error.message });
    }
};

// Update patient presence / ai status (ownership enforced by route middleware)
const updateStatus = async (req, res) => {
    try {
        const { id } = req.params || {}
        const body = req.body || {}

        // Only allow updating the authenticated user's own record via path id
        if (!id || (req.user && req.user.role === 'patient' && req.user.id !== id)) {
            return res.status(403).json({ message: 'Forbidden' })
        }

        let patient = null
        if (id) patient = await Patient.findOne({ patientId: id })

        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' })
        }

        const updates = {}
        if (typeof body.online === 'boolean') updates.online = body.online
        if (typeof body.aiActive === 'boolean') updates.aiActive = body.aiActive

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No valid status fields provided' })
        }

        Object.assign(patient, updates)
        await patient.save()

        // Return only safe, minimal fields (never the password hash)
        return res.status(200).json({
            message: 'Status updated',
            user: {
                patientId: patient.patientId,
                online: patient.online,
                aiActive: patient.aiActive,
            },
        })
    } catch (error) {
        console.error('Error updating patient status:', error)
        return res.status(500).json({ message: 'Failed to update status' })
    }
}

// Verify patient email with token
const verifyPatientEmail = async (req, res) => {
    try {
        const { token, email } = req.body || req.query || {};
        
        if (!token) {
            return res.status(400).json({ message: 'Verification token is required' });
        }
        
        // First check pending registrations (OTP flow)
        const normalizedToken = String(token).trim()
        const normalizedEmail = email ? String(email).trim().toLowerCase() : ''
        const role = String(req.body?.role || req.query?.role || 'patient').trim().toLowerCase()
        const pendingQuery = normalizedEmail
            ? { role, email: normalizedEmail, token: normalizedToken }
            : { role, token: normalizedToken };

        const pending = await PendingEmailVerification.findOne(pendingQuery);
        if (pending) {
            if (new Date() > pending.expiresAt) {
                await PendingEmailVerification.deleteOne({ _id: pending._id });
                return res.status(400).json({ message: 'Verification code has expired' });
            }

            // Create the real patient record now
            try {
                const payload = pending.payload || {}
                if (String(pending.role) === 'patient') {
                    const newPatient = new Patient({
                        patientFirstName: payload.patientFirstName,
                        patientLastName: payload.patientLastName,
                        patientEmail: payload.patientEmail,
                        patientPhone: payload.patientPhone,
                        patientPassword: payload.patientPasswordHash,
                        patientAddress: payload.patientAddress,
                        isVerified: true,
                        emailVerified: true,
                    });

                    const saved = await newPatient.save();
                    await PendingEmailVerification.deleteOne({ _id: pending._id });

                    return res.status(200).json({
                        message: 'Email verified successfully. Your account is now active.',
                        isVerified: true,
                        user: {
                            patientId: saved.patientId,
                            patientFirstName: saved.patientFirstName,
                            patientLastName: saved.patientLastName,
                            patientEmail: saved.patientEmail,
                            role: 'patient',
                            profileImage: saved.profileImage,
                        },
                    });
                }

                if (String(pending.role) === 'doctor') {
                    const newDoctor = new (require('../models/privateHealthWorker/doctor/doctorRegistration'))({
                        doctorFirstName: payload.doctorFirstName,
                        doctorLastName: payload.doctorLastName,
                        doctorEmail: payload.doctorEmail,
                        doctorPhone: payload.doctorPhone,
                        doctorPassword: payload.doctorPasswordHash,
                        doctorAddress: payload.doctorAddress,
                        specialization: payload.specialization,
                        licenseNumber: payload.licenseNumber,
                        yearsOfExperience: Number.isFinite(Number(payload.yearsOfExperience)) ? Number(payload.yearsOfExperience) : 0,
                        isVerified: true,
                        emailVerified: true,
                    })

                    const saved = await newDoctor.save();
                    await PendingEmailVerification.deleteOne({ _id: pending._id });

                    return res.status(200).json({
                        message: 'Email verified successfully. Your doctor account is now active.',
                        isVerified: true,
                        user: {
                            doctorId: saved.doctorId,
                            doctorFirstName: saved.doctorFirstName,
                            doctorLastName: saved.doctorLastName,
                            doctorEmail: saved.doctorEmail,
                            role: 'doctor',
                            profileImage: saved.profileImage,
                        },
                    });
                }

                if (String(pending.role) === 'nurse') {
                    const Nurse = require('../models/privateHealthWorker/nurse/privateNurseRegistration')
                    const newNurse = new Nurse({
                        nurseFirstName: payload.nurseFirstName,
                        nurseLastName: payload.nurseLastName,
                        nurseEmail: payload.nurseEmail,
                        nursePhone: payload.nursePhone,
                        nursePassword: payload.nursePasswordHash,
                        nurseAddress: payload.nurseAddress,
                        specialization: payload.specialization,
                        yearsOfExperience: Number.isFinite(Number(payload.yearsOfExperience)) ? Number(payload.yearsOfExperience) : 0,
                        isVerified: false,
                        emailVerified: true,
                    })

                    const saved = await newNurse.save();
                    const PrivateNurseRequirement = require('../models/privateHealthWorker/nurse/privateNurseRequirement')
                    await PrivateNurseRequirement.create({
                        requirementId: saved._id,
                        nurseId: saved.uid,
                    }).catch((error) => {
                        console.error('Error saving nurse approval request:', error)
                    })
                    await PendingEmailVerification.deleteOne({ _id: pending._id });

                    return res.status(200).json({
                        message: 'Email verified successfully. Your nurse account is awaiting admin approval.',
                        isVerified: true,
                        user: {
                            nurseId: saved.uid,
                            nurseFirstName: saved.nurseFirstName,
                            nurseLastName: saved.nurseLastName,
                            nurseEmail: saved.nurseEmail,
                            role: 'nurse',
                            profileImage: saved.profileImage,
                        },
                        approvalStatus: 'pending_approval',
                    });
                }

                return res.status(400).json({ message: 'This verification code belongs to a different account type. Please use the correct signup flow.' });
            } catch (createErr) {
                console.error('Failed to create patient from pending registration:', createErr);
                if (createErr?.code === 11000) {
                    const key = Object.keys(createErr?.keyPattern || createErr?.keyValue || {})[0]
                    if (key === 'patientEmail') return res.status(409).json({ message: 'This email was already used by an existing account. Please log in instead.' })
                    if (key === 'patientPhone') return res.status(409).json({ message: 'This phone number was already used by an existing account.' })
                }
                return res.status(500).json({ message: 'Failed to complete registration', error: createErr.message });
            }
        }

        // Fallback: check verification tokens (legacy/link flow)
        const tokenRecord = await VerificationToken.findOne({ token });
        if (!tokenRecord) {
            return res.status(400).json({ message: 'Invalid or expired verification token' });
        }

        if (new Date() > tokenRecord.expiresAt) {
            await VerificationToken.deleteOne({ _id: tokenRecord._id });
            return res.status(400).json({ message: 'Verification token has expired' });
        }

        // Find the patient and update isVerified
        const patient = await Patient.findOne({ patientId: tokenRecord.patientId });
        if (!patient) return res.status(404).json({ message: 'Patient not found' });

        patient.isVerified = true;
        patient.emailVerified = true;
        await patient.save();
        await VerificationToken.deleteOne({ _id: tokenRecord._id });

        return res.status(200).json({
            message: 'Email verified successfully. You can now log in.',
            isVerified: true,
            user: {
                patientId: patient.patientId,
                patientFirstName: patient.patientFirstName,
                patientLastName: patient.patientLastName,
                patientEmail: patient.patientEmail,
                role: 'patient',
                profileImage: patient.profileImage,
            },
        });
    } catch (error) {
        console.error('Error verifying patient email:', error);
        return res.status(500).json({ message: 'Error verifying email', error: error.message });
    }
}

module.exports = {
    registerPatient,
    loginPatient,
    updateStatus,
    verifyPatientEmail,
    resendVerificationCode,
};

