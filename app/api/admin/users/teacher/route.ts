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
    const { email, password, full_name, phone, gender, dob, address, status, admission } = body || {}
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
      .update({ role: 'teacher', full_name })
      .eq('id', userId)
    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 400 })
    }

    const { data: teacherRow, error: teacherErr } = await supabaseAdmin
      .from('teachers')
      .insert({
        user_id: userId,
        full_name,
        phone: phone || null,
        gender: gender || null,
        dob: normalizeDate(dob),
        address: address || null,
        status: status || null,
        admission: admission || null
      })
      .select()
      .single()

    if (teacherErr) {
      return NextResponse.json({ error: teacherErr.message }, { status: 400 })
    }

    return NextResponse.json({ userId, teacher: teacherRow }, { status: 201 })
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
    if (!id) return NextResponse.json({ error: 'Missing teacher id' }, { status: 400 })

    const supabaseAdmin = getSupabaseAdmin()

    // Get the teacher's user_id so we can also delete the auth user
    const { data: teacher } = await supabaseAdmin
      .from('teachers')
      .select('user_id')
      .eq('id', id)
      .single()

    const { error } = await supabaseAdmin.from('teachers').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Also delete the auth user if we found one
    if (teacher?.user_id) {
      await supabaseAdmin.auth.admin.deleteUser(teacher.user_id)
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
