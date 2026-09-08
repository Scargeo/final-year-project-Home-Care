const express = require('express');
const router = express.Router();

const { registerDoctor, loginDoctor } = require('../../../middleware/doctorController');
const { registrationLimiter, loginLimiter } = require('../../../middleware/rateLimiters')

// Route for doctor registration
router.post('/register', registrationLimiter, registerDoctor);

// Route for doctor login
router.post('/login', loginLimiter, loginDoctor);

module.exports = router;
