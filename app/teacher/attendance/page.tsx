'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { UserCheck, BookOpen, Check, X, Clock, ShieldCheck, ChevronLeft, ChevronRight, Save } from 'lucide-react'
import type { AttendanceStatus } from '@/types/database'

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; ring: string; dot: string }> = {
  present:  { label: 'Present',  color: 'bg-emerald-500 text-white border-emerald-500',  ring: 'ring-emerald-300',  dot: 'bg-emerald-500' },
  absent:   { label: 'Absent',   color: 'bg-red-500 text-white border-red-500',          ring: 'ring-red-300',      dot: 'bg-red-500' },
  late:     { label: 'Late',     color: 'bg-amber-400 text-white border-amber-400',       ring: 'ring-amber-300',    dot: 'bg-amber-400' },
  excused:  { label: 'Excused',  color: 'bg-sky-500 text-white border-sky-500',           ring: 'ring-sky-300',      dot: 'bg-sky-500' },
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function shiftDate(d: string, days: number) {
  const dt = new Date(d + 'T12:00:00')
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().slice(0, 10)
}

export default function TeacherAttendancePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [error, setError] = useState('')

  const [classes, setClasses] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [students, setStudents] = useState<any[]>([])
  const [entries, setEntries] = useState<Record<string, AttendanceStatus>>({})
  const [alreadySaved, setAlreadySaved] = useState(false)

  // Load classes where this teacher is the class teacher
  useEffect(() => {
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/auth/login'); return }

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role !== 'teacher') { router.push('/'); return }

        const { data: teacher } = await supabase.from('teachers').select('id').eq('user_id', user.id).single()
        if (!teacher) { setLoading(false); return }

        // Only classes where this teacher is the class teacher
        const { data: classTeacherClasses } = await supabase
          .from('classes')
          .select('id, name, class_level, department')
          .eq('class_teacher_id', teacher.id)

        // Also check legacy teacher_id
        const { data: legacyClasses } = await supabase
          .from('classes')
          .select('id, name, class_level, department')
          .eq('teacher_id', teacher.id)
          .not('class_teacher_id', 'eq', teacher.id) // avoid duplicates

        const allClasses = [...(classTeacherClasses || []), ...(legacyClasses || [])]
        // Deduplicate by id
        const seen = new Set<string>()
        const deduped = allClasses.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true })

        setClasses(deduped)
        if (deduped.length > 0) setSelectedClass(deduped[0].id)
      } catch {
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Load students when class changes
  useEffect(() => {
    if (!selectedClass) { setStudents([]); return }
    ;(async () => {
      const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select('student_id, students(id, full_name, photo_url)')
        .eq('class_id', selectedClass)

      const list = (enrollments || [])
        .map((e: any) => e.students)
        .filter(Boolean)
        .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name))

      setStudents(list)
      // Default everyone to present
      const init: Record<string, AttendanceStatus> = {}
      for (const s of list) init[s.id] = 'present'
      setEntries(init)
    })()
  }, [selectedClass])

  // Load existing attendance for class+date
  useEffect(() => {
    if (!selectedClass || !selectedDate || students.length === 0) return
    ;(async () => {
      const res = await fetch(`/api/attendance?class_id=${selectedClass}&date=${selectedDate}`)
      const js = await res.json()
      const records: any[] = js.records || []
      if (records.length > 0) {
        setAlreadySaved(true)
        setEntries((prev) => {
          const updated = { ...prev }
          for (const r of records) {
            if (updated[r.student_id] !== undefined) updated[r.student_id] = r.status
          }
          return updated
        })
      } else {
        setAlreadySaved(false)
      }
    })()
  }, [selectedClass, selectedDate, students])

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setEntries((prev) => ({ ...prev, [studentId]: status }))
    setSavedMsg('')
  }

  const markAll = (status: AttendanceStatus) => {
    const all: Record<string, AttendanceStatus> = {}
    for (const s of students) all[s.id] = status
    setEntries(all)
    setSavedMsg('')
  }

  const handleSubmit = async () => {
    if (!selectedClass || !selectedDate || students.length === 0) return
    setSaving(true)
    setError('')
    setSavedMsg('')
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: selectedClass,
          date: selectedDate,
          entries: students.map((s) => ({ student_id: s.id, status: entries[s.id] || 'present' })),
        }),
      })
      const js = await res.json()
      if (!res.ok) { setError(js.error || 'Failed to save'); return }
      setAlreadySaved(true)
      setSavedMsg('Attendance saved successfully!')
    } catch {
      setError('Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  const summary = {
    present: Object.values(entries).filter((s) => s === 'present').length,
    absent:  Object.values(entries).filter((s) => s === 'absent').length,
    late:    Object.values(entries).filter((s) => s === 'late').length,
    excused: Object.values(entries).filter((s) => s === 'excused').length,
  }

  const selectedClassObj = classes.find((c) => c.id === selectedClass)
  const classLabel = (c: any) => c.class_level || c.name || 'Class'
  const isToday = selectedDate === new Date().toISOString().slice(0, 10)

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-4">
          <UserCheck className="w-10 h-10 text-teal-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">No classes assigned</h2>
        <p className="text-gray-500 text-sm max-w-sm">You have not been assigned as a class teacher for any class. Ask the admin to assign you as a class teacher.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <p className="text-gray-500 text-sm mt-1">Mark daily attendance for your class</p>
      </div>

      {/* Controls card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Class selector */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{classLabel(c)}</option>
              ))}
            </select>
          </div>

          {/* Date navigator */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date</label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={selectedDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
              />
              <button
                onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
                disabled={isToday}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Today shortcut */}
          {!isToday && (
            <button
              onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
              className="px-3 py-2.5 text-sm text-teal-600 border border-teal-200 rounded-xl hover:bg-teal-50"
            >
              Today
            </button>
          )}
        </div>

        {/* Date display */}
        <p className="mt-3 text-sm text-gray-600 flex items-center gap-2">
          <span className="font-medium">{fmtDate(selectedDate)}</span>
          {alreadySaved && (
            <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" /> Already saved
            </span>
          )}
        </p>
      </div>

      {students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <BookOpen className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No students enrolled in this class.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, typeof STATUS_CONFIG[AttendanceStatus]][]).map(([status, cfg]) => (
              <button
                key={status}
                onClick={() => markAll(status)}
                title={`Mark all as ${cfg.label}`}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center hover:shadow-md transition-shadow group"
              >
                <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot} mx-auto mb-1.5`} />
                <p className="text-2xl font-bold text-gray-800">{summary[status]}</p>
                <p className="text-xs text-gray-500 group-hover:text-gray-700">{cfg.label}</p>
                <p className="text-xs text-gray-300 mt-0.5 group-hover:text-teal-500">Mark all</p>
              </button>
            ))}
          </div>

          {/* Student list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                {selectedClassObj ? classLabel(selectedClassObj) : ''} — {students.length} students
              </span>
              <span className="text-xs text-gray-400">Tap a status to toggle</span>
            </div>

            <div className="divide-y divide-gray-50">
              {students.map((student, idx) => {
                const status = entries[student.id] || 'present'
                const cfg = STATUS_CONFIG[status]
                return (
                  <div key={student.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/60">
                    {/* Index + photo */}
                    <span className="text-xs text-gray-400 w-5 text-right shrink-0">{idx + 1}</span>
                    <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                      {student.photo_url ? (
                        <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-semibold text-gray-500">
                          {student.full_name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Name + status dot */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{student.full_name}</p>
                      <p className={`text-xs font-medium mt-0.5 ${
                        status === 'present' ? 'text-emerald-600' :
                        status === 'absent'  ? 'text-red-500' :
                        status === 'late'    ? 'text-amber-500' : 'text-sky-500'
                      }`}>{cfg.label}</p>
                    </div>

                    {/* Status buttons */}
                    <div className="flex gap-1.5 shrink-0">
                      {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, typeof STATUS_CONFIG[AttendanceStatus]][]).map(([s, c]) => (
                        <button
                          key={s}
                          onClick={() => setStatus(student.id, s)}
                          title={c.label}
                          className={`w-8 h-8 rounded-lg border text-xs font-bold transition-all ${
                            status === s
                              ? `${c.color} shadow-sm ring-2 ${c.ring}`
                              : 'border-gray-200 text-gray-400 hover:border-gray-300 bg-white'
                          }`}
                        >
                          {s === 'present' ? 'P' : s === 'absent' ? 'A' : s === 'late' ? 'L' : 'E'}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer actions */}
          {error && <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</div>}
          {savedMsg && (
            <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Check className="w-4 h-4" /> {savedMsg}
            </div>
          )}

          <div className="flex items-center gap-3 pb-8">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 disabled:opacity-50 shadow-sm shadow-teal-200 transition-all"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : alreadySaved ? 'Update Attendance' : 'Submit Attendance'}
            </button>
            <span className="text-sm text-gray-400">
              {summary.present} present · {summary.absent} absent · {summary.late} late · {summary.excused} excused
            </span>
          </div>
        </>
      )}
    </div>
  )
}
