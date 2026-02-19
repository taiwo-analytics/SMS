'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ClipboardList, ArrowLeft, BookOpen, Users } from 'lucide-react'
import { Grade, Student, Class } from '@/types/database'

export default function ParentGradesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [children, setChildren] = useState<Student[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedChild, setSelectedChild] = useState<string>('all')

  useEffect(() => {
    checkAuthAndLoad()
  }, [])

  const checkAuthAndLoad = async () => {
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

      if (profile?.role !== 'parent') {
        router.push('/')
        return
      }

      // Load parent record and their children
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (parent) {
        const { data: childrenData } = await supabase
          .from('students')
          .select('*')
          .eq('parent_id', parent.id)

        setChildren(childrenData || [])

        // Load all enrolled classes for context
        if (childrenData && childrenData.length > 0) {
          const childIds = childrenData.map(c => c.id)
          const { data: enrollments } = await supabase
            .from('class_enrollments')
            .select('class_id')
            .in('student_id', childIds)

          if (enrollments && enrollments.length > 0) {
            const classIds = [...new Set(enrollments.map(e => e.class_id))]
            const { data: classesData } = await supabase
              .from('classes')
              .select('*')
              .in('id', classIds)
            setClasses(classesData || [])
          }
        }
      }

      // Load grades from API (returns all children's grades)
      const res = await fetch('/api/grades')
      const data = await res.json()
      setGrades(data.grades || [])
    } catch (error) {
      console.error('Error:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const filteredGrades = selectedChild === 'all'
    ? grades
    : grades.filter(g => g.student_id === selectedChild)

  // Group grades by child
  const gradesByChild = children.map(child => {
    const childGrades = filteredGrades.filter(g => g.student_id === child.id)
    const avg = childGrades.length > 0
      ? (childGrades.reduce((sum, g) => sum + (g.score / g.max_score) * 100, 0) / childGrades.length).toFixed(1)
      : null
    return { child, grades: childGrades, average: avg }
  }).filter(entry =>
    selectedChild === 'all' ? true : entry.child.id === selectedChild
  )

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
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">Children&apos;s Grades</h1>
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
            <ClipboardList className="w-10 h-10 text-blue-600" />
            <h2 className="text-3xl font-bold text-gray-900">Children&apos;s Grades</h2>
          </div>

          {/* Child Filter */}
          {children.length > 1 && (
            <div className="flex items-center gap-4 mb-6">
              <label className="text-sm font-medium text-gray-700">Select Child:</label>
              <select
                value={selectedChild}
                onChange={(e) => setSelectedChild(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Children</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {children.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No children linked to your account.</p>
          </div>
        ) : gradesByChild.every(entry => entry.grades.length === 0) ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No grades recorded yet for your children.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {gradesByChild.map(({ child, grades: childGrades, average }) => (
              childGrades.length > 0 && (
                <div key={child.id}>
                  {/* Child Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{child.full_name}</h3>
                        <p className="text-sm text-gray-500">{childGrades.length} grade{childGrades.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {average && (
                      <div className={`text-lg font-bold ${
                        parseFloat(average) >= 70 ? 'text-green-600' :
                        parseFloat(average) >= 50 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        Average: {average}%
                      </div>
                    )}
                  </div>

                  {/* Grades Table */}
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Class
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
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {childGrades.map((grade) => {
                          const cls = classes.find(c => c.id === grade.class_id)
                          const percentage = ((grade.score / grade.max_score) * 100).toFixed(1)
                          return (
                            <tr key={grade.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {cls?.name || 'Unknown'}
                                </div>
                                {cls?.subject && (
                                  <div className="text-xs text-gray-500">{cls.subject}</div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{grade.assignment_name}</div>
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
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">
                                  {new Date(grade.created_at).toLocaleDateString()}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
