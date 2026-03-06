import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ROLE_ROUTE_MAP: Record<string, string> = {
  '/admin': 'admin',
  '/teacher': 'teacher',
  '/student': 'student',
  '/parent': 'parent',
}

const ROLE_HOME_MAP: Record<string, string> = {
  admin: '/admin',
  teacher: '/teacher',
  student: '/student/classes',
  parent: '/parent/children',
}

export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = req.nextUrl

  // Helper to redirect while preserving Supabase session cookies
  const redirectWithCookies = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  // Public sign-up is disabled; account creation is admin-only
  if (pathname === '/auth/signup') {
    const url = req.nextUrl.clone()
    url.pathname = '/auth/login'
    return redirectWithCookies(url)
  }

  // Check if the route requires a specific role
  const matchedPrefix = Object.keys(ROLE_ROUTE_MAP).find(prefix => pathname.startsWith(prefix))
  if (!matchedPrefix) {
    return supabaseResponse
  }

  // Not logged in — redirect to login
  if (!user) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return redirectWithCookies(loginUrl)
  }

  // Check role from the profiles table.
  // If profile lookup fails (e.g., RLS policy issue), don't trap user on "/".
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const userRole = profile?.role
  if (profileError || !userRole) {
    return supabaseResponse
  }
  const requiredRole = ROLE_ROUTE_MAP[matchedPrefix]
  if (userRole !== requiredRole) {
    const url = req.nextUrl.clone()
    url.pathname = ROLE_HOME_MAP[userRole || ''] || '/'
    return redirectWithCookies(url)
  }

  return supabaseResponse
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
