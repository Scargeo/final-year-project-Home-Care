import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../../lib/backend-url'

export async function PATCH(req, context) {
  try {
    const { postId } = await context.params
    const url = `${getBackendBaseUrl()}/api/posts/${encodeURIComponent(postId)}/like`
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        authorization: authHeader,
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
