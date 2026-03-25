const Patient = require('../models/patient/patientRegistration');
const bcrypt = require('bcrypt');

// Controller function to handle patient registration
const registerPatient = async (req, res) => {
    try {
        const {patientFirstName, patientLastName, patientEmail, 
            patientPhone, patientPassword, patientAddress} = req.body;

        // if ( !patientPassword.match[/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}/] ) {
        //     return res.status(400).json({ 
        //         message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.' });
        // }
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
                res.status(201).json({message: "Account Created", user: savedPatient});
            })
        })
    } catch (error) {
        res.status(500).json({ message: 'Error registering patient', error: error.message });
    }
};

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
        res.status(200).json({ message: 'Login successful', user: patient });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in patient', error: error.message });
    }
};

module.exports = {
    registerPatient,
    loginPatient,
};

