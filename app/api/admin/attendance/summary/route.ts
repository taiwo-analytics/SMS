import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

/**
 * GET /api/admin/attendance/summary
 * Returns attendance rates grouped by class for a given period.
 * Params:
 *   view: 'day' | 'week' | 'month' (default 'week')
 *   class_id?: filter to a single class
 *   date?: reference date (default today, ISO format)
 */
export async function GET(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') || 'week'
  const classId = searchParams.get('class_id')
  const refDate = searchParams.get('date') || new Date().toISOString().slice(0, 10)

  // Calculate date range based on view
  const ref = new Date(refDate + 'T00:00:00')
  let from: string
  let to: string

  if (view === 'day') {
    from = refDate
    to = refDate
  } else if (view === 'week') {
    const day = ref.getDay()
    const monday = new Date(ref)
    monday.setDate(ref.getDate() - (day === 0 ? 6 : day - 1))
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    from = monday.toISOString().slice(0, 10)
    to = friday.toISOString().slice(0, 10)
  } else {
    // month
    from = `${refDate.slice(0, 7)}-01`
    const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
    to = lastDay.toISOString().slice(0, 10)
  }

  // Fetch attendance records in the range
  let query = supabase
    .from('attendance')
    .select('id, class_id, date, statuses, classes(id, name)')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })

  if (classId) query = query.eq('class_id', classId)

  const { data: records, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Fetch all classes for context
  const { data: allClasses } = await supabase
    .from('classes')
    .select('id, name')
    .order('name')

  // Aggregate: group by class, compute present/absent/late counts
  const classMap: Record<string, {
    class_id: string
    class_name: string
    present: number
    absent: number
    late: number
    total: number
  }> = {}

  for (const r of (records || []) as any[]) {
    const cid = r.class_id
    const cname = r.classes?.name || 'Unknown'
    if (!classMap[cid]) {
      classMap[cid] = { class_id: cid, class_name: cname, present: 0, absent: 0, late: 0, total: 0 }
    }
    const statuses: string[] = r.statuses || []
    classMap[cid].total += 1
    if (statuses.includes('present')) classMap[cid].present += 1
    if (statuses.includes('absent')) classMap[cid].absent += 1
    if (statuses.includes('late')) classMap[cid].late += 1
  }

  // Build per-class summary with rates
  const summary = Object.values(classMap).map((c) => ({
    ...c,
    attendance_rate: c.total > 0 ? Math.round(((c.present + c.late) / c.total) * 100) : 0,
  }))

  // Also build daily breakdown for trend line
  const dayMap: Record<string, { date: string; present: number; absent: number; late: number; total: number }> = {}
  for (const r of (records || []) as any[]) {
    const d = r.date
    if (!dayMap[d]) {
      dayMap[d] = { date: d, present: 0, absent: 0, late: 0, total: 0 }
    }
    const statuses: string[] = r.statuses || []
    dayMap[d].total += 1
    if (statuses.includes('present')) dayMap[d].present += 1
    if (statuses.includes('absent')) dayMap[d].absent += 1
    if (statuses.includes('late')) dayMap[d].late += 1
  }

  const trend = Object.values(dayMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      attendance_rate: d.total > 0 ? Math.round(((d.present + d.late) / d.total) * 100) : 0,
    }))

  // Overall rate
  const totalRecords = (records || []).length
  const totalPresent = Object.values(classMap).reduce((s, c) => s + c.present + c.late, 0)
  const overallRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0

  return NextResponse.json({
    from,
    to,
    view,
    overall_rate: overallRate,
    total_records: totalRecords,
    by_class: summary,
    trend,
    classes: (allClasses || []).map((c: any) => ({ id: c.id, name: c.name })),
  })
}
