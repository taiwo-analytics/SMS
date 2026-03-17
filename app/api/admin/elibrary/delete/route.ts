import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // Get file record to find storage path
  const { data: file } = await supabase.from('elibrary_files').select('file_url').eq('id', id).single()
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  // Extract storage path from URL
  const url = file.file_url
  const match = url.match(/\/elibrary\/(.+)$/)
  if (match) {
    await supabase.storage.from('elibrary').remove([match[1]])
  }

  // Delete DB record
  const { error } = await supabase.from('elibrary_files').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
