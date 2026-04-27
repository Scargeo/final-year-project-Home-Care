import * as base from "../../lib/auth-config.js"

export const ROLES = base.ROLES
export const DEFAULT_ROLE_HOME = base.DEFAULT_ROLE_HOME
export const ROLE_ALLOWED_PATHS = base.ROLE_ALLOWED_PATHS
export const isRole = base.isRole

export function getRoleHome(role) {
  return base.getRoleHome(role)
}

export function getRoleAllowedPaths(role) {
  return base.getRoleAllowedPaths(role)
}
