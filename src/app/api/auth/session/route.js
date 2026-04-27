import { NextResponse } from "next/server"
import { verifyToken } from "../../../../lib/auth-server.js"

export async function GET(request) {
  const authHeader = request.headers.get("authorization") || ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ""
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: "Invalid session." }, { status: 401 })
  return NextResponse.json({
    token,
    user: { id: payload.sub, email: payload.email, fullName: payload.fullName, role: payload.role },
  })
}
