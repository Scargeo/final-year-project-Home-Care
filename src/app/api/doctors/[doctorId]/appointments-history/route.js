import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../../lib/backend-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request, context) {
  try {
    const params = await context?.params || {}
    const doctorId = params?.doctorId

    if (!doctorId) {
      return NextResponse.json({ message: 'Missing doctorId' }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams.toString()
    const backendUrl = `${getBackendBaseUrl()}/api/doctors/${encodeURIComponent(doctorId)}/appointments-history${searchParams ? `?${searchParams}` : ''}`

    const forwardHeaders = {}
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (authHeader) forwardHeaders.authorization = authHeader

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: forwardHeaders,
      cache: 'no-store',
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Doctor appointment history proxy error:', error)
    return NextResponse.json({ message: 'Failed to fetch appointment history' }, { status: 500 })
  }
}
