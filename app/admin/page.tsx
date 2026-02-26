'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Shield, GraduationCap, User, BookOpen, Users, TrendingUp, Calendar, Clock, MapPin } from 'lucide-react'
import { Event } from '@/types/events'

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

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!loading) {
      loadStats()
      loadUpcomingEvents()
    }
  }, [loading])

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
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <Shield className="w-10 h-10 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-900">Administration Dashboard</h2>
        </div>
        <p className="text-gray-600">
          Overview of your school&apos;s administration, teachers, students, and classes.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div
          onClick={() => router.push('/admin/teachers')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-blue-500"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Teachers</p>
              <p className="text-3xl font-bold text-gray-900">{stats.teachers}</p>
            </div>
            <GraduationCap className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        <div
          onClick={() => router.push('/admin/students')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-green-500"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Students</p>
              <p className="text-3xl font-bold text-gray-900">{stats.students}</p>
            </div>
            <User className="w-12 h-12 text-green-500" />
          </div>
        </div>

        <div
          onClick={() => router.push('/admin/classes')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-purple-500"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Classes</p>
              <p className="text-3xl font-bold text-gray-900">{stats.classes}</p>
            </div>
            <BookOpen className="w-12 h-12 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Parents</p>
              <p className="text-3xl font-bold text-gray-900">{stats.parents}</p>
            </div>
            <Users className="w-12 h-12 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div
          onClick={() => router.push('/admin/teachers')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-blue-500"
        >
          <GraduationCap className="w-8 h-8 text-blue-600 mb-3" />
          <h3 className="text-lg font-semibold mb-1">Teachers</h3>
          <p className="text-sm text-gray-600">Manage teacher accounts</p>
        </div>

        <div
          onClick={() => router.push('/admin/students')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-green-500"
        >
          <User className="w-8 h-8 text-green-600 mb-3" />
          <h3 className="text-lg font-semibold mb-1">Students</h3>
          <p className="text-sm text-gray-600">Manage student records</p>
        </div>

        <div
          onClick={() => router.push('/admin/classes')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-purple-500"
        >
          <BookOpen className="w-8 h-8 text-purple-600 mb-3" />
          <h3 className="text-lg font-semibold mb-1">Classes</h3>
          <p className="text-sm text-gray-600">Create and manage classes</p>
        </div>

        <div
          onClick={() => router.push('/admin/enrollments')}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-orange-500"
        >
          <Users className="w-8 h-8 text-orange-600 mb-3" />
          <h3 className="text-lg font-semibold mb-1">Enrollments</h3>
          <p className="text-sm text-gray-600">Manage class enrollments</p>
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
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

      {/* Quick Stats */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-6 h-6 text-gray-600" />
          <h3 className="text-xl font-semibold text-gray-900">Quick Stats</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Teachers</p>
            <p className="text-2xl font-bold text-blue-600">{stats.teachers}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Students</p>
            <p className="text-2xl font-bold text-green-600">{stats.students}</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Active Classes</p>
            <p className="text-2xl font-bold text-purple-600">{stats.classes}</p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Registered Parents</p>
            <p className="text-2xl font-bold text-orange-600">{stats.parents}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
