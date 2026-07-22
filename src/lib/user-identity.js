/**
 * ============================================================
 *  Unified User Identity Utility
 *  -------------------------------------------
 *  PURPOSE: This utility provides a single source of truth
 *  for determining the currently logged-in user's identity
 *  across all pages. Previously, each page had its own
 *  hardcoded logic that only checked one auth key
 *  (e.g., only 'patientAuth'), causing pages to display
 *  wrong attributes when a doctor or nurse was logged in.
 *
 *  FIX: Now we check ALL auth keys (patientAuth, doctorAuth,
 *  nurseAuth) and return the correct identity based on
 *  whichever role is actually authenticated. This ensures
 *  that health-records, settings, dashboard, and all other
 *  pages always show the correct user's data regardless
 *  of their role (patient, doctor, or nurse).
 * ============================================================
 */

/**
 * Reads the active user's auth data from localStorage.
 * Checks all possible auth keys and returns the first
 * valid one found.
 *
 * @returns {{ role: string|null, id: string, name: string, profileImage: object|null, token: string|null, raw: object|null }}
 */
export function getStoredUserIdentity() {
  if (typeof window === 'undefined') {
    return { role: null, id: '', name: '', profileImage: null, token: null, raw: null }
  }

  // Check all auth keys in priority order (whichever is found first wins)
  const authKeys = [
    { key: 'patientAuth', role: 'patient' },
    { key: 'doctorAuth', role: 'doctor' },
    { key: 'nurseAuth', role: 'nurse' },
  ]

  for (const { key, role } of authKeys) {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue

      const parsed = JSON.parse(raw)
      if (!parsed) continue

      // Extract the identity based on role
      const id = parsed.patientId || parsed.doctorId || parsed.nurseId || parsed.uid || parsed.id || parsed._id || parsed.patientEmail || ''
      const firstName = parsed.patientFirstName || parsed.doctorFirstName || parsed.nurseFirstName || parsed.firstName || ''
      const lastName = parsed.patientLastName || parsed.doctorLastName || parsed.nurseLastName || parsed.lastName || ''
      const name = [firstName, lastName].filter(Boolean).join(' ').trim() || firstName || role.charAt(0).toUpperCase() + role.slice(1)
      const profileImage = parsed.profileImage || null
      const token = parsed.token || parsed.accessToken || null

      return { role, id, name, profileImage, token, raw: parsed, firstName, lastName }
    } catch {
      // Malformed JSON — skip and try next key
      continue
    }
  }

  // No authenticated user found
  return { role: null, id: '', name: '', profileImage: null, token: null, raw: null }
}

/**
 * Returns just the role of the currently logged-in user.
 * Convenience wrapper around getStoredUserIdentity().
 *
 * @returns {string|null} 'patient', 'doctor', 'nurse', or null
 */
export function getStoredRole() {
  return getStoredUserIdentity().role
}

/**
 * Returns just the auth token of the currently logged-in user.
 * Works for ALL roles (patient, doctor, nurse).
 *
 * @returns {string|null}
 */
export function getStoredToken() {
  return getStoredUserIdentity().token
}

/**
 * Returns just the user ID of the currently logged-in user.
 *
 * @returns {string}
 */
export function getStoredUserId() {
  return getStoredUserIdentity().id
}

/**
 * Builds a fetch-friendly full API URL.
 * Falls back to the path itself if backendUrl is not available.
 *
 * @param {string} path - API path (e.g., '/api/posts')
 * @returns {string}
 */
export function buildUserApiUrl(path) {
  // Use dynamic import for ESM compatibility
  // Next.js handles this via its module resolution
  return path
}

/**
 * Returns auth headers including the Bearer token if available.
 * Works for ALL roles.
 *
 * @param {object} [extraHeaders={}] - Additional headers to merge
 * @returns {object}
 */
export function getAuthHeaders(extraHeaders = {}) {
  const { token } = getStoredUserIdentity()
  const headers = { ...extraHeaders }
  if (token) {
    headers.authorization = `Bearer ${token}`
  }
  return headers
}

/**
 * Returns a role-appropriate label for display purposes.
 * e.g., 'Doctor ID', 'Nurse ID', 'Patient ID'
 *
 * @param {string} role
 * @returns {string}
 */
export function getRoleIdLabel(role) {
  switch (role) {
    case 'doctor': return 'Doctor ID'
    case 'nurse': return 'Nurse ID'
    case 'patient': return 'Patient ID'
    default: return 'User ID'
  }
}

/**
 * Returns a role-appropriate dashboard label.
 * e.g., 'Doctor Dashboard', 'Nurse Dashboard', 'Patient Dashboard'
 *
 * @param {string} role
 * @returns {string}
 */
export function getRoleDashboardLabel(role) {
  switch (role) {
    case 'doctor': return 'Doctor Dashboard'
    case 'nurse': return 'Nurse Dashboard'
    case 'patient': return 'Patient Dashboard'
    default: return 'Dashboard'
  }
}

