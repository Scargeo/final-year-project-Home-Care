const express = require('express')
const router = express.Router()
const { loginUnified } = require('../../middleware/authController')
const { verifyPatientEmail, resendVerificationCode } = require('../../middleware/patientController')
const rateLimit = require('express-rate-limit')

const { verifyRefreshToken, signRefreshToken, signToken, revokeRefreshToken } = require('../../middleware/jwtAuth')

router.post('/login', loginUnified)

router.post('/verify-email', verifyPatientEmail)

const resendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many resend requests. Please try again later.' },
})

router.post('/resend-verification-code', resendOtpLimiter, resendVerificationCode)

// Refresh token rotation with device binding and reuse detection
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {}
    if (!refreshToken) return res.status(400).json({ message: 'refreshToken is required' })

    const payload = await verifyRefreshToken(refreshToken)
    if (!payload) return res.status(401).json({ message: 'Invalid refresh token' })

    // create a new access token and rotate refresh token
    const access = signToken({ id: payload.userId, role: payload.role })
    const newRefresh = await signRefreshToken(payload)
    // revoke old refresh token
    await revokeRefreshToken(refreshToken)

    return res.status(200).json({ token: access, refreshToken: newRefresh })
  } catch {
    return res.status(500).json({ message: 'Failed to refresh token' })
  }
})

router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body || {}
    if (refreshToken) await revokeRefreshToken(refreshToken)
    return res.status(200).json({ message: 'Logged out' })
  } catch {
    return res.status(500).json({ message: 'Logout failed' })
  }
})

module.exports = router
