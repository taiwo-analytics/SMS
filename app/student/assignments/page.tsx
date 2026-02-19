'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ClipboardList, ArrowLeft, BookOpen, Calendar, Clock } from 'lucide-react'
import { Assignment, Class } from '@/types/database'

export default function StudentAssignmentsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('all')

  useEffect(() => {
    checkAuthAndLoad()
  }, [])

  const checkAuthAndLoad = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'student') { router.push('/'); return }

      // Load enrolled classes
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

      // Load assignments
      const res = await fetch('/api/assignments')
      const data = await res.json()
      setAssignments(data.assignments || [])
    } catch {
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const filteredAssignments = selectedClass === 'all'
    ? assignments
    : assignments.filter(a => a.class_id === selectedClass)

  const now = new Date()
  const upcoming = filteredAssignments.filter(a => a.due_date && new Date(a.due_date) >= now)
  const past = filteredAssignments.filter(a => !a.due_date || new Date(a.due_date) < now)

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/')} className="text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">Assignments</h1>
            </div>
            <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <ClipboardList className="w-10 h-10 text-blue-600" />
            <h2 className="text-3xl font-bold text-gray-900">My Assignments</h2>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <p className="text-sm text-gray-600">Total Assignments</p>
              <p className="text-2xl font-bold text-gray-900">{filteredAssignments.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
              <p className="text-sm text-gray-600">Upcoming</p>
              <p className="text-2xl font-bold text-yellow-600">{upcoming.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-400">
              <p className="text-sm text-gray-600">Past Due</p>
              <p className="text-2xl font-bold text-gray-500">{past.length}</p>
            </div>
          </div>

          {/* Filter by class */}
          {classes.length > 1 && (
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
            </div>
          )}
        </div>

        {filteredAssignments.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No assignments found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  Upcoming
                </h3>
                <div className="space-y-3">
                  {upcoming.map((a) => {
                    const cls = classes.find(c => c.id === a.class_id)
                    const daysLeft = a.due_date
                      ? Math.ceil((new Date(a.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                      : null
                    return (
                      <div key={a.id} className="bg-white rounded-lg shadow p-5 border-l-4 border-yellow-400">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">{a.title}</h4>
                            {cls && (
                              <p className="text-sm text-blue-600 mt-1">
                                {cls.name} {cls.subject ? `- ${cls.subject}` : ''}
                              </p>
                            )}
                            {a.description && (
                              <p className="text-sm text-gray-600 mt-2">{a.description}</p>
                            )}
                          </div>
                          {a.due_date && (
                            <div className="text-right flex-shrink-0 ml-4">
                              <div className="flex items-center gap-1 text-sm text-gray-500">
                                <Calendar className="w-4 h-4" />
                                {new Date(a.due_date).toLocaleDateString()}
                              </div>
                              {daysLeft !== null && (
                                <p className={`text-xs font-medium mt-1 ${
                                  daysLeft <= 1 ? 'text-red-600' : daysLeft <= 3 ? 'text-yellow-600' : 'text-green-600'
                                }`}>
                                  {daysLeft === 0 ? 'Due today' : daysLeft === 1 ? 'Due tomorrow' : `${daysLeft} days left`}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Past */}
            {past.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-500" />
                  Past / No Due Date
                </h3>
                <div className="space-y-3">
                  {past.map((a) => {
                    const cls = classes.find(c => c.id === a.class_id)
                    return (
                      <div key={a.id} className="bg-white rounded-lg shadow p-5 border-l-4 border-gray-300 opacity-75">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">{a.title}</h4>
                            {cls && (
                              <p className="text-sm text-blue-600 mt-1">
                                {cls.name} {cls.subject ? `- ${cls.subject}` : ''}
                              </p>
                            )}
                            {a.description && (
                              <p className="text-sm text-gray-600 mt-2">{a.description}</p>
                            )}
                          </div>
                          {a.due_date && (
                            <div className="flex items-center gap-1 text-sm text-gray-400 flex-shrink-0 ml-4">
                              <Calendar className="w-4 h-4" />
                              {new Date(a.due_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
