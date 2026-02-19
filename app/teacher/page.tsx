'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { GraduationCap, ArrowLeft, BookOpen, Users, ClipboardList, UserCheck, FileText } from 'lucide-react'

export default function TeacherDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    classes: 0,
    students: 0,
  })

  useEffect(() => {
    checkAuth()
    loadStats()
  }, [])

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
    } catch (error) {
      console.error('Error checking auth:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (teacher) {
        const [classesRes, enrollmentsRes] = await Promise.all([
          supabase.from('classes').select('id', { count: 'exact' }).eq('teacher_id', teacher.id),
          supabase
            .from('class_enrollments')
            .select('student_id', { count: 'exact' })
            .in('class_id', 
              (await supabase.from('classes').select('id').eq('teacher_id', teacher.id)).data?.map(c => c.id) || []
            )
        ])

        setStats({
          classes: classesRes.count || 0,
          students: enrollmentsRes.count || 0,
        })
      }
    } catch (error) {
      console.error('Error loading stats:', error)
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
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">Teacher Dashboard</h1>
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
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <GraduationCap className="w-10 h-10 text-blue-600" />
            <h2 className="text-3xl font-bold text-gray-900">Welcome, Teacher</h2>
          </div>
          <p className="text-gray-600">
            Manage your classes, students, and grades from this dashboard.
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div 
            onClick={() => router.push('/teacher/classes')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-blue-500"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">My Classes</p>
                <p className="text-3xl font-bold text-gray-900">{stats.classes}</p>
              </div>
              <BookOpen className="w-12 h-12 text-blue-500" />
            </div>
          </div>

          <div 
            onClick={() => router.push('/teacher/students')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-green-500"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Students</p>
                <p className="text-3xl font-bold text-gray-900">{stats.students}</p>
              </div>
              <Users className="w-12 h-12 text-green-500" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            onClick={() => router.push('/teacher/classes')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <BookOpen className="w-10 h-10 text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">My Classes</h3>
            <p className="text-gray-600">View and manage your assigned classes</p>
          </div>

          <div
            onClick={() => router.push('/teacher/students')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <Users className="w-10 h-10 text-green-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">My Students</h3>
            <p className="text-gray-600">View students enrolled in your classes</p>
          </div>

          <div
            onClick={() => router.push('/teacher/grades')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <ClipboardList className="w-10 h-10 text-purple-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Manage Grades</h3>
            <p className="text-gray-600">View and manage student grades</p>
          </div>

          <div
            onClick={() => router.push('/teacher/attendance')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <UserCheck className="w-10 h-10 text-teal-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Attendance</h3>
            <p className="text-gray-600">Take and review class attendance</p>
          </div>

          <div
            onClick={() => router.push('/teacher/assignments')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <FileText className="w-10 h-10 text-indigo-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Assignments</h3>
            <p className="text-gray-600">Create and manage class assignments</p>
          </div>
        </div>
      </main>
    </div>
  )
}
