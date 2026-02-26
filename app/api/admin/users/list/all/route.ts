import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 400 })
    }

    const userIds = (profiles || []).map((p: any) => p.id)

    const [teachersRes, studentsRes, parentsRes] = await Promise.all([
      supabaseAdmin.from('teachers').select('*').in('user_id', userIds),
      supabaseAdmin.from('students').select('*').in('user_id', userIds),
      supabaseAdmin.from('parents').select('*').in('user_id', userIds),
    ])

    const teachers = teachersRes.data || []
    const students = studentsRes.data || []
    const parents = parentsRes.data || []

    const teacherByUser: Record<string, any> = {}
    const studentByUser: Record<string, any> = {}
    const parentByUser: Record<string, any> = {}

    teachers.forEach((t: any) => { teacherByUser[t.user_id] = t })
    students.forEach((s: any) => { studentByUser[s.user_id] = s })
    parents.forEach((p: any) => { parentByUser[p.user_id] = p })

    const emailMap: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      if (authData?.users) {
        for (const u of authData.users) {
          if (u.email) emailMap[u.id] = u.email
        }
      }
    }

    const users = (profiles || []).map((profile: any) => {
      const role = profile.role
      const roleRow =
        role === 'teacher'
          ? teacherByUser[profile.id]
          : role === 'student'
          ? studentByUser[profile.id]
          : role === 'parent'
          ? parentByUser[profile.id]
          : null

      return {
        ...profile,
        email: emailMap[profile.id] || null,
        displayName: roleRow?.full_name || profile.full_name || 'N/A',
      }
    })

    return NextResponse.json({ users })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
