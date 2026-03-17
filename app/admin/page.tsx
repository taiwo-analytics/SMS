'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Shield, GraduationCap, User, BookOpen, Users, Calendar, Clock, MapPin, BarChart3 } from 'lucide-react'
import { Event } from '@/types/events'
import SchoolLoader from '@/components/SchoolLoader'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'

export default function AdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    teachers: 0,
    students: 0,
    classes: 0,
    parents: 0,
  })
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [attendanceView, setAttendanceView] = useState<'day' | 'week' | 'month'>('week')
  const [attendanceClassId, setAttendanceClassId] = useState<string>('')
  const [attendanceData, setAttendanceData] = useState<{
    overall_rate: number
    total_records: number
    by_class: { class_id: string; class_name: string; present: number; absent: number; late: number; total: number; attendance_rate: number }[]
    trend: { date: string; present: number; absent: number; late: number; total: number; attendance_rate: number }[]
    classes: { id: string; name: string }[]
    from: string
    to: string
  } | null>(null)
  const [attendanceLoading, setAttendanceLoading] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!loading) {
      loadStats()
      loadUpcomingEvents()
      loadAttendanceSummary()
    }
  }, [loading])

  useEffect(() => {
    if (!loading) loadAttendanceSummary()
  }, [attendanceView, attendanceClassId])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        loadUpcomingEvents()
      }
    }, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [loading])

  useEffect(() => {
    if (loading) return
    const channel = supabase
      .channel('events-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        loadUpcomingEvents()
      })
      .subscribe()
    return () => {
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [loading])

  const checkAuth = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError) {
        console.error('Auth error:', authError)
        // Don't redirect on error, allow access for development
        setLoading(false)
        return
      }

      if (!user) {
        // Allow access for development, but show a warning
        console.warn('No user logged in')
        setLoading(false)
        return
      }

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.error('Profile error:', profileError)
          // Allow access for development
          setLoading(false)
          return
        }

        if (profile?.role !== 'admin') {
          console.warn('User is not admin')
          // Allow access for development
          setLoading(false)
          return
        }
      } catch (profileErr) {
        console.error('Error checking profile:', profileErr)
        // Allow access for development
        setLoading(false)
        return
      }
    } catch (error) {
      console.error('Error checking auth:', error)
      // Allow access for development
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/stats')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load stats')
      setStats({
        teachers: json.teachers ?? 0,
        students: json.students ?? 0,
        classes: json.classes ?? 0,
        parents: json.parents ?? 0,
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadAttendanceSummary = async () => {
    setAttendanceLoading(true)
    try {
      const params = new URLSearchParams({ view: attendanceView })
      if (attendanceClassId) params.set('class_id', attendanceClassId)
      const res = await fetch(`/api/admin/attendance/summary?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load attendance')
      setAttendanceData(json)
    } catch (error) {
      console.error('Error loading attendance summary:', error)
    } finally {
      setAttendanceLoading(false)
    }
  }

  const loadUpcomingEvents = async () => {
    try {
      // Helpers to handle legacy event_time (e.g., "09:00" or "09:00-15:00")
      const pad2 = (n: number) => String(n).padStart(2, '0')
      const parseTime24 = (s?: string): string | null => {
        if (!s) return null
        const t = s.trim().toUpperCase()
        const range = t.includes('-') ? t.split('-')[0] : t
        const m = range.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
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

      // Fetch recent events and decide status on the client for robustness across schemas/timezones
      const { data } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      const now = new Date()
      const cutoff = new Date(now.getTime() - 10 * 60 * 1000)
      const items = (data || [])
        .map((ev: any) => ({ ev, ...resolveStartEnd(ev) }))
        .filter(({ end }) => end >= cutoff) // keep ongoing or within grace window
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .slice(0, 10)
        .map(({ ev }) => ev)

      setUpcomingEvents(items)
    } catch (error) {
      console.error('Error loading events:', error)
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
    return <SchoolLoader />
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-600 bg-clip-text text-transparent">Administration Dashboard</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Overview of your school&apos;s administration, teachers, students, and classes.
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards - Gradient */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div
          onClick={() => router.push('/admin/teachers')}
          className="relative overflow-hidden rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-200/50 group"
        >
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-lg group-hover:scale-150 transition-transform duration-500" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-white">{stats.teachers}</p>
            <p className="text-sm text-blue-100 mt-1 font-medium">Total Teachers</p>
          </div>
        </div>

        <div
          onClick={() => router.push('/admin/students')}
          className="relative overflow-hidden rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-200/50 group"
        >
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-lg group-hover:scale-150 transition-transform duration-500" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <User className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-white">{stats.students}</p>
            <p className="text-sm text-emerald-100 mt-1 font-medium">Total Students</p>
          </div>
        </div>

        <div
          onClick={() => router.push('/admin/classes')}
          className="relative overflow-hidden rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl bg-gradient-to-br from-violet-500 to-purple-700 shadow-lg shadow-violet-200/50 group"
        >
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-lg group-hover:scale-150 transition-transform duration-500" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-white">{stats.classes}</p>
            <p className="text-sm text-violet-100 mt-1 font-medium">Total Classes</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-200/50 group">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-lg group-hover:scale-150 transition-transform duration-500" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-white">{stats.parents}</p>
            <p className="text-sm text-amber-100 mt-1 font-medium">Total Parents</p>
          </div>
        </div>
      </div>

      {/* Attendance Overview Chart */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-semibold text-gray-900">Attendance Overview</h3>
            {attendanceData && (
              <span className={`ml-3 px-3 py-1 text-sm font-semibold rounded-full ${
                attendanceData.overall_rate >= 80 ? 'bg-green-100 text-green-700' :
                attendanceData.overall_rate >= 60 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {attendanceData.overall_rate}% overall
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={attendanceClassId}
              onChange={(e) => setAttendanceClassId(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Classes</option>
              {(attendanceData?.classes || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['day', 'week', 'month'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setAttendanceView(v)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    attendanceView === v
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {v === 'day' ? 'Today' : v === 'week' ? 'This Week' : 'This Month'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {attendanceLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">Loading attendance data...</div>
        ) : !attendanceData || attendanceData.total_records === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <BarChart3 className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-lg font-medium">No attendance data</p>
            <p className="text-sm">No records found for this period. Attendance is recorded by class teachers.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Per-class bar chart */}
            {!attendanceClassId && attendanceData.by_class.length >= 1 && (
              <div>
                <p className="text-sm font-medium text-gray-600 mb-3">Attendance Rate by Class</p>
                <ResponsiveContainer width="100%" height={Math.max(250, attendanceData.by_class.length * 45)}>
                  <BarChart
                    data={attendanceData.by_class.sort((a, b) => b.attendance_rate - a.attendance_rate)}
                    layout="vertical"
                    margin={{ top: 0, right: 30, left: 20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="class_name" width={120} tick={{ fontSize: 13 }} />
                    <Tooltip
                      formatter={(value: any, name: any) => {
                        if (name === 'attendance_rate') return [`${value}%`, 'Rate']
                        return [value, name]
                      }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                    <Bar dataKey="attendance_rate" name="Attendance Rate" radius={[0, 6, 6, 0]} maxBarSize={32}>
                      {attendanceData.by_class
                        .sort((a, b) => b.attendance_rate - a.attendance_rate)
                        .map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.attendance_rate >= 80 ? '#22c55e' : entry.attendance_rate >= 60 ? '#eab308' : '#ef4444'}
                          />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Daily trend (week/month views) */}
            {attendanceData.trend.length >= 1 && (
              <div>
                <p className="text-sm font-medium text-gray-600 mb-3">Daily Breakdown</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={attendanceData.trend} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => {
                        const dt = new Date(d + 'T00:00:00')
                        return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                      }}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      labelFormatter={(d) => {
                        const dt = new Date(d + 'T00:00:00')
                        return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                      }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                    <Legend />
                    <Bar dataKey="present" name="Present" fill="#22c55e" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="late" name="Late" fill="#eab308" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="absent" name="Absent" fill="#ef4444" stackId="a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Summary stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">
                  {attendanceData.by_class.reduce((s, c) => s + c.present, 0)}
                </p>
                <p className="text-xs text-gray-600">Present</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {attendanceData.by_class.reduce((s, c) => s + c.late, 0)}
                </p>
                <p className="text-xs text-gray-600">Late</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">
                  {attendanceData.by_class.reduce((s, c) => s + c.absent, 0)}
                </p>
                <p className="text-xs text-gray-600">Absent</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{attendanceData.total_records}</p>
                <p className="text-xs text-gray-600">Total Records</p>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Showing {attendanceData.from} to {attendanceData.to}
            </p>
          </div>
        )}
      </div>

      {/* Upcoming Events */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-semibold text-gray-900">Upcoming Events</h3>
          </div>
          <button
            onClick={() => router.push('/admin/events')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Manage Events →
          </button>
        </div>
        {upcomingEvents.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No upcoming events. <button onClick={() => router.push('/admin/events')} className="text-blue-600 hover:underline">Add one</button></p>
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
                        {event.event_time && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {event.event_time}
                          </div>
                        )}
                        {event.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {event.location}
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
