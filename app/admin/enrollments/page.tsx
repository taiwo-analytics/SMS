'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Users, ArrowLeft, Plus, Trash2, X } from 'lucide-react'
import { Class, Student } from '@/types/database'

interface Enrollment {
  id: string
  class_id: string
  student_id: string
  class_name?: string
  student_name?: string
  created_at: string
}

export default function AdminEnrollmentsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ class_id: '', student_id: '' })

  useEffect(() => {
    checkAuth()
  }, [])

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

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.error('Profile error:', profileError)
          setLoading(false)
          return
        }

        if (profile?.role !== 'admin') {
          console.warn('User is not admin')
          setLoading(false)
          return
        }
      } catch (profileErr) {
        console.error('Error checking profile:', profileErr)
        setLoading(false)
        return
      }

      await loadData()
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    try {
      // Load classes and students
      const [classesRes, studentsRes, enrollmentsRes] = await Promise.all([
        supabase.from('classes').select('*').order('name'),
        supabase.from('students').select('*').order('full_name'),
        supabase.from('class_enrollments').select('*').order('created_at', { ascending: false }),
      ])

      setClasses(classesRes.data || [])
      setStudents(studentsRes.data || [])

      // Enrich enrollments with names
      const enrichedEnrollments = (enrollmentsRes.data || []).map((enrollment) => {
        const classItem = classesRes.data?.find((c) => c.id === enrollment.class_id)
        const student = studentsRes.data?.find((s) => s.id === enrollment.student_id)
        return {
          ...enrollment,
          class_name: classItem?.name || 'Unknown',
          student_name: student?.full_name || 'Unknown',
        }
      })

      setEnrollments(enrichedEnrollments)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const handleCreateEnrollment = async () => {
    try {
      // Check if enrollment already exists
      const { data: existing } = await supabase
        .from('class_enrollments')
        .select('id')
        .eq('class_id', formData.class_id)
        .eq('student_id', formData.student_id)
        .single()

      if (existing) {
        alert('Student is already enrolled in this class')
        return
      }

      const { error } = await supabase.from('class_enrollments').insert({
        class_id: formData.class_id,
        student_id: formData.student_id,
      })

      if (error) throw error

      setShowModal(false)
      setFormData({ class_id: '', student_id: '' })
      loadData()
    } catch (error: any) {
      alert(error.message || 'Error creating enrollment')
    }
  }

  const handleDeleteEnrollment = async (enrollmentId: string) => {
    if (!confirm('Are you sure you want to remove this enrollment?')) return

    try {
      await supabase.from('class_enrollments').delete().eq('id', enrollmentId)
      loadData()
    } catch (error: any) {
      alert(error.message || 'Error deleting enrollment')
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Users className="w-10 h-10 text-orange-600" />
          <h2 className="text-3xl font-bold text-gray-900">Class Enrollments</h2>
        </div>
        <button
          onClick={() => {
            setFormData({ class_id: '', student_id: '' })
            setShowModal(true)
          }}
          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Enroll Student
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
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
                Enrolled Date
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  No enrollments found. Click "Enroll Student" to add one.
                </td>
              </tr>
            ) : (
              enrollments.map((enrollment) => (
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
                      {new Date(enrollment.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
              <h3 className="text-xl font-bold">Enroll Student in Class</h3>
              <button onClick={() => setShowModal(false)}>
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
                  onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                >
                  <option value="">Select a class</option>
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name} - {classItem.subject}
                    </option>
                  ))}
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
                >
                  <option value="">Select a student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name}
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
                  onClick={handleCreateEnrollment}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Enroll
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
