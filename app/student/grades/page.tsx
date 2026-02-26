'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ClipboardList, ArrowLeft, BookOpen } from 'lucide-react'
import { Grade, Class, AcademicTerm } from '@/types/database'

export default function StudentGradesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [grades, setGrades] = useState<Grade[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [terms, setTerms] = useState<AcademicTerm[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [selectedTerm, setSelectedTerm] = useState<string>('all')

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

      if (profile?.role !== 'student') {
        router.push('/')
        return
      }

      // Load student's enrolled classes
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (student) {
        const { data: enrollments } = await supabase
          .from('class_enrollments')
          .select('class_id')
          .eq('student_id', student.id)

        if (enrollments && enrollments.length > 0) {
          const classIds = enrollments.map(e => e.class_id)
          const { data: classesData } = await supabase
            .from('classes')
            .select('*')
            .in('id', classIds)
          setClasses(classesData || [])
        }
      }

      // Load terms
      const { data: termsData } = await supabase
        .from('academic_terms').select('*').order('created_at', { ascending: false })
      setTerms(termsData || [])

      // Load grades from API
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

  const filteredGrades = grades
    .filter(g => selectedClass === 'all' || g.class_id === selectedClass)
    .filter(g => selectedTerm === 'all' || g.term_id === selectedTerm)

  // Calculate overall stats
  const totalGrades = filteredGrades.length
  const averagePercentage = totalGrades > 0
    ? (filteredGrades.reduce((sum, g) => sum + (g.score / g.max_score) * 100, 0) / totalGrades).toFixed(1)
    : '0.0'

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
                onClick={() => router.push('/student')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">My Grades</h1>
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
            <h2 className="text-3xl font-bold text-gray-900">My Grades</h2>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-5 border-l-4 border-blue-500">
              <p className="text-sm text-gray-600">Total Grades</p>
              <p className="text-2xl font-bold text-gray-900">{totalGrades}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-5 border-l-4 border-green-500">
              <p className="text-sm text-gray-600">Average Score</p>
              <p className={`text-2xl font-bold ${
                parseFloat(averagePercentage) >= 70 ? 'text-green-600' :
                parseFloat(averagePercentage) >= 50 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {averagePercentage}%
              </p>
            </div>
          </div>

          {/* Class Filter */}
          {classes.length > 0 && (
            <div className="flex items-center gap-4 mb-6">
              <label className="text-sm font-medium text-gray-700">Filter by Class:</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} {cls.subject ? `- ${cls.subject}` : ''}
                  </option>
                ))}
              </select>
              {terms.length > 0 && (
                <>
                  <label className="text-sm font-medium text-gray-700">Term:</label>
                  <select
                    value={selectedTerm}
                    onChange={(e) => setSelectedTerm(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Terms</option>
                    {terms.map((term) => (
                      <option key={term.id} value={term.id}>{term.name}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}
        </div>

        {filteredGrades.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No grades recorded yet.</p>
          </div>
        ) : (
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
                {filteredGrades.map((grade) => {
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
        )}
      </main>
    </div>
  )
}
