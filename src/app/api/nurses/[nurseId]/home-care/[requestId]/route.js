import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../../../lib/backend-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request, context) {
  try {
    const params = await context?.params || {}
    const { nurseId, requestId } = params
    if (!nurseId || !requestId) {
      return NextResponse.json({ message: 'Missing nurse id or request id' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    const backendUrl = `${getBackendBaseUrl()}/api/nurses/${encodeURIComponent(nurseId)}/home-care/${encodeURIComponent(requestId)}`
    const response = await fetch(backendUrl, {
      cache: 'no-store',
      headers: authHeader ? { authorization: authHeader } : {},
    })
    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Nurse home care detail proxy error:', error)
    return NextResponse.json({ message: 'Failed to load home care request' }, { status: 500 })
  }
}

export async function PATCH(request, context) {
  try {
    const params = await context?.params || {}
    const { nurseId, requestId } = params
    if (!nurseId || !requestId) {
      return NextResponse.json({ message: 'Missing nurse id or request id' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    const backendUrl = `${getBackendBaseUrl()}/api/nurses/${encodeURIComponent(nurseId)}/home-care/${encodeURIComponent(requestId)}`
    const response = await fetch(backendUrl, {
      method: 'PATCH',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Nurse home care update proxy error:', error)
    return NextResponse.json({ message: 'Failed to update home care request' }, { status: 500 })
  }
}
