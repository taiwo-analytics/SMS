import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const [settingsRes, subjectsRes, classesRes, timetablesRes, cstRes, sessionsRes, termsRes, eventsRes, messagesRes, inventoryRes, booksRes, paymentsRes] =
      await Promise.all([
        supabaseAdmin.from('settings').select('*'),
        supabaseAdmin.from('subjects').select('*'),
        supabaseAdmin.from('classes').select('*'),
        supabaseAdmin.from('timetables').select('*'),
        supabaseAdmin.from('class_subject_teachers').select('*'),
        supabaseAdmin.from('academic_sessions').select('*'),
        supabaseAdmin.from('academic_terms').select('*'),
        supabaseAdmin.from('events').select('*'),
        supabaseAdmin.from('messages').select('*'),
        supabaseAdmin.from('inventory_items').select('*'),
        supabaseAdmin.from('books').select('*'),
        supabaseAdmin.from('payments').select('*'),
      ])

    const usersRes = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const users = (usersRes.data?.users || []).map(u => ({ id: u.id, email: u.email || null }))

    const data = {
      exported_at: new Date().toISOString(),
      users,
      tables: {
        settings: settingsRes.data || [],
        subjects: subjectsRes.data || [],
        classes: classesRes.data || [],
        timetables: timetablesRes.data || [],
        class_subject_teachers: cstRes.data || [],
        academic_sessions: sessionsRes.data || [],
        academic_terms: termsRes.data || [],
        events: eventsRes.data || [],
        messages: messagesRes.data || [],
        inventory_items: inventoryRes.data || [],
        books: booksRes.data || [],
        payments: paymentsRes.data || [],
      },
    }

    const body = JSON.stringify(data, null, 2)
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="school-backup-${ts}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
