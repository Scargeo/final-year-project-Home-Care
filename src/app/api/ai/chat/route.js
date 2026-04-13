import { NextResponse } from "next/server"

export const runtime = "nodejs"

const env = globalThis?.process?.env || {}

function normalizeBaseUrl(value) {
  const base = String(value || "").trim().replace(/\/+$/, "")
  if (!base) return ""
  return base.replace(/\/external-api$/i, "")
}

function getCandidateBaseUrls() {
  const port = env.BACKENDSERVER_PORT || 8000
  const candidates = [
    env.NEXT_PUBLIC_RAG_API_BASE_URL,
    env.NEXT_PUBLIC_API_BASE_URL,
    env.BACKENDSERVER,
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
  ]

  return Array.from(new Set(candidates.map(normalizeBaseUrl).filter(Boolean)))
}

async function fetchFromAIBackend(path, init = {}) {
  const baseUrls = getCandidateBaseUrls()
  let fallbackResponse = null
  let lastError = null

  for (const baseUrl of baseUrls) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const response = await fetch(new URL(path, `${baseUrl}/`).toString(), {
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
    } catch (error) {
      lastError = error
      // Try next candidate when this host is unreachable.
    }
  }

  if (fallbackResponse) {
    return fallbackResponse
  }

  const unreachableError = new Error("AI_BACKEND_UNREACHABLE")
  unreachableError.details = lastError?.message || "No reachable AI backend host"
  unreachableError.candidates = baseUrls
  throw unreachableError
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const response = await fetchFromAIBackend("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const data = await response.json().catch(() => ({ error: "Invalid AI backend response." }))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to reach AI backend server.",
        details: error?.details || error?.message || "Unknown error",
        candidates: error?.candidates || getCandidateBaseUrls(),
      },
      { status: 503 }
    )
  }
}
