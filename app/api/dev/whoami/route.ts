import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
    }
    const devSecret = process.env.DEV_ADMIN_SECRET
    const url = new URL(req.url)
    const reqSecret = url.searchParams.get('secret') || req.headers.get('x-dev-admin-secret')
    if (!devSecret || devSecret !== reqSecret) {
      return NextResponse.json({ error: 'Not allowed in development without secret' }, { status: 403 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ loggedIn: false })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      loggedIn: true,
      user: { id: user.id, email: user.email },
      profile,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
