import { NextResponse } from "next/server"
import { getBackendBaseUrl } from "../../../../lib/backend-url"

function getCandidateBaseUrls() {
  const env = globalThis?.process?.env || {}
  const candidates = [
    getBackendBaseUrl(),
    env.SOS_SERVER_URL,
    env.NEXT_PUBLIC_API_BASE_URL,
    env.BACKENDSERVER,
  ]

  return Array.from(
    new Set(
      candidates
        .map((value) => String(value || "").trim().replace(/\/+$/, "").replace(/\/external-api$/i, ""))
        .filter(Boolean),
    ),
  )
}

async function fetchFromSOSBackend(path, init = {}) {
  const baseUrls = getCandidateBaseUrls()
  let fallbackResponse = null

  for (const baseUrl of baseUrls) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        cache: "no-store",
        signal: controller.signal,
      })
      clearTimeout(timeout)

      // Continue to next candidate if this backend host responds with server errors.
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

export async function GET() {
  try {
    const response = await fetchFromSOSBackend("/api/sos")
    const data = await response.json()

    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ message: "Unable to reach SOS backend server." }, { status: 503 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const response = await fetchFromSOSBackend("/api/sos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ message: "Unable to reach SOS backend server." }, { status: 503 })
  }
}
