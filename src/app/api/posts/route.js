import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../lib/backend-url'

async function readBackendPayload(response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase()

  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}))
  }

  const text = await response.text().catch(() => '')
  return text ? { message: text } : {}
}

export async function GET() {
  try {
    const url = `${getBackendBaseUrl()}/api/posts`
    const response = await fetch(url, { cache: 'no-store' })
    const data = await readBackendPayload(response)
    return NextResponse.json(data, { status: response.ok ? 200 : (response.status || 500) })
  } catch (error) {
    console.error('Error fetching posts:', error)
    return NextResponse.json({ message: error?.message || 'Failed to fetch posts' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const url = `${getBackendBaseUrl()}/api/posts`
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: authHeader,
      },
      body: JSON.stringify(body),
    })
    const data = await readBackendPayload(response)
    return NextResponse.json(data, { status: response.ok ? 200 : (response.status || 500) })
  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json({ message: error?.message || 'Failed to create post' }, { status: 500 })
  }
}
