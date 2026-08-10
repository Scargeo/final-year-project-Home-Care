import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../../lib/backend-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request, context) {
  try {
    const params = await context?.params || {}
    const { nurseId } = params
    if (!nurseId) {
      return NextResponse.json({ message: 'Missing nurse id' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    const backendUrl = `${getBackendBaseUrl()}/api/nurses/${encodeURIComponent(nurseId)}/home-care`
    const response = await fetch(backendUrl, {
      cache: 'no-store',
      headers: authHeader ? { authorization: authHeader } : {},
    })
    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Nurse home care list proxy error:', error)
    return NextResponse.json({ message: 'Failed to fetch home care requests' }, { status: 500 })
  }
}
