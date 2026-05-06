const DEFAULT_BACKEND_BASE_URL = "https://home-care-ob1m.onrender.com"
const LOCAL_BACKEND_BASE_URL = "http://localhost:8000"
const LOCAL_SOCKET_BASE_URL = "http://localhost:3003"

function normalizeBaseUrl(value) {
  const base = String(value || "").trim().replace(/\/+$/, "")
  if (!base) return ""
  return base.replace(/\/external-api$/i, "")
}

export function getBackendBaseUrl() {
  const env = globalThis?.process?.env || {}
  const publicBaseUrl = normalizeBaseUrl(env.NEXT_PUBLIC_API_BASE_URL)
  const localBaseUrl = normalizeBaseUrl(env.LOCAL_BACKEND_URL)
  const isProduction = String(env.NODE_ENV || "").toLowerCase() === "production"

  if (isProduction) {
    if (publicBaseUrl && !publicBaseUrl.includes("localhost") && !publicBaseUrl.includes("127.0.0.1")) {
      return publicBaseUrl
    }
    return DEFAULT_BACKEND_BASE_URL
  }

  if (localBaseUrl) {
    return localBaseUrl
  }

  if (publicBaseUrl) {
    return publicBaseUrl
  }

  return LOCAL_BACKEND_BASE_URL
}

export function getSocketBaseUrl() {
  const env = globalThis?.process?.env || {}
  const publicSocketUrl = normalizeBaseUrl(env.NEXT_PUBLIC_SOS_SOCKET_URL)
  const localSocketUrl = normalizeBaseUrl(env.LOCAL_SOS_SOCKET_URL)
  const isProduction = String(env.NODE_ENV || "").toLowerCase() === "production"

  if (isProduction) {
    if (publicSocketUrl && !publicSocketUrl.includes("localhost") && !publicSocketUrl.includes("127.0.0.1")) {
      return publicSocketUrl
    }
    return DEFAULT_BACKEND_BASE_URL
  }

  if (localSocketUrl) {
    return localSocketUrl
  }

  if (publicSocketUrl) {
    return publicSocketUrl
  }

  return LOCAL_SOCKET_BASE_URL
}

export function buildBackendApiUrl(path) {
  const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`
  return `${getBackendBaseUrl()}${normalizedPath}`
}
