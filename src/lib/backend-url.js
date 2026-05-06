const DEFAULT_BACKEND_BASE_URL = "https://home-care-ob1m.onrender.com"
const LOCAL_BACKEND_BASE_URL = "http://localhost:8000"

function normalizeBaseUrl(value) {
  const base = String(value || "").trim().replace(/\/+$/, "")
  if (!base) return ""
  return base.replace(/\/external-api$/i, "")
}

export function getBackendBaseUrl() {
  const env = globalThis?.process?.env || {}
  const publicBaseUrl = normalizeBaseUrl(env.NEXT_PUBLIC_API_BASE_URL)

  if (publicBaseUrl) {
    return publicBaseUrl
  }

  const isProduction = String(env.NODE_ENV || "").toLowerCase() === "production"
  if (!isProduction) {
    return LOCAL_BACKEND_BASE_URL
  }

  return DEFAULT_BACKEND_BASE_URL
}

export function buildBackendApiUrl(path) {
  const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`
  return `${getBackendBaseUrl()}${normalizedPath}`
}
