export const ROLES = ["doctor", "nurse", "pharmacist", "patient", "rider", "admin"]

export const DEFAULT_ROLE_HOME = {
  doctor: "/marketplace",
  nurse: "/appointments",
  pharmacist: "/pharmacies",
  patient: "/patients",
  rider: "/rider",
  admin: "/admin",
}

export const ROLE_ALLOWED_PATHS = {
  doctor: [
    "/doctors",
    "/patients",
    "/appointments",
    "/telehealth",
    "/secure/chat",
    "/reports",
    "/medical-imaging",
    "/marketplace",
    "/notifications",
    "/ai-assistant",
    "/sos",
  ],
  nurse: [
    "/appointments",
    "/patients",
    "/telehealth",
    "/secure/chat",
    "/reports",
    "/medical-imaging",
    "/marketplace",
    "/notifications",
    "/ai-assistant",
    "/sos",
  ],
  pharmacist: ["/pharmacies", "/secure/chat", "/rider", "/reports", "/notifications"],
  patient: [
    "/patients",
    "/appointments",
    "/billing",
    "/family",
    "/secure/chat",
    "/telehealth",
    "/notifications",
    "/sos",
    "/marketplace",
    "/ai-assistant",
    "/medical-imaging",
  ],
  rider: ["/rider", "/pharmacies", "/secure/chat", "/notifications", "/sos"],
  admin: [
    "/admin",
    "/dashboard",
    "/reports",
    "/integrations",
    "/community",
    "/secure/chat",
    "/notifications",
    "/sos",
    "/marketplace",
    "/medical-imaging",
    "/ai-assistant",
    "/doctors",
    "/patients",
    "/appointments",
    "/telehealth",
    "/pharmacies",
    "/billing",
    "/family",
    "/rider",
  ],
}

export function isRole(value) {
  return ROLES.includes(value)
}

export function getRoleHome(role) {
  return DEFAULT_ROLE_HOME[role] || "/dashboard"
}

export function getRoleAllowedPaths(role) {
  return ROLE_ALLOWED_PATHS[role] || ["/dashboard"]
}
