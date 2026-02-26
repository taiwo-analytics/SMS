import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    let supabaseAdmin: any
    try {
      supabaseAdmin = getSupabaseAdmin()
    } catch {
      supabaseAdmin = await createServerSupabaseClient()
    }

    const { data: teachers, error: tErr } = await supabaseAdmin
      .from('teachers')
      .select('*')
      .order('created_at', { ascending: false })

    if (tErr) {
      return NextResponse.json({ error: tErr.message }, { status: 400 })
    }

    const teacherIds = (teachers || []).map((t: any) => t.id)

    const [{ data: classes }, { data: classSubjectTeachers }] = await Promise.all([
      teacherIds.length
        ? supabaseAdmin.from('classes').select('*').in('teacher_id', teacherIds)
        : Promise.resolve({ data: [] as any[] }),
      teacherIds.length
        ? supabaseAdmin.from('class_subject_teachers').select('*').in('teacher_id', teacherIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const classIdsForSubjects = [...new Set((classSubjectTeachers || []).map((r: any) => r.class_id))]
    const subjectIdsForSubjects = [...new Set((classSubjectTeachers || []).map((r: any) => r.subject_id))]

    const [{ data: subjectRows }, { data: classRowsForSubjects }] = await Promise.all([
      subjectIdsForSubjects.length
        ? supabaseAdmin.from('subjects').select('id, name, code').in('id', subjectIdsForSubjects)
        : Promise.resolve({ data: [] as any[] }),
      classIdsForSubjects.length
        ? supabaseAdmin.from('classes').select('id, name, class_level').in('id', classIdsForSubjects)
        : Promise.resolve({ data: [] as any[] }),
    ])

    // Fetch auth users to get emails
    const userIds = (teachers || []).map((t: any) => t.user_id).filter(Boolean)
    const emailMap: Record<string, string> = {}
    if (userIds.length > 0 && supabaseAdmin?.auth?.admin?.listUsers) {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      if (authData?.users) {
        for (const u of authData.users) {
          if (u.email) emailMap[u.id] = u.email
        }
      }
    }

    const subjectMap = new Map((subjectRows || []).map((s: any) => [s.id, s]))
    const classMapForSubjects = new Map((classRowsForSubjects || []).map((c: any) => [c.id, c]))

    const teachersWithDetails = (teachers || []).map((teacher: any) => {
      const subjectAssignments = (classSubjectTeachers || [])
        .filter((row: any) => row.teacher_id === teacher.id)
        .map((row: any) => {
          const subject = subjectMap.get(row.subject_id)
          const cls = classMapForSubjects.get(row.class_id)
          const classLabel = cls
            ? `${cls.class_level || cls.name}${cls.class_level || cls.name ? (cls.department ? ` - ${cls.department}` : '') : ''}`
            : 'Unknown class'
          const subjectLabel = subject
            ? `${subject.name}${subject.code ? ` (${subject.code})` : ''}`
            : 'Unknown subject'

          return {
            id: row.id,
            class_id: row.class_id,
            subject_id: row.subject_id,
            class_label: classLabel,
            subject_label: subjectLabel,
          }
        })

      return {
        ...teacher,
        email: emailMap[teacher.user_id] || 'N/A',
        classes: (classes || []).filter((c: any) => c.teacher_id === teacher.id),
        subjects: [...new Set(subjectAssignments.map((a: any) => a.subject_label))],
        subject_assignments: subjectAssignments,
      }
    })

    return NextResponse.json({ teachers: teachersWithDetails })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
