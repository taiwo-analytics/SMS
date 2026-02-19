'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ClipboardList, ArrowLeft, BookOpen, Trash2 } from 'lucide-react'
import { Class, Student, Grade } from '@/types/database'

export default function TeacherGradesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [students, setStudents] = useState<Student[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    student_id: '',
    assignment_name: '',
    score: 0,
    max_score: 100,
    notes: '',
  })

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (selectedClass) {
      loadStudentsAndGrades()
    }
  }, [selectedClass])

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'teacher') {
        router.push('/')
        return
      }

      await loadClasses(user.id)
    } catch (error) {
      console.error('Error checking auth:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const loadClasses = async (userId: string) => {
    try {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (teacher) {
        const { data } = await supabase
          .from('classes')
          .select('*')
          .eq('teacher_id', teacher.id)

        setClasses(data || [])
        if (data && data.length > 0) {
          setSelectedClass(data[0].id)
        }
      }
    } catch (error) {
      console.error('Error loading classes:', error)
    }
  }

  const loadStudentsAndGrades = async () => {
    if (!selectedClass) return

    try {
      // Load students enrolled in this class
      const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select('student_id')
        .eq('class_id', selectedClass)

      if (enrollments && enrollments.length > 0) {
        const studentIds = enrollments.map(e => e.student_id)
        const { data: studentsData } = await supabase
          .from('students')
          .select('*')
          .in('id', studentIds)

        setStudents(studentsData || [])
      } else {
        setStudents([])
      }

      // Load grades from API
      const res = await fetch(`/api/grades?class_id=${selectedClass}`)
      const data = await res.json()
      setGrades(data.grades || [])
    } catch (error) {
      console.error('Error loading students/grades:', error)
    }
  }

  const handleSubmitGrade = async () => {
    if (!formData.student_id || !formData.assignment_name) return

    setSaving(true)
    try {
      const res = await fetch('/api/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: formData.student_id,
          class_id: selectedClass,
          assignment_name: formData.assignment_name,
          score: formData.score,
          max_score: formData.max_score,
          notes: formData.notes || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to save grade')
        return
      }

      // Add to list
      setGrades(prev => [data.grade, ...prev])
      setShowModal(false)
      setFormData({
        student_id: '',
        assignment_name: '',
        score: 0,
        max_score: 100,
        notes: '',
      })
    } catch (error) {
      console.error('Error saving grade:', error)
      alert('Failed to save grade')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteGrade = async (gradeId: string) => {
    if (!confirm('Delete this grade?')) return

    try {
      const res = await fetch(`/api/grades?id=${gradeId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to delete grade')
        return
      }
      setGrades(prev => prev.filter(g => g.id !== gradeId))
    } catch (error) {
      console.error('Error deleting grade:', error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/teacher')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">Manage Grades</h1>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <ClipboardList className="w-10 h-10 text-purple-600" />
            <h2 className="text-3xl font-bold text-gray-900">Grades Management</h2>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <label className="text-sm font-medium text-gray-700">Select Class:</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select a class</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name} {classItem.subject ? `- ${classItem.subject}` : ''}
                </option>
              ))}
            </select>
            {selectedClass && (
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Add Grade
              </button>
            )}
          </div>
        </div>

        {selectedClass ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assignment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Percentage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {grades.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No grades recorded yet. Click &quot;Add Grade&quot; to start recording grades.
                    </td>
                  </tr>
                ) : (
                  grades.map((grade) => {
                    const student = students.find(s => s.id === grade.student_id)
                    const percentage = ((grade.score / grade.max_score) * 100).toFixed(1)
                    return (
                      <tr key={grade.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {student?.full_name || 'Unknown'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{grade.assignment_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {grade.score} / {grade.max_score}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${
                            parseFloat(percentage) >= 70 ? 'text-green-600' :
                            parseFloat(percentage) >= 50 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {percentage}%
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500 max-w-xs truncate">
                            {grade.notes || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleDeleteGrade(grade.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete grade"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Please select a class to view and manage grades.</p>
          </div>
        )}

        {/* Add Grade Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">Add Grade</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Student
                  </label>
                  <select
                    value={formData.student_id}
                    onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Select student</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assignment Name
                  </label>
                  <input
                    type="text"
                    value={formData.assignment_name}
                    onChange={(e) => setFormData({ ...formData, assignment_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Score
                    </label>
                    <input
                      type="number"
                      value={formData.score}
                      onChange={(e) => setFormData({ ...formData, score: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      min={0}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Score
                    </label>
                    <input
                      type="number"
                      value={formData.max_score}
                      onChange={(e) => setFormData({ ...formData, max_score: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      min={1}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitGrade}
                    disabled={saving || !formData.student_id || !formData.assignment_name}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Grade'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
