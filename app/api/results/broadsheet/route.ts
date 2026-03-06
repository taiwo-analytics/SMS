import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
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
  const class_id = searchParams.get('class_id')
  const term_id = searchParams.get('term_id')
  const view = searchParams.get('view') || 'students' // students | subjects

  if (!class_id || !term_id) {
    return NextResponse.json({ error: 'class_id and term_id are required' }, { status: 400 })
  }

  let accessType: 'full' | 'subject' | null = null
  let allowedSubjectIds: string[] = []

  if (caller.role === 'admin') {
    accessType = 'full'
  } else if (caller.role === 'teacher' && caller.teacherId) {
    // Check if class teacher
    const { data: classData } = await supabase
      .from('classes')
      .select('class_teacher_id')
      .eq('id', class_id)
      .single()
    if (classData?.class_teacher_id === caller.teacherId) {
      accessType = 'full'
    } else {
      // Check subject teacher assignments
      const { data: cst } = await supabase
        .from('class_subject_teachers')
        .select('subject_id')
        .eq('class_id', class_id)
        .eq('teacher_id', caller.teacherId)
      if (cst && cst.length > 0) {
        accessType = 'subject'
        allowedSubjectIds = cst.map((r: any) => r.subject_id)
      }
    }
  }

  if (!accessType) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Determine which subjects this teacher can edit scores for
  let editableSubjectIds: string[] = []
  if (caller.role === 'teacher' && caller.teacherId && accessType === 'subject') {
    editableSubjectIds = allowedSubjectIds
  }

  // Fetch all scores for class+term
  let scoresQuery = supabase
    .from('subject_scores')
    .select(`
      *,
      students(id, full_name),
      subjects(id, name, code)
    `)
    .eq('class_id', class_id)
    .eq('term_id', term_id)

  if (accessType === 'subject' && allowedSubjectIds.length > 0) {
    scoresQuery = scoresQuery.in('subject_id', allowedSubjectIds)
  }

  const { data: scores, error } = await scoresQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const admin = getSupabaseAdmin()
  const norm = (s: any) => String(s || '').trim().toLowerCase()

  // Fetch class info for department resolution
  const { data: classInfo } = await admin
    .from('classes')
    .select('id, class_level, department')
    .eq('id', class_id)
    .maybeSingle()
  const classLevel = String((classInfo as any)?.class_level || '').toUpperCase()
  const isSenior = classLevel.startsWith('SS')
  const classDeptNorm = norm((classInfo as any)?.department)

  // Fetch enrolled students with department info
  const { data: enrollments } = await admin
    .from('class_enrollments')
    .select('student_id, department, students(id, full_name, department)')
    .eq('class_id', class_id)

  // Fetch subjects for the class
  let subjectsQuery = supabase
    .from('class_subject_teachers')
    .select('subject_id, subjects(id, name, code)')
    .eq('class_id', class_id)
  if (accessType === 'subject' && allowedSubjectIds.length > 0) {
    subjectsQuery = subjectsQuery.in('subject_id', allowedSubjectIds)
  }
  const { data: classSubjects } = await subjectsQuery

  // Build unique subjects list
  const subjectsMap = new Map<string, { id: string; name: string; code?: string }>()
  for (const cs of (classSubjects || [])) {
    const sub = cs.subjects as any
    if (sub) subjectsMap.set(sub.id, sub)
  }
  // Also include subjects from scores in case not in class_subject_teachers
  for (const sc of (scores || [])) {
    const sub = sc.subjects as any
    if (sub && !subjectsMap.has(sub.id)) subjectsMap.set(sub.id, sub)
  }

  // Fetch department restrictions for all subjects in view
  const subjectIds = Array.from(subjectsMap.keys())
  const subjectDeptsMap = new Map<string, string[]>() // subject_id -> department list
  if (subjectIds.length > 0 && isSenior) {
    const { data: subjectRows } = await admin
      .from('subjects')
      .select('id, departments, department')
      .in('id', subjectIds)
    for (const s of (subjectRows || [])) {
      let depts: string[] = []
      if (Array.isArray((s as any).departments) && (s as any).departments.length > 0) {
        depts = (s as any).departments
      } else if ((s as any).department) {
        depts = String((s as any).department).split(';').map((d: string) => d.trim()).filter(Boolean)
      }
      if (depts.length > 0) subjectDeptsMap.set(s.id, depts)
    }
  }

  // Resolve each enrollment's department and build student list
  // For SS classes with dept-restricted subjects, filter students accordingly
  const enrollmentDepts = new Map<string, string>() // student_id -> resolved dept
  const studentsMap = new Map<string, string>()

  // Check if ANY subject in view has department restrictions
  const anySubjectHasDepts = subjectDeptsMap.size > 0

  for (const e of (enrollments || [])) {
    const s = (e as any).students
    if (!s) continue
    const resolved = norm((e as any).department) || norm(s.department) || classDeptNorm
    enrollmentDepts.set(s.id, resolved)

    if (!isSenior || !anySubjectHasDepts) {
      // JSS or no dept-restricted subjects: show all students
      studentsMap.set(s.id, s.full_name)
    } else {
      // SS with dept-restricted subjects: include student if they match at least one subject's department
      // or if there are core subjects (no dept restriction) in the view
      const hasCoreSubject = subjectIds.some((sid) => !subjectDeptsMap.has(sid))
      if (hasCoreSubject) {
        studentsMap.set(s.id, s.full_name)
      } else if (resolved) {
        // Only include if student's dept matches at least one subject
        const matches = Array.from(subjectDeptsMap.values()).some((depts) =>
          depts.some((d) => norm(d) === resolved)
        )
        if (matches) studentsMap.set(s.id, s.full_name)
      }
      // If resolved is empty and all subjects have dept restrictions, student is excluded
    }
  }

  // Index scores by student+subject
  const scoreIndex = new Map<string, any>()
  for (const sc of (scores || [])) {
    scoreIndex.set(`${sc.student_id}:${sc.subject_id}`, sc)
  }

  const students = Array.from(studentsMap.entries()).map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const subjects = Array.from(subjectsMap.values())
    .sort((a, b) => a.name.localeCompare(b.name))

  if (view === 'students') {
    // Rows = students, cols = subjects
    const rows = students.map((student) => {
      const cells: Record<string, { ca: number; exam: number; total: number; grade: string; remark: string } | null> = {}
      let totalSum = 0
      let subjectCount = 0
      for (const subject of subjects) {
        const sc = scoreIndex.get(`${student.id}:${subject.id}`)
        if (sc) {
          const total = Number(sc.total) || 0
          const { grade, remark } = getGrade(total)
          cells[subject.id] = { ca: Number(sc.ca_score), exam: Number(sc.exam_score), total, grade, remark }
          totalSum += total
          subjectCount++
        } else {
          cells[subject.id] = null
        }
      }
      const average = subjectCount > 0 ? totalSum / subjectCount : 0
      return { student, cells, totalSum, average: Math.round(average * 100) / 100, subjectCount }
    })

    // Add position (rank by average)
    const sorted = [...rows].sort((a, b) => b.average - a.average)
    const rowsWithPosition = rows.map((row) => ({
      ...row,
      position: sorted.findIndex((r) => r.student.id === row.student.id) + 1,
    }))

    return NextResponse.json({ view: 'students', subjects, rows: rowsWithPosition, accessType, editableSubjectIds })
  } else {
    // Rows = subjects, cols = students
    const rows = subjects.map((subject) => {
      const cells: Record<string, { ca: number; exam: number; total: number; grade: string } | null> = {}
      for (const student of students) {
        const sc = scoreIndex.get(`${student.id}:${subject.id}`)
        if (sc) {
          const total = Number(sc.total) || 0
          const { grade } = getGrade(total)
          cells[student.id] = { ca: Number(sc.ca_score), exam: Number(sc.exam_score), total, grade }
        } else {
          cells[student.id] = null
        }
      }
      return { subject, cells }
    })
    return NextResponse.json({ view: 'subjects', students, rows, accessType, editableSubjectIds })
  }
}
