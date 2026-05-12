const express = require('express')
const router = express.Router()
const { loginUnified } = require('../../middleware/authController')

const { verifyRefreshToken, signRefreshToken, signToken, revokeRefreshToken } = require('../../middleware/jwtAuth')

router.post('/login', loginUnified)

router.post('/refresh', async (req, res) => {
	try {
		const { refreshToken } = req.body || {}
		if (!refreshToken) return res.status(400).json({ message: 'refreshToken is required' })

		const payload = await verifyRefreshToken(refreshToken)
		if (!payload) return res.status(401).json({ message: 'Invalid refresh token' })

		// create a new access token and rotate refresh token
		const access = signToken({ id: payload.userId, role: payload.role })
		const newRefresh = await signRefreshToken({ id: payload.userId, role: payload.role })
		// revoke old refresh token
		await revokeRefreshToken(refreshToken)

		return res.status(200).json({ token: access, refreshToken: newRefresh })
	} catch (err) {
		return res.status(500).json({ message: 'Failed to refresh token', error: err.message })
	}
})

router.post('/logout', async (req, res) => {
	try {
		const { refreshToken } = req.body || {}
		if (refreshToken) await revokeRefreshToken(refreshToken)
		return res.status(200).json({ message: 'Logged out' })
	} catch (err) {
		return res.status(500).json({ message: 'Logout failed', error: err.message })
	}

})

module.exports = router
