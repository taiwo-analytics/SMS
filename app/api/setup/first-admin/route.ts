import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const token = process.env.FIRST_ADMIN_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'FIRST_ADMIN_TOKEN not configured' }, { status: 403 })
    }
    const headerToken = req.headers.get('x-first-admin-token')
    const url = new URL(req.url)
    const queryToken = url.searchParams.get('token')
    if (headerToken !== token && queryToken !== token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Allow only if no admin exists
    const { data: admins, error: qErr } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
    if (qErr) {
      return NextResponse.json({ error: qErr.message }, { status: 400 })
    }
    if (admins && admins.length > 0) {
      return NextResponse.json({ error: 'Admin already exists' }, { status: 409 })
    }

    const body = await req.json()
    const email = String(body?.email || '').trim()
    const password = String(body?.password || '').trim()
    const full_name = String(body?.full_name || '').trim() || 'Admin User'
    if (!email || !password) {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // Create auth user
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })
    if (cErr || !created?.user) {
      return NextResponse.json({ error: cErr?.message || 'Failed to create user' }, { status: 400 })
    }
    const id = created.user.id

    // Create profile with role=admin
    const { error: pErr } = await supabaseAdmin
      .from('profiles')
      .insert({ id, role: 'admin', full_name })
    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, id, email, role: 'admin' }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
