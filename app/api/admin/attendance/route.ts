import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

/**
 * GET /api/admin/attendance
 * Params: class_id?, date?, student_id?, from?, to?, view=daily|weekly|monthly
 */
export async function GET(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const class_id = searchParams.get('class_id')
  const date = searchParams.get('date')
  const student_id = searchParams.get('student_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('attendance')
    .select('*, students(id, full_name, photo_url), classes(id, name, class_level)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (class_id) query = query.eq('class_id', class_id)
  if (date) query = query.eq('date', date)
  if (student_id) query = query.eq('student_id', student_id)
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data: records, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ records: records || [] })
}
