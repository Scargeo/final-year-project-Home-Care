const express = require('express');
const router = express.Router();

const { registerNurse, loginNurse } = require('../../../middleware/nurseController');
const nurseDashboardRoute = require('./nurseDashboardRoute');
// Route for nurse registration
router.post('/register', registerNurse);

// Route for nurse login
router.post('/login', loginNurse);

// Nurse dashboard and settings endpoints
router.use('/', nurseDashboardRoute);

module.exports = router;