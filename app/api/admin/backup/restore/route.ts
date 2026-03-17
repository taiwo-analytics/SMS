import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await req.json()
    const tables = body?.tables || {}

    const subjects = Array.isArray(tables.subjects) ? tables.subjects : []
    const classes = Array.isArray(tables.classes) ? tables.classes : []
    const sessions = Array.isArray(tables.academic_sessions) ? tables.academic_sessions : []
    const terms = Array.isArray(tables.academic_terms) ? tables.academic_terms : []
    const timetables = Array.isArray(tables.timetables) ? tables.timetables : []
    const cst = Array.isArray(tables.class_subject_teachers) ? tables.class_subject_teachers : []
    const settings = Array.isArray(tables.settings) ? tables.settings : []
    const events = Array.isArray(tables.events) ? tables.events : []
    const inventory = Array.isArray(tables.inventory_items) ? tables.inventory_items : []
    const inventoryAssignments = Array.isArray(tables.inventory_assignments) ? tables.inventory_assignments : []
    const books = Array.isArray(tables.books) ? tables.books : []
    const payments = Array.isArray(tables.payments) ? tables.payments : []

    const results: Record<string, any> = {}
    const doUpsert = async (table: string, rows: any[]) => {
      if (!rows.length) return
      const res = await supabaseAdmin.from(table).upsert(rows as any, { onConflict: 'id' })
      if (res.error) results[table] = { error: res.error.message }
      else results[table] = { count: rows.length }
    }

    if (settings.length) await doUpsert('settings', settings)
    if (sessions.length) await doUpsert('academic_sessions', sessions)
    if (terms.length) await doUpsert('academic_terms', terms)
    if (subjects.length) await doUpsert('subjects', subjects)
    if (classes.length) await doUpsert('classes', classes)
    if (timetables.length) await doUpsert('timetables', timetables)
    if (cst.length) await doUpsert('class_subject_teachers', cst)
    if (events.length) await doUpsert('events', events)
    if (inventory.length) await doUpsert('inventory_items', inventory)
    if (inventoryAssignments.length) await doUpsert('inventory_assignments', inventoryAssignments)
    if (books.length) await doUpsert('books', books)
    if (payments.length) await doUpsert('payments', payments)

    return NextResponse.json({ ok: true, results })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
