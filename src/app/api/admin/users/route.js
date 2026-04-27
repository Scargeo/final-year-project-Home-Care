import { NextResponse } from "next/server"
import { listUsersSanitized, verifyToken } from "../../../../lib/auth-server.js"

export async function GET(request) {
  const authHeader = request.headers.get("authorization") || ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ""
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  if (String(payload.role || "").toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }
  const users = await listUsersSanitized()
  return NextResponse.json({ users })
}
