import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const student_id = searchParams.get('student_id')
    if (!student_id) {
      return NextResponse.json({ subjects: [] })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: en } = await supabaseAdmin
      .from('class_enrollments')
      .select('class_id')
      .eq('student_id', student_id)
      .maybeSingle()
    if (!en?.class_id) {
      return NextResponse.json({ subjects: [] })
    }

    const { data: cls } = await supabaseAdmin
      .from('classes')
      .select('id, class_level, department, class_level')
      .eq('id', en.class_id)
      .maybeSingle()
    if (!cls) {
      return NextResponse.json({ subjects: [] })
    }
    const lvl = String((cls as any).class_level || '').toUpperCase()
    const dept: string | null = (cls as any).department || (lvl.startsWith('JSS') ? 'General' : null)

    const { data: links } = await supabaseAdmin
      .from('class_subject_teachers')
      .select('subject_id')
      .eq('class_id', en.class_id)
    const subjectIds = Array.from(new Set((links || []).map((x: any) => x.subject_id).filter(Boolean)))
    if (subjectIds.length === 0) {
      return NextResponse.json({ subjects: [] })
    }

    const { data: subs } = await supabaseAdmin
      .from('subjects')
      .select('id, name, code, departments')
      .in('id', subjectIds)
      .order('name', { ascending: true })

    let subjects = (subs || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      departments: Array.isArray(s.departments) ? s.departments as string[] : [],
    }))
    if (dept && !lvl.startsWith('JSS')) {
      subjects = subjects.filter(s => s.departments.length === 0 || s.departments.includes(dept))
    }

    return NextResponse.json({ subjects })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
