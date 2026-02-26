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
    const term_id = searchParams.get('term_id')
    if (!student_id) return NextResponse.json({ error: 'Missing student_id' }, { status: 400 })

    const supabaseAdmin = getSupabaseAdmin()

    const { data: student } = await supabaseAdmin
      .from('students')
      .select('*')
      .eq('id', student_id)
      .maybeSingle()
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    const { data: en } = await supabaseAdmin
      .from('class_enrollments')
      .select('class_id')
      .eq('student_id', student_id)
      .maybeSingle()

    let cls: any = null
    if (en?.class_id) {
      const res = await supabaseAdmin.from('classes').select('*').eq('id', en.class_id).maybeSingle()
      cls = res.data || null
    }

    const lvl = String(cls?.class_level || '').toUpperCase()
    const department: string | null = cls?.department || (lvl.startsWith('JSS') ? 'General' : null)

    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('student_id', student_id)
      .order('created_at', { ascending: false })
      .limit(1)
    const latestPayment = payments && payments[0] ? payments[0] : null

    let gradesQuery = supabaseAdmin.from('grades').select('*').eq('student_id', student_id).order('created_at', { ascending: false })
    if (term_id) {
      gradesQuery = gradesQuery.eq('term_id', term_id)
    }
    const { data: grades } = await gradesQuery

    const avgPercent = Array.isArray(grades) && grades.length > 0
      ? Math.round((grades.reduce((s: number, g: any) => s + (g.score / g.max_score) * 100, 0) / grades.length) * 10) / 10
      : 0

    const dob = student?.dob ? new Date(student.dob) : null
    let ageYears: number | null = null
    if (dob) {
      const now = new Date()
      ageYears = now.getFullYear() - dob.getFullYear()
      const m = now.getMonth() - dob.getMonth()
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) ageYears--
    }

    const { data: subRes } = await supabaseAdmin
      .from('class_subject_teachers')
      .select('subject_id')
      .eq('class_id', cls?.id || '')
    const subjectIds = Array.from(new Set((subRes || []).map((x: any) => x.subject_id).filter(Boolean)))
    let subjects: Array<{ id: string; name: string; code: string }> = []
    if (subjectIds.length) {
      const { data: subs } = await supabaseAdmin
        .from('subjects')
        .select('id, name, code, departments')
        .in('id', subjectIds)
        .order('name', { ascending: true })
      subjects = (subs || []).filter((s: any) => {
        if (!department || String(department).toUpperCase() === 'GENERAL') return true
        const arr: string[] = Array.isArray(s.departments) ? s.departments : []
        return arr.length === 0 || arr.includes(department)
      }).map((s: any) => ({ id: s.id, name: s.name, code: s.code }))
    }

    const report = {
      student: {
        id: student.id,
        full_name: student.full_name,
        gender: student.gender || null,
        dob: student.dob || null,
        age: ageYears,
      },
      class: cls ? { id: cls.id, class_level: cls.class_level || cls.name || null, department: department } : null,
      subjects,
      grades: {
        count: Array.isArray(grades) ? grades.length : 0,
        average_percent: avgPercent,
      },
      payments: latestPayment ? {
        status: latestPayment.status || null,
        amount: latestPayment.amount || null,
        created_at: latestPayment.created_at || null,
      } : null,
    }

    return NextResponse.json({ report })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
