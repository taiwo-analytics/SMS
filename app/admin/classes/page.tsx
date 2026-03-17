'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { BookOpen, Plus, Edit, Trash2, X, Users, User, Settings as SettingsIcon } from 'lucide-react'
import { Class, Teacher, Student } from '@/types/database'
import SchoolLoader from '@/components/SchoolLoader'

export default function AdminClassesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<(Class & { teacher_name?: string; student_count?: number })[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [formData, setFormData] = useState({
    category: '' as '' | 'Junior' | 'Senior',
    class_level: '',
    department: ''
  })
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignTargetClass, setAssignTargetClass] = useState<(Class & { teacher_name?: string }) | null>(null)
  const [assignTeacherId, setAssignTeacherId] = useState('')
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [studentsFilterClassId, setStudentsFilterClassId] = useState('')
  const [studentsInClass, setStudentsInClass] = useState<Student[]>([])
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(id)
  }, [notice])

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!loading) {
      loadClasses()
      loadTeachers()
    }
  }, [loading])

  const checkAuth = async () => {
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
    } catch (error) {
      console.error('Error checking auth:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTeachers = async () => {
    try {
      const res = await fetch('/api/admin/users/list/teachers')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load teachers')
      setTeachers((json.teachers || []) as Teacher[])
    } catch (error) {
      console.error('Error loading teachers:', error)
    }
  }

  const categoryOf = (lvl: string | null | undefined) => {
    const u = String(lvl || '').toUpperCase()
    if (u.startsWith('JSS')) return 'Junior'
    if (u.startsWith('SS')) return 'Senior'
    return 'Unknown'
  }

  const loadClasses = async () => {
    try {
      const res = await fetch('/api/admin/classes')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load classes')
      setClasses(json.classes || [])
    } catch (error) {
      console.error('Error loading classes:', error)
      setNotice({ type: 'error', text: (error as any)?.message || 'Failed to load classes' })
      throw error
    }
  }

  const handleCreateClass = async () => {
    try {
      const res = await fetch('/api/admin/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_level: formData.class_level || null,
          department: formData.department || null
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error creating class')

      setShowModal(false)
      setFormData({ category: '', class_level: '', department: '' })
      await loadClasses()
      setNotice({ type: 'success', text: 'Class created successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error creating class' })
    }
  }

  const handleUpdateClass = async () => {
    if (!editingClass) return

    try {
      const res = await fetch('/api/admin/classes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingClass.id,
          class_level: formData.class_level || null,
          department: formData.department || null
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error updating class')

      setShowModal(false)
      setEditingClass(null)
      setFormData({ category: '', class_level: '', department: '' })
      await loadClasses()
      setNotice({ type: 'success', text: 'Class updated successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error updating class' })
    }
  }

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Are you sure you want to delete this class? This will also remove all enrollments.')) return

    try {
      const res = await fetch(`/api/admin/classes?id=${classId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error deleting class')
      await loadClasses()
      setNotice({ type: 'success', text: 'Class deleted successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error deleting class' })
    }
  }

  const openEditModal = (classItem: Class & { teacher_name?: string }) => {
    setEditingClass(classItem)
    setFormData({
      category: categoryOf((classItem as any).class_level) as any,
      class_level: (classItem as any).class_level || '',
      department: ((classItem as any).department || '')
    })
    setShowModal(true)
  }

  const openCreateModal = () => {
    setEditingClass(null)
    setFormData({ category: '', class_level: '', department: '' })
    setShowModal(true)
  }

  const openAssignTeacherModal = (classItem: Class & { teacher_name?: string }) => {
    setAssignTargetClass(classItem)
    // Pre-select the current class teacher if one is assigned
    const currentId = (classItem as any).class_teacher_id || (classItem as any).teacher_id || ''
    setAssignTeacherId(currentId)
    setShowAssignModal(true)
  }

  const handleAssignClassTeacher = async () => {
    if (!assignTargetClass || !assignTeacherId) return
    try {
      const res = await fetch('/api/admin/teachers/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'class_teacher',
          teacher_id: assignTeacherId,
          class_id: assignTargetClass.id,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to assign class teacher')
      setShowAssignModal(false)
      setAssignTargetClass(null)
      setAssignTeacherId('')
      await loadClasses()
      setNotice({ type: 'success', text: 'Class teacher assigned' })
    } catch (e: any) {
      setNotice({ type: 'error', text: e?.message || 'Failed to assign class teacher' })
    }
  }

  const handleRemoveClassTeacher = async () => {
    if (!assignTargetClass) return
    if (!confirm(`Remove class teacher from ${classLabel(assignTargetClass)}?`)) return
    try {
      const res = await fetch('/api/admin/teachers/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'remove_class_teacher',
          teacher_id: '',
          class_id: assignTargetClass.id,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to remove class teacher')
      setShowAssignModal(false)
      setAssignTargetClass(null)
      setAssignTeacherId('')
      await loadClasses()
      setNotice({ type: 'success', text: 'Class teacher removed' })
    } catch (e: any) {
      setNotice({ type: 'error', text: e?.message || 'Failed to remove class teacher' })
    }
  }

  const classLabel = (c: Class) => (c as any).class_level || c.name || 'Untitled'

  const loadStudentsForClass = async (cid: string) => {
    try {
      if (!cid) {
        setStudentsInClass([])
        return
      }
      const res = await fetch(`/api/admin/classes/students?class_id=${cid}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load students')
      setStudentsInClass(json.students || [])
    } catch (e: any) {
      setStudentsInClass([])
      setNotice({ type: 'error', text: e?.message || 'Failed to load students' })
    }
  }

  const exportStudentsCsv = () => {
    if (!studentsFilterClassId || studentsInClass.length === 0) return
    const cls = classes.find(c => c.id === studentsFilterClassId)
    const header = ['Student','Department','Payment Status']
    const rows = studentsInClass.map((s: any) => [
      s.full_name || '',
      s.department || '',
      s.payment_status || ''
    ])
    const csv = [header, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `students-${(cls as any)?.class_level || cls?.name || 'class'}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <SchoolLoader />
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <BookOpen className="w-10 h-10 text-purple-600" />
          <h2 className="text-3xl font-bold text-gray-900">Classes</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-5 h-5" />
            Add Class
          </button>
        </div>
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

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class Teacher</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Students</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {classes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No classes found. Click &quot;Add Class&quot; to create one.
                </td>
              </tr>
            ) : (
              classes.map((classItem) => (
                <tr key={classItem.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{classLabel(classItem)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{categoryOf((classItem as any).class_level)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{classItem.teacher_name || 'Unassigned'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Users className="w-4 h-4" />
                      {classItem.student_count || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openAssignTeacherModal(classItem)}
                        className="text-orange-600 hover:text-orange-900"
                        title="Assign class teacher"
                      >
                        <User className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openEditModal(classItem)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClass(classItem.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
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
              <h3 className="text-xl font-bold">
                {editingClass ? 'Edit Class' : 'Add New Class'}
              </h3>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => {
                    const cat = e.target.value as any
                    setFormData((prev) => ({
                      ...prev,
                      category: cat,
                      class_level:
                        cat === 'Junior'
                          ? (['JSS1','JSS2','JSS3'].includes(prev.class_level) ? prev.class_level : '')
                          : cat === 'Senior'
                          ? (['SS1','SS2','SS3'].includes(prev.class_level) ? prev.class_level : '')
                          : ''
                    }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select Category</option>
                  <option value="Junior">Junior</option>
                  <option value="Senior">Senior</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Class
                </label>
                <select
                  value={formData.class_level}
                  onChange={(e) => setFormData({ ...formData, class_level: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select Class</option>
                  {(formData.category === 'Junior' ? ['JSS1','JSS2','JSS3'] :
                    formData.category === 'Senior' ? ['SS1','SS2','SS3'] : []
                  ).map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department (optional, recommended for Senior)
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All/Core</option>
                  <option value="Science">Science</option>
                  <option value="Humanities">Humanities</option>
                  <option value="Arts">Arts</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={editingClass ? handleUpdateClass : handleCreateClass}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  {editingClass ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Class Teacher Modal */}
      {showAssignModal && assignTargetClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Assign Class Teacher</h3>
              <button onClick={() => setShowAssignModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Class: <span className="font-semibold text-gray-800">{classLabel(assignTargetClass)}</span>
            </p>
            {assignTargetClass.teacher_name && assignTargetClass.teacher_name !== 'Unassigned' && (
              <div className="mb-4 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
                Current class teacher: <span className="font-semibold">{assignTargetClass.teacher_name}</span>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Teacher</label>
                <select
                  value={assignTeacherId}
                  onChange={(e) => setAssignTeacherId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select a teacher</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-between items-center pt-4">
                {(assignTargetClass.teacher_name && assignTargetClass.teacher_name !== 'Unassigned') && (
                  <button
                    onClick={handleRemoveClassTeacher}
                    className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm"
                  >
                    Remove Teacher
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button
                    onClick={handleAssignClassTeacher}
                    disabled={!assignTeacherId}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <h3 className="text-lg font-semibold">Students</h3>
          <div className="ml-auto w-64">
            <select
              value={studentsFilterClassId}
              onChange={(e) => {
                const v = e.target.value
                setStudentsFilterClassId(v)
                loadStudentsForClass(v)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              title="Filter by class"
            >
              <option value="">Select a class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{classLabel(c)}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => studentsFilterClassId && loadStudentsForClass(studentsFilterClassId)}
            disabled={!studentsFilterClassId}
            className="ml-3 px-3 py-2 border rounded-lg text-sm disabled:opacity-50"
            title="Refresh"
          >
            Refresh
          </button>
          <button
            onClick={exportStudentsCsv}
            disabled={!studentsFilterClassId || studentsInClass.length === 0}
            className="ml-3 px-3 py-2 border rounded-lg text-sm disabled:opacity-50"
            title="Export CSV"
          >
            Export CSV
          </button>
        </div>
        <div className="p-4">
          {studentsFilterClassId && studentsInClass.length === 0 ? (
            <div className="text-sm text-gray-500">No students in this class.</div>
          ) : null}
          {studentsFilterClassId && studentsInClass.length > 0 ? (() => {
            const selected = classes.find((c) => c.id === studentsFilterClassId)
            const lvl = String((selected as any)?.class_level || '').toUpperCase()
            const defaultDept = lvl.startsWith('JSS') ? 'General' : ''
            return (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {studentsInClass.map((s) => {
                    const dept = (s as any).department || defaultDept || ''
                    const badgeClass =
                      dept === 'Science' ? 'bg-blue-100 text-blue-700' :
                      dept === 'Business' ? 'bg-yellow-100 text-yellow-700' :
                      dept === 'Humanities' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    const ps = (s as any).payment_status || ''
                    const payClass =
                      /paid|success|completed/i.test(ps) ? 'bg-green-100 text-green-700' :
                      /pending|processing/i.test(ps) ? 'bg-yellow-100 text-yellow-700' :
                      /failed|unpaid|overdue/i.test(ps) ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-sm text-gray-800">{s.full_name}</td>
                        <td className="px-6 py-3 text-sm">
                          {dept ? (
                            <span className={`px-2 py-0.5 text-xs rounded ${badgeClass}`}>{dept}</span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-sm">
                          {ps ? (
                            <span className={`px-2 py-0.5 text-xs rounded ${payClass}`}>{ps}</span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-sm text-right">
                          <a
                            href={`/admin/payments?student_id=${s.id}`}
                            className="text-indigo-600 hover:text-indigo-800 text-xs underline"
                            title="View payments"
                          >
                            View payments
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          })() : null}
        </div>
      </div>
    </div>
  )
}
