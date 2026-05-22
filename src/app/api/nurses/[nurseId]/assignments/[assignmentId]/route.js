import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../../../lib/backend-url'

async function forwardRequest(request, params, method) {
  const { nurseId, assignmentId } = params
  if (!nurseId || !assignmentId) {
    return NextResponse.json({ message: 'Missing assignment identifiers' }, { status: 400 })
  }

  const backendUrl = `${getBackendBaseUrl()}/api/nurses/${encodeURIComponent(nurseId)}/assignments/${encodeURIComponent(assignmentId)}`
  const forwardHeaders = {}
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  if (authHeader) forwardHeaders.authorization = authHeader
  const userId = request.headers.get('x-user-id')
  if (userId) forwardHeaders['x-user-id'] = userId
  const userRole = request.headers.get('x-user-role')
  if (userRole) forwardHeaders['x-user-role'] = userRole

  const init = {
    method,
    headers: forwardHeaders,
    cache: 'no-store',
  }

  if (method !== 'GET' && method !== 'HEAD') {
    forwardHeaders['Content-Type'] = 'application/json'
    init.body = JSON.stringify(await request.json().catch(() => ({})))
  }

  const response = await fetch(backendUrl, init)
  const data = await response.json().catch(() => ({}))
  return NextResponse.json(data, { status: response.status })
}

export async function GET(request, { params: paramsPromise }) {
  try {
    return await forwardRequest(request, await paramsPromise, 'GET')
  } catch (error) {
    console.error('Nurse assignment GET proxy error:', error)
    return NextResponse.json({ message: 'Failed to fetch nurse assignment' }, { status: 500 })
  }
}

export async function PATCH(request, { params: paramsPromise }) {
  try {
    return await forwardRequest(request, await paramsPromise, 'PATCH')
  } catch (error) {
    console.error('Nurse assignment PATCH proxy error:', error)
    return NextResponse.json({ message: 'Failed to update nurse assignment' }, { status: 500 })
  }
}