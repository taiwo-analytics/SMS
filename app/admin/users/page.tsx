'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { UserCheck, Shield, GraduationCap, User, Users, Search } from 'lucide-react'

export default function AdminUsersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!loading) {
      loadUsers()
    }
  }, [loading])

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      // Load all users from profiles
      const { data: profiles } = await supabase.from('profiles').select('*')
      
      if (profiles) {
        // Enrich with role-specific data
        const enrichedUsers = await Promise.all(
          profiles.map(async (profile) => {
            let roleData = null
            if (profile.role === 'teacher') {
              const { data } = await supabase.from('teachers').select('full_name').eq('user_id', profile.id).single()
              roleData = data
            } else if (profile.role === 'student') {
              const { data } = await supabase.from('students').select('full_name').eq('user_id', profile.id).single()
              roleData = data
            } else if (profile.role === 'parent') {
              const { data } = await supabase.from('parents').select('full_name').eq('user_id', profile.id).single()
              roleData = data
            }
            
            return {
              ...profile,
              displayName: roleData?.full_name || profile.full_name || 'N/A',
            }
          })
        )
        setAllUsers(enrichedUsers)
      }
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-5 h-5 text-blue-600" />
      case 'teacher':
        return <GraduationCap className="w-5 h-5 text-green-600" />
      case 'student':
        return <User className="w-5 h-5 text-purple-600" />
      case 'parent':
        return <Users className="w-5 h-5 text-orange-600" />
      default:
        return <UserCheck className="w-5 h-5 text-gray-600" />
    }
  }

  const filteredUsers = allUsers.filter((user) => {
    const matchesSearch = user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = filterRole === 'all' || user.role === filterRole
    return matchesSearch && matchesRole
  })

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <UserCheck className="w-10 h-10 text-indigo-600" />
        <h2 className="text-3xl font-bold text-gray-900">Users Management</h2>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Search by name or email..."
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
            <option value="parent">Parent</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  <UserCheck className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p>No users found</p>
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {getRoleIcon(user.role)}
                      <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.email || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded capitalize">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
