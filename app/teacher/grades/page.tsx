'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ClipboardList, BookOpen, Trash2 } from 'lucide-react'
import { Class, Student, Grade, AcademicTerm } from '@/types/database'
import SchoolLoader from '@/components/SchoolLoader'

export default function TeacherGradesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [students, setStudents] = useState<Student[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [terms, setTerms] = useState<AcademicTerm[]>([])
  const [selectedTerm, setSelectedTerm] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    student_id: '',
    assignment_name: '',
    score: 0,
    max_score: 100,
    notes: '',
    term_id: '',
  })

  const loadStudentsAndGrades = useCallback(async () => {
    if (!selectedClass) return
    try {
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
      const res = await fetch(`/api/grades?class_id=${selectedClass}`)
      const data = await res.json()
      setGrades(data.grades || [])
    } catch (error) {
      console.error('Error loading students/grades:', error)
    }
  }, [selectedClass])

  useEffect(() => {
    if (selectedClass) {
      loadStudentsAndGrades()
    }
  }, [selectedClass, loadStudentsAndGrades])

  const loadTerms = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('academic_terms')
        .select('*')
        .order('created_at', { ascending: false })
      setTerms(data || [])
    } catch (error) {
      console.error('Error loading terms:', error)
    }
  }, [])

  const loadClasses = useCallback(async (userId: string) => {
    try {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (teacher) {
        // Get classes from class_subject_teachers + classes where teacher is class teacher
        const [{ data: cst }, { data: ctClasses }] = await Promise.all([
          supabase.from('class_subject_teachers').select('class_id, classes(id, name)').eq('teacher_id', teacher.id),
          supabase.from('classes').select('id, name').eq('class_teacher_id', teacher.id),
        ])
        const classMap = new Map<string, any>()
        for (const r of (cst || [])) {
          const c = r.classes as any
          if (c) classMap.set(c.id, c)
        }
        for (const c of (ctClasses || [])) classMap.set(c.id, c)
        const data = Array.from(classMap.values())
        setClasses(data)
        if (data.length > 0) setSelectedClass(data[0].id)
      }
    } catch (error) {
      console.error('Error loading classes:', error)
    }
  }, [])

  const checkAuth = useCallback(async () => {
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
      await loadTerms()
    } catch (error) {
      console.error('Error checking auth:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }, [router, loadClasses, loadTerms])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

 

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
          term_id: formData.term_id || null,
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
        term_id: '',
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

  const filteredGrades = selectedTerm === 'all' ? grades : grades.filter(g => g.term_id === selectedTerm)

  if (loading) {
    return <SchoolLoader />
  }

  return (
    <div>
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
            <label className="text-sm font-medium text-gray-700">Term:</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Terms</option>
              {terms.map((term) => (
                <option key={term.id} value={term.id}>{term.name}</option>
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
                {filteredGrades.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No grades recorded yet. Click &quot;Add Grade&quot; to start recording grades.
                    </td>
                  </tr>
                ) : (
                  filteredGrades.map((grade) => {
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
                    Term (Optional)
                  </label>
                  <select
                    value={formData.term_id}
                    onChange={(e) => setFormData({ ...formData, term_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">No term</option>
                    {terms.map((term) => (
                      <option key={term.id} value={term.id}>{term.name}</option>
                    ))}
                  </select>
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
    </div>
  )
}
