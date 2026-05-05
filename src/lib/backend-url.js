const DEFAULT_BACKEND_BASE_URL = "https://home-care-ob1m.onrender.com"

function normalizeBaseUrl(value) {
  const base = String(value || "").trim().replace(/\/+$/, "")
  if (!base) return ""
  return base.replace(/\/external-api$/i, "")
}

export function getBackendBaseUrl() {
  const env = globalThis?.process?.env || {}
  const baseUrl = normalizeBaseUrl(
    env.NEXT_PUBLIC_API_BASE_URL ||
      env.NEXT_PUBLIC_SOS_SOCKET_URL ||
      env.NEXT_PUBLIC_RAG_API_BASE_URL ||
      env.BACKENDSERVER ||
      DEFAULT_BACKEND_BASE_URL,
  )

  return baseUrl || DEFAULT_BACKEND_BASE_URL
}

export function buildBackendApiUrl(path) {
  const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`
  return `${getBackendBaseUrl()}${normalizedPath}`
}
