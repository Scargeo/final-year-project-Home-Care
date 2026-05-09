const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const DEFAULT_EXPIRY = process.env.JWT_EXPIRES_IN || '7d'

function signToken(payload, opts = {}) {
  const toSign = typeof payload === 'object' ? payload : { id: payload }
  return jwt.sign(toSign, JWT_SECRET, { expiresIn: opts.expiresIn || DEFAULT_EXPIRY })
}

function verifyToken(token) {
  try {
    if (!token) return null
    const trimmed = String(token).replace(/^Bearer\s+/i, '').trim()
    return jwt.verify(trimmed, JWT_SECRET)
  } catch (err) {
    return null
  }
}

function authenticateToken(req, res, next) {
  try {
    if (String(process.env.DISABLE_AUTH || '') === 'true') return next()
    const authHeader = req.get('authorization') || req.get('Authorization') || ''
    if (!authHeader) return next()
    const payload = verifyToken(authHeader)
    if (!payload) return next()
    // attach minimal token payload to req.tokenUser
    req.tokenUser = payload
    return next()
  } catch (err) {
    console.error('authenticateToken error', err)
    return next()
  }
}

module.exports = { signToken, verifyToken, authenticateToken }
