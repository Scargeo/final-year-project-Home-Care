import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../lib/backend-url'

export async function DELETE(_request, { params }) {
  try {
    const backendUrl = `${getBackendBaseUrl()}/api/uploads/${params.id}`

    const response = await fetch(backendUrl, {
      method: 'DELETE',
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Uploads delete proxy error:', error)
    return NextResponse.json({ message: 'Failed to remove file' }, { status: 500 })
  }
}