import { NextResponse } from "next/server"
import { getBackendBaseUrl } from "../../../../../lib/backend-url"

export async function PATCH(request, context) {
  try {
    const body = await request.json().catch(() => ({}))
    const params = await context?.params
    const id = params?.id
    if (!id) return NextResponse.json({ message: 'Missing id' }, { status: 400 })

    const backendUrl = `${getBackendBaseUrl()}/api/patients/${encodeURIComponent(id)}/status`

    const response = await fetch(backendUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Patient status proxy error:', error)
    return NextResponse.json({ message: 'Failed to update status' }, { status: 500 })
  }
}
