'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { GraduationCap, BookOpen, Users, ClipboardList, UserCheck, FileText, Clock, Calendar, MapPin } from 'lucide-react'
import { Event } from '@/types/events'

export default function TeacherDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    classes: 0,
    students: 0,
  })
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [assignedSubjects, setAssignedSubjects] = useState<Array<{ class_id: string, class_label: string, subjects: string[] }>>([])

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
    } catch (error) {
      console.error('Error checking auth:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }, [router])

  const loadStats = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    checkAuth()
    loadStats()
    const loadAssigned = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: teacher } = await supabase
          .from('teachers')
          .select('id')
          .eq('user_id', user.id)
          .single()
        if (!teacher) return
        const { data: assignments } = await supabase
          .from('class_subject_teachers')
          .select('class_id, subject_id, teacher_id')
          .eq('teacher_id', teacher.id)
        const classIds = Array.from(new Set((assignments || []).map(a => a.class_id)))
        const subjIds = Array.from(new Set((assignments || []).map(a => a.subject_id)))
        const [classesRes, subjectsRes] = await Promise.all([
          classIds.length ? supabase.from('classes').select('id, name, class_level, department').in('id', classIds) : Promise.resolve({ data: [] as any[] }),
          subjIds.length ? supabase.from('subjects').select('id, name, code').in('id', subjIds) : Promise.resolve({ data: [] as any[] }),
        ])
        const classMap = new Map<string, any>((classesRes.data || []).map((c: any) => [c.id, c]))
        const subjectMap = new Map<string, any>((subjectsRes.data || []).map((s: any) => [s.id, s]))
        const byClass: Map<string, { class_id: string, class_label: string, subjects: string[] }> = new Map()
        ;(assignments || []).forEach((a: any) => {
          const c = classMap.get(a.class_id)
          const s = subjectMap.get(a.subject_id)
          const label = c ? `${c.class_level || c.name}${c.department ? ` - ${c.department}` : ''}` : 'Unknown class'
          const subjLabel = s ? `${s.name}${s.code ? ` (${s.code})` : ''}` : 'Unknown subject'
          if (!byClass.has(a.class_id)) byClass.set(a.class_id, { class_id: a.class_id, class_label: label, subjects: [] })
          const row = byClass.get(a.class_id)!
          if (!row.subjects.includes(subjLabel)) row.subjects.push(subjLabel)
        })
        setAssignedSubjects(Array.from(byClass.values()))
      } catch (e) {
        console.error('Error loading assigned subjects:', e)
        setAssignedSubjects([])
      }
    }
    loadAssigned()
    loadUpcomingEvents()
    const interval = setInterval(loadUpcomingEvents, 60000)
    const eventsChannel = supabase
      .channel('events-teacher')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => { loadUpcomingEvents() }
      )
      .subscribe()
    return () => {
      clearInterval(interval)
      supabase.removeChannel(eventsChannel)
    }
  }, [checkAuth, loadStats])

  const loadUpcomingEvents = async () => {
    try {
      const pad2 = (n: number) => String(n).padStart(2, '0')
      const parseTime24 = (s?: string): string | null => {
        if (!s) return null
        const t = s.trim().toUpperCase()
        const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
        if (!m) return null
        let h = Number(m[1]); const mm = Number(m[2]); const ap = m[3]
        if (Number.isNaN(h) || Number.isNaN(mm)) return null
        if (ap === 'PM' && h < 12) h += 12
        if (ap === 'AM' && h === 12) h = 0
        return `${pad2(h)}:${pad2(mm)}`
      }
      const splitRange24 = (s?: string): { start: string | null, end: string | null } => {
        if (!s) return { start: null, end: null }
        if (!s.includes('-')) return { start: parseTime24(s), end: null }
        const [a, b] = s.split('-')
        return { start: parseTime24(a || ''), end: parseTime24(b || '') }
      }
      const resolveStartEnd = (ev: any) => {
        let start = ev.start_at ? new Date(ev.start_at) : new Date(ev.event_date)
        const { start: s24, end: e24 } = splitRange24(ev.event_time)
        if (s24) {
          const [h, m] = s24.split(':').map(Number)
          start.setHours(h, m, 0, 0)
        }
        let end: Date
        if (ev.end_at) {
          end = new Date(ev.end_at)
        } else if (e24) {
          end = new Date(start)
          const [h2, m2] = e24.split(':').map(Number)
          end.setHours(h2, m2, 0, 0)
        } else {
          end = new Date(start.getTime() + 60 * 60 * 1000)
        }
        return { start, end }
      }

      const { data } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      const now = new Date()
      const cutoff = new Date(now.getTime() - 10 * 60 * 1000)
      const items = (data || [])
        .map((ev: any) => ({ ev, ...resolveStartEnd(ev) }))
        .filter(({ end }) => end >= cutoff)
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .slice(0, 10)
        .map(({ ev }) => ev)
      setUpcomingEvents(items as Event[])
    } catch (e) {
      console.error('Error loading events:', e)
    }
  }

  const getEventStatus = (eventDate: string, eventTime?: string, endAt?: string) => {
    const now = new Date()
    let start = new Date(eventDate)
    if (isNaN(start.getTime())) start = new Date(`${eventDate}T00:00:00`)
    const parseTime24 = (s?: string): string | null => {
      if (!s) return null
      const t = s.trim().toUpperCase()
      const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
      if (!m) return null
      let h = Number(m[1]); const mm = Number(m[2]); const ap = m[3]
      if (Number.isNaN(h) || Number.isNaN(mm)) return null
      if (ap === 'PM' && h < 12) h += 12
      if (ap === 'AM' && h === 12) h = 0
      return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
    }
    const splitRange24 = (s?: string): { start: string | null, end: string | null } => {
      if (!s) return { start: null, end: null }
      if (!s.includes('-')) return { start: parseTime24(s), end: null }
      const [a, b] = s.split('-')
      return { start: parseTime24(a || ''), end: parseTime24(b || '') }
    }
    const { start: s24, end: e24 } = splitRange24(eventTime)
    if (s24) {
      const [h, m] = s24.split(':').map(Number)
      start.setHours(h, m, 0, 0)
    }
    let end: Date
    if (endAt) {
      end = new Date(endAt)
    } else if (e24) {
      end = new Date(start)
      const [h2, m2] = e24.split(':').map(Number)
      end.setHours(h2, m2, 0, 0)
    } else if (s24) {
      end = new Date(start.getTime() + 60 * 60 * 1000)
    } else {
      end = new Date(start)
      end.setHours(23, 59, 59, 999)
    }

    const sameDay =
      start.getFullYear() === now.getFullYear() &&
      start.getMonth() === now.getMonth() &&
      start.getDate() === now.getDate()

    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    const isTomorrow =
      start.getFullYear() === tomorrow.getFullYear() &&
      start.getMonth() === tomorrow.getMonth() &&
      start.getDate() === tomorrow.getDate()

    if (now >= start && now <= end) return { text: 'Ongoing', color: 'text-green-600 bg-green-50 border-green-200' }
    if (now > end) return { text: 'Completed', color: 'text-gray-600 bg-gray-50 border-gray-200' }
    if (sameDay) {
      const ms = start.getTime() - now.getTime()
      const hrs = Math.max(1, Math.ceil(ms / (1000 * 60 * 60)))
      return { text: `${hrs}h left`, color: 'text-orange-600 bg-orange-50 border-orange-200' }
    }
    if (isTomorrow) return { text: 'Tomorrow', color: 'text-orange-600 bg-orange-50 border-orange-200' }
    const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfStart = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const daysLeft = Math.round((startOfStart.getTime() - startOfNow.getTime()) / (1000 * 60 * 60 * 24))
    return { text: `${daysLeft} days left`, color: 'text-blue-600 bg-blue-50 border-blue-200' }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
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

          <div
            onClick={() => router.push('/teacher/timetable')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <Clock className="w-10 h-10 text-orange-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Timetable</h3>
            <p className="text-gray-600">View your weekly schedule</p>
          </div>
        </div>

        {/* My Subjects */}
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-semibold text-gray-900">My Subjects</h3>
            </div>
            <button
              onClick={() => router.push('/teacher/classes')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View Classes →
            </button>
          </div>
          {assignedSubjects.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No subjects assigned yet.</p>
          ) : (
            <div className="space-y-4">
              {assignedSubjects.map((row) => (
                <div key={row.class_id} className="border rounded-lg p-4">
                  <p className="text-sm font-semibold text-gray-900 mb-2">{row.class_label}</p>
                  <div className="flex flex-wrap gap-2">
                    {row.subjects.map((s, idx) => (
                      <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-semibold text-gray-900">Upcoming Events</h3>
            </div>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No upcoming events.</p>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => {
                const status = getEventStatus((event as any).start_at || (event as any).event_date, (event as any).event_time, (event as any).end_at)
                const eventDate = new Date((event as any).start_at || (event as any).event_date)
                return (
                  <div key={event.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">{event.title}</h4>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {eventDate.toLocaleDateString()}
                          </div>
                          {'event_time' in event && (event as any).event_time && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {(event as any).event_time}
                            </div>
                          )}
                          {'location' in event && (event as any).location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {(event as any).location}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full border ${status.color}`}>
                        {status.text}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
    </div>
  )
}
