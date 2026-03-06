import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/attendance?class_id=...&date=...  — teacher fetches attendance for a class/date
 * GET /api/attendance?student_id=...         — student/parent fetches attendance history
 */
export async function GET(req: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role
    const { searchParams } = new URL(req.url)
    const classId = searchParams.get('class_id')
    const date = searchParams.get('date')
    const studentId = searchParams.get('student_id')

    let query = supabase.from('attendance').select('*').order('date', { ascending: false })

    if (role === 'teacher') {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!teacher) {
        return NextResponse.json({ error: 'Teacher record not found' }, { status: 404 })
      }

      query = query.eq('teacher_id', teacher.id)
      if (classId) query = query.eq('class_id', classId)
      if (date) query = query.eq('date', date)
    } else if (role === 'student') {
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!student) {
        return NextResponse.json({ error: 'Student record not found' }, { status: 404 })
      }

      query = query.eq('student_id', student.id)
      if (classId) query = query.eq('class_id', classId)
    } else if (role === 'parent') {
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!parent) {
        return NextResponse.json({ error: 'Parent record not found' }, { status: 404 })
      }

      const { data: children } = await supabase
        .from('students')
        .select('id')
        .eq('parent_id', parent.id)

      const childIds = (children || []).map(c => c.id)
      if (childIds.length === 0) {
        return NextResponse.json({ records: [] })
      }

      query = query.in('student_id', childIds)
      if (studentId) query = query.eq('student_id', studentId)
    } else if (role === 'admin') {
      if (classId) query = query.eq('class_id', classId)
      if (studentId) query = query.eq('student_id', studentId)
      if (date) query = query.eq('date', date)
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: records, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ records: records || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

/**
 * POST /api/attendance — teacher submits attendance for a class on a date
 * Body: { class_id, date, entries: [{ student_id, statuses: string[], notes? }] }
 * Uses upsert so re-submitting the same class+date updates existing records.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'teacher') {
      return NextResponse.json({ error: 'Only teachers can submit attendance' }, { status: 403 })
    }

    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher record not found' }, { status: 404 })
    }

    const body = await req.json()
    const { class_id, date, entries } = body || {}

    if (!class_id || !date || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: class_id, date, entries[]' }, { status: 400 })
    }

    // Disallow future dates (UTC ISO yyyy-mm-dd)
    const todayIso = new Date().toISOString().slice(0, 10)
    if (String(date) > todayIso) {
      return NextResponse.json({ error: 'Cannot submit attendance for a future date' }, { status: 400 })
    }

    // Verify teacher is the class teacher (check both class_teacher_id and legacy teacher_id)
    const { data: classRecord } = await supabase
      .from('classes')
      .select('id, class_teacher_id, teacher_id')
      .eq('id', class_id)
      .single()

    const isClassTeacher =
      classRecord?.class_teacher_id === teacher.id ||
      classRecord?.teacher_id === teacher.id

    if (!classRecord || !isClassTeacher) {
      return NextResponse.json({ error: 'Only the class teacher can take attendance for this class' }, { status: 403 })
    }

    // Build upsert rows
    const allowed = new Set(['present','absent','late'])
    const rows = entries.map((entry: { student_id: string; statuses: string[]; notes?: string }) => {
      const statuses = Array.isArray(entry.statuses)
        ? entry.statuses.filter((s) => allowed.has(s))
        : []
      return {
        student_id: entry.student_id,
        class_id,
        teacher_id: teacher.id,
        date,
        statuses,
        notes: entry.notes || null,
      }
    })

    const { data: records, error } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'student_id,class_id,date' })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ records: records || [] }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
