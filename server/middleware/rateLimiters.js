const { rateLimit, ipKeyGenerator } = require('express-rate-limit')

function identityKey(req) {
  const body = req.body || {}
  const email = body.email || body.patientEmail || body.doctorEmail || body.nurseEmail || body.adminEmail || ''
  return `${ipKeyGenerator(req)}:${String(email).trim().toLowerCase() || 'anonymous'}`
}

function createLimiter({ windowMs, max, message, keyGenerator = identityKey }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    message: { message },
  })
}

const registrationLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many registration attempts. Please try again later.',
})

const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again later.',
})

const verificationLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many verification attempts. Please try again later.',
})

const resendVerificationLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Too many resend requests. Please try again later.',
})

const aiChatLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many AI requests. Please wait a moment and try again.',
  keyGenerator: (req) => ipKeyGenerator(req),
})

const uploadLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many upload requests. Please try again later.',
})

const appointmentLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many appointment requests. Please try again later.',
})

module.exports = {
  registrationLimiter,
  loginLimiter,
  verificationLimiter,
  resendVerificationLimiter,
  aiChatLimiter,
  uploadLimiter,
  appointmentLimiter,
}
