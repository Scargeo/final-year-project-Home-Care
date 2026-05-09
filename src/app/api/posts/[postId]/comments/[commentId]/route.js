import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../../../lib/backend-url'

export async function DELETE(req, context) {
  try {
    const { postId, commentId } = await context.params
    const url = `${getBackendBaseUrl()}/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`
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
    console.error('Error deleting comment:', error)
    return NextResponse.json({ message: 'Failed to delete comment' }, { status: 500 })
  }
}
