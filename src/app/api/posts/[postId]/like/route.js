import { NextResponse } from 'next/server'

export async function PATCH(req, context) {
  try {
    const { postId } = await context.params
    const url = `${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8000'}/api/posts/${encodeURIComponent(postId)}/like`
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.get('Authorization') || '',
      },
      body: JSON.stringify({}),
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.ok ? 200 : (response.status || 500) })
  } catch (error) {
    console.error('Error liking post:', error)
    return NextResponse.json({ message: 'Failed to like post' }, { status: 500 })
  }
}
