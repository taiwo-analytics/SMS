import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireApiRole } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function DELETE(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const class_id = searchParams.get('class_id')
    if (!class_id) {
      return NextResponse.json({ error: 'Missing class_id' }, { status: 400 })
    }
    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin.from('classes').update({ department: null }).eq('id', class_id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
