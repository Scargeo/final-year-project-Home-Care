import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../lib/backend-url'

export async function POST(request) {
  try {
    const backendUrl = `${getBackendBaseUrl()}/api/uploads`

    // Read the request body (it's a ReadableStream)
    const body = await request.arrayBuffer()

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'content-type': request.headers.get('content-type') || 'multipart/form-data' },
      body,
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Uploads proxy error:', error)
    return NextResponse.json({ message: 'Failed to upload files' }, { status: 500 })
  }
}
