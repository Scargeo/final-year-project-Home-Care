const Nurse = require('../models/privateHealthWorker/nurse/privateNurseRegistration');
const PrivateNurseRequirement = require('../models/privateHealthWorker/nurse/privateNurseRequirement');
const bcrypt = require('bcrypt');

// Controller function to handle nurse registration
const registerNurse = async (req, res) => {
    try {
        const {nurseFirstName, nurseLastName, nurseEmail,
            nursePhone, nursePassword, nurseAddress} = req.body;

        // Create a new qualification document for the nurse
        const {nurseId} = req.body;
        const qualification = new PrivateNurseRequirement({
            nurseId: nurseId,
        });
        qualification.save().then((savedQualification) => {
            console.log('Qualification saved:', savedQualification);
        }).catch((error) => {
            console.error('Error saving qualification:', error);
        });

        bcrypt.hash(nursePassword, 10).then((hash) => {
            const newNurse = new Nurse({
                nurseFirstName,
                nurseLastName,
                nurseEmail,
                nursePhone,
                nursePassword: hash,
                nurseAddress,
            });
            newNurse.save().then((savedNurse) => {
                res.status(201).json({message: "Account Created", user: savedNurse});
            })
        })
    } catch (error) {
        res.status(500).json({ message: 'Error registering nurse', error: error.message });
    }
};

// Login controller function to handle nurse login
const loginNurse = async (req, res) => {
    try {
        const {nurseEmail, nursePassword} = req.body;
        // Find the nurse by email
        const nurse = await Nurse.findOne({ nurseEmail });
        if (!nurse) {
            return res.status(404).json({ message: 'Nurse not found' });
        }
        // Check if the password matches
        const isMatch = await bcrypt.compare(nursePassword, nurse.nursePassword);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        res.status(200).json({ message: 'Login successful', user: nurse });
    }
    catch (error) {
        res.status(500).json({ message: 'Error logging in nurse', error: error.message });
    }
};

module.exports = {
    registerNurse,
    loginNurse,
};  
