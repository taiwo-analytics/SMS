import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET() {
  const admin = getSupabaseAdmin()

  // 1. Get Chemistry subject
  const { data: allSubjects } = await admin
    .from('subjects')
    .select('id, name, departments, department')
    .order('name')

  // 2. Get SS3 classes
  const { data: ss3Classes } = await admin
    .from('classes')
    .select('id, name, class_level, department')
    .ilike('class_level', 'SS3%')

  // 3. Get enrollments for first SS3 class
  let enrollmentSample: any[] = []
  if (ss3Classes && ss3Classes.length > 0) {
    const { data: enrollments } = await admin
      .from('class_enrollments')
      .select('student_id, department, students(id, full_name, department)')
      .eq('class_id', ss3Classes[0].id)
      .limit(15)
    enrollmentSample = (enrollments || []).map((e: any) => ({
      student: e.students?.full_name,
      enrollment_dept: e.department,
      student_dept: e.students?.department,
    }))
  }

  return NextResponse.json({
    subjects: (allSubjects || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      departments: s.departments,
      department_legacy: s.department,
    })),
    ss3_classes: ss3Classes,
    enrollments_in_first_ss3: enrollmentSample,
  }, { status: 200 })
}
