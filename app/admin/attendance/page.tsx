'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { UserCheck, ChevronLeft, ChevronRight, Download, Users, CheckCircle, XCircle, Clock, Calendar } from 'lucide-react'

type ViewMode = 'daily' | 'weekly' | 'monthly'
type AttType = 'class' | 'subject'

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  present:  { label: 'Present',  bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  absent:   { label: 'Absent',   bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500' },
  late:     { label: 'Late',     bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-400' },
}

function toISO(d: Date) { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function startOfWeek(d: Date) { const x = new Date(d); x.setDate(x.getDate() - x.getDay() + 1); return x }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }

function fmtShort(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}
function fmtFull(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtMonth(d: Date) {
  return d.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
}

export default function AdminAttendancePage() {
  const [view, setView] = useState<ViewMode>('daily')
  const [attType, setAttType] = useState<AttType>('class')
  const [anchor, setAnchor] = useState(new Date()) // reference date for navigation
  const [classes, setClasses] = useState<any[]>([])
  const [classId, setClassId] = useState('')
  const [subjects, setSubjects] = useState<any[]>([])
  const [subjectId, setSubjectId] = useState('')
  const [records, setRecords] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Date range based on view + anchor
  const dateRange = (() => {
    if (view === 'daily') {
      const d = toISO(anchor)
      return { from: d, to: d, label: fmtFull(d) }
    }
    if (view === 'weekly') {
      const mon = startOfWeek(anchor)
      const fri = addDays(mon, 4)
      return { from: toISO(mon), to: toISO(fri), label: `${fmtShort(toISO(mon))} – ${fmtShort(toISO(fri))}` }
    }
    // monthly
    const s = startOfMonth(anchor)
    const e = endOfMonth(anchor)
    return { from: toISO(s), to: toISO(e), label: fmtMonth(anchor) }
  })()

  useEffect(() => {
    supabase.from('classes').select('id, name, class_level, class_teacher_id').order('class_level').then(({ data }) => {
      setClasses(data || [])
    })
  }, [])

  useEffect(() => {
    if (!classId) { setStudents([]); return }
    supabase
      .from('class_enrollments')
      .select('student_id, students(id, full_name, photo_url)')
      .eq('class_id', classId)
      .then(({ data }) => {
        const list = (data || []).map((e: any) => e.students).filter(Boolean)
          .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name))
        setStudents(list)
      })
    // Load subjects for selected class (for subject attendance)
    supabase
      .from('class_subject_teachers')
      .select('subject_id, subjects(id, name, code)')
      .eq('class_id', classId)
      .then(({ data }) => {
        const subs = (data || []).map((r: any) => r.subjects).filter(Boolean)
          .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
        setSubjects(subs)
        // Default to "No subject" until admin chooses one
        setSubjectId('')
      })
  }, [classId])

  useEffect(() => {
    fetchAttendance()
  }, [classId, subjectId, attType, dateRange.from, dateRange.to])

  const fetchAttendance = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (classId) params.set('class_id', classId)
      if (attType === 'subject' && subjectId) params.set('subject_id', subjectId)
      params.set('from', dateRange.from)
      params.set('to', dateRange.to)
      if (attType === 'subject' && !subjectId) {
        setRecords([])
        return
      }
      const res = await fetch(attType === 'subject' ? `/api/admin/subject-attendance?${params}` : `/api/admin/attendance?${params}`)
      const js = await res.json()
      setRecords(js.records || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const ch = supabase
      .channel('admin-attendance')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: attType === 'subject' ? 'subject_attendance' : 'attendance' },
        () => { fetchAttendance() }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [classId, subjectId, attType, dateRange.from, dateRange.to])

  // Navigate anchor
  const navigate = (dir: -1 | 1) => {
    if (view === 'daily') setAnchor(addDays(anchor, dir))
    else if (view === 'weekly') setAnchor(addDays(anchor, dir * 7))
    else {
      const m = new Date(anchor)
      m.setMonth(m.getMonth() + dir)
      setAnchor(m)
    }
  }

  // Get all unique dates in range
  const datesInRange: string[] = (() => {
    const dates: string[] = []
    const cur = new Date(dateRange.from + 'T12:00:00')
    const end = new Date(dateRange.to + 'T12:00:00')
    while (cur <= end) {
      dates.push(toISO(cur))
      cur.setDate(cur.getDate() + 1)
    }
    return dates
  })()

  // Only show dates where there is at least one record
  const activeDates = view === 'daily'
    ? datesInRange
    : datesInRange.filter((d) => records.some((r) => r.date === d))

  // Index: student → date → statuses[]
  const index: Record<string, Record<string, string[]>> = {}
  for (const r of records) {
    if (!index[r.student_id]) index[r.student_id] = {}
    index[r.student_id][r.date] = Array.isArray(r.statuses)
      ? r.statuses
      : (r.status ? [r.status] : [])
  }

  // Summary totals
  const totals = {
    present: records.filter((r) => {
      const arr = Array.isArray(r.statuses) ? r.statuses : (r.status ? [r.status] : [])
      return arr.includes('present')
    }).length,
    absent: records.filter((r) => {
      const arr = Array.isArray(r.statuses) ? r.statuses : (r.status ? [r.status] : [])
      return arr.includes('absent')
    }).length,
    late: records.filter((r) => {
      const arr = Array.isArray(r.statuses) ? r.statuses : (r.status ? [r.status] : [])
      return arr.includes('late')
    }).length,
  }

  // Per-student summary (for weekly/monthly)
  const studentSummary = (sid: string) => {
    const days = index[sid] || {}
    const vals = Object.values(days)
    return {
      present: vals.filter((arr) => (arr || []).includes('present')).length,
      absent:  vals.filter((arr) => (arr || []).includes('absent')).length,
      late:    vals.filter((arr) => (arr || []).includes('late')).length,
    }
  }

  const classLabel = (c: any) => c.class_level || c.name || 'Class'

  const exportCSV = () => {
    if (records.length === 0) return
    const cls = classes.find((c) => c.id === classId)
    const sub = subjects.find((s: any) => s.id === subjectId)
    const header = view === 'daily'
      ? ['Student', 'Status', 'Date']
      : ['Student', ...activeDates.map(fmtShort), 'Present', 'Absent', 'Late']

    const rows = students.map((s) => {
      if (view === 'daily') {
        const arr = index[s.id]?.[dateRange.from] || []
        const status =
          (arr.includes('absent') && 'Absent') ||
          (attType === 'subject'
            ? (arr.includes('present') && 'Present')
            : (arr.includes('present') && arr.includes('late') ? 'Present + Late' :
               (arr.includes('present') && 'Present'))) ||
          (arr.includes('late') && 'Late') || '—'
        return [s.full_name, status, dateRange.from]
      }
      const sm = studentSummary(s.id)
      return [
        s.full_name,
        ...activeDates.map((d) => {
          const arr = index[s.id]?.[d] || []
          return (arr.includes('absent') && 'A') ||
                 (attType === 'subject'
                   ? (arr.includes('present') && 'P')
                   : (arr.includes('present') && arr.includes('late') && 'P+L') ||
                     (arr.includes('present') && 'P')) ||
                 (arr.includes('late') && 'L') || '—'
        }),
        sm.present, sm.absent, sm.late,
      ]
    })

    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const nameParts = [attType === 'subject' ? 'subject-attendance' : 'attendance', classLabel(cls || {})]
    if (attType === 'subject' && sub) nameParts.push(String(sub.name || 'Subject'))
    nameParts.push(dateRange.from)
    a.download = `${nameParts.join('-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasData = records.length > 0 || (classId && students.length > 0)

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-gray-500 text-sm mt-0.5">View and monitor student attendance</p>
        </div>
        {records.length > 0 && (
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type</label>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {(['class','subject'] as AttType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setAttType(t)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    attType === t ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {/* View mode */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">View</label>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {(['daily', 'weekly', 'monthly'] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    view === v ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Class */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="">All classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
            </select>
          </div>

          {/* Subject (only in subject view) */}
          {attType === 'subject' && (
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Subject</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
              >
                {subjects.length === 0 ? (
                  <option value="">Select a class to load subjects</option>
                ) : (
                  <>
                    <option value="">No subject</option>
                    {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </>
                )}
              </select>
            </div>
          )}

          {/* Date navigator */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Period</label>
            <div className="flex items-center gap-1">
              <button onClick={() => navigate(-1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-2 text-sm font-medium text-gray-700 min-w-[160px] text-center bg-gray-50 border border-gray-200 rounded-xl">
                {dateRange.label}
              </span>
              <button onClick={() => navigate(1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Today */}
          <button
            onClick={() => setAnchor(new Date())}
            className="px-3 py-2.5 text-sm text-teal-600 border border-teal-200 rounded-xl hover:bg-teal-50"
          >
            Today
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {[
          { key: 'present', label: 'Present',  icon: CheckCircle,  color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { key: 'absent',  label: 'Absent',   icon: XCircle,      color: 'text-red-600',     bg: 'bg-red-50 border-red-100' },
          { key: 'late',    label: 'Late',      icon: Clock,        color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100' },
        ].map(({ key, label, icon: Icon, color, bg }) => (
          <div key={key} className={`rounded-2xl border p-4 ${bg}`}>
            <div className="flex items-center justify-between mb-2">
              <Icon className={`w-5 h-5 ${color}`} />
              <span className="text-xs text-gray-400 font-medium">{label}</span>
            </div>
            <p className={`text-3xl font-bold ${color}`}>{totals[key as keyof typeof totals]}</p>
            <p className="text-xs text-gray-400 mt-0.5">entries</p>
          </div>
        ))}
      </div>

      {/* Main table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto" />
        </div>
      ) : !classId ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <Calendar className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Select a class to view attendance</p>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <Users className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No attendance records found</p>
          <p className="text-gray-400 text-sm mt-1">for this {view} period</p>
        </div>
      ) : view === 'daily' ? (
        /* ── DAILY VIEW ── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">{fmtFull(dateRange.from)}</span>
            <span className="text-xs text-gray-400">{records.length} records</span>
          </div>
          <div className="divide-y divide-gray-50">
            {students.map((student, idx) => {
              const arr = index[student.id]?.[dateRange.from] || []
              const key =
                (arr.includes('absent') && 'absent') ||
                (arr.includes('present') && arr.includes('late') && 'present-late') ||
                (arr.includes('present') && 'present') ||
                (arr.includes('late') && 'late') || ''
              return (
                <div key={student.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/60">
                  <span className="text-xs text-gray-400 w-5 text-right shrink-0">{idx + 1}</span>
                  <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {student.photo_url ? (
                      <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-gray-500">{student.full_name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 text-sm font-medium text-gray-900">{student.full_name}</div>
                  {key ? (
                    key === 'present-late' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Present + Late</span>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[key]?.bg} ${STATUS_STYLES[key]?.text}`}>
                        {STATUS_STYLES[key]?.label}
                      </span>
                    )
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-400">No record</span>
                  )}
                </div>
              )
            }).filter(Boolean)}
          </div>
        </div>
      ) : (
        /* ── WEEKLY / MONTHLY VIEW ── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50">
            <span className="text-sm font-semibold text-gray-700">{dateRange.label} — {activeDates.length} school days recorded</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600 sticky left-0 bg-gray-50/80 min-w-[160px]">Student</th>
                  {activeDates.map((d) => (
                    <th key={d} className="px-2 py-3 text-center font-semibold text-gray-600 min-w-[70px]">
                      <div className="text-xs">{new Date(d + 'T12:00:00').toLocaleDateString('en-NG', { weekday: 'short' })}</div>
                      <div className="text-xs text-gray-400">{fmtShort(d)}</div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-semibold text-emerald-600 min-w-[50px]">P</th>
                  <th className="px-3 py-3 text-center font-semibold text-red-500 min-w-[50px]">A</th>
                  <th className="px-3 py-3 text-center font-semibold text-amber-500 min-w-[50px]">L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map((student) => {
                  const sm = studentSummary(student.id)
                  const hasAny = Object.keys(index[student.id] || {}).length > 0
                  return (
                    <tr key={student.id} className="hover:bg-gray-50/60">
                      <td className="px-5 py-3 sticky left-0 bg-white font-medium text-gray-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                            {student.photo_url ? (
                              <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-semibold text-gray-500">{student.full_name.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <span className="text-sm">{student.full_name}</span>
                        </div>
                      </td>
                      {activeDates.map((d) => {
                        const arr = index[student.id]?.[d] || []
                        const key =
                          (arr.includes('absent') && 'absent') ||
                          (arr.includes('present') && arr.includes('late') && 'present-late') ||
                          (arr.includes('present') && 'present') ||
                          (arr.includes('late') && 'late') || ''
                        return (
                          <td key={d} className="px-2 py-3 text-center">
                            {key ? (
                      key === 'present-late' ? (
                                <span className={`inline-block px-1.5 h-6 rounded-full text-[10px] font-bold leading-6 bg-amber-100 text-amber-700`}>
                                  P+L
                                </span>
                              ) : (
                                <span className={`inline-block w-6 h-6 rounded-full text-xs font-bold leading-6 ${STATUS_STYLES[key]?.bg} ${STATUS_STYLES[key]?.text}`}>
                                  {key.charAt(0).toUpperCase()}
                                </span>
                              )
                            ) : (
                              <span className="text-gray-200">·</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-3 py-3 text-center font-semibold text-emerald-600">{sm.present || '—'}</td>
                      <td className="px-3 py-3 text-center font-semibold text-red-500">{sm.absent || '—'}</td>
                      <td className="px-3 py-3 text-center font-semibold text-amber-500">{sm.late || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Legend */}
          <div className="px-5 py-3 border-t border-gray-50 flex gap-4 text-xs text-gray-400">
            <span><strong className="text-emerald-600">P</strong> Present</span>
            <span><strong className="text-red-500">A</strong> Absent</span>
            <span><strong className="text-amber-500">L</strong> Late</span>
            {attType !== 'subject' && <span><strong className="text-amber-600">P+L</strong> Present + Late</span>}
          </div>
        </div>
      )}
    </div>
  )
}
