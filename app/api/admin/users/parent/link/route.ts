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
    const { parent_user_id, student_id } = body || {}

    if (!parent_user_id) {
      return NextResponse.json({ error: 'Missing parent_user_id' }, { status: 400 })
    }

    let parentId: string | null = null

    const { data: parentRow } = await supabaseAdmin
      .from('parents')
      .select('id')
      .eq('user_id', parent_user_id)
      .maybeSingle()

    if (parentRow?.id) {
      parentId = parentRow.id
    } else {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', parent_user_id)
        .single()

      const full_name = profile?.full_name || 'Parent'
      const { data: createdParent, error: pErr } = await supabaseAdmin
        .from('parents')
        .insert({ user_id: parent_user_id, full_name })
        .select()
        .single()

      if (pErr) {
        return NextResponse.json({ error: pErr.message }, { status: 400 })
      }
      parentId = createdParent.id
    }

    if (student_id) {
      const { error: updErr } = await supabaseAdmin
        .from('students')
        .update({ parent_id: parentId })
        .eq('id', student_id)
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true, parent_id: parentId })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
