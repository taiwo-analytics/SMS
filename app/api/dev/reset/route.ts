import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
    }
    const devSecret = process.env.DEV_ADMIN_SECRET
    const url = new URL(req.url)
    const headerSecret = req.headers.get('x-dev-admin-secret')
    const reqSecret = url.searchParams.get('secret')
    const enableReset = process.env.DEV_ENABLE_RESET === 'true'
    if (!enableReset) {
      return NextResponse.json({ error: 'Reset disabled. Set DEV_ENABLE_RESET=true in .env.local' }, { status: 403 })
    }
    if (!devSecret || (headerSecret !== devSecret && reqSecret !== devSecret)) {
      return NextResponse.json({ error: 'Not allowed in development without valid secret' }, { status: 403 })
    }
    const confirm = url.searchParams.get('confirm')
    if (confirm !== 'DELETE ALL DATA') {
      return NextResponse.json({ error: 'Confirmation phrase mismatch. Provide confirm=DELETE ALL DATA' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    const supabaseAdmin = getSupabaseAdmin()
    const seed = url.searchParams.get('seed') === 'true'
    const enableSeed = process.env.DEV_ENABLE_SEED === 'true'
    const deleteSelf = url.searchParams.get('deleteSelf') === 'true'
    const keepCurrent = !deleteSelf

    const tablesToClear = [
      'grades',
      'attendance',
      'assignments',
      'class_enrollments',
      'classes',
      'messages',
      'books',
      'inventory_items',
      'payments',
      'students',
      'teachers',
      'parents',
      'profiles',
    ]

    // Clear application tables
    for (const table of tablesToClear) {
      await supabaseAdmin.from(table).delete().neq('id', '')
    }

    // Delete auth users
    const usersRes = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const allUsers = usersRes?.data?.users || []
    for (const u of allUsers) {
      if (keepCurrent && currentUser && u.id === currentUser.id) continue
      await supabaseAdmin.auth.admin.deleteUser(u.id)
    }

    const result: Record<string, any> = { clearedTables: tablesToClear }

    if (seed && enableSeed) {
      const seeds = [
        { email: 'admin@example.com', password: 'password123', role: 'admin', full_name: 'Admin User' },
        { email: 'teacher@example.com', password: 'password123', role: 'teacher', full_name: 'Teacher User' },
        { email: 'student@example.com', password: 'password123', role: 'student', full_name: 'Student User' },
        { email: 'parent@example.com', password: 'password123', role: 'parent', full_name: 'Parent User' },
      ]

      const created: Array<{ email: string; id: string; role: string }> = []

      for (const s of seeds) {
        const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: s.email,
          password: s.password,
          email_confirm: true,
          user_metadata: { full_name: s.full_name },
        })
        if (createErr || !createdUser?.user) {
          continue
        }
        const id = createdUser.user.id

        // Ensure profile with correct role
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', id)
          .maybeSingle()

        if (existingProfile) {
          await supabaseAdmin.from('profiles').update({ role: s.role, full_name: s.full_name }).eq('id', id)
        } else {
          await supabaseAdmin.from('profiles').insert({ id, role: s.role, full_name: s.full_name })
        }

        // Create role-specific records
        if (s.role === 'teacher') {
          await supabaseAdmin.from('teachers').insert({ user_id: id, full_name: s.full_name })
        } else if (s.role === 'student') {
          await supabaseAdmin.from('students').insert({ user_id: id, full_name: s.full_name })
        } else if (s.role === 'parent') {
          await supabaseAdmin.from('parents').insert({ user_id: id, full_name: s.full_name })
        }

        created.push({ email: s.email, id, role: s.role })
      }

      result.seeded = created
    }

    return NextResponse.json({ success: true, keepCurrent, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
