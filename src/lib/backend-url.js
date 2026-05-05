const DEFAULT_BACKEND_BASE_URL = "https://home-care-ob1m.onrender.com"
const LOCAL_BACKEND_BASE_URL = "http://localhost:8000"

function normalizeBaseUrl(value) {
  const base = String(value || "").trim().replace(/\/+$/, "")
  if (!base) return ""
  return base.replace(/\/external-api$/i, "")
}

export function getBackendBaseUrl() {
  const env = globalThis?.process?.env || {}
  const isProduction = String(env.NODE_ENV || "").toLowerCase() === "production"

  const candidates = isProduction
    ? [
        env.NEXT_PUBLIC_API_BASE_URL,
        env.NEXT_PUBLIC_SOS_SOCKET_URL,
        env.NEXT_PUBLIC_RAG_API_BASE_URL,
        env.BACKENDSERVER,
        DEFAULT_BACKEND_BASE_URL,
      ]
    : [
        env.LOCAL_BACKEND_URL,
        LOCAL_BACKEND_BASE_URL,
        env.NEXT_PUBLIC_API_BASE_URL,
        env.NEXT_PUBLIC_SOS_SOCKET_URL,
        env.NEXT_PUBLIC_RAG_API_BASE_URL,
        env.BACKENDSERVER,
        DEFAULT_BACKEND_BASE_URL,
      ]

  for (const candidate of candidates) {
    const baseUrl = normalizeBaseUrl(candidate)
    if (baseUrl) return baseUrl
  }

  return DEFAULT_BACKEND_BASE_URL
}

export function buildBackendApiUrl(path) {
  const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`
  return `${getBackendBaseUrl()}${normalizedPath}`
}
