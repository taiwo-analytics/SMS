import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const normalizeDate = (v: any) => {
      if (!v) return null
      const d = new Date(v)
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
    }

    const body = await req.json()
    const {
      email, password, full_name, parent_id,
      phone, gender, dob, address, status, admission, guardian_name,
      class_id
    } = body || {}
    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })
    if (createErr || !created.user) {
      return NextResponse.json({ error: createErr?.message || 'Failed to create user' }, { status: 400 })
    }

    const userId = created.user.id

    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'student', full_name })
      .eq('id', userId)
    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 400 })
    }

    const { data: studentRow, error: studentErr } = await supabaseAdmin
      .from('students')
      .insert({
        user_id: userId,
        full_name,
        parent_id: parent_id || null,
        phone: phone || null,
        gender: gender || null,
        dob: normalizeDate(dob),
        address: address || null,
        status: status || null,
        admission: admission || null,
        guardian_name: guardian_name || null
      })
      .select()
      .single()

    if (studentErr) {
      return NextResponse.json({ error: studentErr.message }, { status: 400 })
    }

    if (class_id) {
      await supabaseAdmin.from('class_enrollments').upsert({
        class_id,
        student_id: studentRow.id
      })
    }

    return NextResponse.json({ userId, student: studentRow }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing student id' }, { status: 400 })

    const supabaseAdmin = getSupabaseAdmin()

    // Get the student's user_id so we can also delete the auth user
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('user_id')
      .eq('id', id)
      .single()

    const { error } = await supabaseAdmin.from('students').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Also delete the auth user if we found one
    if (student?.user_id) {
      await supabaseAdmin.auth.admin.deleteUser(student.user_id)
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
