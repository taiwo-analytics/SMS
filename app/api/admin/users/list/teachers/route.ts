import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data: teachers, error: tErr } = await supabaseAdmin
      .from('teachers')
      .select('*')
      .order('created_at', { ascending: false })

    if (tErr) {
      return NextResponse.json({ error: tErr.message }, { status: 400 })
    }

    const teacherIds = (teachers || []).map((t: any) => t.id)

    const { data: classes } = await supabaseAdmin
      .from('classes')
      .select('*')
      .in('teacher_id', teacherIds)

    const { data: subjects } = await supabaseAdmin
      .from('teacher_subjects')
      .select('*')
      .in('teacher_id', teacherIds)

    const teachersWithDetails = (teachers || []).map((teacher: any) => ({
      ...teacher,
      classes: (classes || []).filter((c: any) => c.teacher_id === teacher.id),
      subjects: [...new Set((subjects || []).filter((s: any) => s.teacher_id === teacher.id).map((s: any) => s.subject))]
    }))

    return NextResponse.json({ teachers: teachersWithDetails })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
