'use client'

import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  GraduationCap,
  BookOpen,
  Users,
  ClipboardList,
  UserCheck,
  FileText,
  Clock,
  MessageSquare,
  LogOut,
  Menu,
  X,
  Bell,
  Calendar,
  MapPin,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface TeacherLayoutProps {
  children: React.ReactNode
}

export default function TeacherLayout({ children }: TeacherLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [openGroups, setOpenGroups] = useState<string[]>([])
  const [eventCount, setEventCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const navigation = [
    { name: 'Dashboard', href: '/teacher', icon: GraduationCap },
    { name: 'My Class', href: '/teacher/classes', icon: BookOpen },
    { name: 'Assigned Classes', href: '/teacher/students', icon: Users },
    { name: 'Results', href: '/teacher/broadsheet', icon: ClipboardList, children: [
      { name: 'Broadsheet', href: '/teacher/broadsheet' },
      { name: 'Report Card', href: '/teacher/report-card' },
    ]},
    { name: 'Attendance', href: '/teacher/attendance', icon: UserCheck, children: [
      { name: 'Class Attendance', href: '/teacher/attendance' },
      { name: 'Subject Attendance', href: '/teacher/subject-attendance' },
    ]},
    { name: 'Assignments', href: '/teacher/assignments', icon: FileText },
    { name: 'Timetable', href: '/teacher/timetable', icon: Clock },
    { name: 'Messages', href: '/teacher/messages', icon: MessageSquare },
  ]

  const pad2 = (n: number) => String(n).padStart(2, '0')

  const parseTime24 = (s?: string): string | null => {
    if (!s) return null
    const t = s.trim().toUpperCase()
    const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
    if (!m) return null
    let h = Number(m[1]); const mm = Number(m[2]); const ap = m[3]
    if (ap === 'PM' && h < 12) h += 12
    if (ap === 'AM' && h === 12) h = 0
    return `${pad2(h)}:${pad2(mm)}`
  }

  const splitRange24 = (s?: string) => {
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

  const loadUpcomingEvents = async () => {
    try {
      const { data } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true })
        .limit(200)
      if (data) {
        const now = new Date()
        const cutoff = new Date(now.getTime() - 10 * 60 * 1000)
        const enriched = (data as any[]).map((e) => ({ raw: e, ...resolveStartEnd(e) }))
        const upcoming = enriched
          .filter((e) => e.end >= cutoff)
          .sort((a, b) => a.start.getTime() - b.start.getTime())
          .slice(0, 10)
          .map((e) => e.raw)
        setUpcomingEvents(upcoming)
        setEventCount(upcoming.length)
      }
    } catch (error) {
      console.error('Error loading events:', error)
    }
  }

  const loadUnreadCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id || null

      const [broadcastRes, directRes] = await Promise.all([
        supabase
          .from('messages')
          .select('id, is_read, read_at, recipient_role, sender_id')
          .in('recipient_role', ['teacher', 'all'])
          .is('recipient_id', null),
        uid
          ? supabase
              .from('messages')
              .select('id, is_read, read_at, recipient_role, sender_id')
              .eq('recipient_id', uid)
          : Promise.resolve({ data: [] as any[], error: null }),
      ])

      const seen = new Set<string>()
      const all: any[] = []
      for (const m of [...(broadcastRes.data || []), ...((directRes as any).data || [])]) {
        if (!seen.has(m.id)) { seen.add(m.id); all.push(m) }
      }
      // Only count messages not sent by this teacher
      const count = all.filter((m: any) => m.sender_id !== uid && (m.is_read === false || m.read_at == null)).length
      setUnreadCount(count)
    } catch (e) {
      console.error('Error loading unread messages:', e)
    }
  }

  useEffect(() => {
    loadUpcomingEvents()
    loadUnreadCount()
    const interval = setInterval(loadUpcomingEvents, 60000)
    const msgInterval = setInterval(loadUnreadCount, 60000)

    const eventsChannel = supabase
      .channel('events-teacher-layout')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, loadUpcomingEvents)
      .subscribe()

    const messagesChannel = supabase
      .channel('messages-teacher-layout')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadUnreadCount)
      .subscribe()

    return () => {
      clearInterval(interval)
      clearInterval(msgInterval)
      supabase.removeChannel(eventsChannel)
      supabase.removeChannel(messagesChannel)
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b fixed w-full top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-gray-600 hover:text-gray-900"
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <button
                onClick={() => router.push('/teacher')}
                className="text-gray-600 hover:text-gray-900"
              >
                <GraduationCap className="w-6 h-6" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">Teacher Portal</h1>
            </div>

            <div className="flex items-center gap-4">
              {/* Messages Icon */}
              <button
                onClick={() => router.push('/teacher/messages')}
                className="relative p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                title="Messages"
              >
                <MessageSquare className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                >
                  <Bell className="w-6 h-6" />
                  {eventCount > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {eventCount > 9 ? '9+' : eventCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900">Upcoming Events</h3>
                    </div>
                    <div className="p-2">
                      {upcomingEvents.length === 0 ? (
                        <p className="text-sm text-gray-500 p-4 text-center">No upcoming events</p>
                      ) : (
                        upcomingEvents.map((event) => {
                          const { start, end } = resolveStartEnd(event)
                          const now = new Date()
                          const isOngoing = now >= start && now <= end
                          const diffTime = start.getTime() - now.getTime()
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                          return (
                            <div key={event.id} className="p-3 hover:bg-gray-50 rounded-lg mb-1">
                              <p className="font-medium text-sm text-gray-900">{event.title}</p>
                              {event.description && (
                                <p className="text-xs text-gray-600">{event.description}</p>
                              )}
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                <Calendar className="w-3 h-3" />
                                {start.toLocaleDateString()} at {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              {event.location && (
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <MapPin className="w-3 h-3" />
                                  {event.location}
                                </div>
                              )}
                              <p className="text-xs mt-1">
                                {isOngoing ? (
                                  <span className="text-green-600 font-medium">Ongoing</span>
                                ) : diffDays > 0 ? (
                                  <span className="text-blue-600">{diffDays} day{diffDays !== 1 ? 's' : ''} left</span>
                                ) : (
                                  <span className="text-orange-600">Today</span>
                                )}
                              </p>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out lg:translate-x-0 pt-16`}
        >
          <div className="h-full overflow-y-auto py-4">
            <nav className="space-y-1 px-3">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                if ((item as any).children) {
                  const isOpen = openGroups.includes(item.name)
                  const isGroupActive = (item as any).children.some((c: any) => pathname === c.href)
                  return (
                    <div key={item.name}>
                      <button
                        onClick={() => setOpenGroups((prev) =>
                          prev.includes(item.name) ? prev.filter((g) => g !== item.name) : [...prev, item.name]
                        )}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                          isGroupActive
                            ? 'bg-blue-50 text-blue-600 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="flex-1 text-left">{item.name}</span>
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      {isOpen && (
                        <div className="ml-8 mt-1 space-y-1">
                          {(item as any).children.map((child: any) => (
                            <button
                              key={child.name}
                              onClick={() => { router.push(child.href); setSidebarOpen(false) }}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                                pathname === child.href
                                  ? 'bg-blue-50 text-blue-600 font-medium'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                              {child.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      router.push(item.href)
                      setSidebarOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="flex-1 text-left">{item.name}</span>
                    {item.name === 'Messages' && unreadCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => {
            setSidebarOpen(false)
            setShowNotifications(false)
          }}
        />
      )}

      {showNotifications && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setShowNotifications(false)}
        />
      )}
    </div>
  )
}
