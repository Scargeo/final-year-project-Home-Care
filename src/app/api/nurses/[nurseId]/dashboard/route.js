import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../../lib/backend-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request, context) {
  try {
    const params = await context?.params || {}
    const nurseId = params?.nurseId
    if (!nurseId) {
      return NextResponse.json({ message: 'Missing nurseId' }, { status: 400 })
    }
    const backendUrl = `${getBackendBaseUrl()}/api/nurses/${encodeURIComponent(nurseId)}/dashboard`

    // Forward authorization header from the client to the backend so protected
    // routes can validate the request when needed.
    const forwardHeaders = {}
    const auth = request.headers.get('authorization')
    if (auth) forwardHeaders.authorization = auth

    const response = await fetch(backendUrl, {
      cache: 'no-store',
      headers: forwardHeaders,
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Nurse dashboard proxy error:', error)
    return NextResponse.json({ message: 'Failed to fetch nurse dashboard' }, { status: 500 })
  }
}
