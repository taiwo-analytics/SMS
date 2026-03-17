import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const [
      profilesRes,
      teachersRes,
      studentsRes,
      parentsRes,
      classesRes,
      enrollmentsRes,
      gradesRes,
      attendanceRes,
      subjectsRes,
      timetablesRes,
      cstRes,
      sessionsRes,
      termsRes,
      eventsRes,
      messagesRes,
      inventoryRes,
      inventoryAssignmentsRes,
      booksRes,
      paymentsRes,
      settingsRes,
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*'),
      supabaseAdmin.from('teachers').select('*'),
      supabaseAdmin.from('students').select('*'),
      supabaseAdmin.from('parents').select('*'),
      supabaseAdmin.from('classes').select('*'),
      supabaseAdmin.from('class_enrollments').select('*'),
      supabaseAdmin.from('grades').select('*'),
      supabaseAdmin.from('attendance').select('*'),
      supabaseAdmin.from('subjects').select('*'),
      supabaseAdmin.from('timetables').select('*'),
      supabaseAdmin.from('class_subject_teachers').select('*'),
      supabaseAdmin.from('academic_sessions').select('*'),
      supabaseAdmin.from('academic_terms').select('*'),
      supabaseAdmin.from('events').select('*'),
      supabaseAdmin.from('messages').select('*'),
      supabaseAdmin.from('inventory_items').select('*'),
      supabaseAdmin.from('inventory_assignments').select('*'),
      supabaseAdmin.from('books').select('*'),
      supabaseAdmin.from('payments').select('*'),
      supabaseAdmin.from('settings').select('*'),
    ])

    const usersRes = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const users = (usersRes.data?.users || []).map(u => ({
      id: u.id,
      email: u.email || null,
      metadata: u.user_metadata || {},
    }))

    const data = {
      exported_at: new Date().toISOString(),
      users,
      tables: {
        profiles: profilesRes.data || [],
        teachers: teachersRes.data || [],
        students: studentsRes.data || [],
        parents: parentsRes.data || [],
        classes: classesRes.data || [],
        class_enrollments: enrollmentsRes.data || [],
        grades: gradesRes.data || [],
        attendance: attendanceRes.data || [],
        subjects: subjectsRes.data || [],
        timetables: timetablesRes.data || [],
        class_subject_teachers: cstRes.data || [],
        academic_sessions: sessionsRes.data || [],
        academic_terms: termsRes.data || [],
        events: eventsRes.data || [],
        messages: messagesRes.data || [],
        inventory_items: inventoryRes.data || [],
        inventory_assignments: inventoryAssignmentsRes.data || [],
        books: booksRes.data || [],
        payments: paymentsRes.data || [],
        settings: settingsRes.data || [],
      },
    }

    const body = JSON.stringify(data, null, 2)
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="school-full-backup-${ts}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
