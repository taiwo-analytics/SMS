import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const classId = searchParams.get('class_id')
    const subjectId = searchParams.get('subject_id')
    if (!classId || !subjectId) {
      return NextResponse.json({ error: 'Missing class_id or subject_id' }, { status: 400 })
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

    // Verify this teacher is assigned to this class+subject
    const { data: assignment } = await supabase
      .from('class_subject_teachers')
      .select('id')
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .eq('teacher_id', teacher.id)
      .maybeSingle()
    if (!assignment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = getSupabaseAdmin()

    const norm = (s: any) => String(s || '').trim().toLowerCase()
    const { data: cls } = await admin
      .from('classes')
      .select('id, class_level, department')
      .eq('id', classId)
      .maybeSingle()
    const lvl = String((cls as any)?.class_level || '').toUpperCase()
    const isSenior = lvl.startsWith('SS')
    let classDeptNorm = norm((cls as any)?.department)
    if (classDeptNorm === 'arts') classDeptNorm = 'humanities'

    // Check if the subject is department-specific
    const { data: subject, error: subjectError } = await admin
      .from('subjects')
      .select('*')
      .eq('id', subjectId)
      .maybeSingle()

    // Resolve subject departments (array field or semicolon-separated fallback)
    let subjectDepts: string[] = []
    if (subject && Array.isArray((subject as any).departments)) {
      subjectDepts = (subject as any).departments
    }
    subjectDepts = subjectDepts.map((d) => {
      const n = norm(d)
      if (n === 'arts') return 'humanities'
      return n
    }).filter((n) => ['science', 'business', 'humanities'].includes(n))

    // Fetch students enrolled in the class (include enrollment department)
    const { data: enrollments } = await admin
      .from('class_enrollments')
      .select('student_id, department, students(id, full_name, gender, photo_url, department)')
      .eq('class_id', classId)

    let students = (enrollments || [])
      .filter((e: any) => {
        if (!e.students) return false
        // Core subject (no department restriction) → show all students
        if (subjectDepts.length === 0) return true
        // JSS classes have no department system
        if (!isSenior) return true
        // Resolve student department: enrollment → student record → class-level
        let resolved = norm(e.department) || norm(e.students?.department) || classDeptNorm
        if (resolved === 'arts') resolved = 'humanities'
        // If we can't determine the student's department, exclude them for dept-restricted subjects
        if (!resolved) return false
        return subjectDepts.some((d) => norm(d) === resolved)
      })
      .map((e: any) => e.students)
      .sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || ''))

    return NextResponse.json({
      students,
      _debug: {
        classId,
        subjectId,
        isSenior,
        classDeptNorm,
        subjectDepts,
        subjectRaw: subject,
        subjectError: subjectError?.message || null,
        totalEnrollments: (enrollments || []).length,
        filteredCount: students.length,
        enrollmentSample: (enrollments || []).slice(0, 5).map((e: any) => ({
          student_name: e.students?.full_name,
          enrollment_dept: e.department,
          student_dept: e.students?.department,
          resolved: norm(e.department) || norm(e.students?.department) || classDeptNorm,
        })),
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
