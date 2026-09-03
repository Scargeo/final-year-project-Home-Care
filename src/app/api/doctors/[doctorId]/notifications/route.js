import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../../lib/backend-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request, context) {
  try {
    const params = await context?.params || {}
    const doctorId = params?.doctorId
    if (!doctorId) return NextResponse.json({ message: 'Missing doctorId' }, { status: 400 })

    const query = request.nextUrl.searchParams.toString()
    const backendUrl = `${getBackendBaseUrl()}/api/doctors/${encodeURIComponent(doctorId)}/notifications${query ? `?${query}` : ''}`
    const authorization = request.headers.get('authorization')
    const response = await fetch(backendUrl, { cache: 'no-store', headers: authorization ? { authorization } : {} })
    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Doctor notifications proxy error:', error)
    return NextResponse.json({ message: 'Failed to fetch doctor notifications' }, { status: 500 })
  }
}