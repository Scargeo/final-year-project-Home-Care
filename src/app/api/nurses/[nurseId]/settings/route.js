import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../../lib/backend-url'

export async function GET(req, context) {
  try {
    const { nurseId } = await context.params

    if (!nurseId) {
      return NextResponse.json({ message: 'Missing nurse ID' }, { status: 400 })
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const response = await fetch(`${getBackendBaseUrl()}/api/nurses/${encodeURIComponent(nurseId)}/settings`, {
      method: 'GET',
      headers: {
        authorization: authHeader,
      },
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json(data || { message: 'Failed to fetch nurse settings' }, { status: response.status })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Error fetching nurse settings:', error)
    return NextResponse.json(
      { message: 'Failed to fetch nurse settings', error: error.message },
      { status: 500 }
    )
  }
}

export async function PATCH(req, context) {
  try {
    const { nurseId } = await context.params
    const body = await req.json()

    if (!nurseId) {
      return NextResponse.json({ message: 'Missing nurse ID' }, { status: 400 })
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const response = await fetch(`${getBackendBaseUrl()}/api/nurses/${encodeURIComponent(nurseId)}/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        authorization: authHeader,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json(data || { message: 'Failed to update nurse settings' }, { status: response.status })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Error updating nurse settings:', error)
    return NextResponse.json(
      { message: 'Failed to update nurse settings', error: error.message },
      { status: 500 }
    )
  }
}