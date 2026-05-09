import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../../../lib/backend-url'

export async function GET(req, context) {
  try {
    const { postId } = await context.params
    const url = `${getBackendBaseUrl()}/api/posts/${encodeURIComponent(postId)}/comments`
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const response = await fetch(url, {
      headers: {
        authorization: authHeader,
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
