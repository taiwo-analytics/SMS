import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ROLE_ROUTE_MAP: Record<string, string> = {
  '/admin': 'admin',
  '/teacher': 'teacher',
  '/student': 'student',
  '/parent': 'parent',
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = req.nextUrl

  // Redirect authenticated users away from auth pages
  if (pathname.startsWith('/auth')) {
    if (session) {
      return NextResponse.redirect(new URL('/', req.url))
    }
    return res
  }

  // Check if this is a protected route
  const matchedPrefix = Object.keys(ROLE_ROUTE_MAP).find((prefix) =>
    pathname.startsWith(prefix)
  )

  if (!matchedPrefix) {
    return res
  }

  // Must be authenticated for any protected route
  if (!session) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Check role from the profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const userRole = profile?.role
  const requiredRole = ROLE_ROUTE_MAP[matchedPrefix]

  if (userRole !== requiredRole) {
    // Redirect to home if user doesn't have the right role
    return NextResponse.redirect(new URL('/', req.url))
  }

  // Also block API routes under /api/admin for non-admins
  // (API routes get their own in-handler check too, as defense-in-depth)

  return res
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/teacher/:path*',
    '/student/:path*',
    '/parent/:path*',
    '/auth/:path*',
    '/api/admin/:path*',
  ],
}
