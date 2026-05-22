/**
 * Determines the redirect path based on user role
 * @param {string} role - The user's role ('doctor', 'nurse' or 'patient')
 * @returns {string} The redirect path
 */
export function getRoleRedirect(role) {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'doctor':
      return '/secure/doctor';
    case 'nurse':
      return '/secure/nurse';
    case 'patient':
    default:
      return '/secure/home';
  }
}

/**
 * Gets the current user role from localStorage
 * @returns {string|null} The user's role or null if not logged in
 */
export function getCurrentUserRole() {
  if (typeof window === 'undefined') return null;

  const patientAuth = localStorage.getItem('patientAuth');
  const doctorAuth = localStorage.getItem('doctorAuth');
  const nurseAuth = localStorage.getItem('nurseAuth');
  const adminAuth = localStorage.getItem('adminAuth');

  if (adminAuth) {
    try {
      const user = JSON.parse(adminAuth);
      return user.role || 'admin';
    } catch {
      return 'admin';
    }
  }

  if (patientAuth) {
    try {
      const user = JSON.parse(patientAuth);
      return user.role || 'patient';
    } catch {
      return 'patient';
    }
  }

  if (doctorAuth) {
    try {
      const user = JSON.parse(doctorAuth);
      return user.role || 'doctor';
    } catch {
      return 'doctor';
    }
  }

  if (nurseAuth) {
    try {
      const user = JSON.parse(nurseAuth);
      return user.role || 'nurse';
    } catch {
      return 'nurse';
    }
  }

  return null;
}

/**
 * Checks if user is authenticated and returns their role
 * @returns {string|null} The user's role or null if not authenticated
 */
export function getAuthenticatedUserRole() {
  return getCurrentUserRole();
}
