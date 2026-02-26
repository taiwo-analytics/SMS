import { createServerSupabaseClient } from './supabase/server'
import { NextResponse } from 'next/server'
import type { UserRole } from '@/types/database'

/**
 * Verifies the caller is authenticated and has one of the allowed roles.
 * Returns the user on success, or a NextResponse error to send back.
 */
export async function requireApiRole(
  allowedRoles: UserRole[]
): Promise<
  | { authorized: true; userId: string; role: UserRole }
  | { authorized: false; response: NextResponse }
> {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Unauthorized – you must be logged in' },
          { status: 401 }
        ),
      }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role as UserRole | undefined

    if (!role || !allowedRoles.includes(role)) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Forbidden – insufficient permissions' },
          { status: 403 }
        ),
      }
    }

    return { authorized: true, userId: user.id, role }
  } catch {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      ),
    }
  }
}
