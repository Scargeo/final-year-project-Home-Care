import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../../../lib/backend-url'

export async function PATCH(request, { params: paramsPromise }) {
  try {
    const params = await paramsPromise
    const { doctorId, appointmentId } = params
    if (!doctorId || !appointmentId) {
      return NextResponse.json({ message: 'Missing appointment identifiers' }, { status: 400 })
    }

    const backendUrl = `${getBackendBaseUrl()}/api/doctors/${encodeURIComponent(doctorId)}/appointments/${encodeURIComponent(appointmentId)}`
    const body = await request.json().catch(() => ({}))

    const forwardHeaders = { 'Content-Type': 'application/json' }
    const userId = request.headers.get('x-user-id')
    const userRole = request.headers.get('x-user-role')
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (userId) forwardHeaders['x-user-id'] = userId
    if (userRole) forwardHeaders['x-user-role'] = userRole
    if (authHeader) forwardHeaders['authorization'] = authHeader

    const response = await fetch(backendUrl, {
      method: 'PATCH',
      headers: forwardHeaders,
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Doctor appointment patch proxy error:', error)
    return NextResponse.json({ message: 'Failed to update appointment' }, { status: 500 })
  }
}