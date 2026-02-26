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
    const role = String(body?.role || '').trim()

    if (!email || !role) {
      return NextResponse.json({ error: 'Missing email or role' }, { status: 400 })
    }

    if (!['admin', 'teacher', 'student', 'parent'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Find auth user by email
    const usersRes = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const all = usersRes?.data?.users || []
    const user = all.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!user) {
      return NextResponse.json({ error: 'User not found for given email' }, { status: 404 })
    }

    const user_id = user.id

    if (role === 'admin') {
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user_id)
        .single()
      if (targetProfile?.is_super_admin) {
        return NextResponse.json({ error: 'Cannot delete the super admin' }, { status: 403 })
      }
    }

    // Delete role-specific rows first (to satisfy FKs)
    if (role === 'teacher') {
      await supabaseAdmin.from('teachers').delete().eq('user_id', user_id)
    } else if (role === 'student') {
      await supabaseAdmin.from('students').delete().eq('user_id', user_id)
    } else if (role === 'parent') {
      await supabaseAdmin.from('parents').delete().eq('user_id', user_id)
    }

    // Delete profile
    await supabaseAdmin.from('profiles').delete().eq('id', user_id)

    // Delete auth user
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user_id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
