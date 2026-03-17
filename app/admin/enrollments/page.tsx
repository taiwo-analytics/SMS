'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Users, ArrowLeft, Plus, Trash2, X, Edit } from 'lucide-react'
import { Class, Student } from '@/types/database'
import SchoolLoader from '@/components/SchoolLoader'

interface Enrollment {
  id: string
  class_id: string
  student_id: string
  class_name?: string
  student_name?: string
  student_department?: string
  created_at: string
}

export default function AdminEnrollmentsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ class_id: '', student_id: '', department: '' })
  const [editing, setEditing] = useState<Enrollment | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterClassId, setFilterClassId] = useState('')
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [classesRes, studentsRes, enrollmentsRes] = await Promise.all([
        fetch('/api/admin/classes').then(r => r.json()),
        fetch('/api/admin/users/list/students').then(r => r.json()),
        fetch('/api/admin/enrollments').then(r => r.json()),
      ])
      setClasses((classesRes.classes || []) as any)
      setStudents((studentsRes.students || []) as any)
      setEnrollments((enrollmentsRes.enrollments || []) as any)
    } catch (error) {
      console.error('Error loading data:', error)
      setClasses([])
      setStudents([])
      setEnrollments([])
    }
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        console.error('Auth error:', authError)
        setLoading(false)
        return
      }
      
      if (!user) {
        console.warn('No user logged in')
        setLoading(false)
        return
      }

      // Attempt to load data regardless of profile lookup outcome.
      // RLS will enforce permissions; this avoids blocking when profile lookup fails.
      try {
        await loadData()
      } catch (e) {
        console.error('Data load failed:', e)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [loadData])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(t)
  }, [notice])

  const handleCreateEnrollment = async () => {
    try {
      const res = await fetch('/api/admin/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: formData.class_id,
          student_id: formData.student_id,
          department: formData.department,
        })
      })
      const js = await res.json()
      if (!res.ok) throw new Error(js.error || 'Failed to enroll')

      setShowModal(false)
      setEditing(null)
      setFormData({ class_id: '', student_id: '', department: '' })
      await loadData()
      const deptText = formData.department ? ` — Department: ${formData.department}` : ''
      setNotice({ type: 'success', text: editing ? `Enrollment updated${deptText}` : `Student enrolled${deptText}` })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error creating enrollment' })
    }
  }

  const handleDeleteEnrollment = async (enrollmentId: string) => {
    if (!confirm('Are you sure you want to remove this enrollment?')) return

    try {
      const res = await fetch(`/api/admin/enrollments?id=${encodeURIComponent(enrollmentId)}`, { method: 'DELETE' })
      const js = await res.json()
      if (!res.ok) throw new Error(js.error || 'Failed to delete enrollment')
      await loadData()
    } catch (error: any) {
      alert(error.message || 'Error deleting enrollment')
    }
  }

  if (loading) {
    return <SchoolLoader />
  }

  return (
    <div>
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
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Users className="w-10 h-10 text-orange-600" />
          <h2 className="text-3xl font-bold text-gray-900">Class Enrollments</h2>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setFormData({ class_id: '', student_id: '', department: '' })
            setShowModal(true)
          }}
          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Enroll Student
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <select
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All classes</option>
              {classes.map((c) => {
                const label = (c.class_level && (c.class_level as any).toString().trim())
                  ? (c.class_level as any).toString().trim()
                  : (c.name as any).toString().trim()
                return (
                  <option key={c.id} value={c.id}>
                    {label}
                  </option>
                )
              })}
            </select>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student or class"
              className="px-3 py-2 border border-gray-300 rounded-lg w-72"
            />
            {filterClassId ? (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/admin/classes/department?class_id=${encodeURIComponent(filterClassId)}`, { method: 'DELETE' })
                    const js = await res.json()
                    if (!res.ok) throw new Error(js.error || 'Failed to clear department')
                    await loadData()
                    alert('Class department cleared')
                  } catch (e: any) {
                    alert(e?.message || 'Failed to clear department')
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                title="Clear the class-level department label"
              >
                Clear class department
              </button>
            ) : null}
          </div>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Student
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Class
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Enrolled Date
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {enrollments
              .filter((e) => !filterClassId || e.class_id === filterClassId)
              .filter((e) => {
                const q = searchTerm.trim().toLowerCase()
                if (!q) return true
                return (e.student_name || '').toLowerCase().includes(q) || (e.class_name || '').toLowerCase().includes(q)
              }).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  No enrollments found. Click &quot;Enroll Student&quot; to add one.
                </td>
              </tr>
            ) : (
              enrollments
                .filter((e) => !filterClassId || e.class_id === filterClassId)
                .filter((e) => {
                  const q = searchTerm.trim().toLowerCase()
                  if (!q) return true
                  return (e.student_name || '').toLowerCase().includes(q) || (e.class_name || '').toLowerCase().includes(q)
                })
                .map((enrollment) => (
                <tr key={enrollment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {enrollment.student_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{enrollment.class_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {(enrollment.student_department || '').trim() ? enrollment.student_department : 'None'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(enrollment.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        setFormData({
                          class_id: enrollment.class_id,
                          student_id: enrollment.student_id,
                          department: (enrollment.student_department && enrollment.student_department !== 'None') ? enrollment.student_department : ''
                        })
                        setEditing(enrollment)
                        setShowModal(true)
                      }}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteEnrollment(enrollment.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{editing ? 'Edit Enrollment' : 'Enroll Student in Class'}</h3>
              <button onClick={() => { setShowModal(false); setEditing(null) }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Class
                </label>
                <select
                  value={formData.class_id}
                  onChange={(e) => {
                    const id = e.target.value
                    const cls = classes.find(c => c.id === id) as any
                    const lvl = String(cls?.class_level || '').toUpperCase()
                    const isJunior = lvl.startsWith('JSS')
                    setFormData({ ...formData, class_id: id, department: isJunior ? '' : formData.department })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                >
                  <option value="">Select a class</option>
                  {classes.map((c: any) => {
                    const label = (c.class_level && String(c.class_level).trim())
                      ? String(c.class_level).trim()
                      : String(c.name || '').trim()
                    return (
                      <option key={c.id} value={c.id}>
                        {label}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Student
                </label>
                <select
                  value={formData.student_id}
                  onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                  disabled={!!editing}
                >
                  <option value="">Select a student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department for this Class
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100 disabled:text-gray-400"
                  disabled={(() => {
                    const cls = classes.find(c => c.id === formData.class_id) as any
                    const lvl = String(cls?.class_level || '').toUpperCase()
                    return lvl.startsWith('JSS')
                  })()}
                >
                  <option value="">— Keep current —</option>
                  <option value="General">General</option>
                  <option value="Science">Science</option>
                  <option value="Business">Business</option>
                  <option value="Humanities">Humanities</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => { setShowModal(false); setEditing(null) }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateEnrollment}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  {editing ? 'Save' : 'Enroll'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
