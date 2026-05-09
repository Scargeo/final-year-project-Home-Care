import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../lib/backend-url'

export async function DELETE(_request, { params: paramsPromise }) {
  try {
    const params = await paramsPromise
    const backendUrl = `${getBackendBaseUrl()}/api/uploads/${params.id}`

    const forwardHeaders = {}
    const userId = _request.headers.get('x-user-id')
    const userRole = _request.headers.get('x-user-role')
    const authHeader = _request.headers.get('authorization') || _request.headers.get('Authorization')
    if (userId) forwardHeaders['x-user-id'] = userId
    if (userRole) forwardHeaders['x-user-role'] = userRole
    if (authHeader) forwardHeaders['authorization'] = authHeader

    const response = await fetch(backendUrl, {
      method: 'DELETE',
      headers: forwardHeaders,
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Uploads delete proxy error:', error)
    return NextResponse.json({ message: 'Failed to remove file' }, { status: 500 })
  }
}