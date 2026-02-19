'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { UserCheck, ArrowLeft, Users, Check, X, Clock, ShieldCheck } from 'lucide-react'
import { Attendance, Student, Class, AttendanceStatus } from '@/types/database'

export default function ParentAttendancePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [children, setChildren] = useState<Student[]>([])
  const [records, setRecords] = useState<Attendance[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedChild, setSelectedChild] = useState<string>('all')

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

      if (profile?.role !== 'parent') { router.push('/'); return }

      // Load children
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (parent) {
        const { data: childrenData } = await supabase
          .from('students')
          .select('*')
          .eq('parent_id', parent.id)

        setChildren(childrenData || [])

        // Load classes for context
        if (childrenData && childrenData.length > 0) {
          const childIds = childrenData.map(c => c.id)
          const { data: enrollments } = await supabase
            .from('class_enrollments')
            .select('class_id')
            .in('student_id', childIds)

          if (enrollments && enrollments.length > 0) {
            const classIds = [...new Set(enrollments.map(e => e.class_id))]
            const { data: classesData } = await supabase
              .from('classes')
              .select('*')
              .in('id', classIds)
            setClasses(classesData || [])
          }
        }
      }

      // Load attendance records
      const res = await fetch('/api/attendance')
      const data = await res.json()
      setRecords(data.records || [])
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

  const filteredRecords = selectedChild === 'all'
    ? records
    : records.filter(r => r.student_id === selectedChild)

  const statusIcon: Record<AttendanceStatus, { icon: typeof Check; color: string; label: string }> = {
    present: { icon: Check, color: 'text-green-600', label: 'Present' },
    absent: { icon: X, color: 'text-red-600', label: 'Absent' },
    late: { icon: Clock, color: 'text-yellow-600', label: 'Late' },
    excused: { icon: ShieldCheck, color: 'text-blue-600', label: 'Excused' },
  }

  // Stats per child
  const childStats = children.map(child => {
    const childRecords = records.filter(r => r.student_id === child.id)
    const total = childRecords.length
    const present = childRecords.filter(r => r.status === 'present').length
    const rate = total > 0 ? ((present / total) * 100).toFixed(1) : null
    return { child, total, present, rate }
  }).filter(entry =>
    selectedChild === 'all' ? true : entry.child.id === selectedChild
  )

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
              <h1 className="text-xl font-bold text-gray-900">Children&apos;s Attendance</h1>
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
            <UserCheck className="w-10 h-10 text-blue-600" />
            <h2 className="text-3xl font-bold text-gray-900">Children&apos;s Attendance</h2>
          </div>

          {children.length > 1 && (
            <div className="flex items-center gap-4 mb-6">
              <label className="text-sm font-medium text-gray-700">Select Child:</label>
              <select
                value={selectedChild}
                onChange={(e) => setSelectedChild(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Children</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>{child.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Stats per child */}
          {childStats.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {childStats.map(({ child, total, present, rate }) => (
                <div key={child.id} className="bg-white rounded-lg shadow p-5 border-l-4 border-teal-500">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="w-5 h-5 text-teal-600" />
                    <p className="font-semibold text-gray-900">{child.full_name}</p>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <span className="text-gray-600">Total Days: <strong>{total}</strong></span>
                    <span className="text-green-600">Present: <strong>{present}</strong></span>
                    {rate && (
                      <span className={`font-medium ${
                        parseFloat(rate) >= 80 ? 'text-green-600' :
                        parseFloat(rate) >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        Rate: {rate}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {children.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No children linked to your account.</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <UserCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No attendance records found yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {selectedChild === 'all' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Child
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRecords.map((record) => {
                  const child = children.find(c => c.id === record.student_id)
                  const cls = classes.find(c => c.id === record.class_id)
                  const cfg = statusIcon[record.status]
                  const Icon = cfg.icon
                  return (
                    <tr key={record.id} className="hover:bg-gray-50">
                      {selectedChild === 'all' && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{child?.full_name || 'Unknown'}</div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{new Date(record.date).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{cls?.name || 'Unknown'}</div>
                        {cls?.subject && <div className="text-xs text-gray-500">{cls.subject}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-sm font-medium ${cfg.color}`}>
                          <Icon className="w-4 h-4" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500 max-w-xs truncate">{record.notes || '-'}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
