import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const class_id = searchParams.get('class_id')
    if (!class_id) {
      return NextResponse.json({ students: [] })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: cls, error: cErr } = await supabaseAdmin
      .from('classes')
      .select('id, class_level, department')
      .eq('id', class_id)
      .maybeSingle()
    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 400 })
    }
    const lvl = String((cls as any)?.class_level || '').toUpperCase()
    const classDept: string | null = (cls as any)?.department || (lvl.startsWith('JSS') ? 'General' : null)
    // Try to fetch per-student department from enrollments; if column missing, fall back to just student_id
    let enrollments: any[] = []
    let eErr: any = null
    const tryWithDept = await supabaseAdmin
      .from('class_enrollments')
      .select('student_id, department')
      .eq('class_id', class_id)
    if (tryWithDept.error && /department/i.test(String(tryWithDept.error.message || ''))) {
      const fallback = await supabaseAdmin
        .from('class_enrollments')
        .select('student_id')
        .eq('class_id', class_id)
      enrollments = fallback.data || []
      eErr = fallback.error || null
    } else {
      enrollments = tryWithDept.data || []
      eErr = tryWithDept.error || null
    }

    if (eErr) {
      return NextResponse.json({ error: eErr.message }, { status: 400 })
    }

    const ids = (enrollments || []).map((e: any) => e.student_id).filter(Boolean)
    const deptByStudent: Record<string, string> = {}
    for (const en of enrollments || []) {
      const sid = (en as any).student_id
      const dep = String((en as any)?.department || '').trim()
      if (sid && dep) deptByStudent[sid] = dep
    }
    if (!ids.length) {
      return NextResponse.json({ students: [] })
    }

    const { data: students, error: sErr } = await supabaseAdmin
      .from('students')
      .select('id, full_name, photo_url')
      .in('id', ids)
      .order('full_name', { ascending: true })

    if (sErr) {
      return NextResponse.json({ error: sErr.message }, { status: 400 })
    }

    const { data: payments, error: pErr } = await supabaseAdmin
      .from('payments')
      .select('student_id, status, amount, created_at')
      .in('student_id', ids)
      .order('created_at', { ascending: false })
    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 400 })
    }
    const latestByStudent: Record<string, { status: string | null; created_at: string | null }> = {}
    for (const p of payments || []) {
      const sid = (p as any).student_id
      if (!sid) continue
      if (!latestByStudent[sid]) {
        latestByStudent[sid] = { status: (p as any).status || null, created_at: (p as any).created_at || null }
      }
    }
    const augmented = (students || []).map((s: any) => {
      const latest = latestByStudent[s.id] || null
      const studentDept = lvl.startsWith('JSS')
        ? 'None'
        : (deptByStudent[s.id] || '')
      return {
        ...s,
        department: studentDept,
        payment_status: latest?.status || null,
        payment_updated_at: latest?.created_at || null,
      }
    })
    return NextResponse.json({ students: augmented })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
