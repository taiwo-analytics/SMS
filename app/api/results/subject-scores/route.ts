import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

async function getTeacherAndRole(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
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

// GET: fetch scores for a class+subject+term
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const caller = await getTeacherAndRole(supabase)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const class_id = searchParams.get('class_id')
  const subject_id = searchParams.get('subject_id')
  const term_id = searchParams.get('term_id')

  if (!class_id || !term_id) {
    return NextResponse.json({ error: 'class_id and term_id are required' }, { status: 400 })
  }

  // Access check for teachers
  if (caller.role === 'teacher') {
    if (!caller.teacherId) return NextResponse.json({ error: 'Teacher record not found' }, { status: 403 })
    // Must be class teacher OR subject teacher for this class
    const { data: cst } = await supabase
      .from('class_subject_teachers')
      .select('id')
      .eq('class_id', class_id)
      .eq('teacher_id', caller.teacherId)
    const { data: classData } = await supabase
      .from('classes')
      .select('class_teacher_id')
      .eq('id', class_id)
      .single()
    const isClassTeacher = classData?.class_teacher_id === caller.teacherId
    const isSubjectTeacher = (cst?.length ?? 0) > 0
    if (!isClassTeacher && !isSubjectTeacher) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (caller.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let query = supabase
    .from('subject_scores')
    .select(`
      *,
      students(id, full_name, photo_url),
      subjects(id, name, code)
    `)
    .eq('class_id', class_id)
    .eq('term_id', term_id)

  if (subject_id) query = query.eq('subject_id', subject_id)

  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ scores: data })
}

// POST: upsert a score
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const caller = await getTeacherAndRole(supabase)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { student_id, class_id, subject_id, term_id, ca1_score, ca2_score, exam_score } = body

  if (!student_id || !class_id || !subject_id || !term_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Validate scores
  if (ca1_score !== undefined && (ca1_score < 0 || ca1_score > 20)) {
    return NextResponse.json({ error: 'CA1 score must be between 0 and 20' }, { status: 400 })
  }
  if (ca2_score !== undefined && (ca2_score < 0 || ca2_score > 20)) {
    return NextResponse.json({ error: 'CA2 score must be between 0 and 20' }, { status: 400 })
  }
  if (exam_score !== undefined && (exam_score < 0 || exam_score > 60)) {
    return NextResponse.json({ error: 'Exam score must be between 0 and 60' }, { status: 400 })
  }

  // Access check — only the assigned subject teacher can record scores
  if (caller.role !== 'teacher' || !caller.teacherId) {
    return NextResponse.json({ error: 'Only assigned subject teachers can record scores' }, { status: 403 })
  }
  const { data: cst } = await supabase
    .from('class_subject_teachers')
    .select('id')
    .eq('class_id', class_id)
    .eq('subject_id', subject_id)
    .eq('teacher_id', caller.teacherId)
    .single()
  if (!cst) return NextResponse.json({ error: 'Forbidden – not your subject' }, { status: 403 })

  const teacherId = caller.teacherId

  const { data, error } = await supabase
    .from('subject_scores')
    .upsert(
      {
        student_id,
        class_id,
        subject_id,
        term_id,
        teacher_id: teacherId,
        ca1_score: ca1_score ?? 0,
        ca2_score: ca2_score ?? 0,
        exam_score: exam_score ?? 0,
      },
      { onConflict: 'student_id,class_id,subject_id,term_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ score: data })
}
