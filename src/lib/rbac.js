import { ROLES } from "./auth-config.js"

/**
 * Central RBAC policy.
 *
 * Keep this file free of Next/server imports so it can be reused in both
 * route handlers and client UI (RBAC matrix rendering).
 */

export const PERMISSIONS = [
  "admin.users.read",
  "admin.users.write",
  "audit.read",
  "audit.write",
  "patients.read",
  "patients.write",
  "appointments.read",
  "appointments.write",
  "telehealth.use",
  "rx.read",
  "rx.write",
  "pharmacy.fulfill",
  "rider.deliveries.read",
  "rider.deliveries.write",
]

/**
 * Role -> allowed permissions.
 * - Use explicit entries (no wildcards) so the matrix is auditable.
 */
export const ROLE_PERMISSIONS = {
  admin: new Set(PERMISSIONS),
  doctor: new Set([
    "audit.write",
    "patients.read",
    "patients.write",
    "appointments.read",
    "appointments.write",
    "telehealth.use",
    "rx.read",
    "rx.write",
  ]),
  nurse: new Set(["audit.write", "patients.read", "patients.write", "appointments.read", "appointments.write", "telehealth.use", "rx.read"]),
  pharmacist: new Set(["audit.write", "rx.read", "pharmacy.fulfill", "rider.deliveries.read", "rider.deliveries.write"]),
  patient: new Set(["audit.write", "patients.read", "appointments.read", "appointments.write", "telehealth.use", "rx.read"]),
  rider: new Set(["audit.write", "rider.deliveries.read", "rider.deliveries.write"]),
}

export function getKnownRoles() {
  // Keep in sync with auth-config ROLES, but allow matrix to include all configured roles.
  return Array.isArray(ROLES) ? ROLES.slice() : Object.keys(ROLE_PERMISSIONS)
}

export function hasPermission(role, permission) {
  const r = String(role || "").toLowerCase()
  const p = String(permission || "")
  const allowed = ROLE_PERMISSIONS[r]
  return Boolean(allowed && allowed.has(p))
}

export function permissionsForRole(role) {
  const r = String(role || "").toLowerCase()
  const allowed = ROLE_PERMISSIONS[r]
  if (!allowed) return []
  return Array.from(allowed).sort()
}

