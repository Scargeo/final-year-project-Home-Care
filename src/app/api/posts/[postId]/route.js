import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../lib/backend-url'

export async function DELETE(req, context) {
  try {
    const { postId } = await context.params
    const url = `${getBackendBaseUrl()}/api/posts/${encodeURIComponent(postId)}`
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        authorization: authHeader,
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
