import { NextResponse } from 'next/server'
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

    const email = url.searchParams.get('email')
    const password = url.searchParams.get('password') || 'password123'
    const full_name = url.searchParams.get('full_name') || 'Admin User'

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Create auth user
    const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })
    if (createErr || !createdUser?.user) {
      return NextResponse.json({ error: createErr?.message || 'Failed to create user' }, { status: 400 })
    }
    const id = createdUser.user.id

    // Ensure admin profile
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (existingProfile) {
      await supabaseAdmin.from('profiles').update({ role: 'admin', full_name }).eq('id', id)
    } else {
      await supabaseAdmin.from('profiles').insert({ id, role: 'admin', full_name })
    }

    // Return created user info
    return NextResponse.json({ success: true, id, email, role: 'admin' })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
