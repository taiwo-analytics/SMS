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
      phone, gender, dob, address, status, admission, admission_date, guardian_name,
      class_id,
      nin, guardian_phone, guardian_occupation
    } = body || {}
    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let userId: string | null = null
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })
    if (createErr || !created.user) {
      const message = createErr?.message || ''
      const looksLikeExists =
        message.toLowerCase().includes('already') ||
        message.toLowerCase().includes('registered') ||
        message.toLowerCase().includes('duplicate')
      if (!looksLikeExists) {
        return NextResponse.json({ error: message || 'Failed to create user' }, { status: 400 })
      }
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      const existing = authData?.users?.find(u => u.email?.toLowerCase() === String(email).toLowerCase())
      if (!existing) {
        return NextResponse.json({ error: 'User exists but could not be found' }, { status: 400 })
      }
      userId = existing.id
    } else {
      userId = created.user.id
    }

    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId!, role: 'student', full_name }, { onConflict: 'id' })
    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 400 })
    }

    const { data: studentRow, error: studentErr } = await supabaseAdmin
      .from('students')
      .upsert({
        user_id: userId,
        full_name
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (studentErr) {
      return NextResponse.json({ error: studentErr.message }, { status: 400 })
    }

    const optionalUpdates: Array<[string, any]> = [
      ['parent_id', parent_id || null],
      ['phone', phone || null],
      ['gender', gender || null],
      ['dob', normalizeDate(dob)],
      ['address', address || null],
      ['status', status || null],
      ['admission', admission || null],
      ['admission_date', normalizeDate(admission_date)],
      ['guardian_name', guardian_name || null],
      ['nin', nin || null],
      ['guardian_phone', guardian_phone || null],
      ['guardian_occupation', guardian_occupation || null],
    ]
    for (const [key, val] of optionalUpdates) {
      try {
        if (val !== undefined) {
          await supabaseAdmin.from('students').update({ [key]: val }).eq('id', studentRow.id)
        }
      } catch (e: any) {
        const m = String(e?.message || '').toLowerCase()
        if (!(m.includes('column') && m.includes(key))) {
          continue
        }
      }
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

export async function PUT(req: Request) {
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
      id, full_name, phone, gender, dob, address, status, admission, admission_date,
      guardian_name, parent_id, nin, guardian_phone, guardian_occupation, photo_url, department
    } = body || {}
    if (!id) {
      return NextResponse.json({ error: 'Missing student id' }, { status: 400 })
    }

    const updateData: Record<string, any> = {}
    if (full_name !== undefined) updateData.full_name = full_name
    if (phone !== undefined) updateData.phone = phone || null
    if (gender !== undefined) updateData.gender = gender || null
    if (dob !== undefined) updateData.dob = normalizeDate(dob)
    if (address !== undefined) updateData.address = address || null
    if (status !== undefined) updateData.status = status || null
    if (admission !== undefined) updateData.admission = admission || null
    if (admission_date !== undefined) updateData.admission_date = normalizeDate(admission_date)
    if (guardian_name !== undefined) updateData.guardian_name = guardian_name || null
    if (parent_id !== undefined) updateData.parent_id = parent_id || null
    if (nin !== undefined) updateData.nin = nin || null
    if (guardian_phone !== undefined) updateData.guardian_phone = guardian_phone || null
    if (guardian_occupation !== undefined) updateData.guardian_occupation = guardian_occupation || null
    if (photo_url !== undefined) updateData.photo_url = photo_url || null
    if (department !== undefined) updateData.department = department || null

    const { data: student, error } = await supabaseAdmin
      .from('students')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (full_name && student?.user_id) {
      await supabaseAdmin
        .from('profiles')
        .update({ full_name })
        .eq('id', student.user_id)
    }

    return NextResponse.json({ student })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const formData = await req.formData()
    const id = formData.get('id') as string
    const file = formData.get('photo') as File | null

    if (!id) return NextResponse.json({ error: 'Missing student id' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'Missing photo file' }, { status: 400 })

    const ext = file.name.split('.').pop()
    const path = `${id}/photo_${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from('student-photos')
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

    const { data } = supabaseAdmin.storage.from('student-photos').getPublicUrl(path)

    const { error: updateError } = await supabaseAdmin
      .from('students')
      .update({ photo_url: data.publicUrl })
      .eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

    return NextResponse.json({ photo_url: data.publicUrl })
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
