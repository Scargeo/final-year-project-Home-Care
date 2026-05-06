import { NextResponse } from "next/server"
import { getBackendBaseUrl } from "../../../../lib/backend-url"

export async function POST(request) {
  try {
    const body = await request.json()
    
    const backendUrl = `${getBackendBaseUrl()}/api/patients/login`
    
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }
    
    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error("Patient login error:", error)
    return NextResponse.json(
      { message: "Failed to process login request" },
      { status: 500 }
    )
  }
}
