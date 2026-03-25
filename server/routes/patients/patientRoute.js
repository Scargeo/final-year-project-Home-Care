const express = require('express');
const router = express.Router();

const { registerPatient, loginPatient } = require('../../middleware/patientController');

// Route for patient registration
router.post('/register', registerPatient);

// Route for patient login
router.post('/login', loginPatient);

module.exports = router;