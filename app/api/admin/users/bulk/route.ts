import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

type BulkRow = Record<string, any>

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
    const slug = (v: string) =>
      String(v || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .slice(0, 16) || 'user'
    const body = await req.json()
    const { type, rows } = body as { type: 'teacher' | 'student', rows: BulkRow[] }
    if (!type || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const results: Array<{ email?: string; status: 'ok' | 'error'; error?: string; row?: number }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      let email = String(row.email || '').trim()
      const full_name = String(row.full_name || row.fullname || row.name || '').trim()
      // Validation rules:
      // - Teachers: require email + full_name
      // - Students: require full_name (email optional; will be synthesized if missing)
      if (type === 'teacher') {
        if (!email || !full_name) {
          results.push({ email, status: 'error', error: 'Missing email or full_name', row: i + 1 })
          continue
        }
      } else {
        if (!full_name) {
          results.push({ email, status: 'error', error: 'Missing full_name', row: i + 1 })
          continue
        }
        if (!email) {
          email = `${slug(full_name)}.${Date.now()}@students.local`
        }
      }
      const password = 'ChangeMe123!'

      let userId: string | null = null
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name }
      })
      if (createErr || !created.user) {
        const msg = String(createErr?.message || '').toLowerCase()
        const looksLikeExists = msg.includes('already') || msg.includes('registered') || msg.includes('duplicate')
        if (looksLikeExists) {
          const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
          const existing = authData?.users?.find(u => (u.email || '').toLowerCase() === email.toLowerCase())
          if (!existing) {
            results.push({ email, status: 'error', error: createErr?.message || 'User exists but could not be found', row: i + 1 })
            continue
          }
          userId = existing.id
        } else {
          results.push({ email, status: 'error', error: createErr?.message || 'Failed to create user', row: i + 1 })
          continue
        }
      } else {
        userId = created.user.id
      }

      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        role: type === 'teacher' ? 'teacher' : 'student',
        full_name
      }, { onConflict: 'id' })

      if (type === 'teacher') {
        // Parse array-like fields from CSV: semicolon-separated values
        const parseList = (v: any) =>
          Array.isArray(v) ? v :
          v ? String(v).split(/[;,]/).map((s) => s.trim()).filter(Boolean) : null

        let { error: tErr } = await supabaseAdmin.from('teachers').upsert({
          user_id: userId,
          full_name,
          phone: row.phone || null,
          gender: row.gender || null,
          dob: normalizeDate(row.dob),
          address: row.address || null,
          status: row.status || null,
          admission: row.admission || null,
          title: row.title || null,
          staff_id: row.staff_id || null,
          marital_status: row.marital_status || null,
          next_of_kin: row.next_of_kin || null,
          next_of_kin_phone: row.next_of_kin_phone || null,
          course_of_study: row.course_of_study || null,
          institution_name: row.institution_name || null,
          years_of_experience: row.years_of_experience ? Number(row.years_of_experience) : null,
          subjects_taught: parseList(row.subjects_taught),
          degrees: parseList(row.degrees),
          certifications: parseList(row.certifications),
          workshops: parseList(row.workshops),
          photo_url: row.photo_url || null,
          cv_url: row.cv_url || null,
          certification_files: parseList(row.certification_files)
        }, { onConflict: 'user_id' })
        if (tErr) {
          const m = String(tErr.message || '').toLowerCase()
          if (m.includes('column')) {
            // Retry with minimal payload
            const retry = await supabaseAdmin.from('teachers').upsert({
              user_id: userId,
              full_name
            }, { onConflict: 'user_id' })
            if (retry.error) {
              results.push({ email, status: 'error', error: retry.error.message, row: i + 1 })
              continue
            }
            // Minimal success; proceed without optional fields
          } else {
            results.push({ email, status: 'error', error: tErr.message, row: i + 1 })
            continue
          }
        }
      } else {
        let { data: student, error: sErr } = await supabaseAdmin.from('students')
          .upsert({
            user_id: userId,
            full_name,
            parent_id: row.parent_id || null,
            phone: row.phone || null,
            gender: row.gender || null,
            dob: normalizeDate(row.dob),
            address: row.address || null,
            status: row.status || null,
            admission: row.admission || null,
            department: row.department || null,
            guardian_name: row.guardian_t || row.guardian_name || null,
            nin: row.nin || null,
            guardian_phone: row.guardian_phone || row.guardian_phone_no || null,
            guardian_occupation: row.guardian_occupation || row.occupation || null,
            photo_url: row.photo_url || null
          }, { onConflict: 'user_id' })
          .select()
          .single()
        if (sErr) {
          const m = String(sErr.message || '').toLowerCase()
          if (m.includes('column')) {
            // Retry with minimal payload
            const retry = await supabaseAdmin.from('students')
              .upsert({ user_id: userId, full_name }, { onConflict: 'user_id' })
              .select()
              .single()
            student = retry.data as any
            sErr = retry.error as any
            if (sErr) {
              results.push({ email, status: 'error', error: sErr.message, row: i + 1 })
              continue
            }
          } else {
            results.push({ email, status: 'error', error: sErr.message, row: i + 1 })
            continue
          }
        }
        const className = row.class || row['class'] || row.class_name || row.class_level
        const classIdDirect = row.class_id
        if ((className && String(className).trim()) || classIdDirect) {
          let classRes: any = null
          if (classIdDirect) {
            const q = await supabaseAdmin.from('classes').select('id').eq('id', String(classIdDirect)).limit(1).single()
            classRes = q.data || null
          }
          if (!classRes && className) {
            const nameVal = String(className).trim()
            const byName = await supabaseAdmin.from('classes').select('id').ilike('name', nameVal).limit(1).maybeSingle()
            classRes = byName.data || null
          }
          if (!classRes && className) {
            const levelVal = String(className).trim()
            const byLevel = await supabaseAdmin.from('classes').select('id').ilike('class_level', levelVal).limit(1).maybeSingle()
            classRes = byLevel.data || null
          }
          if (classRes?.id && student?.id) {
            await supabaseAdmin.from('class_enrollments').upsert({
              class_id: classRes.id,
              student_id: student.id
            })
          }
        }
      }

      results.push({ email, status: 'ok', row: i + 1 })
    }

    return NextResponse.json({ results })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
