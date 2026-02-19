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
    const body = await req.json()
    const { type, rows } = body as { type: 'teacher' | 'student', rows: BulkRow[] }
    if (!type || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const results: Array<{ email?: string; status: 'ok' | 'error'; error?: string }> = []

    for (const row of rows) {
      const email = String(row.email || '').trim()
      const full_name = String(row.full_name || row.fullname || row.name || '').trim()
      if (!email || !full_name) {
        results.push({ email, status: 'error', error: 'Missing email or full_name' })
        continue
      }
      const password = 'ChangeMe123!'

      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name }
      })
      if (createErr || !created.user) {
        results.push({ email, status: 'error', error: createErr?.message || 'Failed to create user' })
        continue
      }
      const userId = created.user.id

      await supabaseAdmin.from('profiles').update({
        role: type === 'teacher' ? 'teacher' : 'student',
        full_name
      }).eq('id', userId)

      if (type === 'teacher') {
        const { error: tErr } = await supabaseAdmin.from('teachers').insert({
          user_id: userId,
          full_name,
          phone: row.phone || null,
          gender: row.gender || null,
          dob: normalizeDate(row.dob),
          address: row.address || null,
          status: row.status || null,
          admission: row.admission || null
        })
        if (tErr) {
          results.push({ email, status: 'error', error: tErr.message })
          continue
        }
      } else {
        const { data: student, error: sErr } = await supabaseAdmin.from('students')
          .insert({
            user_id: userId,
            full_name,
            parent_id: row.parent_id || null,
            phone: row.phone || null,
            gender: row.gender || null,
            dob: normalizeDate(row.dob),
            address: row.address || null,
            status: row.status || null,
            admission: row.admission || null,
            guardian_name: row.guardian_t || row.guardian_name || null
          })
          .select()
          .single()
        if (sErr) {
          results.push({ email, status: 'error', error: sErr.message })
          continue
        }
        const className = row.class || row['class']
        if (className) {
          const { data: classRes } = await supabaseAdmin.from('classes').select('id').ilike('name', className).limit(1).single()
          if (classRes?.id && student?.id) {
            await supabaseAdmin.from('class_enrollments').upsert({
              class_id: classRes.id,
              student_id: student.id
            })
          }
        }
      }

      results.push({ email, status: 'ok' })
    }

    return NextResponse.json({ results })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
