import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/assignments?class_id=...  — fetch assignments filtered by role
 */
export async function GET(req: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role
    const { searchParams } = new URL(req.url)
    const classId = searchParams.get('class_id')

    let query = supabase.from('assignments').select('*').order('due_date', { ascending: true })

    if (role === 'teacher') {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!teacher) {
        return NextResponse.json({ error: 'Teacher record not found' }, { status: 404 })
      }

      query = query.eq('teacher_id', teacher.id)
      if (classId) query = query.eq('class_id', classId)
    } else if (role === 'student') {
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!student) {
        return NextResponse.json({ error: 'Student record not found' }, { status: 404 })
      }

      // Only show assignments for enrolled classes
      const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select('class_id')
        .eq('student_id', student.id)

      const classIds = (enrollments || []).map(e => e.class_id)
      if (classIds.length === 0) {
        return NextResponse.json({ assignments: [] })
      }

      query = query.in('class_id', classIds)
      if (classId) query = query.eq('class_id', classId)
    } else if (role === 'parent') {
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!parent) {
        return NextResponse.json({ error: 'Parent record not found' }, { status: 404 })
      }

      const { data: children } = await supabase
        .from('students')
        .select('id')
        .eq('parent_id', parent.id)

      const childIds = (children || []).map(c => c.id)
      if (childIds.length === 0) {
        return NextResponse.json({ assignments: [] })
      }

      const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select('class_id')
        .in('student_id', childIds)

      const classIds = [...new Set((enrollments || []).map(e => e.class_id))]
      if (classIds.length === 0) {
        return NextResponse.json({ assignments: [] })
      }

      query = query.in('class_id', classIds)
      if (classId) query = query.eq('class_id', classId)
    } else if (role === 'admin') {
      if (classId) query = query.eq('class_id', classId)
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: assignments, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ assignments: assignments || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

/**
 * POST /api/assignments — teacher creates an assignment
 * Body: { class_id, title, description?, due_date? }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'teacher') {
      return NextResponse.json({ error: 'Only teachers can create assignments' }, { status: 403 })
    }

    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher record not found' }, { status: 404 })
    }

    const body = await req.json()
    const { class_id, title, description, due_date } = body || {}

    if (!class_id || !title) {
      return NextResponse.json({ error: 'Missing required fields: class_id, title' }, { status: 400 })
    }

    // Verify teacher owns this class
    const { data: classRecord } = await supabase
      .from('classes')
      .select('id')
      .eq('id', class_id)
      .eq('teacher_id', teacher.id)
      .single()

    if (!classRecord) {
      return NextResponse.json({ error: 'You can only create assignments for your own classes' }, { status: 403 })
    }

    const { data: assignment, error } = await supabase
      .from('assignments')
      .insert({
        title,
        description: description || null,
        class_id,
        teacher_id: teacher.id,
        due_date: due_date || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ assignment }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

/**
 * DELETE /api/assignments?id=... — teacher deletes an assignment
 */
export async function DELETE(req: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
    }

    if (profile?.role === 'teacher') {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!teacher) {
        return NextResponse.json({ error: 'Teacher record not found' }, { status: 404 })
      }

      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id)
        .eq('teacher_id', teacher.id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    } else if (profile?.role === 'admin') {
      const { error } = await supabase.from('assignments').delete().eq('id', id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
