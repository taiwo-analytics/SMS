import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await req.json()
    const email = String(body?.email || '').trim()
    const make = Boolean(body?.make ?? true)

    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

    // Caller must be a super admin
    const { data: caller } = await supabaseAdmin
      .from('profiles')
      .select('is_super_admin')
      .eq('id', auth.userId)
      .single()
    if (!caller?.is_super_admin) {
      return NextResponse.json({ error: 'Only a super admin can modify super admin status' }, { status: 403 })
    }

    // Find target user
    const usersRes = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const all = usersRes?.data?.users || []
    const user = all.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!user) {
      return NextResponse.json({ error: 'User not found for given email' }, { status: 404 })
    }

    // Ensure profile exists and is role=admin if promoting
    if (make) {
      await supabaseAdmin
        .from('profiles')
        .upsert({ id: user.id, role: 'admin', full_name: (user.user_metadata as any)?.full_name || user.email || 'Admin User', is_super_admin: true }, { onConflict: 'id' })
    } else {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ is_super_admin: false })
        .eq('id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
