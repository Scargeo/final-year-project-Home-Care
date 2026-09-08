function isLocalDevelopmentRequest(req) {
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') return false

  const origin = String(req.headers.origin || req.headers.referer || '').toLowerCase()
  if (origin) {
    return origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')
  }

  const hostname = String(req.hostname || '').toLowerCase()
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

module.exports = { isLocalDevelopmentRequest }
