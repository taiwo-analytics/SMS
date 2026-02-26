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

    // Find user by email
    const usersRes = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const all = usersRes?.data?.users || []
    const user = all.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!user) {
      return NextResponse.json({ error: 'User not found for given email' }, { status: 404 })
    }

    const id = user.id

    // Update password
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(id, { password })
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 })
    }

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

    return NextResponse.json({ success: true, id, email, role: 'admin', password })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
