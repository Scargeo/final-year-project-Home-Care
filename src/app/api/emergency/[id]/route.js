import { NextResponse } from "next/server"

function normalizeBaseUrl(value) {
  const base = String(value || "").trim().replace(/\/+$/, "")
  if (!base) return ""
  return base.replace(/\/external-api$/i, "")
}

function getCandidateBaseUrls() {
  const port = process.env.BACKENDSERVER_PORT || 8000
  const candidates = [
    process.env.SOS_SERVER_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
    process.env.BACKENDSERVER,
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
  ]

  return Array.from(new Set(candidates.map(normalizeBaseUrl).filter(Boolean)))
}

async function fetchFromSOSBackend(path, init = {}) {
  const baseUrls = getCandidateBaseUrls()
  let fallbackResponse = null

  for (const baseUrl of baseUrls) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4500)
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        cache: "no-store",
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (response.status >= 500) {
        fallbackResponse = response
        continue
      }

      return response
    } catch {
      // Try the next candidate URL when this host is unreachable.
    }
  }

  if (fallbackResponse) {
    return fallbackResponse
  }

  throw new Error("SOS_BACKEND_UNREACHABLE")
}

export async function GET(_request, { params }) {
  try {
    const response = await fetchFromSOSBackend(`/api/sos/${params.id}`)
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ message: "Unable to reach SOS backend server." }, { status: 503 })
  }
}

export async function PATCH(request, { params }) {
  try {
    const body = await request.json().catch(() => ({}))
    const response = await fetchFromSOSBackend(`/api/sos/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ message: "Unable to reach SOS backend server." }, { status: 503 })
  }
}
