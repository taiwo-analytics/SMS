import { createServerSupabaseClient } from './supabase/server'
import { UserRole } from '@/types/database'

export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  // Get user role from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return {
    ...user,
    role: profile?.role as UserRole || null,
  }
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await requireAuth()
  if (!user.role || !allowedRoles.includes(user.role)) {
    throw new Error('Forbidden')
  }
  return user
}
