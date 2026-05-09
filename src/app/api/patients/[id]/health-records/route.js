import { NextResponse } from "next/server"
import { getBackendBaseUrl } from "../../../../../lib/backend-url"

async function proxyHealthRecords(request, id, method) {
  const backendUrl = `${getBackendBaseUrl()}/api/patients/${encodeURIComponent(id)}/health-records`
  const init = {
    method,
    cache: "no-store",
    headers: {},
  }

  if (method !== "GET") {
    const body = await request.json().catch(() => ({}))
    init.headers = { "Content-Type": "application/json" }
    init.body = JSON.stringify(body)
  }
  // Forward simple auth headers for permission checks
  const userId = request.headers.get('x-user-id')
  const userRole = request.headers.get('x-user-role')
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  if (userId) init.headers['x-user-id'] = userId
  if (userRole) init.headers['x-user-role'] = userRole
  if (authHeader) init.headers['authorization'] = authHeader

  const response = await fetch(backendUrl, init)
  const data = await response.json().catch(() => ({}))
  return NextResponse.json(data, { status: response.status })
}

export async function GET(request, context) {
  try {
    const params = await context?.params
    const id = params?.id
    if (!id) {
      return NextResponse.json({ message: "Missing id" }, { status: 400 })
    }

    return proxyHealthRecords(request, id, "GET")
  } catch (error) {
    console.error("Health records proxy GET error:", error)
    return NextResponse.json({ message: "Failed to fetch health records" }, { status: 500 })
  }
}

export async function PUT(request, context) {
  try {
    const params = await context?.params
    const id = params?.id
    if (!id) {
      return NextResponse.json({ message: "Missing id" }, { status: 400 })
    }

    return proxyHealthRecords(request, id, "PUT")
  } catch (error) {
    console.error("Health records proxy PUT error:", error)
    return NextResponse.json({ message: "Failed to save health records" }, { status: 500 })
  }
}