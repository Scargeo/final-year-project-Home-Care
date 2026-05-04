export function getPatientApiBaseUrl() {
  const env = globalThis?.process?.env || {}
  const baseUrl = String(env.NEXT_PUBLIC_API_BASE_URL || env.BACKENDSERVER || "").trim().replace(/\/+$/, "")

  if (baseUrl) return baseUrl

  if (typeof window === "undefined") return "http://localhost:8000"

  const protocol = window.location.protocol === "https:" ? "https:" : "http:"
  return `${protocol}//${window.location.hostname}:8000`
}

export function buildPatientApiUrl(path) {
  return `${getPatientApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`
}