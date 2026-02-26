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
    const { type, ids } = body || {}

    if (!type || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Missing type or ids' }, { status: 400 })
    }

    if (!['teacher', 'student'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    const table = type === 'teacher' ? 'teachers' : 'students'
    const results: { id: string; success: boolean; error?: string }[] = []

    for (const id of ids) {
      try {
        // Get user_id before deleting
        const { data: record } = await supabaseAdmin
          .from(table)
          .select('user_id')
          .eq('id', id)
          .single()

        const { error } = await supabaseAdmin.from(table).delete().eq('id', id)
        if (error) {
          results.push({ id, success: false, error: error.message })
          continue
        }

        // Delete auth user
        if (record?.user_id) {
          await supabaseAdmin.auth.admin.deleteUser(record.user_id)
        }

        results.push({ id, success: true })
      } catch (e: any) {
        results.push({ id, success: false, error: e?.message })
      }
    }

    const successCount = results.filter(r => r.success).length
    return NextResponse.json({ success: true, deleted: successCount, total: ids.length, results })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
