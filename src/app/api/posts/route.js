import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../lib/backend-url'

export async function GET() {
  try {
    const url = `${getBackendBaseUrl()}/api/posts`
    const response = await fetch(url, { cache: 'no-store' })
    const data = await response.json()
    return NextResponse.json(data, { status: response.ok ? 200 : (response.status || 500) })
  } catch (error) {
    console.error('Error fetching posts:', error)
    return NextResponse.json({ message: 'Failed to fetch posts' }, { status: 500 })
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
    const data = await response.json()
    return NextResponse.json(data, { status: response.ok ? 200 : (response.status || 500) })
  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json({ message: 'Failed to create post' }, { status: 500 })
  }
}
