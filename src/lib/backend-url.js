const DEFAULT_BACKEND_BASE_URL = "https://home-care-ob1m.onrender.com"
const LOCAL_BACKEND_BASE_URL = "http://localhost:8000"

function isLocalhostBaseUrl(value) {
  const normalizedValue = String(value || "").toLowerCase()
  return normalizedValue.includes("localhost") || normalizedValue.includes("127.0.0.1")
}

function isLocalBrowserHost() {
  if (typeof window === "undefined") return false
  const browserHost = String(window.location?.hostname || "").toLowerCase()
  return browserHost === "localhost" || browserHost === "127.0.0.1"
}

function normalizeBaseUrl(value) {
  const base = String(value || "").trim().replace(/\/+$/, "")
  if (!base) return ""
  return base.replace(/\/external-api$/i, "")
}

export function getBackendBaseUrl() {
  const env = globalThis?.process?.env || {}
  const isProduction = String(env.NODE_ENV || "").toLowerCase() === "production"
  const publicBaseUrl = normalizeBaseUrl(env.NEXT_PUBLIC_API_BASE_URL)
  const isLocalBrowser = isLocalBrowserHost()

  if (publicBaseUrl) {
    if (!isLocalhostBaseUrl(publicBaseUrl)) {
      return publicBaseUrl
    }

    if (isLocalBrowser || !isProduction) {
      return publicBaseUrl
    }
  }

  // During server-side development (local dev), prefer the local backend
  // so `next dev` and API routes proxy to a developer-run backend at localhost:8000.
  if (!isProduction) {
    return LOCAL_BACKEND_BASE_URL
  }

  // If browser is not localhost (e.g., deployed on Vercel), always use production backend
  if (!isLocalBrowser) {
    return DEFAULT_BACKEND_BASE_URL
  }

  return DEFAULT_BACKEND_BASE_URL
}

export function buildBackendApiUrl(path) {
  const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`
  return `${getBackendBaseUrl()}${normalizedPath}`
}
