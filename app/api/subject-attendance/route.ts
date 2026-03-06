import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/subject-attendance?class_id=...&subject_id=...&date=...
 * Teacher fetches subject attendance for a class/subject/date
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
    if (role !== 'teacher' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const classId = searchParams.get('class_id')
    const subjectId = searchParams.get('subject_id')
    const date = searchParams.get('date')

    let query = supabase
      .from('subject_attendance')
      .select('*')
      .order('date', { ascending: false })

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
    }

    if (classId) query = query.eq('class_id', classId)
    if (subjectId) query = query.eq('subject_id', subjectId)
    if (date) query = query.eq('date', date)

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
 * POST /api/subject-attendance
 * Body: { class_id, subject_id, date, entries: [{ student_id, statuses: string[], notes? }] }
 * Uses upsert so re-submitting the same class+subject+date updates existing records.
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
      return NextResponse.json({ error: 'Only teachers can submit subject attendance' }, { status: 403 })
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
    const { class_id, subject_id, date, entries } = body || {}

    if (!class_id || !subject_id || !date || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: class_id, subject_id, date, entries[]' }, { status: 400 })
    }
    // Disallow future dates
    const todayIso = new Date().toISOString().slice(0, 10)
    if (String(date) > todayIso) {
      return NextResponse.json({ error: 'Cannot submit subject attendance for a future date' }, { status: 400 })
    }

    // Verify teacher is assigned to this class+subject via class_subject_teachers
    const { data: cst } = await supabase
      .from('class_subject_teachers')
      .select('id')
      .eq('class_id', class_id)
      .eq('subject_id', subject_id)
      .eq('teacher_id', teacher.id)
      .single()

    if (!cst) {
      return NextResponse.json({ error: 'You are not assigned to teach this subject in this class' }, { status: 403 })
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
        subject_id,
        teacher_id: teacher.id,
        date,
        statuses,
        notes: entry.notes || null,
      }
    })

    const { data: records, error } = await supabase
      .from('subject_attendance')
      .upsert(rows, { onConflict: 'student_id,class_id,subject_id,date' })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ records: records || [] }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
