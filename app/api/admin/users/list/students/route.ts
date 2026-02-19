import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data: students, error: sErr } = await supabaseAdmin
      .from('students')
      .select('*')
      .order('created_at', { ascending: false })

    if (sErr) {
      return NextResponse.json({ error: sErr.message }, { status: 400 })
    }

    const studentIds = (students || []).map((s: any) => s.id)
    const parentIds = (students || []).map((s: any) => s.parent_id).filter(Boolean)

    const { data: parents } = await supabaseAdmin
      .from('parents')
      .select('*')
      .in('id', parentIds)

    const { data: enrollments } = await supabaseAdmin
      .from('class_enrollments')
      .select('*')
      .in('student_id', studentIds)

    const classIds = (enrollments || []).map((e: any) => e.class_id)
    const { data: classes } = await supabaseAdmin
      .from('classes')
      .select('*')
      .in('id', classIds)

    const studentsWithDetails = (students || []).map((student: any) => ({
      ...student,
      parent: (parents || []).find((p: any) => p.id === student.parent_id) || null,
      classes: (enrollments || []).filter((en: any) => en.student_id === student.id).map((en: any) => (classes || []).find((c: any) => c.id === en.class_id)).filter(Boolean),
      email: 'N/A'
    }))

    return NextResponse.json({ students: studentsWithDetails })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
