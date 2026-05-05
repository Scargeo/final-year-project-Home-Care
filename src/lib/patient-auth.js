import { getBackendBaseUrl } from "./backend-url"

export function getPatientApiBaseUrl() {
  return getBackendBaseUrl()
}

export function buildPatientApiUrl(path) {
  return `${getPatientApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`
}