import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../lib/backend-url'

export async function POST(request) {
  try {
    const backendUrl = `${getBackendBaseUrl()}/api/uploads`

    // Read the request body (it's a ReadableStream)
    const body = await request.arrayBuffer()

    const forwardHeaders = { 'content-type': request.headers.get('content-type') || 'multipart/form-data' }
    const userId = request.headers.get('x-user-id')
    const userRole = request.headers.get('x-user-role')
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (userId) forwardHeaders['x-user-id'] = userId
    if (userRole) forwardHeaders['x-user-role'] = userRole
    if (authHeader) forwardHeaders['authorization'] = authHeader

    let response
    try {
      response = await fetch(backendUrl, { method: 'POST', headers: forwardHeaders, body })
    } catch (err) {
      console.error('Uploads proxy network error when calling backend:', backendUrl, err?.code || err.message)
      return NextResponse.json({ message: `Failed to connect to backend at ${backendUrl}: ${err?.code || err.message}` }, { status: 502 })
    }

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Uploads proxy error:', error)
    return NextResponse.json({ message: 'Failed to upload files' }, { status: 500 })
  }
}
