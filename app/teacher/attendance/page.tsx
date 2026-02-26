'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { UserCheck, BookOpen, Check, X, Clock, ShieldCheck } from 'lucide-react'
import { Class, Student, Attendance, AttendanceStatus } from '@/types/database'

export default function TeacherAttendancePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  )
  const [students, setStudents] = useState<Student[]>([])
  const [entries, setEntries] = useState<Record<string, { status: AttendanceStatus; notes: string }>>({})
  const [existingRecords, setExistingRecords] = useState<Attendance[]>([])
  const [saved, setSaved] = useState(false)

  const loadStudents = useCallback(async () => {
    const { data: enrollments } = await supabase
      .from('class_enrollments')
      .select('student_id')
      .eq('class_id', selectedClass)
    if (enrollments && enrollments.length > 0) {
      const studentIds = enrollments.map(e => e.student_id)
      const { data } = await supabase
        .from('students')
        .select('*')
        .in('id', studentIds)
        .order('full_name')
      setStudents(data || [])
      const initial: Record<string, { status: AttendanceStatus; notes: string }> = {}
      for (const s of data || []) {
        initial[s.id] = { status: 'present', notes: '' }
      }
      setEntries(initial)
    } else {
      setStudents([])
      setEntries({})
    }
  }, [selectedClass])

  useEffect(() => {
    if (selectedClass) {
      loadStudents()
    }
  }, [selectedClass, loadStudents])

  const loadExistingAttendance = useCallback(async () => {
    const res = await fetch(`/api/attendance?class_id=${selectedClass}&date=${selectedDate}`)
    const data = await res.json()
    const records: Attendance[] = data.records || []
    setExistingRecords(records)
    if (records.length > 0) {
      const updated = { ...entries }
      for (const r of records) {
        if (updated[r.student_id]) {
          updated[r.student_id] = { status: r.status, notes: r.notes || '' }
        }
      }
      setEntries(updated)
    }
  }, [selectedClass, selectedDate, entries])

  useEffect(() => {
    if (selectedClass && selectedDate && students.length > 0) {
      loadExistingAttendance()
    }
  }, [selectedClass, selectedDate, students, loadExistingAttendance])

  const loadClasses = useCallback(async (userId: string) => {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (teacher) {
      const { data } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', teacher.id)

      setClasses(data || [])
      if (data && data.length > 0) {
        setSelectedClass(data[0].id)
      }
    }
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'teacher') { router.push('/'); return }

      await loadClasses(user.id)
    } catch {
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }, [router, loadClasses])

 

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

 

  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setEntries(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], status },
    }))
    setSaved(false)
  }

  const handleSubmit = async () => {
    if (!selectedClass || !selectedDate) return

    setSaving(true)
    setSaved(false)
    try {
      const entryList = Object.entries(entries).map(([student_id, val]) => ({
        student_id,
        status: val.status,
        notes: val.notes || undefined,
      }))

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: selectedClass,
          date: selectedDate,
          entries: entryList,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to save attendance')
        return
      }

      setSaved(true)
      setExistingRecords(data.records || [])
    } catch {
      alert('Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  const statusConfig: Record<AttendanceStatus, { label: string; color: string; bg: string; icon: typeof Check }> = {
    present: { label: 'Present', color: 'text-green-700', bg: 'bg-green-100 border-green-300', icon: Check },
    absent: { label: 'Absent', color: 'text-red-700', bg: 'bg-red-100 border-red-300', icon: X },
    late: { label: 'Late', color: 'text-yellow-700', bg: 'bg-yellow-100 border-yellow-300', icon: Clock },
    excused: { label: 'Excused', color: 'text-blue-700', bg: 'bg-blue-100 border-blue-300', icon: ShieldCheck },
  }

  const summary = {
    present: Object.values(entries).filter(e => e.status === 'present').length,
    absent: Object.values(entries).filter(e => e.status === 'absent').length,
    late: Object.values(entries).filter(e => e.status === 'late').length,
    excused: Object.values(entries).filter(e => e.status === 'excused').length,
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <UserCheck className="w-10 h-10 text-teal-600" />
            <h2 className="text-3xl font-bold text-gray-900">Attendance</h2>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select a class</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} {cls.subject ? `- ${cls.subject}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Summary Bar */}
          {students.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{summary.present}</p>
                <p className="text-xs text-green-600">Present</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{summary.absent}</p>
                <p className="text-xs text-red-600">Absent</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{summary.late}</p>
                <p className="text-xs text-yellow-600">Late</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{summary.excused}</p>
                <p className="text-xs text-blue-600">Excused</p>
              </div>
            </div>
          )}
        </div>

        {selectedClass && students.length > 0 ? (
          <>
            <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => {
                    const current = entries[student.id]?.status || 'present'
                    return (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{student.full_name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {(Object.keys(statusConfig) as AttendanceStatus[]).map((status) => {
                              const cfg = statusConfig[status]
                              const Icon = cfg.icon
                              const isActive = current === status
                              return (
                                <button
                                  key={status}
                                  onClick={() => setStudentStatus(student.id, status)}
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                                    isActive
                                      ? `${cfg.bg} ${cfg.color} font-medium`
                                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                  }`}
                                >
                                  <Icon className="w-4 h-4" />
                                  <span className="hidden sm:inline">{cfg.label}</span>
                                </button>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium"
              >
                {saving ? 'Saving...' : existingRecords.length > 0 ? 'Update Attendance' : 'Submit Attendance'}
              </button>
              {saved && (
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <Check className="w-5 h-5" />
                  Attendance saved successfully
                </span>
              )}
            </div>
          </>
        ) : selectedClass ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No students enrolled in this class.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <UserCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Select a class to take attendance.</p>
          </div>
        )}
    </div>
  )
}
