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
    const { email, password, role, full_name } = body || {}

    if (!email || !password || !role || !full_name) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, role, full_name' },
        { status: 400 }
      )
    }

    if (!['admin', 'teacher', 'student', 'parent'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Only a super admin can create another admin
    if (role === 'admin') {
      const { data: callerProfile } = await supabaseAdmin
        .from('profiles')
        .select('is_super_admin')
        .eq('id', auth.userId)
        .single()
      if (!callerProfile?.is_super_admin) {
        return NextResponse.json({ error: 'Only a super admin can create admin users' }, { status: 403 })
      }
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (createErr || !created?.user) {
      return NextResponse.json(
        { error: createErr?.message || 'Failed to create user' },
        { status: 400 }
      )
    }

    const user_id = created.user.id

    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: user_id, role, full_name }, { onConflict: 'id' })

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 400 })
    }

    if (role === 'teacher') {
      const { error } = await supabaseAdmin
        .from('teachers')
        .upsert({ user_id, full_name }, { onConflict: 'user_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    } else if (role === 'student') {
      const { error } = await supabaseAdmin
        .from('students')
        .upsert({ user_id, full_name }, { onConflict: 'user_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    } else if (role === 'parent') {
      const { error } = await supabaseAdmin
        .from('parents')
        .upsert({ user_id, full_name }, { onConflict: 'user_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { success: true, user: { id: user_id, email, role, full_name } },
      { status: 201 }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await req.json()
    const { user_id, role, full_name } = body || {}

    if (!user_id || !role) {
      return NextResponse.json({ error: 'Missing user_id or role' }, { status: 400 })
    }

    if (!['admin', 'teacher', 'student', 'parent'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    if (role === 'admin') {
      const { data: callerProfile } = await supabaseAdmin
        .from('profiles')
        .select('is_super_admin')
        .eq('id', auth.userId)
        .single()
      if (!callerProfile?.is_super_admin) {
        return NextResponse.json({ error: 'Only a super admin can assign admin role' }, { status: 403 })
      }
    }

    if (full_name) {
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .upsert({ id: user_id, role, full_name }, { onConflict: 'id' })
      if (profileErr) {
        return NextResponse.json({ error: profileErr.message }, { status: 400 })
      }

      if (role === 'teacher') {
        await supabaseAdmin.from('teachers').upsert({ user_id, full_name }, { onConflict: 'user_id' })
      } else if (role === 'student') {
        await supabaseAdmin.from('students').upsert({ user_id, full_name }, { onConflict: 'user_id' })
      } else if (role === 'parent') {
        await supabaseAdmin.from('parents').upsert({ user_id, full_name }, { onConflict: 'user_id' })
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await req.json()
    const { user_id, password } = body || {}

    if (!user_id || !password) {
      return NextResponse.json({ error: 'Missing user_id or password' }, { status: 400 })
    }

    if (String(password).length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const auth = await requireApiRole(['admin'])
  if (!auth.authorized) return auth.response

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    const role = searchParams.get('role')

    if (!user_id || !role) {
      return NextResponse.json({ error: 'Missing user_id or role' }, { status: 400 })
    }

    if (!['admin', 'teacher', 'student', 'parent'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Prevent deleting super admin
    if (role === 'admin') {
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user_id as string)
        .single()
      if (targetProfile?.is_super_admin) {
        return NextResponse.json({ error: 'Cannot delete the super admin' }, { status: 403 })
      }
    }

    if (role === 'teacher') {
      await supabaseAdmin.from('teachers').delete().eq('user_id', user_id)
    } else if (role === 'student') {
      await supabaseAdmin.from('students').delete().eq('user_id', user_id)
    } else if (role === 'parent') {
      await supabaseAdmin.from('parents').delete().eq('user_id', user_id)
    }

    await supabaseAdmin.from('profiles').delete().eq('id', user_id)
    await supabaseAdmin.auth.admin.deleteUser(user_id)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
