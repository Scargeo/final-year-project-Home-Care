import { NextResponse } from 'next/server'

export async function GET(req, context) {
  try {
    const { postId } = await context.params
    const url = `${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8000'}/api/posts/${encodeURIComponent(postId)}/comments`
    const response = await fetch(url, {
      headers: {
        Authorization: req.headers.get('Authorization') || '',
      },
      cache: 'no-store',
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.ok ? 200 : (response.status || 500) })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ message: 'Failed to fetch comments', comments: [], count: 0 }, { status: 500 })
  }
}
