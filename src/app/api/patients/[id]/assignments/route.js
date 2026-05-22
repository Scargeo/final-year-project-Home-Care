import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../../lib/backend-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request, context) {
  try {
    const params = await context?.params || {}
    const id = params?.id

    if (!id) {
      return NextResponse.json({ message: 'Missing patient id' }, { status: 400 })
    }

    const backendUrl = `${getBackendBaseUrl()}/api/patients/${encodeURIComponent(id)}/assignments`
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')

    const response = await fetch(backendUrl, {
      cache: 'no-store',
      headers: authHeader ? { authorization: authHeader } : {},
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Patient assignments proxy error:', error)
    return NextResponse.json({ message: 'Failed to fetch patient assignments' }, { status: 500 })
  }
}
