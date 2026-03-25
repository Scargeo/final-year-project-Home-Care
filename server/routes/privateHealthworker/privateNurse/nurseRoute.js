const express = require('express');
const router = express.Router();

const { registerNurse, loginNurse } = require('../../../middleware/nurseController');
// Route for nurse registration
router.post('/register', registerNurse);

// Route for nurse login
router.post('/login', loginNurse);

module.exports = router;