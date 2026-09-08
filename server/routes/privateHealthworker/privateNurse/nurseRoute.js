const express = require('express');
const router = express.Router();

const { registerNurse, loginNurse } = require('../../../middleware/nurseController');
const nurseDashboardRoute = require('./nurseDashboardRoute');
const { registrationLimiter, loginLimiter } = require('../../../middleware/rateLimiters')
// Route for nurse registration
router.post('/register', registrationLimiter, registerNurse);

// Route for nurse login
router.post('/login', loginLimiter, loginNurse);

// Nurse dashboard and settings endpoints
router.use('/', nurseDashboardRoute);

module.exports = router;