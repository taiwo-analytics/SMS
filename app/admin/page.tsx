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
      const { data } = await supabase
        .from('events')
        .select('*')
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(5)

      if (data) {
        setUpcomingEvents(data)
      }
    } catch (error) {
      console.error('Error loading events:', error)
    }
  }

  const getEventStatus = (eventDate: string) => {
    const date = new Date(eventDate)
    const now = new Date()
    const diffTime = date.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const isOngoing = diffTime < 0 && Math.abs(diffTime) < 24 * 60 * 60 * 1000

    if (isOngoing) return { text: 'Ongoing', color: 'text-green-600 bg-green-50 border-green-200' }
    if (diffDays === 0) return { text: 'Today', color: 'text-blue-600 bg-blue-50 border-blue-200' }
    if (diffDays === 1) return { text: 'Tomorrow', color: 'text-orange-600 bg-orange-50 border-orange-200' }
    return { text: `${diffDays} days left`, color: 'text-blue-600 bg-blue-50 border-blue-200' }
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
          Overview of your school's administration, teachers, students, and classes.
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
              const status = getEventStatus(event.event_date)
              const eventDate = new Date(event.event_date)
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
