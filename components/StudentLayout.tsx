'use client'

import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  User,
  BookOpen,
  ClipboardList,
  Clock,
  LogOut,
  Menu,
  X,
  FileText,
  LayoutDashboard,
  MessageSquare,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

interface StudentLayoutProps {
  children: ReactNode
}

export default function StudentLayout({ children }: StudentLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [profile, setProfile] = useState<{ full_name: string; role: string } | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  const navigation = [
    { name: 'Dashboard', href: '/student', icon: LayoutDashboard },
    { name: 'My Classes', href: '/student/classes', icon: BookOpen },
    { name: 'My Grades', href: '/student/grades', icon: ClipboardList },
    { name: 'Assignments', href: '/student/assignments', icon: FileText },
    { name: 'Timetable', href: '/student/timetable', icon: Clock },
    { name: 'Messages', href: '/student/messages', icon: MessageSquare },
  ]

  const loadUnreadCount = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // Get all visible messages (RLS filters for student)
      const { data: messages } = await supabase
        .from('messages')
        .select('id, sender_id')
      // Get read message IDs
      const { data: reads } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('user_id', user.id)
      const readIds = new Set((reads || []).map((r: any) => r.message_id))
      // Count unread inbox messages (not sent by this user, not in reads)
      const count = (messages || []).filter((m: any) =>
        m.sender_id !== user.id && !m.reply_to && !readIds.has(m.id)
      ).length
      setUnreadCount(count)
    } catch (e) {
      console.error('Error loading unread count:', e)
    }
  }, [])

  useEffect(() => {
    loadProfile()
    cacheSchoolLogo()
    loadUnreadCount()
    const msgInterval = setInterval(loadUnreadCount, 60000)
    const channel = supabase
      .channel('messages-student-layout')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => loadUnreadCount())
      .subscribe()
    return () => {
      clearInterval(msgInterval)
      supabase.removeChannel(channel)
    }
  }, [loadUnreadCount])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', user.id)
          .single()
        if (data) setProfile(data)
      }
    } catch (e) {
      console.error('Error loading profile:', e)
    }
  }

  const cacheSchoolLogo = async () => {
    try {
      const { data: settingsRows } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['schoolLogo'])
      const logoRow = (settingsRows || []).find((r: any) => r.key === 'schoolLogo' && r.value)
      try {
        if (logoRow?.value) localStorage.setItem('schoolLogo', logoRow.value)
        else localStorage.removeItem('schoolLogo')
      } catch {}
    } catch {
    }
  }

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
              <h1 className="text-xl font-bold text-gray-900">Student Portal</h1>
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
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto py-4">
              <nav className="space-y-1 px-3">
                {navigation.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
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
                        <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* User Profile & Logout Section at Bottom */}
            <div className="p-4 border-t bg-white">
              <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border-2 border-white shadow-sm overflow-hidden">
                  <User className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {profile?.full_name || 'Student User'}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {profile?.role || 'Student'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors group"
              >
                <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
