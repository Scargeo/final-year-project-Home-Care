import { getBackendBaseUrl } from '../../../../lib/backend-url'

export async function POST(request) {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await request.json()),
      cache: 'no-store',
    })
    const data = await response.json().catch(() => ({}))
    return Response.json(data, { status: response.status })
  } catch (error) {
    return Response.json({ message: 'Failed to refresh token', error: error.message }, { status: 502 })
  }
}