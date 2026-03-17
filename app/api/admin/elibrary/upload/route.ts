import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string
  const description = (formData.get('description') as string) || null
  const category = (formData.get('category') as string) || null

  if (!file || !title) {
    return NextResponse.json({ error: 'File and title are required' }, { status: 400 })
  }

  // Upload to storage
  const ext = file.name.split('.').pop() || ''
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('elibrary')
    .upload(path, file, { contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from('elibrary').getPublicUrl(path)

  // Insert record
  const { data: record, error: dbError } = await supabase.from('elibrary_files').insert({
    title,
    description,
    file_name: file.name,
    file_url: urlData.publicUrl,
    file_size: file.size,
    file_type: file.type || ext,
    category,
    uploaded_by: user.id,
  }).select().single()

  if (dbError) {
    // Clean up uploaded file
    await supabase.storage.from('elibrary').remove([path])
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json(record)
}
