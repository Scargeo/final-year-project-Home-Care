const Patient = require('../models/patient/patientRegistration');
const VerificationToken = require('../models/token/verificationToken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendVerificationEmail } = require('../lib/emailService');

// Controller function to handle patient registration
const registerPatient = async (req, res) => {
    try {
        const {patientFirstName, patientLastName, patientEmail, 
            patientPhone, patientPassword, patientAddress} = req.body;
        bcrypt.hash(patientPassword, 10).then(async (hash) => {
            const newPatient = new Patient({
                    patientFirstName,
                    patientLastName,
                    patientEmail,
                    patientPhone,
                    patientPassword: hash,
                    patientAddress,
                    isVerified: false,
                });
                try {
                    const savedPatient = await newPatient.save();
                    
                    // Generate verification token
                    const verificationToken = crypto.randomBytes(32).toString('hex');
                    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
                    
                    // Save verification token to database
                    const tokenRecord = new VerificationToken({
                        patientId: savedPatient.patientId,
                        email: savedPatient.patientEmail,
                        token: verificationToken,
                        expiresAt: tokenExpiresAt,
                    });
                    
                    await tokenRecord.save();
                    
                    // Send verification email
                    const fullName = `${patientFirstName} ${patientLastName}`;
                    await sendVerificationEmail(savedPatient.patientEmail, fullName, verificationToken);
                    
                    res.status(201).json({
                        message: "Account Created. Please check your email to verify your account.",
                        user: {
                            patientId: savedPatient.patientId,
                            patientFirstName: savedPatient.patientFirstName,
                            patientLastName: savedPatient.patientLastName,
                            patientEmail: savedPatient.patientEmail,
                            role: 'patient',
                            profileImage: savedPatient.profileImage,
                            isVerified: savedPatient.isVerified,
                        },
                    });
                } catch (saveError) {
                    // Clean up if token save fails
                    res.status(500).json({ message: 'Error completing registration', error: saveError.message });
                }
        })
    } catch (error) {
        res.status(500).json({ message: 'Error registering patient', error: error.message });
    }
};

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
        if (!patient.isVerified) {
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
        const { token } = req.body || req.query || {};
        
        if (!token) {
            return res.status(400).json({ message: 'Verification token is required' });
        }
        
        // Find the verification token record
        const tokenRecord = await VerificationToken.findOne({ token });
        
        if (!tokenRecord) {
            return res.status(400).json({ message: 'Invalid or expired verification token' });
        }
        
        // Check if token has expired
        if (new Date() > tokenRecord.expiresAt) {
            await VerificationToken.deleteOne({ _id: tokenRecord._id });
            return res.status(400).json({ message: 'Verification token has expired' });
        }
        
        // Find the patient and update isVerified
        const patient = await Patient.findOne({ patientId: tokenRecord.patientId });
        
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }
        
        // Mark patient as verified
        patient.isVerified = true;
        await patient.save();
        
        // Delete the verification token
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
};

