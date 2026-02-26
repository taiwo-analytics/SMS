import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/settings — fetch all settings (any authenticated user)
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: rows, error } = await supabase
      .from('settings')
      .select('key, value')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Convert rows to key-value object
    const settings: Record<string, string> = {}
    for (const row of rows || []) {
      settings[row.key] = row.value
    }

    return NextResponse.json({ settings })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

/**
 * POST /api/settings — admin saves settings
 * Body: { settings: { key: value, ... } }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can update settings' }, { status: 403 })
    }

    const body = await req.json()
    const entries = body?.settings

    if (!entries || typeof entries !== 'object') {
      return NextResponse.json({ error: 'Missing settings object' }, { status: 400 })
    }

    // Upsert each key-value pair
    const rows = Object.entries(entries).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('settings')
      .upsert(rows, { onConflict: 'key' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
