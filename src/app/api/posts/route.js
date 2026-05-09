import { NextResponse } from 'next/server'

export async function GET(req) {
  try {
    const url = `${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8000'}/api/posts`
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
    const url = `${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8000'}/api/posts`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.get('Authorization') || '',
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
