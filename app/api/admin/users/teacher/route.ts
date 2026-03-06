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
      email, password, full_name,
      phone, gender, dob, address, status, admission,
      title, staff_id, marital_status, next_of_kin, next_of_kin_phone,
      course_of_study, institution_name, years_of_experience,
      subjects_taught, degrees, certifications, workshops,
      photo_url, cv_url,
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

    if (createErr || !created?.user) {
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
      .upsert({ id: userId, role: 'teacher', full_name }, { onConflict: 'id' })
    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 400 })
    }

    const basePayload: Record<string, any> = {
      user_id: userId,
      full_name,
    }

    const { data: teacherRow, error: teacherErr } = await supabaseAdmin
      .from('teachers')
      .upsert(basePayload, { onConflict: 'user_id' })
      .select()
      .single()

    if (teacherErr) {
      const msg = String(teacherErr.message || '').toLowerCase()
      const shouldRetry = msg.includes('column')
      if (!shouldRetry) {
        return NextResponse.json({ error: teacherErr.message }, { status: 400 })
      }
      const reduced: Record<string, any> = {
        user_id: userId,
        full_name,
      }
      const { data: row2, error: err2 } = await supabaseAdmin
        .from('teachers')
        .upsert(reduced, { onConflict: 'user_id' })
        .select()
        .single()
      if (err2) {
        return NextResponse.json({ error: err2.message }, { status: 400 })
      }
      return NextResponse.json({ userId, teacher: row2 }, { status: 201 })
    }

    const teacherId = (teacherRow as any)?.id
    if (teacherId) {
      const optionalUpdates: Array<[string, any]> = [
        ['phone', phone || null],
        ['gender', gender || null],
        ['dob', normalizeDate(dob)],
        ['address', address || null],
        ['status', status || null],
        ['title', title || null],
        ['staff_id', staff_id || null],
        ['marital_status', marital_status || null],
        ['next_of_kin', next_of_kin || null],
        ['next_of_kin_phone', next_of_kin_phone || null],
        ['course_of_study', course_of_study || null],
        ['institution_name', institution_name || null],
        ['years_of_experience', years_of_experience ?? null],
        ['subjects_taught', Array.isArray(subjects_taught) ? subjects_taught : (subjects_taught ? String(subjects_taught).split(',').map((s: string) => s.trim()) : null)],
        ['degrees', Array.isArray(degrees) ? degrees : (degrees ? String(degrees).split(',').map((s: string) => s.trim()) : null)],
        ['certifications', Array.isArray(certifications) ? certifications : (certifications ? String(certifications).split(',').map((s: string) => s.trim()) : null)],
        ['workshops', Array.isArray(workshops) ? workshops : (workshops ? String(workshops).split(',').map((s: string) => s.trim()) : null)],
        ['photo_url', photo_url || null],
        ['cv_url', cv_url || null],
      ]
      for (const [key, val] of optionalUpdates) {
        try {
          if (val !== undefined) {
            await supabaseAdmin.from('teachers').update({ [key]: val }).eq('id', teacherId)
          }
        } catch (e: any) {
          const m = String(e?.message || '').toLowerCase()
          if (!(m.includes('column') && m.includes(key))) {
            continue
          }
        }
      }
    }

    return NextResponse.json({ userId, teacher: teacherRow }, { status: 201 })
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
      id, full_name, email, phone, gender, dob, address, status, admission,
      title, staff_id, marital_status, next_of_kin, next_of_kin_phone,
      course_of_study, institution_name, years_of_experience,
      subjects_taught, degrees, certifications, workshops,
      photo_url, cv_url,
    } = body || {}
    if (!id) {
      return NextResponse.json({ error: 'Missing teacher id' }, { status: 400 })
    }

    const updateData: Record<string, any> = {}
    if (full_name !== undefined) updateData.full_name = full_name
    if (phone !== undefined) updateData.phone = phone || null
    if (gender !== undefined) updateData.gender = gender || null
    if (dob !== undefined) updateData.dob = normalizeDate(dob)
    if (address !== undefined) updateData.address = address || null
    if (status !== undefined) updateData.status = status || null
    if (admission !== undefined) updateData.admission = admission || null
    if (title !== undefined) updateData.title = title || null
    if (staff_id !== undefined) updateData.staff_id = staff_id || null
    if (marital_status !== undefined) updateData.marital_status = marital_status || null
    if (next_of_kin !== undefined) updateData.next_of_kin = next_of_kin || null
    if (next_of_kin_phone !== undefined) updateData.next_of_kin_phone = next_of_kin_phone || null
    if (course_of_study !== undefined) updateData.course_of_study = course_of_study || null
    if (institution_name !== undefined) updateData.institution_name = institution_name || null
    if (years_of_experience !== undefined) updateData.years_of_experience = years_of_experience ?? null
    if (subjects_taught !== undefined) updateData.subjects_taught = Array.isArray(subjects_taught) ? subjects_taught : (subjects_taught ? String(subjects_taught).split(',').map((s: string) => s.trim()) : null)
    if (degrees !== undefined) updateData.degrees = Array.isArray(degrees) ? degrees : (degrees ? String(degrees).split(',').map((s: string) => s.trim()) : null)
    if (certifications !== undefined) updateData.certifications = Array.isArray(certifications) ? certifications : (certifications ? String(certifications).split(',').map((s: string) => s.trim()) : null)
    if (workshops !== undefined) updateData.workshops = Array.isArray(workshops) ? workshops : (workshops ? String(workshops).split(',').map((s: string) => s.trim()) : null)
    if (photo_url !== undefined) updateData.photo_url = photo_url || null
    if (cv_url !== undefined) updateData.cv_url = cv_url || null

    let { data: teacher, error } = await supabaseAdmin
      .from('teachers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      const msg = String(error.message || '').toLowerCase()
      if (msg.includes('column')) {
        const optionalKeys = [
          'subjects_taught',
          'degrees',
          'certifications',
          'workshops',
          'photo_url',
          'cv_url',
          'course_of_study',
          'institution_name',
          'years_of_experience',
          'admission',
          'marital_status',
          'next_of_kin',
          'next_of_kin_phone'
        ]
        optionalKeys.forEach((k) => { if (k in updateData) delete updateData[k] })
        const res2 = await supabaseAdmin
          .from('teachers')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()
        teacher = res2.data as any
        error = res2.error as any
      }
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Also update profile full_name if it changed
    if (full_name && teacher?.user_id) {
      await supabaseAdmin
        .from('profiles')
        .update({ full_name })
        .eq('id', teacher.user_id)
    }

    // Update email in Supabase Auth and teachers table if provided
    if (email && teacher?.user_id) {
      const { error: emailErr } = await supabaseAdmin.auth.admin.updateUserById(teacher.user_id, {
        email,
        email_confirm: true,
      })
      if (emailErr) {
        return NextResponse.json({ error: `Failed to update email: ${emailErr.message}` }, { status: 400 })
      }
      // Also update email in the teachers table
      await supabaseAdmin.from('teachers').update({ email }).eq('id', id)
    }

    return NextResponse.json({ teacher })
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

    if (!id) return NextResponse.json({ error: 'Missing teacher id' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'Missing photo file' }, { status: 400 })

    const ext = file.name.split('.').pop()
    const path = `${id}/photo_${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from('teacher-files')
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

    const { data } = supabaseAdmin.storage.from('teacher-files').getPublicUrl(path)

    const { error: updateError } = await supabaseAdmin
      .from('teachers')
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
