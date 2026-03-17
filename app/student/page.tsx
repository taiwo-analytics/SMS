'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { User, BookOpen, ClipboardList, FileText, Clock } from 'lucide-react'
import SchoolLoader from '@/components/SchoolLoader'

export default function StudentDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    classes: 0,
    grades: 0,
    averageScore: 0,
  })

  useEffect(() => {
    checkAuthAndLoad()
  }, [])

  const checkAuthAndLoad = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'student') { router.push('/'); return }

      const { data: student } = await supabase
        .from('students').select('id').eq('user_id', user.id).single()
      if (!student) { setLoading(false); return }

      // Load stats
      const { data: enrollments } = await supabase
        .from('class_enrollments').select('class_id').eq('student_id', student.id)

      const classCount = enrollments?.length || 0

      const res = await fetch('/api/grades')
      const gradesData = await res.json()
      const grades = gradesData.grades || []
      const gradeCount = grades.length
      const avgScore = gradeCount > 0
        ? parseFloat((grades.reduce((sum: number, g: any) => sum + (g.score / g.max_score) * 100, 0) / gradeCount).toFixed(1))
        : 0

      setStats({ classes: classCount, grades: gradeCount, averageScore: avgScore })
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <SchoolLoader />
  }

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <User className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Welcome, Student</h2>
        </div>
        <p className="text-gray-600">View your classes, grades, and assignments from this dashboard.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div
          onClick={() => router.push('/student/classes')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-blue-500"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Enrolled Classes</p>
              <p className="text-3xl font-bold text-gray-900">{stats.classes}</p>
            </div>
            <BookOpen className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        <div
          onClick={() => router.push('/student/grades')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-green-500"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Grades</p>
              <p className="text-3xl font-bold text-gray-900">{stats.grades}</p>
            </div>
            <ClipboardList className="w-12 h-12 text-green-500" />
          </div>
        </div>

        <div
          onClick={() => router.push('/student/grades')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-purple-500"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Average Score</p>
              <p className={`text-3xl font-bold ${stats.averageScore >= 70 ? 'text-green-600' : stats.averageScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {stats.averageScore}%
              </p>
            </div>
            <ClipboardList className="w-12 h-12 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          onClick={() => router.push('/student/classes')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <BookOpen className="w-10 h-10 text-blue-600 mb-4" />
          <h3 className="text-xl font-semibold mb-2">My Classes</h3>
          <p className="text-gray-600">View your enrolled classes</p>
        </div>

        <div
          onClick={() => router.push('/student/grades')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <ClipboardList className="w-10 h-10 text-green-600 mb-4" />
          <h3 className="text-xl font-semibold mb-2">My Grades</h3>
          <p className="text-gray-600">View your grades and scores</p>
        </div>

        <div
          onClick={() => router.push('/student/assignments')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <FileText className="w-10 h-10 text-indigo-600 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Assignments</h3>
          <p className="text-gray-600">View upcoming assignments</p>
        </div>

        <div
          onClick={() => router.push('/student/timetable')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <Clock className="w-10 h-10 text-orange-600 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Timetable</h3>
          <p className="text-gray-600">View your weekly schedule</p>
        </div>
      </div>
    </div>
  )
}
