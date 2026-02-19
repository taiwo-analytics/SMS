'use client'

import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { 
  Shield, 
  GraduationCap, 
  User, 
  BookOpen, 
  Book,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  MessageSquare,
  Library,
  Package,
  CreditCard,
  UserCheck,
  Bell,
  Calendar
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: Shield },
    { name: 'Users', href: '/admin/users', icon: UserCheck },
    { name: 'Teachers', href: '/admin/teachers', icon: GraduationCap },
    { name: 'Students', href: '/admin/students', icon: User },
    { name: 'Classes', href: '/admin/classes', icon: BookOpen },
    { name: 'Enrollments', href: '/admin/enrollments', icon: Users },
    { name: 'Subjects', href: '/admin/subjects', icon: Book },
    { name: 'Events', href: '/admin/events', icon: Calendar },
    { name: 'Academics', href: '/admin/academics', icon: Calendar },
    { name: 'Messages', href: '/admin/messages', icon: MessageSquare },
    { name: 'Library', href: '/admin/library', icon: Library },
    { name: 'Inventory', href: '/admin/inventory', icon: Package },
    { name: 'Payments', href: '/admin/payments', icon: CreditCard },
    { name: 'Reports', href: '/admin/reports', icon: BarChart3 },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ]

  const [eventCount, setEventCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])

  useEffect(() => {
    loadUpcomingEvents()
    const interval = setInterval(loadUpcomingEvents, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  const loadUpcomingEvents = async () => {
    try {
      const { data } = await supabase
        .from('events')
        .select('*')
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(10)

      if (data) {
        setUpcomingEvents(data)
        setEventCount(data.length)
      }
    } catch (error) {
      console.error('Error loading events:', error)
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
              <button
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                <Shield className="w-6 h-6" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
            </div>
            <div className="flex items-center gap-4">
              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                >
                  <Bell className="w-6 h-6" />
                  {eventCount > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {eventCount}
                    </span>
                  )}
                </button>
                
                {/* Notifications Dropdown */}
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
                          const eventDate = new Date(event.event_date)
                          const now = new Date()
                          const diffTime = eventDate.getTime() - now.getTime()
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                          const isOngoing = diffTime < 0 && Math.abs(diffTime) < 24 * 60 * 60 * 1000
                          
                          return (
                            <div key={event.id} className="p-3 hover:bg-gray-50 rounded-lg mb-1">
                              <p className="font-medium text-sm text-gray-900">{event.title}</p>
                              <p className="text-xs text-gray-500">
                                {eventDate.toLocaleDateString()} at {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              <p className="text-xs mt-1">
                                {isOngoing ? (
                                  <span className="text-green-600 font-medium">Ongoing</span>
                                ) : diffDays > 0 ? (
                                  <span className="text-blue-600">{diffDays} day{diffDays !== 1 ? 's' : ''} left</span>
                                ) : (
                                  <span className="text-gray-500">Today</span>
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
          } fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out lg:translate-x-0 pt-16 lg:pt-0`}
        >
          <div className="h-full overflow-y-auto py-4">
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
                    <span>{item.name}</span>
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

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => {
            setSidebarOpen(false)
            setShowNotifications(false)
          }}
        />
      )}
      
      {/* Overlay for notifications */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setShowNotifications(false)}
        />
      )}
    </div>
  )
}
