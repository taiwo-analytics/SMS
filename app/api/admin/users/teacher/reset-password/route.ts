import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const { teacher_id, new_password } = await req.json()
    if (!teacher_id || !new_password) {
      return NextResponse.json({ error: 'teacher_id and new_password are required' }, { status: 400 })
    }
    if (new_password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: teacher } = await supabaseAdmin
      .from('teachers')
      .select('user_id')
      .eq('id', teacher_id)
      .single()

    if (!teacher?.user_id) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(teacher.user_id, {
      password: new_password,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
