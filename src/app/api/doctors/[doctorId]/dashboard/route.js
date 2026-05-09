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
    const backendUrl = `${getBackendBaseUrl()}/api/doctors/${encodeURIComponent(doctorId)}/dashboard`

    const response = await fetch(backendUrl, {
      cache: 'no-store',
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Doctor dashboard proxy error:', error)
    return NextResponse.json({ message: 'Failed to fetch dashboard' }, { status: 500 })
  }
}
