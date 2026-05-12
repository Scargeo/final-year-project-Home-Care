import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../lib/backend-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/api/doctors`, {
      cache: 'no-store',
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Doctors proxy error:', error)
    return NextResponse.json({ message: 'Failed to fetch doctors' }, { status: 500 })
  }
}