'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { BookOpen, Plus, Edit, Trash2, X, Users } from 'lucide-react'
import { Class, Teacher } from '@/types/database'

export default function AdminClassesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<(Class & { teacher_name?: string; student_count?: number })[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [formData, setFormData] = useState({ 
    name: '', 
    subject: '', 
    teacher_id: '', 
    class_level: '',
    department: ''
  })

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
      const { data, error } = await supabase.from('teachers').select('*').order('full_name')
      if (error) throw error
      setTeachers(data || [])
    } catch (error) {
      console.error('Error loading teachers:', error)
    }
  }

  const loadClasses = async () => {
    try {
      const { data, error } = await supabase.from('classes').select('*').order('class_level', { ascending: true }).order('name', { ascending: true })
      if (error) throw error

      const classesWithDetails = await Promise.all(
        (data || []).map(async (classItem) => {
          const [teacherRes, enrollmentsRes] = await Promise.all([
            classItem.teacher_id 
              ? supabase.from('teachers').select('full_name').eq('id', classItem.teacher_id).single()
              : Promise.resolve({ data: null }),
            supabase.from('class_enrollments').select('id', { count: 'exact' }).eq('class_id', classItem.id)
          ])

          return {
            ...classItem,
            teacher_name: teacherRes.data?.full_name || 'Unassigned',
            student_count: enrollmentsRes.count || 0,
          }
        })
      )

      setClasses(classesWithDetails)
    } catch (error) {
      console.error('Error loading classes:', error)
    }
  }

  const handleCreateClass = async () => {
    try {
      const { error } = await supabase.from('classes').insert({
        name: formData.name,
        subject: formData.subject || null,
        teacher_id: formData.teacher_id || null,
        class_level: formData.class_level || null,
        department: formData.department || null,
      })

      if (error) throw error

      setShowModal(false)
      setFormData({ name: '', subject: '', teacher_id: '', class_level: '', department: '' })
      loadClasses()
    } catch (error: any) {
      alert(error.message || 'Error creating class')
    }
  }

  const handleUpdateClass = async () => {
    if (!editingClass) return

    try {
      await supabase
        .from('classes')
        .update({
          name: formData.name,
          subject: formData.subject || null,
          teacher_id: formData.teacher_id || null,
          class_level: formData.class_level || null,
          department: formData.department || null,
        })
        .eq('id', editingClass.id)

      setShowModal(false)
      setEditingClass(null)
      setFormData({ name: '', subject: '', teacher_id: '', class_level: '', department: '' })
      loadClasses()
    } catch (error: any) {
      alert(error.message || 'Error updating class')
    }
  }

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Are you sure you want to delete this class? This will also remove all enrollments.')) return

    try {
      await supabase.from('class_enrollments').delete().eq('class_id', classId)
      await supabase.from('classes').delete().eq('id', classId)
      loadClasses()
    } catch (error: any) {
      alert(error.message || 'Error deleting class')
    }
  }

  const openEditModal = (classItem: Class & { teacher_name?: string }) => {
    setEditingClass(classItem)
    setFormData({
      name: classItem.name,
      subject: classItem.subject || '',
      teacher_id: classItem.teacher_id || '',
      class_level: (classItem as any).class_level || '',
      department: (classItem as any).department || '',
    })
    setShowModal(true)
  }

  const openCreateModal = () => {
    setEditingClass(null)
    setFormData({ name: '', subject: '', teacher_id: '', class_level: '', department: '' })
    setShowModal(true)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <BookOpen className="w-10 h-10 text-purple-600" />
          <h2 className="text-3xl font-bold text-gray-900">Classes</h2>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
        >
          <Plus className="w-5 h-5" />
          Add Class
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Students</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {classes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No classes found. Click "Add Class" to create one.
                </td>
              </tr>
            ) : (
              classes.map((classItem) => (
                <tr key={classItem.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{classItem.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {(classItem as any).class_level || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {(classItem as any).department ? (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                          {(classItem as any).department}
                        </span>
                      ) : (
                        'N/A'
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{classItem.subject || 'N/A'}</div>
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
                  Class Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., JSS1A, SS2B"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Class Level
                </label>
                <select
                  value={formData.class_level}
                  onChange={(e) => setFormData({ ...formData, class_level: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select Level</option>
                  <option value="JSS1">JSS1</option>
                  <option value="JSS2">JSS2</option>
                  <option value="JSS3">JSS3</option>
                  <option value="SS1">SS1</option>
                  <option value="SS2">SS2</option>
                  <option value="SS3">SS3</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department (For Senior Students)
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">No Department</option>
                  <option value="Science">Science</option>
                  <option value="Humanities">Humanities</option>
                  <option value="Business">Business</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject (Optional)
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Mathematics"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teacher (Optional)
                </label>
                <select
                  value={formData.teacher_id}
                  onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select a teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.full_name}
                    </option>
                  ))}
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
    </div>
  )
}
