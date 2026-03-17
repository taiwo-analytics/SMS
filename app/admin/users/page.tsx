'use client'

import { useEffect, useState } from 'react'
import { UserCheck, Shield, GraduationCap, User, Users, Search, Edit, Trash2, Link2, X, Plus, KeyRound } from 'lucide-react'
import SchoolLoader from '@/components/SchoolLoader'

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createData, setCreateData] = useState({ full_name: '', email: '', password: '', role: 'teacher' })
  const [showEditModal, setShowEditModal] = useState(false)
  const [editUser, setEditUser] = useState<any | null>(null)
  const [editName, setEditName] = useState('')
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetUser, setResetUser] = useState<any | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkParentUser, setLinkParentUser] = useState<any | null>(null)
  const [students, setStudents] = useState<any[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadUsers().finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(id)
  }, [notice])

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/admin/users/list/all')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load users')
      setAllUsers(json.users || [])
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const loadStudents = async () => {
    try {
      const res = await fetch('/api/admin/users/list/students')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load students')
      setStudents(json.students || [])
    } catch (error) {
      console.error('Error loading students:', error)
      setStudents([])
    }
  }

  const openEditModal = (user: any) => {
    setEditUser(user)
    setEditName(user.displayName || user.full_name || '')
    setShowEditModal(true)
  }

  const handleCreateUser = async () => {
    try {
      const res = await fetch('/api/admin/users/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createData),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create user')
      setShowCreateModal(false)
      setCreateData({ full_name: '', email: '', password: '', role: 'teacher' })
      await loadUsers()
      setNotice({ type: 'success', text: 'User created successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Failed to create user' })
    }
  }

  const handleUpdateUser = async () => {
    if (!editUser) return
    try {
      const res = await fetch('/api/admin/users/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: editUser.id,
          role: editUser.role,
          full_name: editName,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update user')
      setShowEditModal(false)
      setEditUser(null)
      setEditName('')
      await loadUsers()
      setNotice({ type: 'success', text: 'User updated successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Failed to update user' })
    }
  }

  const openResetModal = (user: any) => {
    setResetUser(user)
    setNewPassword('')
    setShowResetModal(true)
  }

  const handleResetPassword = async () => {
    if (!resetUser) return
    try {
      const res = await fetch('/api/admin/users/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: resetUser.id,
          password: newPassword,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to reset password')
      setShowResetModal(false)
      setResetUser(null)
      setNewPassword('')
      setNotice({ type: 'success', text: 'Password reset successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Failed to reset password' })
    }
  }

  const handleDeleteUser = async (user: any) => {
    if (!confirm(`Delete user ${user.displayName || user.email || user.id}?`)) return
    try {
      const res = await fetch(`/api/admin/users/user?user_id=${user.id}&role=${user.role}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete user')
      await loadUsers()
      setNotice({ type: 'success', text: 'User deleted successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Failed to delete user' })
    }
  }

  const openLinkModal = async (user: any) => {
    setLinkParentUser(user)
    setSelectedStudentId('')
    setShowLinkModal(true)
    await loadStudents()
  }

  const handleLinkStudent = async () => {
    if (!linkParentUser) return
    try {
      const res = await fetch('/api/admin/users/parent/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_user_id: linkParentUser.id,
          student_id: selectedStudentId || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to link student')
      setShowLinkModal(false)
      setLinkParentUser(null)
      setSelectedStudentId('')
      setNotice({ type: 'success', text: 'Student linked successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Failed to link student' })
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
    return <SchoolLoader />
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <UserCheck className="w-10 h-10 text-indigo-600" />
          <h2 className="text-3xl font-bold text-gray-900">Users Management</h2>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Create User
        </button>
      </div>

      {notice && (
        <div
          className={`mb-4 border rounded-lg px-4 py-3 text-sm ${
            notice.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}

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
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
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
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      {user.role === 'parent' && (
                        <button
                          onClick={() => openLinkModal(user)}
                          className="text-purple-600 hover:text-purple-800"
                          title="Link student"
                        >
                          <Link2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit user"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openResetModal(user)}
                        className="text-amber-600 hover:text-amber-800"
                        title="Reset password"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showEditModal && editUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Edit User</h3>
              <button onClick={() => { setShowEditModal(false); setEditUser(null) }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => { setShowEditModal(false); setEditUser(null) }}
                  className="px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateUser}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Create User</h3>
              <button onClick={() => setShowCreateModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={createData.full_name}
                  onChange={(e) => setCreateData({ ...createData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={createData.email}
                  onChange={(e) => setCreateData({ ...createData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={createData.password}
                  onChange={(e) => setCreateData({ ...createData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={createData.role}
                  onChange={(e) => setCreateData({ ...createData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="admin">Admin</option>
                  <option value="teacher">Teacher</option>
                  <option value="student">Student</option>
                  <option value="parent">Parent</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateUser}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showResetModal && resetUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Reset Password</h3>
              <button onClick={() => { setShowResetModal(false); setResetUser(null) }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                User: <span className="font-medium">{resetUser.displayName || resetUser.email || resetUser.id}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  minLength={6}
                  placeholder="Enter new password"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => { setShowResetModal(false); setResetUser(null) }}
                  className="px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={!newPassword || newPassword.length < 6}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                >
                  Reset Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLinkModal && linkParentUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Link Student</h3>
              <button onClick={() => { setShowLinkModal(false); setLinkParentUser(null) }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Student</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select a student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} {s.email ? `(${s.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => { setShowLinkModal(false); setLinkParentUser(null) }}
                  className="px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLinkStudent}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
