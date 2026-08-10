import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '../../../../lib/backend-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function proxy(request, params) {
  try {
    // Next.js 15: params is a Promise that must be awaited
    const resolvedParams = await params
    const method = request.method || 'GET'
    const pathSegments = Array.isArray(resolvedParams?.path) ? resolvedParams.path : []
    const path = pathSegments.length > 0 ? `/${pathSegments.join('/')}` : ''
    const backendUrl = `${getBackendBaseUrl()}/api/admin${path}${request.nextUrl.search || ''}`

    const headers = {}
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (authHeader) headers.authorization = authHeader

    let body
    if (!['GET', 'HEAD'].includes(method)) {
      body = await request.text()
      if (body) {
        headers['Content-Type'] = request.headers.get('content-type') || 'application/json'
      }
    }

    const response = await fetch(backendUrl, {
      method,
      headers,
      body,
      cache: 'no-store',
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    return NextResponse.json({ message: 'Admin proxy failed', error: error.message }, { status: 500 })
  }
}

export async function GET(request, context) {
  const params = await context.params
  return proxy(request, params)
}

export async function POST(request, context) {
  const params = await context.params
  return proxy(request, params)
}

export async function PATCH(request, context) {
  const params = await context.params
  return proxy(request, params)
}

export async function PUT(request, context) {
  const params = await context.params
  return proxy(request, params)
}

export async function DELETE(request, context) {
  const params = await context.params
  return proxy(request, params)
}
