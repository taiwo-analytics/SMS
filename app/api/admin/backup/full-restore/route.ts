import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

function randomPassword() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

export async function POST(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    // Extra safeguards
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Full restore blocked in production' }, { status: 403 })
    }
    if (process.env.DEV_ENABLE_FULL_RESTORE !== 'true') {
      return NextResponse.json({ error: 'Set DEV_ENABLE_FULL_RESTORE=true to allow full restore' }, { status: 403 })
    }
    const supabaseAdmin = getSupabaseAdmin()
    const body = await req.json()

    const users = Array.isArray(body?.users) ? body.users : []
    const tables = body?.tables || {}

    // Build email -> oldUserId map
    const oldIdByEmail: Record<string, string> = {}
    for (const u of users) {
      if (u?.email && u?.id) oldIdByEmail[String(u.email).toLowerCase()] = String(u.id)
    }

    // Existing auth users
    const authRes = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const existingByEmail: Record<string, string> = {}
    for (const u of authRes.data?.users || []) {
      if (u.email) existingByEmail[u.email.toLowerCase()] = u.id
    }

    // Create any missing users and map old -> new ids
    const oldToNew: Record<string, string> = {}
    for (const u of users) {
      const email = (u?.email || '').toLowerCase()
      if (!email) continue
      const oldId = String(u.id)
      let newId = existingByEmail[email]
      if (!newId) {
        const pw = randomPassword()
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: pw,
          email_confirm: true,
          user_metadata: u?.metadata || {},
        })
        if (error || !created?.user) {
          return NextResponse.json({ error: `Failed to create user ${email}: ${error?.message || 'unknown'}` }, { status: 400 })
        }
        newId = created.user.id
        existingByEmail[email] = newId
      }
      oldToNew[oldId] = newId
    }

    // Helper to rewrite user_id references
    const mapUserId = (row: any, key: string) => {
      if (row && row[key] && oldToNew[row[key]]) row[key] = oldToNew[row[key]]
    }

    // Prepare rows with remapped auth user ids
    const parents = (tables.parents || []).map((r: any) => {
      const row = { ...r }
      mapUserId(row, 'user_id')
      return row
    })
    const students = (tables.students || []).map((r: any) => {
      const row = { ...r }
      mapUserId(row, 'user_id')
      return row
    })
    const teachers = (tables.teachers || []).map((r: any) => {
      const row = { ...r }
      mapUserId(row, 'user_id')
      return row
    })

    const inventoryAssignments = (tables.inventory_assignments || []).map((r: any) => {
      const row = { ...r }
      mapUserId(row, 'assigned_to')
      return row
    })

    // Upsert order (parents/students/teachers first so FKs exist)
    const results: Record<string, any> = {}
    const doUpsert = async (table: string, rows: any[], onConflict = 'id') => {
      if (!rows || rows.length === 0) return
      const res = await supabaseAdmin.from(table).upsert(rows as any, { onConflict })
      if (res.error) results[table] = { error: res.error.message }
      else results[table] = { count: rows.length }
    }

    await doUpsert('parents', parents)
    await doUpsert('students', students)
    await doUpsert('teachers', teachers)

    // Profiles should match new auth user ids
    const profiles = (tables.profiles || []).map((r: any) => {
      const row = { ...r }
      if (row.id && oldToNew[row.id]) row.id = oldToNew[row.id]
      return row
    })
    await doUpsert('profiles', profiles)

    // Remaining master and relational tables (ids preserved)
    await doUpsert('subjects', tables.subjects || [])
    await doUpsert('classes', tables.classes || [])
    await doUpsert('academic_sessions', tables.academic_sessions || [])
    await doUpsert('academic_terms', tables.academic_terms || [])
    await doUpsert('timetables', tables.timetables || [])
    await doUpsert('class_subject_teachers', tables.class_subject_teachers || [])
    await doUpsert('class_enrollments', tables.class_enrollments || [])
    await doUpsert('grades', tables.grades || [])
    await doUpsert('attendance', tables.attendance || [])
    await doUpsert('events', tables.events || [])
    await doUpsert('messages', tables.messages || [])
    await doUpsert('inventory_items', tables.inventory_items || [])
    await doUpsert('inventory_assignments', inventoryAssignments)
    await doUpsert('books', tables.books || [])
    await doUpsert('payments', tables.payments || [])
    await doUpsert('settings', tables.settings || [], 'key')

    return NextResponse.json({ ok: true, results })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
