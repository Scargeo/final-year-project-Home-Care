import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../../../lib/backend-url'

export async function GET(request, context) {
  try {
    const params = await context?.params || {}
    const ownerRef = params?.ownerRef
    if (!ownerRef) return NextResponse.json({ message: 'Missing ownerRef' }, { status: 400 })

    const backendUrl = `${getBackendBaseUrl()}/api/uploads/owner/${encodeURIComponent(ownerRef)}`
    const forwardHeaders = {}
    const userId = request.headers.get('x-user-id')
    const userRole = request.headers.get('x-user-role')
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (userId) forwardHeaders['x-user-id'] = userId
    if (userRole) forwardHeaders['x-user-role'] = userRole
    if (authHeader) forwardHeaders['authorization'] = authHeader

    const response = await fetch(backendUrl, { method: 'GET', cache: 'no-store', headers: forwardHeaders })
    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Uploads owner proxy error:', error)
    return NextResponse.json({ message: 'Failed to fetch attachments' }, { status: 500 })
  }
}
