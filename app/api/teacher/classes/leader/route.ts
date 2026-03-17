import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { class_id, student_id } = body || {}
    if (!class_id || !student_id) {
      return NextResponse.json({ error: 'Missing class_id or student_id' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })

    const admin = getSupabaseAdmin()
    const { data: cls } = await admin
      .from('classes')
      .select('id, class_teacher_id')
      .eq('id', class_id)
      .maybeSingle()
    if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    if (cls.class_teacher_id && cls.class_teacher_id !== teacher.id) {
      return NextResponse.json({ error: 'Forbidden: not class teacher' }, { status: 403 })
    }

    const { data: student } = await admin
      .from('students')
      .select('id')
      .eq('id', student_id)
      .maybeSingle()
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    const { error } = await admin
      .from('classes')
      .update({ class_leader_id: student_id })
      .eq('id', class_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
