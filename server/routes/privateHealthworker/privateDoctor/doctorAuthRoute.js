const express = require('express');
const router = express.Router();

const { registerDoctor, loginDoctor } = require('../../../middleware/doctorController');

// Route for doctor registration
router.post('/register', registerDoctor);

// Route for doctor login
router.post('/login', loginDoctor);

module.exports = router;
