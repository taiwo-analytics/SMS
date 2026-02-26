import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data: classes, error: cErr } = await supabaseAdmin
      .from('classes')
      .select('*')
      .order('class_level', { ascending: true })
      .order('name', { ascending: true })

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 400 })
    }

    // Collect all teacher IDs from both teacher_id (legacy) and class_teacher_id (new)
    const allTeacherIds = [...new Set([
      ...(classes || []).map((c: any) => c.class_teacher_id).filter(Boolean),
      ...(classes || []).map((c: any) => c.teacher_id).filter(Boolean),
    ])]
    const classIds = (classes || []).map((c: any) => c.id)

    const [{ data: teachers }, { data: enrollments }] = await Promise.all([
      allTeacherIds.length
        ? supabaseAdmin.from('teachers').select('id, full_name').in('id', allTeacherIds)
        : Promise.resolve({ data: [] as any[] }),
      classIds.length
        ? supabaseAdmin.from('class_enrollments').select('class_id').in('class_id', classIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const teacherMap: Record<string, string> = {}
    ;(teachers || []).forEach((t: any) => {
      teacherMap[t.id] = t.full_name
    })

    const enrollmentMap: Record<string, number> = {}
    ;(enrollments || []).forEach((e: any) => {
      enrollmentMap[e.class_id] = (enrollmentMap[e.class_id] || 0) + 1
    })

    const list = (classes || []).map((c: any) => {
      // Prefer class_teacher_id (new), fall back to teacher_id (legacy)
      const ctId = c.class_teacher_id || c.teacher_id
      return {
        ...c,
        teacher_name: ctId ? teacherMap[ctId] || 'Unassigned' : 'Unassigned',
        student_count: enrollmentMap[c.id] || 0,
      }
    })

    return NextResponse.json({ classes: list })
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
    const { class_level, department } = body || {}

    if (!class_level) {
      return NextResponse.json({ error: 'Class level is required' }, { status: 400 })
    }

    const { data: created, error } = await supabaseAdmin
      .from('classes')
      .insert({
        name: class_level,
        subject: null,
        teacher_id: null,
        class_level,
        department: department || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ class: created }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await req.json()
    const { id, class_level, department } = body || {}

    if (!id) {
      return NextResponse.json({ error: 'Missing class id' }, { status: 400 })
    }

    const { data: updated, error } = await supabaseAdmin
      .from('classes')
      .update({
        name: class_level || null,
        subject: null,
        class_level: class_level || null,
        department: department || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ class: updated })
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
      return NextResponse.json({ error: 'Missing class id' }, { status: 400 })
    }

    await supabaseAdmin.from('class_enrollments').delete().eq('class_id', id)
    const { error } = await supabaseAdmin.from('classes').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
