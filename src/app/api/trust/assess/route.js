import { NextResponse } from "next/server"
import { assessProfileTrust } from "../../../../lib/profileTrust.js"

export async function POST(request) {
  try {
    const body = await request.json()
    const email = String(body?.email || "")
    const fullName = String(body?.fullName || "")
    const role = String(body?.role || "")
    const result = assessProfileTrust({ email, fullName, role })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
}
