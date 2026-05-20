import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../lib/backend-url'

function getForwardHeaders(request, includeJson = false) {
  const headers = {}
  if (includeJson) headers['Content-Type'] = 'application/json'

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  const userId = request.headers.get('x-user-id')
  const userRole = request.headers.get('x-user-role')

  if (authHeader) headers.authorization = authHeader
  if (userId) headers['x-user-id'] = userId
  if (userRole) headers['x-user-role'] = userRole

  return headers
}

export async function GET(request, context) {
  try {
    const params = await context?.params
    const roomId = params?.roomId
    if (!roomId) return NextResponse.json({ message: 'Missing room id' }, { status: 400 })

    const response = await fetch(`${getBackendBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}`, {
      method: 'GET',
      cache: 'no-store',
      headers: getForwardHeaders(request),
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Rooms proxy GET error:', error)
    return NextResponse.json({ message: 'Failed to fetch room' }, { status: 500 })
  }
}

export async function PATCH(request, context) {
  try {
    const params = await context?.params
    const roomId = params?.roomId
    if (!roomId) return NextResponse.json({ message: 'Missing room id' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const response = await fetch(`${getBackendBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}`, {
      method: 'PATCH',
      cache: 'no-store',
      headers: getForwardHeaders(request, true),
      body: JSON.stringify(body),
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Rooms proxy PATCH error:', error)
    return NextResponse.json({ message: 'Failed to update room' }, { status: 500 })
  }
}
