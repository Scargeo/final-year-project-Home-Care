import { NextResponse } from "next/server"
import { getBackendBaseUrl } from "../../../../../lib/backend-url"

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
    const { id } = await params
    const response = await fetchFromSOSBackend(`/api/sos/${id}`)
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ message: "Unable to reach SOS backend server." }, { status: 503 })
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const response = await fetchFromSOSBackend(`/api/sos/${id}`, {
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
