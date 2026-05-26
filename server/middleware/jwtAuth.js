const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const DEFAULT_EXPIRY = process.env.JWT_EXPIRES_IN || '7d'
const DEFAULT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN || '30d'
const RefreshToken = require('../models/token/refreshToken')
const crypto = require('crypto')

// Fail fast in production if a real secret is not provided
if (String(process.env.NODE_ENV || '').toLowerCase() === 'production' && JWT_SECRET === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production environment')
}

function signToken(payload, opts = {}) {
  const toSign = typeof payload === 'object' ? payload : { id: payload }
  return jwt.sign(toSign, JWT_SECRET, { expiresIn: opts.expiresIn || DEFAULT_EXPIRY })
}

async function signRefreshToken(payload, opts = {}) {
  // create a strong random token string rather than a JWT for refresh tokens
  const token = crypto.randomBytes(48).toString('hex')
  const expiresIn = opts.expiresIn || DEFAULT_REFRESH_EXPIRY
  const expiresAt = new Date(Date.now() + parseExpiryToMs(expiresIn))

  const doc = new RefreshToken({ token, userId: String(payload.id || payload.userId || payload.adminId), role: payload.role || 'user', expiresAt })
  await doc.save()
  return token
}

function parseExpiryToMs(expiry) {
  // support simple formats: number in ms, or '7d', '30d', '1h'
  if (typeof expiry === 'number') return expiry
  if (/^\d+$/.test(String(expiry))) return Number(expiry)
  const m = String(expiry).match(/^(\d+)([smhdw])$/)
  if (!m) return 0
  const n = Number(m[1])
  const unit = m[2]
  switch (unit) {
    case 's': return n * 1000
    case 'm': return n * 60 * 1000
    case 'h': return n * 60 * 60 * 1000
    case 'd': return n * 24 * 60 * 60 * 1000
    case 'w': return n * 7 * 24 * 60 * 60 * 1000
    default: return 0
  }
}

function verifyToken(token) {
  try {
    if (!token) return null
    const trimmed = String(token).replace(/^Bearer\s+/i, '').trim()
    return jwt.verify(trimmed, JWT_SECRET)
  } catch {
    return null
  }
}

async function verifyRefreshToken(token) {
  try {
    if (!token) return null
    const doc = await RefreshToken.findOne({ token }).lean()
    if (!doc) return null
    if (new Date(doc.expiresAt) < new Date()) return null
    return { userId: doc.userId, role: doc.role }
  } catch {
    return null
  }
}

async function revokeRefreshToken(token) {
  try {
    await RefreshToken.deleteOne({ token })
  } catch {
    // ignore
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

module.exports = { signToken, verifyToken, authenticateToken, signRefreshToken, verifyRefreshToken, revokeRefreshToken }
