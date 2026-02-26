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
    const { type, teacher_id, class_id, subject_id, category, department, departments } = body || {}

    if (!type || !teacher_id) {
      return NextResponse.json(
        { error: 'Missing required fields: type, teacher_id' },
        { status: 400 }
      )
    }

    if (type === 'class_teacher') {
      if (!class_id) {
        return NextResponse.json(
          { error: 'Missing class_id for class_teacher' },
          { status: 400 }
        )
      }
      // Write to class_teacher_id (new column used by results system)
      // Also keep teacher_id in sync for legacy compatibility
      const { error } = await supabaseAdmin
        .from('classes')
        .update({ class_teacher_id: teacher_id, teacher_id })
        .eq('id', class_id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    }

    if (type === 'remove_class_teacher') {
      if (!class_id) {
        return NextResponse.json(
          { error: 'Missing class_id for remove_class_teacher' },
          { status: 400 }
        )
      }
      const { error } = await supabaseAdmin
        .from('classes')
        .update({ class_teacher_id: null, teacher_id: null })
        .eq('id', class_id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    }

    if (type === 'subject_teacher') {
      if (!subject_id) {
        return NextResponse.json({ error: 'Missing subject_id for subject_teacher' }, { status: 400 })
      }

      // If a specific class_id is provided, assign only to that class
      if (class_id) {
        const { error } = await supabaseAdmin
          .from('class_subject_teachers')
          .upsert(
            { class_id, subject_id, teacher_id },
            { onConflict: 'class_id,subject_id' }
          )

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ success: true, count: 1 })
      }

      // No class selected: assign across all relevant classes
      // Filter by category (junior/senior) and department(s)
      let query = supabaseAdmin.from('classes').select('id,class_level,department')
      if (category && typeof category === 'string') {
        const cat = category.toLowerCase()
        if (cat === 'junior') {
          query = query.ilike('class_level', 'JSS%')
        } else if (cat === 'senior') {
          query = query.ilike('class_level', 'SS%')
        }
      }
      let departmentsToUse: string[] | null = null
      if (Array.isArray(departments) && departments.length) {
        departmentsToUse = departments.map((d: string) => String(d).trim()).filter(Boolean)
      } else if (department && String(department).trim() !== '') {
        departmentsToUse = [String(department).trim()]
      } else {
        // Only select 'departments' from subjects to avoid referencing non-existent legacy columns
        const { data: subj, error: sErr } = await supabaseAdmin
          .from('subjects')
          .select('departments')
          .eq('id', subject_id)
          .maybeSingle()
        if (sErr) {
          return NextResponse.json({ error: sErr.message }, { status: 400 })
        }
        const fromArray: string[] = Array.isArray((subj as any)?.departments)
          ? ((subj as any).departments as string[]).filter(Boolean)
          : []
        departmentsToUse = fromArray.length ? fromArray : null
      }
      if (departmentsToUse && departmentsToUse.length) {
        query = query.in('department', departmentsToUse)
      }
      const { data: classes, error: cErr } = await query
      if (cErr) {
        return NextResponse.json({ error: cErr.message }, { status: 400 })
      }
      let selectedClasses = classes || []
      if ((!selectedClasses || selectedClasses.length === 0) && departmentsToUse && departmentsToUse.length) {
        let fallbackQuery = supabaseAdmin.from('classes').select('id,class_level,department')
        if (category && typeof category === 'string') {
          const cat = category.toLowerCase()
          if (cat === 'junior') {
            fallbackQuery = fallbackQuery.ilike('class_level', 'JSS%')
          } else if (cat === 'senior') {
            fallbackQuery = fallbackQuery.ilike('class_level', 'SS%')
          }
        }
        const { data: allClasses, error: fErr } = await fallbackQuery
        if (fErr) {
          return NextResponse.json({ error: fErr.message }, { status: 400 })
        }
        selectedClasses = allClasses || []
      }
      const targets = (selectedClasses || []).map((c: any) => ({
        class_id: c.id,
        subject_id,
        teacher_id,
      }))
      if (targets.length === 0) {
        return NextResponse.json({ success: true, count: 0 })
      }
      const { error: upErr } = await supabaseAdmin
        .from('class_subject_teachers')
        .upsert(targets, { onConflict: 'class_id,subject_id' })
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, count: targets.length })
    }

    return NextResponse.json({ error: 'Invalid assignment type' }, { status: 400 })
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
    const teacher_id = searchParams.get('teacher_id')
    const subject_id = searchParams.get('subject_id')
    const class_id = searchParams.get('class_id')

    if (!teacher_id || !subject_id) {
      return NextResponse.json({ error: 'Missing teacher_id or subject_id' }, { status: 400 })
    }

    let q = supabaseAdmin
      .from('class_subject_teachers')
      .delete()
      .eq('teacher_id', teacher_id)
      .eq('subject_id', subject_id)
    if (class_id) {
      q = q.eq('class_id', class_id)
    }
    const { error } = await q
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
