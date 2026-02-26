'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Clock, ArrowLeft } from 'lucide-react'
import { Timetable, Class } from '@/types/database'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export default function StudentTimetablePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<Timetable[]>([])
  const [classes, setClasses] = useState<Class[]>([])

  useEffect(() => { checkAuthAndLoad() }, [])

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

      const { data: enrollments } = await supabase
        .from('class_enrollments').select('class_id').eq('student_id', student.id)
      if (!enrollments || enrollments.length === 0) { setLoading(false); return }

      const classIds = enrollments.map(e => e.class_id)

      const [timetableRes, classesRes] = await Promise.all([
        supabase.from('timetables').select('*').in('class_id', classIds).order('start_time'),
        supabase.from('classes').select('*').in('id', classIds),
      ])

      setEntries(timetableRes.data || [])
      setClasses(classesRes.data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const classMap = useMemo(() => {
    const map: Record<string, string> = {}
    classes.forEach(c => { map[c.id] = c.name })
    return map
  }, [classes])

  const entriesByDay = useMemo(() => {
    const map: Record<string, Timetable[]> = {}
    DAYS.forEach(d => { map[d] = [] })
    entries.forEach(e => {
      if (map[e.day_of_week]) map[e.day_of_week].push(e)
    })
    return map
  }, [entries])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/student')} className="text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">My Timetable</h1>
            </div>
            <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Clock className="w-10 h-10 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-900">My Schedule</h2>
        </div>

        {entries.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No timetable entries for your classes yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="grid grid-cols-5 divide-x divide-gray-200">
              {DAYS.map(day => (
                <div key={day}>
                  <div className="bg-gray-50 px-3 py-3 text-center">
                    <span className="text-sm font-semibold text-gray-700">{day}</span>
                  </div>
                  <div className="divide-y divide-gray-100 min-h-[250px]">
                    {entriesByDay[day].length === 0 ? (
                      <div className="px-3 py-8 text-center text-xs text-gray-400">Free</div>
                    ) : (
                      entriesByDay[day].map(entry => (
                        <div key={entry.id} className="px-3 py-2 hover:bg-blue-50">
                          <p className="text-sm font-medium text-gray-900">{entry.subject || 'No subject'}</p>
                          <p className="text-xs text-gray-500">{entry.start_time} - {entry.end_time}</p>
                          <p className="text-xs text-blue-600">{classMap[entry.class_id] || 'Unknown class'}</p>
                          {entry.room && <p className="text-xs text-gray-400">Room: {entry.room}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
