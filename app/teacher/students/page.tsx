'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Users, ArrowLeft, BookOpen } from 'lucide-react'
import { Student, Class } from '@/types/database'

export default function TeacherStudentsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<(Student & { email?: string; classes?: string[] })[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [classes, setClasses] = useState<Class[]>([])

  useEffect(() => {
    checkAuth()
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

      await loadData(user.id)
    } catch (error) {
      console.error('Error checking auth:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const loadData = async (userId: string) => {
    try {
      // Get teacher record
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (!teacher) return

      // Load teacher's classes
      const { data: teacherClasses } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', teacher.id)

      setClasses(teacherClasses || [])

      // Load students from all classes
      const classIds = (teacherClasses || []).map(c => c.id)
      if (classIds.length === 0) return

      const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select('student_id, class_id')
        .in('class_id', classIds)

      if (!enrollments) return

      // Get unique student IDs
      const studentIds = Array.from(new Set(enrollments.map(e => e.student_id)))

      // Load student details
      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .in('id', studentIds)

      // Map students with their classes
      const studentsWithClasses = (studentsData || []).map(student => {
        const studentEnrollments = enrollments.filter(e => e.student_id === student.id)
        const studentClassIds = studentEnrollments.map(e => e.class_id)
        const studentClassNames = (teacherClasses || [])
          .filter(c => studentClassIds.includes(c.id))
          .map(c => c.name)

        return {
          ...student,
          classes: studentClassNames,
        }
      })

      setStudents(studentsWithClasses)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const filteredStudents = selectedClass === 'all' 
    ? students 
    : students.filter(s => {
        const classNames = classes.filter(c => c.id === selectedClass).map(c => c.name)
        return s.classes?.some(sc => classNames.includes(sc))
      })

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
              <h1 className="text-xl font-bold text-gray-900">My Students</h1>
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
            <Users className="w-10 h-10 text-green-600" />
            <h2 className="text-3xl font-bold text-gray-900">My Students</h2>
          </div>
          
          <div className="flex items-center gap-4 mb-6">
            <label className="text-sm font-medium text-gray-700">Filter by Class:</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Classes</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name} - {classItem.subject}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Classes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Enrolled
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                    No students found in your classes.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{student.full_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {student.classes?.map((className, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                          >
                            <BookOpen className="w-3 h-3" />
                            {className}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(student.created_at).toLocaleDateString()}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
