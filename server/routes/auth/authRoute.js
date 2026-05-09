const express = require('express')
const router = express.Router()
const { loginUnified } = require('../../middleware/authController')

router.post('/login', loginUnified)

module.exports = router
