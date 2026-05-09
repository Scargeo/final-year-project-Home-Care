import { NextResponse } from "next/server"
import { getBackendBaseUrl } from "../../../../../lib/backend-url"

export async function PATCH(request, context) {
  try {
    const body = await request.json().catch(() => ({}))
    const params = await context?.params
    const id = params?.id
    if (!id) return NextResponse.json({ message: 'Missing id' }, { status: 400 })

    const backendUrl = `${getBackendBaseUrl()}/api/patients/${encodeURIComponent(id)}/status`

    const forwardHeaders = { 'Content-Type': 'application/json' }
    const userId = request.headers.get('x-user-id')
    const userRole = request.headers.get('x-user-role')
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (userId) forwardHeaders['x-user-id'] = userId
    if (userRole) forwardHeaders['x-user-role'] = userRole
    if (authHeader) forwardHeaders['authorization'] = authHeader

    const response = await fetch(backendUrl, {
      method: 'PATCH',
      headers: forwardHeaders,
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Patient status proxy error:', error)
    return NextResponse.json({ message: 'Failed to update status' }, { status: 500 })
  }
}
