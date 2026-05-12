import { NextResponse } from "next/server"
import { getBackendBaseUrl } from "../../../../../lib/backend-url"

async function proxyConsentRequests(request, id, method) {
  const backendUrl = `${getBackendBaseUrl()}/api/patients/${encodeURIComponent(id)}/consent-requests`
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

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  const userId = request.headers.get('x-user-id')
  const userRole = request.headers.get('x-user-role')
  if (authHeader) init.headers['authorization'] = authHeader
  if (userId) init.headers['x-user-id'] = userId
  if (userRole) init.headers['x-user-role'] = userRole

  const response = await fetch(backendUrl, init)
  const data = await response.json().catch(() => ({}))
  return NextResponse.json(data, { status: response.status })
}

export async function GET(request, context) {
  try {
    const params = await context?.params
    const id = params?.id
    if (!id) return NextResponse.json({ message: 'Missing id' }, { status: 400 })
    return proxyConsentRequests(request, id, 'GET')
  } catch (err) {
    console.error('Consent requests proxy GET error:', err)
    return NextResponse.json({ message: 'Failed' }, { status: 500 })
  }
}

export async function POST(request, context) {
  try {
    const params = await context?.params
    const id = params?.id
    if (!id) return NextResponse.json({ message: 'Missing id' }, { status: 400 })
    return proxyConsentRequests(request, id, 'POST')
  } catch (err) {
    console.error('Consent requests proxy POST error:', err)
    return NextResponse.json({ message: 'Failed' }, { status: 500 })
  }
}
