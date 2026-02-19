import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

export const runtime = 'nodejs'

/**
 * GET /api/grades?class_id=...  — teacher fetches grades for a class
 * GET /api/grades?student_id=... — student/parent fetches grades for a student
 */
export async function GET(req: Request) {
  try {
    const supabase = createServerComponentClient({ cookies })

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    const role = profile?.role
    const { searchParams } = new URL(req.url)
    const classId = searchParams.get('class_id')
    const studentId = searchParams.get('student_id')

    let query = supabase.from('grades').select('*').order('created_at', { ascending: false })

    if (role === 'teacher') {
      // Teachers see grades for a specific class they teach
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', session.user.id)
        .single()

      if (!teacher) {
        return NextResponse.json({ error: 'Teacher record not found' }, { status: 404 })
      }

      query = query.eq('teacher_id', teacher.id)
      if (classId) query = query.eq('class_id', classId)
    } else if (role === 'student') {
      // Students see only their own grades
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', session.user.id)
        .single()

      if (!student) {
        return NextResponse.json({ error: 'Student record not found' }, { status: 404 })
      }

      query = query.eq('student_id', student.id)
      if (classId) query = query.eq('class_id', classId)
    } else if (role === 'parent') {
      // Parents see grades of their children
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('user_id', session.user.id)
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
        return NextResponse.json({ grades: [] })
      }

      query = query.in('student_id', childIds)
      if (studentId) query = query.eq('student_id', studentId)
    } else if (role === 'admin') {
      // Admin can see all, optionally filtered
      if (classId) query = query.eq('class_id', classId)
      if (studentId) query = query.eq('student_id', studentId)
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: grades, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ grades: grades || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

/**
 * POST /api/grades — teacher creates a grade
 * Body: { student_id, class_id, assignment_name, score, max_score, term_id?, notes? }
 */
export async function POST(req: Request) {
  try {
    const supabase = createServerComponentClient({ cookies })

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profile?.role !== 'teacher') {
      return NextResponse.json({ error: 'Only teachers can create grades' }, { status: 403 })
    }

    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', session.user.id)
      .single()

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher record not found' }, { status: 404 })
    }

    const body = await req.json()
    const { student_id, class_id, assignment_name, score, max_score, term_id, notes } = body || {}

    if (!student_id || !class_id || !assignment_name || score === undefined || !max_score) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify the teacher owns this class
    const { data: classRecord } = await supabase
      .from('classes')
      .select('id')
      .eq('id', class_id)
      .eq('teacher_id', teacher.id)
      .single()

    if (!classRecord) {
      return NextResponse.json({ error: 'You can only add grades to your own classes' }, { status: 403 })
    }

    const { data: grade, error } = await supabase
      .from('grades')
      .insert({
        student_id,
        class_id,
        teacher_id: teacher.id,
        assignment_name,
        score,
        max_score,
        term_id: term_id || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ grade }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

/**
 * DELETE /api/grades?id=... — teacher deletes a grade
 */
export async function DELETE(req: Request) {
  try {
    const supabase = createServerComponentClient({ cookies })

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing grade id' }, { status: 400 })
    }

    if (profile?.role === 'teacher') {
      // Verify teacher owns this grade
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', session.user.id)
        .single()

      if (!teacher) {
        return NextResponse.json({ error: 'Teacher record not found' }, { status: 404 })
      }

      const { error } = await supabase
        .from('grades')
        .delete()
        .eq('id', id)
        .eq('teacher_id', teacher.id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    } else {
      // Admin can delete any
      const { error } = await supabase.from('grades').delete().eq('id', id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
