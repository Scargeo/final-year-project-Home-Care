import { NextResponse } from "next/server"
import { loginUser } from "../../../../lib/auth-server.js"

export async function POST(request) {
  try {
    const body = await request.json()
    const email = String(body?.email || "")
    const password = String(body?.password || "")
    const data = await loginUser({ email, password })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to sign in." }, { status: 401 })
  }
}
