import { NextResponse } from "next/server"
import { getBackendBaseUrl } from "../../../../../../lib/backend-url"

async function proxyConsentRequestPatch(request, id, requestId) {
  const backendUrl = `${getBackendBaseUrl()}/api/patients/${encodeURIComponent(id)}/consent-requests/${encodeURIComponent(requestId)}`
  const init = { method: 'PATCH', cache: 'no-store', headers: {} }
  const body = await request.json().catch(() => ({}))
  init.headers = { 'Content-Type': 'application/json' }
  init.body = JSON.stringify(body)

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

export async function PATCH(request, context) {
  try {
    const params = await context?.params
    const id = params?.id
    const requestId = params?.requestId
    if (!id || !requestId) return NextResponse.json({ message: 'Missing params' }, { status: 400 })
    return proxyConsentRequestPatch(request, id, requestId)
  } catch (err) {
    console.error('Consent request patch proxy error:', err)
    return NextResponse.json({ message: 'Failed' }, { status: 500 })
  }
}
