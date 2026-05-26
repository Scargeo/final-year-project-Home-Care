const Patient = require('../models/patient/patientRegistration');
const bcrypt = require('bcrypt');

// Controller function to handle patient registration
const registerPatient = async (req, res) => {
    try {
        const {patientFirstName, patientLastName, patientEmail, 
            patientPhone, patientPassword, patientAddress} = req.body;
        bcrypt.hash(patientPassword, 10).then((hash) => {
            const newPatient = new Patient({
                    patientFirstName,
                    patientLastName,
                    patientEmail,
                    patientPhone,
                    patientPassword: hash,
                    patientAddress,
                });
                newPatient.save().then((savedPatient) => {
                    res.status(201).json({
                        message: "Account Created",
                        user: {
                            patientId: savedPatient.patientId,
                            patientFirstName: savedPatient.patientFirstName,
                            patientLastName: savedPatient.patientLastName,
                            patientEmail: savedPatient.patientEmail,
                            role: 'patient',
                            profileImage: savedPatient.profileImage,
                        },
                    });
                })
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
        // Find the patient by email
        const patient = await Patient.findOne({ patientEmail });
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
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
            },
        });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in patient', error: error.message });
    }
};

// Update patient presence / ai status
const updateStatus = async (req, res) => {
    try {
        const { id } = req.params || {}
        const body = req.body || {}

        let patient = null

        if (id) {
            patient = await Patient.findOne({ patientId: id })
        }

        if (!patient && body.patientEmail) {
            patient = await Patient.findOne({ patientEmail: String(body.patientEmail).trim().toLowerCase() })
        }

        if (!patient && body._id) {
            patient = await Patient.findById(body._id)
        }

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

        return res.status(200).json({ message: 'Status updated', user: patient })
    } catch (error) {
        console.error('Error updating patient status:', error)
        return res.status(500).json({ message: 'Failed to update status', error: error.message })
    }
}

module.exports = {
    registerPatient,
    loginPatient,
    updateStatus,
};

