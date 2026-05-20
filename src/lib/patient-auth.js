import { getBackendBaseUrl } from "./backend-url"

export function getPatientApiBaseUrl() {
  return getBackendBaseUrl()
}

export function getStoredToken() {
  if (typeof window === "undefined") return null

  try {
    const patientAuth = window.localStorage.getItem("patientAuth")
    const doctorAuth = window.localStorage.getItem("doctorAuth")
    const parsed = patientAuth ? JSON.parse(patientAuth) : doctorAuth ? JSON.parse(doctorAuth) : null
    return parsed?.token || parsed?.accessToken || null
  } catch {
    return null
  }
}

export function buildPatientApiUrl(path) {
  return `${getPatientApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`
}