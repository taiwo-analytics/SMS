import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Ensure a profile exists; upsert with admin role
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    let upsertError = null as any
    if (existingProfile) {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', user.id)
      upsertError = error
    } else {
      const fullName =
        (user.user_metadata && (user.user_metadata as any).full_name) ||
        user.email ||
        'Admin User'
      const { error } = await supabaseAdmin
        .from('profiles')
        .insert({ id: user.id, role: 'admin', full_name: fullName })
      upsertError = error
    }

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 400 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    return NextResponse.json({ success: true, userId: user.id, profile })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
