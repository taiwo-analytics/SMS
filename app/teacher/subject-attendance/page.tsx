'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { UserCheck, BookOpen, Check, ChevronLeft, ChevronRight, Save } from 'lucide-react'
import type { AttendanceStatus } from '@/types/database'

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; ring: string; dot: string }> = {
  present:  { label: 'Present',  color: 'bg-emerald-500 text-white border-emerald-500',  ring: 'ring-emerald-300',  dot: 'bg-emerald-500' },
  absent:   { label: 'Absent',   color: 'bg-red-500 text-white border-red-500',          ring: 'ring-red-300',      dot: 'bg-red-500' },
  late:     { label: 'Late',     color: 'bg-amber-400 text-white border-amber-400',       ring: 'ring-amber-300',    dot: 'bg-amber-400' },
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function shiftDate(d: string, days: number) {
  const dt = new Date(d + 'T12:00:00')
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().slice(0, 10)
}

export default function SubjectAttendancePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialClassId = searchParams.get('class_id') || ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [error, setError] = useState('')

  const [teacherId, setTeacherId] = useState('')
  const [classes, setClasses] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState(initialClassId)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [students, setStudents] = useState<any[]>([])
  const [entries, setEntries] = useState<Record<string, AttendanceStatus[]>>({})
  const [alreadySaved, setAlreadySaved] = useState(false)

  // Load classes where this teacher is assigned subjects
  useEffect(() => {
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/auth/login'); return }

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role !== 'teacher') { router.push('/'); return }

        const { data: teacher } = await supabase.from('teachers').select('id').eq('user_id', user.id).single()
        if (!teacher) { setLoading(false); return }
        setTeacherId(teacher.id)

        // Get class+subject assignments
        const { data: cst } = await supabase
          .from('class_subject_teachers')
          .select('class_id, subject_id, classes(id, name, class_level), subjects(id, name)')
          .eq('teacher_id', teacher.id)

        const classMap = new Map<string, any>()
        for (const r of (cst || [])) {
          const c = (r as any).classes
          if (c) classMap.set(c.id, c)
        }
        setClasses(Array.from(classMap.values()))

        // If initial class_id matches, select it
        if (initialClassId && classMap.has(initialClassId)) {
          setSelectedClass(initialClassId)
        } else if (classMap.size > 0) {
          setSelectedClass(Array.from(classMap.keys())[0])
        }

        // Store all assignments for subject filtering
        setSubjects((cst || []).map((r: any) => ({
          class_id: r.class_id,
          subject_id: r.subject_id,
          subject_name: (r as any).subjects?.name || '',
        })))
      } catch {
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Filter subjects when class changes
  const classSubjects = subjects.filter((s) => s.class_id === selectedClass)

  useEffect(() => {
    if (classSubjects.length > 0 && !classSubjects.some((s) => s.subject_id === selectedSubject)) {
      setSelectedSubject(classSubjects[0].subject_id)
    }
  }, [selectedClass, subjects])

  // Load students via server API to bypass RLS (teacher may not be class teacher)
  useEffect(() => {
    if (!selectedClass || !selectedSubject) { setStudents([]); return }
    ;(async () => {
      try {
        const res = await fetch(`/api/teacher/subject-students?class_id=${selectedClass}&subject_id=${selectedSubject}`)
        if (!res.ok) { setStudents([]); return }
        const js = await res.json()
        const list = (js.students || []) as any[]
        setStudents(list)
        const init: Record<string, AttendanceStatus[]> = {}
        for (const s of list) init[s.id] = []
        setEntries(init)
      } catch {
        setStudents([])
      }
    })()
  }, [selectedClass, selectedSubject])

  // Load existing subject attendance for class+subject+date
  useEffect(() => {
    if (!selectedClass || !selectedSubject || !selectedDate || students.length === 0) return
    ;(async () => {
      const res = await fetch(`/api/subject-attendance?class_id=${selectedClass}&subject_id=${selectedSubject}&date=${selectedDate}`)
      const js = await res.json()
      const records: any[] = js.records || []
      if (records.length > 0) {
        setAlreadySaved(true)
        setEntries((prev) => {
          const updated: Record<string, AttendanceStatus[]> = { ...prev }
          for (const r of records) {
            if (updated[r.student_id] !== undefined) {
              const arr: AttendanceStatus[] = Array.isArray(r.statuses) ? r.statuses : []
              updated[r.student_id] = arr.filter((x) => x === 'present' || x === 'absent' || x === 'late')
            }
          }
          return updated
        })
      } else {
        setAlreadySaved(false)
        const init: Record<string, AttendanceStatus[]> = {}
        for (const s of students) init[s.id] = []
        setEntries(init)
      }
    })()
  }, [selectedClass, selectedSubject, selectedDate, students])

  const toggleStatus = (studentId: string, status: AttendanceStatus) => {
    setEntries((prev) => {
      const current = prev[studentId] || []
      let next: AttendanceStatus[] = current.slice()
      if (status === 'absent') {
        next = ['absent']
      } else {
        next = next.filter((s) => s !== 'absent')
        if (next.includes(status)) next = next.filter((s) => s !== status)
        else next.push(status)
      }
      return { ...prev, [studentId]: next }
    })
    setSavedMsg('')
  }

  const markAll = (status: AttendanceStatus) => {
    const all: Record<string, AttendanceStatus[]> = {}
    for (const s of students) {
      if (status === 'absent') all[s.id] = ['absent']
      else all[s.id] = [status]
    }
    setEntries(all)
    setSavedMsg('')
  }

  const handleSubmit = async () => {
    if (!selectedClass || !selectedSubject || !selectedDate || students.length === 0) return
    setSaving(true)
    setError('')
    setSavedMsg('')
    try {
      const res = await fetch('/api/subject-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: selectedClass,
          subject_id: selectedSubject,
          date: selectedDate,
          entries: students
            .map((s) => ({ student_id: s.id, statuses: entries[s.id] || [] }))
            .filter((e: any) => Array.isArray(e.statuses) && e.statuses.length > 0),
        }),
      })
      const js = await res.json()
      if (!res.ok) { setError(js.error || 'Failed to save'); return }
      setAlreadySaved(true)
      setSavedMsg('Subject attendance saved successfully!')
    } catch {
      setError('Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  const summary = {
    present: Object.values(entries).filter((arr) => (arr || []).includes('present')).length,
    absent:  Object.values(entries).filter((arr) => (arr || []).includes('absent')).length,
    late:    Object.values(entries).filter((arr) => (arr || []).includes('late')).length,
  }

  const selectedClassObj = classes.find((c: any) => c.id === selectedClass)
  const classLabel = (c: any) => c.class_level || c.name || 'Class'
  const selectedSubjectName = classSubjects.find((s) => s.subject_id === selectedSubject)?.subject_name || ''
  const isToday = selectedDate === new Date().toISOString().slice(0, 10)

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-4">
          <UserCheck className="w-10 h-10 text-teal-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">No subject assignments</h2>
        <p className="text-gray-500 text-sm max-w-sm">You have not been assigned to teach any subjects. Ask the admin to assign you subjects via class-subject-teacher assignments.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subject Attendance</h1>
        <p className="text-gray-500 text-sm mt-1">Mark attendance per subject for your assigned classes</p>
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
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>{classLabel(c)}</option>
              ))}
            </select>
          </div>

          {/* Subject selector */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            >
              {classSubjects.map((s) => (
                <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
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
          {selectedSubjectName && <span className="text-teal-600">— {selectedSubjectName}</span>}
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
                {selectedClassObj ? classLabel(selectedClassObj) : ''} — {selectedSubjectName} — {students.length} students
              </span>
              <span className="text-xs text-gray-400">Tap a status to toggle</span>
            </div>

            <div className="divide-y divide-gray-50">
              {students.map((student, idx) => {
                const arr = entries[student.id] || []
                const isAbsent = arr.includes('absent')
                const isPresent = arr.includes('present')
                const isLate = arr.includes('late')
                const display =
                  isAbsent ? { label: 'Absent', cls: 'text-red-500' } :
                  isPresent && isLate ? { label: 'Present + Late', cls: 'text-amber-600' } :
                  isPresent ? { label: 'Present', cls: 'text-emerald-600' } :
                  isLate ? { label: 'Late', cls: 'text-amber-500' } :
                  { label: 'Unmarked', cls: 'text-gray-400' }
                return (
                  <div key={student.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/60">
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
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{student.full_name}</p>
                      <p className={`text-xs font-medium mt-0.5 ${display.cls}`}>{display.label}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {(['present','absent','late'] as AttendanceStatus[]).map((s) => {
                        const c = STATUS_CONFIG[s]
                        const active = s === 'absent' ? isAbsent : arr.includes(s)
                        return (
                          <button
                            key={s}
                            onClick={() => toggleStatus(student.id, s)}
                            title={c.label}
                            className={`w-8 h-8 rounded-lg border text-xs font-bold transition-all ${
                              active
                                ? `${c.color} shadow-sm ring-2 ${c.ring}`
                                : 'border-gray-200 text-gray-400 hover:border-gray-300 bg-white'
                            }`}
                          >
                            {s === 'present' ? 'P' : s === 'absent' ? 'A' : 'L'}
                          </button>
                        )
                      })}
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
              {summary.present} present · {summary.absent} absent · {summary.late} late
            </span>
          </div>
        </>
      )}
    </div>
  )
}
