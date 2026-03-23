import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { NextRequest, NextResponse } from 'next/server'

const intlMiddleware = createMiddleware(routing)

// Allowed origin comes from NEXTAUTH_URL (set per environment in .env)
// e.g. http://localhost:3000  or  https://app.yourcompany.pt
const ALLOWED_ORIGIN = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || ''

function setCorsHeaders(response: NextResponse, origin: string | null) {
  // Only allow the configured origin; never use wildcard '*' for credentialed requests
  const allow = ALLOWED_ORIGIN || (origin ?? '')
  response.headers.set('Access-Control-Allow-Origin', allow)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Max-Age', '86400') // preflight cache 24h
  return response
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const origin = request.headers.get('origin')

  // Handle CORS for all /api routes
  if (pathname.startsWith('/api/')) {
    // Reject requests from unexpected origins (skip check in dev when origin is null)
    if (ALLOWED_ORIGIN && origin && origin !== ALLOWED_ORIGIN) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    // Respond to OPTIONS preflight immediately
    if (request.method === 'OPTIONS') {
      return setCorsHeaders(new NextResponse(null, { status: 204 }), origin)
    }

    // For actual requests, pass through and add CORS headers to the response
    const response = NextResponse.next()
    setCorsHeaders(response, origin)
    return response
  }

  // All other routes: delegate to next-intl
  return intlMiddleware(request)
}

export const config = {
  matcher: [
    // API routes (CORS handling)
    '/api/(.*)',
    // i18n routes (exclude static files, _next internals)
    '/((?!_next|_vercel|.*\\..*).*)',
  ],
}
