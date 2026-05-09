/* eslint-disable no-undef */
import { NextResponse } from 'next/server'

export async function DELETE(req, context) {
  try {
    const { postId } = await context.params
    const url = `${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8000'}/api/posts/${encodeURIComponent(postId)}`
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: req.headers.get('Authorization') || '',
      },
      cache: 'no-store',
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.ok ? 200 : (response.status || 500) })
  } catch (error) {
    console.error('Error deleting post:', error)
    return NextResponse.json({ message: 'Failed to delete post' }, { status: 500 })
  }
}
