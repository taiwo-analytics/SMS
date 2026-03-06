import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const classId = searchParams.get('class_id')

    // Authenticate
    const supabase = await createServerSupabaseClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })

    const admin = getSupabaseAdmin()

    // If class_id provided, return students for that class
    if (classId) {
      // Verify teacher owns this class
      const { data: cls } = await admin
        .from('classes')
        .select('id, class_teacher_id')
        .eq('id', classId)
        .maybeSingle()
      if (!cls || cls.class_teacher_id !== teacher.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { data: enrollments } = await admin
        .from('class_enrollments')
        .select('student_id, department, students(id, full_name, gender, photo_url)')
        .eq('class_id', classId)

      const students = (enrollments || [])
        .map((e: any) => {
          const s = e.students
          if (!s) return null
          return { ...s, department: e.department || 'None' }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || ''))

      return NextResponse.json({ students })
    }

    // No class_id: return student counts for all classes this teacher owns
    const { data: teacherClasses } = await admin
      .from('classes')
      .select('id')
      .eq('class_teacher_id', teacher.id)

    const classIds = (teacherClasses || []).map((c: any) => c.id)
    if (classIds.length === 0) {
      return NextResponse.json({ counts: {} })
    }

    const { data: enrollments } = await admin
      .from('class_enrollments')
      .select('class_id')
      .in('class_id', classIds)

    const counts: Record<string, number> = {}
    for (const cid of classIds) counts[cid] = 0
    for (const e of (enrollments || [])) {
      counts[e.class_id] = (counts[e.class_id] || 0) + 1
    }

    // Fetch today's attendance stats per class
    const today = new Date().toISOString().slice(0, 10)
    const { data: attendanceRows } = await admin
      .from('attendance')
      .select('class_id, statuses')
      .in('class_id', classIds)
      .eq('date', today)

    const attendance: Record<string, { present: number; absent: number; late: number; total: number }> = {}
    for (const cid of classIds) {
      attendance[cid] = { present: 0, absent: 0, late: 0, total: 0 }
    }
    for (const r of (attendanceRows || [])) {
      const a = attendance[r.class_id]
      if (!a) continue
      a.total++
      const arr = Array.isArray((r as any).statuses) ? (r as any).statuses as string[] : []
      if (arr.includes('present')) a.present++
      if (arr.includes('absent')) a.absent++
      if (arr.includes('late')) a.late++
    }

    return NextResponse.json({ counts, attendance })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
