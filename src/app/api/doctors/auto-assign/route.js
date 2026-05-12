import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../lib/backend-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const backendUrl = `${getBackendBaseUrl()}/api/doctors/appointments/auto-assign`

    const forwardHeaders = { 'Content-Type': 'application/json' }
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (authHeader) forwardHeaders.authorization = authHeader

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Doctor auto-assign proxy error:', error)
    return NextResponse.json({ message: 'Failed to auto-assign appointment' }, { status: 500 })
  }
}
