import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data: enrollments, error: eErr } = await supabaseAdmin
      .from('class_enrollments')
      .select('*')
      .order('created_at', { ascending: false })

    if (eErr) {
      return NextResponse.json({ error: eErr.message }, { status: 400 })
    }

    const classIds = [...new Set((enrollments || []).map((e: any) => e.class_id))]
    const studentIds = [...new Set((enrollments || []).map((e: any) => e.student_id))]

    const [{ data: classes }, { data: students }] = await Promise.all([
      classIds.length
        ? supabaseAdmin.from('classes').select('id,name,class_level,department').in('id', classIds)
        : Promise.resolve({ data: [] as any[] }),
      studentIds.length
        ? supabaseAdmin.from('students').select('id,full_name').in('id', studentIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const classMap = new Map((classes || []).map((c: any) => [c.id, c]))
    const studentMap = new Map((students || []).map((s: any) => [s.id, s.full_name]))

    const list = (enrollments || []).map((e: any) => ({
      ...e,
      class_name: (classMap.get(e.class_id)?.name) || 'Unknown',
      student_department: (() => {
        const info = classMap.get(e.class_id)
        const lvl = String(info?.class_level || '').toUpperCase()
        if (lvl.startsWith('JSS')) return 'None'
        const dep = String(e?.department || '').trim()
        return dep || ''
      })(),
      student_name: studentMap.get(e.student_id) || 'Unknown',
    }))

    return NextResponse.json({ enrollments: list })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await req.json()
    const { class_id, student_id, department } = body || {}

    if (!class_id || !student_id) {
      return NextResponse.json(
        { error: 'Missing required fields: class_id, student_id' },
        { status: 400 }
      )
    }

    const { data: cls } = await supabaseAdmin
      .from('classes')
      .select('id, class_level')
      .eq('id', class_id)
      .maybeSingle()
    const lvl = String((cls as any)?.class_level || '').toUpperCase()
    const isJunior = lvl.startsWith('JSS')
    const finalDepartment =
      isJunior ? null : (typeof department === 'string' && department.trim() !== '' ? department.trim() : null)

    // Enforce one class per student: remove any existing enrollments first
    await supabaseAdmin.from('class_enrollments').delete().eq('student_id', student_id)

    let payload: any = { class_id, student_id }
    if (finalDepartment && typeof finalDepartment === 'string') {
      payload.department = finalDepartment
    }

    let upsertRes = await supabaseAdmin
      .from('class_enrollments')
      .upsert(payload, { onConflict: 'class_id,student_id' })
      .select()
      .single()

    let data = upsertRes.data
    let error = upsertRes.error

    if (error && payload.department) {
      const msg = String(error.message || '').toLowerCase()
      if (msg.includes('department') && msg.includes('schema')) {
        const fallback = await supabaseAdmin
          .from('class_enrollments')
          .upsert({ class_id, student_id }, { onConflict: 'class_id,student_id' })
          .select()
          .single()
        data = fallback.data
        error = fallback.error
      }
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Recompute and update class-level department label for senior classes
    try {
      const { data: cls2 } = await supabaseAdmin
        .from('classes')
        .select('id, class_level')
        .eq('id', class_id)
        .maybeSingle()
      const lvl2 = String((cls2 as any)?.class_level || '').toUpperCase()
      if (lvl2.startsWith('SS')) {
        let classDep: string | null = null
        // Try to derive from enrollments if column is present
        const rowsRes = await supabaseAdmin
          .from('class_enrollments')
          .select('department')
          .eq('class_id', class_id)
        if (!rowsRes.error) {
          const set = new Set<string>(
            (rowsRes.data || [])
              .map((r: any) => String(r?.department || '').trim())
              .filter(Boolean)
          )
          if (set.size === 1) classDep = Array.from(set)[0]
          else classDep = null
        } else {
          // If selecting department fails due to schema mismatch, fall back to the selected one
          if (typeof finalDepartment === 'string' && finalDepartment.trim() !== '') {
            classDep = finalDepartment.trim()
          } else {
            classDep = null
          }
        }
        await supabaseAdmin.from('classes').update({ department: classDep }).eq('id', class_id)
      }
    } catch (_) {
      // Non-blocking: ignore errors updating class label
    }

    return NextResponse.json({ success: true, enrollment: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing enrollment id' }, { status: 400 })
    }
    const { error } = await supabaseAdmin.from('class_enrollments').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
