import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getGrade } from '@/lib/gradeScale'

async function getCallerInfo(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role
  let teacherId: string | null = null
  if (role === 'teacher') {
    const { data: teacher } = await supabase.from('teachers').select('id').eq('user_id', user.id).single()
    teacherId = teacher?.id || null
  }
  return { userId: user.id, role, teacherId }
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const caller = await getCallerInfo(supabase)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const student_id = searchParams.get('student_id')
  const term_id = searchParams.get('term_id')

  if (!student_id || !term_id) {
    return NextResponse.json({ error: 'student_id and term_id are required' }, { status: 400 })
  }

  // Fetch student
  const { data: student, error: studentErr } = await supabase
    .from('students')
    .select('*')
    .eq('id', student_id)
    .single()
  if (studentErr || !student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  // Fetch enrollment to get class
  const { data: enrollment } = await supabase
    .from('class_enrollments')
    .select('class_id, classes(id, name, class_teacher_id)')
    .eq('student_id', student_id)
    .single()

  const classId = enrollment?.class_id
  const classData = enrollment?.classes as any

  // Access check for teachers
  if (caller.role === 'teacher' && caller.teacherId) {
    const isClassTeacher = classData?.class_teacher_id === caller.teacherId
    let isSubjectTeacher = false
    if (!isClassTeacher && classId) {
      const { data: cst } = await supabase
        .from('class_subject_teachers')
        .select('id')
        .eq('class_id', classId)
        .eq('teacher_id', caller.teacherId)
      isSubjectTeacher = (cst?.length ?? 0) > 0
    }
    if (!isClassTeacher && !isSubjectTeacher) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (caller.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch term
  const { data: term } = await supabase
    .from('academic_terms')
    .select('*, academic_sessions(name)')
    .eq('id', term_id)
    .single()

  // Fetch scores
  const { data: scores } = await supabase
    .from('subject_scores')
    .select(`
      *,
      subjects(id, name, code)
    `)
    .eq('student_id', student_id)
    .eq('term_id', term_id)

  // Build subjects results
  let totalSum = 0
  let subjectCount = 0
  const subjectResults = (scores || []).map((sc: any) => {
    const total = Number(sc.total) || 0
    const { grade, remark } = getGrade(total)
    totalSum += total
    subjectCount++
    return {
      subject_id: sc.subject_id,
      subject_name: sc.subjects?.name || '',
      subject_code: sc.subjects?.code || '',
      ca_score: Number(sc.ca_score),
      exam_score: Number(sc.exam_score),
      total,
      grade,
      remark,
    }
  }).sort((a: any, b: any) => a.subject_name.localeCompare(b.subject_name))

  const average = subjectCount > 0 ? Math.round((totalSum / subjectCount) * 100) / 100 : 0

  // Calculate position: get all students in same class+term, rank by average
  let position = 1
  if (classId) {
    const { data: allScores } = await supabase
      .from('subject_scores')
      .select('student_id, total')
      .eq('class_id', classId)
      .eq('term_id', term_id)

    // Group totals by student
    const studentTotals = new Map<string, { sum: number; count: number }>()
    for (const sc of (allScores || [])) {
      const sid = sc.student_id
      const prev = studentTotals.get(sid) || { sum: 0, count: 0 }
      studentTotals.set(sid, { sum: prev.sum + Number(sc.total), count: prev.count + 1 })
    }
    const studentAverages = Array.from(studentTotals.entries()).map(([sid, d]) => ({
      student_id: sid,
      average: d.count > 0 ? d.sum / d.count : 0,
    })).sort((a, b) => b.average - a.average)
    const rank = studentAverages.findIndex((s) => s.student_id === student_id)
    position = rank >= 0 ? rank + 1 : 1
  }

  // Fetch attendance
  const { data: attendance } = await supabase
    .from('attendance')
    .select('statuses')
    .eq('student_id', student_id)

  const attendanceSummary = {
    present: (attendance || []).filter((a: any) => Array.isArray(a.statuses) && a.statuses.includes('present')).length,
    absent: (attendance || []).filter((a: any) => Array.isArray(a.statuses) && a.statuses.includes('absent')).length,
    late: (attendance || []).filter((a: any) => Array.isArray(a.statuses) && a.statuses.includes('late')).length,
    total: (attendance || []).length,
  }

  // Fetch remarks
  const { data: remarks } = classId
    ? await supabase
        .from('report_remarks')
        .select('class_teacher_remark, principal_remark')
        .eq('student_id', student_id)
        .eq('class_id', classId)
        .eq('term_id', term_id)
        .single()
    : { data: null }

  // Fetch class teacher name
  let classTeacherName = ''
  if (classData?.class_teacher_id) {
    const { data: ct } = await supabase
      .from('teachers')
      .select('full_name')
      .eq('id', classData.class_teacher_id)
      .single()
    classTeacherName = ct?.full_name || ''
  }

  return NextResponse.json({
    report: {
      student: {
        id: student.id,
        full_name: student.full_name,
        photo_url: student.photo_url || null,
        dob: student.dob || null,
        gender: student.gender || null,
        guardian_name: student.guardian_name || null,
        guardian_phone: student.guardian_phone || null,
        admission: student.admission || null,
      },
      class: { id: classId || null, name: classData?.name || '' },
      term: { id: term_id, name: term?.name || '', session: (term?.academic_sessions as any)?.name || '' },
      subjects: subjectResults,
      summary: {
        total_marks: totalSum,
        average,
        position,
        subject_count: subjectCount,
      },
      attendance: attendanceSummary,
      class_teacher_name: classTeacherName,
      class_teacher_remark: (remarks as any)?.class_teacher_remark || '',
      principal_remark: (remarks as any)?.principal_remark || '',
    },
  })
}

// PUT: update remarks
export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const caller = await getCallerInfo(supabase)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (caller.role !== 'admin' && caller.role !== 'teacher') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { student_id, class_id, term_id, class_teacher_remark, principal_remark } = body

  if (!student_id || !class_id || !term_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const updateData: Record<string, string> = {}
  if (caller.role === 'admin' && principal_remark !== undefined) {
    updateData.principal_remark = principal_remark
  }
  if (class_teacher_remark !== undefined) {
    // Verify class teacher
    if (caller.role === 'teacher' && caller.teacherId) {
      const { data: classData } = await supabase
        .from('classes')
        .select('class_teacher_id')
        .eq('id', class_id)
        .single()
      if (classData?.class_teacher_id !== caller.teacherId) {
        return NextResponse.json({ error: 'Forbidden – not the class teacher' }, { status: 403 })
      }
    }
    updateData.class_teacher_remark = class_teacher_remark
  }

  const { data, error } = await supabase
    .from('report_remarks')
    .upsert(
      { student_id, class_id, term_id, ...updateData },
      { onConflict: 'student_id,class_id,term_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ remarks: data })
}
