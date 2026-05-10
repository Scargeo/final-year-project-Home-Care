// Simple permission middleware for owner-or-doctor access
// Accepts headers:
// - x-user-id: the authenticated user's id (patientId or doctorId)
// - x-user-role: either 'patient' or 'doctor'
// For development, set process.env.DISABLE_AUTH = 'true' to bypass checks.

module.exports.allowOwnerOrDoctor = function (getOwnerRef) {
  return (req, res, next) => {
    try {
      if (String(process.env.DISABLE_AUTH || '') === 'true') return next()
      const ownerRef = String(getOwnerRef(req) || '').trim()

      // Prefer req.user if loaded by loadUser middleware
      if (req.user && req.user.role) {
        if (req.user.role === 'doctor') return next()
        if (req.user.role === 'patient' && ownerRef && req.user.id === ownerRef) return next()
        return res.status(403).json({ message: 'Forbidden' })
      }

      // Fallback to header-based checks when req.user is not present
      const userId = String(req.get('x-user-id') || '').trim()
      const userRole = String(req.get('x-user-role') || '').trim().toLowerCase()

      if (!userRole || !userId) {
        return res.status(401).json({ message: 'Missing authentication headers' })
      }

      if (userRole === 'doctor') return next()
      if (userRole === 'patient' && ownerRef && userId === ownerRef) return next()

      return res.status(403).json({ message: 'Forbidden' })
    } catch (err) {
      console.error('Permission middleware error', err)
      return res.status(500).json({ message: 'Permission check failed' })
    }
  }
}

module.exports.allowDoctorOnly = function () {
  return (req, res, next) => {
    try {
      if (String(process.env.DISABLE_AUTH || '') === 'true') return next()

      // Prefer req.user when loadUser middleware has already resolved identity.
      if (req.user && req.user.role) {
        if (req.user.role === 'doctor') return next()
        return res.status(403).json({ message: 'Provider access only' })
      }

      // Fallback to header-based role checks when req.user is absent.
      const userRole = String(req.get('x-user-role') || '').trim().toLowerCase()
      if (!userRole) {
        return res.status(401).json({ message: 'Missing authentication headers' })
      }

      if (userRole === 'doctor') return next()
      return res.status(403).json({ message: 'Provider access only' })
    } catch (err) {
      console.error('allowDoctorOnly middleware error', err)
      return res.status(500).json({ message: 'Permission check failed' })
    }
  }
}
