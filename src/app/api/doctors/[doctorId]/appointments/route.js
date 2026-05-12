import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../../lib/backend-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request, context) {
  try {
    const params = await context?.params || {}
    const doctorId = params?.doctorId

    if (!doctorId) {
      return NextResponse.json({ message: 'Missing doctorId' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const backendUrl = `${getBackendBaseUrl()}/api/doctors/${encodeURIComponent(doctorId)}/appointments`

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
    console.error('Doctor appointment create proxy error:', error)
    return NextResponse.json({ message: 'Failed to create appointment' }, { status: 500 })
  }
}