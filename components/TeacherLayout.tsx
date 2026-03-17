'use client'

import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  GraduationCap,
  BookOpen,
  Users,
  User,
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
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

interface TeacherLayoutProps {
  children: ReactNode
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
  const [profile, setProfile] = useState<{ full_name: string; role: string } | null>(null)
  const [schoolName, setSchoolName] = useState('')
  const [schoolLogo, setSchoolLogo] = useState('')

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
        if (data) setProfile(data)
      }
      const { data: settingsRows } = await supabase.from('settings').select('key, value').in('key', ['schoolName', 'schoolLogo'])
      for (const row of (settingsRows || []) as any[]) {
        if (row.key === 'schoolName' && row.value) setSchoolName(row.value)
        if (row.key === 'schoolLogo' && row.value) {
          setSchoolLogo(row.value)
          try { localStorage.setItem('schoolLogo', row.value) } catch {}
        }
      }
      if (!(settingsRows || []).find((r: any) => r.key === 'schoolLogo' && r.value)) {
        try { localStorage.removeItem('schoolLogo') } catch {}
      }
    } catch (e) { console.error('Error loading profile:', e) }
  }

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
    if (s24) { const [h, m] = s24.split(':').map(Number); start.setHours(h, m, 0, 0) }
    let end: Date
    if (ev.end_at) { end = new Date(ev.end_at) }
    else if (e24) { end = new Date(start); const [h2, m2] = e24.split(':').map(Number); end.setHours(h2, m2, 0, 0) }
    else { end = new Date(start.getTime() + 60 * 60 * 1000) }
    return { start, end }
  }

  const loadUpcomingEvents = async () => {
    try {
      const { data } = await supabase.from('events').select('*').order('event_date', { ascending: true }).limit(200)
      if (data) {
        const now = new Date()
        const cutoff = new Date(now.getTime() - 10 * 60 * 1000)
        const enriched = (data as any[]).map((e) => ({ raw: e, ...resolveStartEnd(e) }))
        const upcoming = enriched.filter((e) => e.end >= cutoff).sort((a, b) => a.start.getTime() - b.start.getTime()).slice(0, 10).map((e) => e.raw)
        setUpcomingEvents(upcoming)
        setEventCount(upcoming.length)
      }
    } catch (error) { console.error('Error loading events:', error) }
  }

  const loadUnreadCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id || null
      if (!uid) return
      const [broadcastRes, directRes] = await Promise.all([
        supabase.from('messages').select('id, sender_id').in('recipient_role', ['teacher', 'all']).is('recipient_id', null),
        supabase.from('messages').select('id, sender_id').eq('recipient_id', uid),
      ])
      const seen = new Set<string>()
      const all: any[] = []
      for (const m of [...(broadcastRes.data || []), ...(directRes.data || [])]) {
        if (!seen.has(m.id)) { seen.add(m.id); all.push(m) }
      }
      const { data: reads } = await supabase.from('message_reads').select('message_id').eq('user_id', uid)
      const readIds = new Set((reads || []).map((r: any) => r.message_id))
      const count = all.filter((m: any) => m.sender_id !== uid && !readIds.has(m.id)).length
      setUnreadCount(count)
    } catch (e) { console.error('Error loading unread messages:', e) }
  }

  useEffect(() => {
    loadProfile()
    loadUpcomingEvents()
    loadUnreadCount()
    const interval = setInterval(loadUpcomingEvents, 60000)
    const msgInterval = setInterval(loadUnreadCount, 60000)
    const eventsChannel = supabase.channel('events-teacher-layout').on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, loadUpcomingEvents).subscribe()
    const messagesChannel = supabase.channel('messages-teacher-layout').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadUnreadCount).subscribe()
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

  const getInitials = (name?: string) => {
    if (!name) return 'T'
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Top Navigation - Glass effect */}
      <nav className="fixed w-full top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all">
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <button onClick={() => router.push('/teacher')} className="flex-shrink-0">
                {schoolLogo ? (
                  <img src={schoolLogo} alt="" className="w-9 h-9 rounded-xl object-contain shadow-sm ring-1 ring-gray-200" />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                )}
              </button>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent truncate">
                  {schoolName || 'Teacher Portal'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Messages */}
              <button onClick={() => router.push('/teacher/messages')} className="relative p-2.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Messages">
                <MessageSquare className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center shadow-lg shadow-red-200">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Bell */}
              <div className="relative">
                <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all">
                  <Bell className="w-5 h-5" />
                  {eventCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center shadow-lg shadow-amber-200">
                      {eventCount > 9 ? '9+' : eventCount}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/60 z-50 max-h-96 overflow-y-auto">
                    <div className="p-4 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900">Upcoming Events</h3>
                    </div>
                    <div className="p-2">
                      {upcomingEvents.length === 0 ? (
                        <p className="text-sm text-gray-500 p-4 text-center">No upcoming events</p>
                      ) : (
                        upcomingEvents.map((event) => {
                          const { start, end } = resolveStartEnd(event)
                          const now = new Date()
                          const isOngoing = now >= start && now <= end
                          const diffDays = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                          return (
                            <div key={event.id} className="p-3 hover:bg-emerald-50/50 rounded-xl mb-1 transition-colors">
                              <p className="font-semibold text-sm text-gray-900">{event.title}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                <Calendar className="w-3 h-3" />
                                {start.toLocaleDateString()} • {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              {event.location && (
                                <div className="flex items-center gap-1 text-xs text-gray-500"><MapPin className="w-3 h-3" />{event.location}</div>
                              )}
                              <p className="text-xs mt-1">
                                {isOngoing ? <span className="text-emerald-600 font-semibold">🟢 Ongoing</span>
                                  : diffDays > 0 ? <span className="text-blue-600">{diffDays}d left</span>
                                  : <span className="text-amber-600 font-semibold">Today</span>}
                              </p>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile */}
              <div className="hidden sm:flex items-center gap-2 ml-1 pl-3 border-l border-gray-200">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-emerald-200">
                  {getInitials(profile?.full_name)}
                </div>
                <div className="hidden md:block">
                  <p className="text-xs font-semibold text-gray-900 truncate max-w-[100px]">{profile?.full_name || 'Teacher'}</p>
                  <p className="text-[10px] text-gray-500 capitalize">{profile?.role || 'Teacher'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex pt-16">
        {/* Sidebar - Dark gradient with teal accent */}
        <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 w-[260px] bg-gradient-to-b from-slate-900 via-slate-800 to-emerald-950 transform transition-transform duration-300 ease-in-out lg:translate-x-0 pt-16 shadow-2xl`}>
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto py-4 px-3">
              <nav className="space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  if ((item as any).children) {
                    const isOpen = openGroups.includes(item.name)
                    const isGroupActive = (item as any).children.some((c: any) => pathname === c.href)
                    return (
                      <div key={item.name}>
                        <button
                          onClick={() => setOpenGroups((prev) => prev.includes(item.name) ? prev.filter((g) => g !== item.name) : [...prev, item.name])}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${isGroupActive ? 'bg-white/10 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                          <div className={`p-1.5 rounded-lg ${isGroupActive ? 'bg-emerald-500/20' : ''}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="flex-1 text-left text-sm font-medium">{item.name}</span>
                          {isOpen ? <ChevronDown className="w-4 h-4 opacity-60" /> : <ChevronRight className="w-4 h-4 opacity-60" />}
                        </button>
                        {isOpen && (
                          <div className="ml-10 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                            {(item as any).children.map((child: any) => (
                              <button key={child.name} onClick={() => { router.push(child.href); setSidebarOpen(false) }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${pathname === child.href ? 'text-emerald-300 bg-emerald-500/10' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                                {child.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }
                  return (
                    <button key={item.name} onClick={() => { router.push(item.href); setSidebarOpen(false) }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${isActive ? 'bg-gradient-to-r from-emerald-600/30 to-teal-600/20 text-white shadow-lg shadow-emerald-900/20 border border-emerald-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                      <div className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'group-hover:bg-white/10'}`}>
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
                      </div>
                      <span className="flex-1 text-left text-sm font-medium">{item.name}</span>
                      {item.name === 'Messages' && unreadCount > 0 && (
                        <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-[10px] font-bold rounded-full px-2 py-0.5 shadow-lg shadow-red-500/30">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* User Profile & Logout */}
            <div className="p-3 border-t border-white/10">
              <div className="flex items-center gap-3 mb-3 px-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/30">
                  {getInitials(profile?.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{profile?.full_name || 'Teacher User'}</p>
                  <p className="text-xs text-slate-400 capitalize">{profile?.role || 'Teacher'}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all group">
                <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 lg:ml-[260px] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden" onClick={() => { setSidebarOpen(false); setShowNotifications(false) }} />
      )}
      {showNotifications && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setShowNotifications(false)} />
      )}
    </div>
  )
}
