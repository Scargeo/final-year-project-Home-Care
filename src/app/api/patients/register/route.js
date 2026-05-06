import { NextResponse } from "next/server"
import { getBackendBaseUrl } from "../../../../lib/backend-url"

export async function POST(request) {
  try {
    const body = await request.json()
    const backendUrl = `${getBackendBaseUrl()}/api/patients/register`

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error("Patient registration error:", error)
    return NextResponse.json(
      { message: "Failed to process registration request" },
      { status: 500 },
    )
  }
}