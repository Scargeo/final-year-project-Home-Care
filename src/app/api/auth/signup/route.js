import { NextResponse } from "next/server"
import { registerUser } from "../../../../lib/auth-server.js"

export async function POST(request) {
  try {
    const body = await request.json()
    const fullName = String(body?.fullName || "")
    const email = String(body?.email || "")
    const password = String(body?.password || "")
    const role = String(body?.role || "")
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }
    const data = await registerUser({ fullName, email, password, role })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to create account." }, { status: 400 })
  }
}
