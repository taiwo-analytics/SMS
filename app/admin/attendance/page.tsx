'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { UserCheck, ChevronLeft, ChevronRight, Download, Users, CheckCircle, XCircle, Clock, ShieldCheck, Calendar } from 'lucide-react'

type ViewMode = 'daily' | 'weekly' | 'monthly'

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  present:  { label: 'Present',  bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  absent:   { label: 'Absent',   bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500' },
  late:     { label: 'Late',     bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  excused:  { label: 'Excused',  bg: 'bg-sky-100',     text: 'text-sky-700',     dot: 'bg-sky-500' },
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
  const [anchor, setAnchor] = useState(new Date()) // reference date for navigation
  const [classes, setClasses] = useState<any[]>([])
  const [classId, setClassId] = useState('')
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
      const sun = addDays(mon, 6)
      return { from: toISO(mon), to: toISO(sun), label: `${fmtShort(toISO(mon))} – ${fmtShort(toISO(sun))}` }
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
  }, [classId])

  useEffect(() => {
    if (!classId) { setRecords([]); return }
    fetchAttendance()
  }, [classId, dateRange.from, dateRange.to])

  const fetchAttendance = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ class_id: classId, from: dateRange.from, to: dateRange.to })
      const res = await fetch(`/api/admin/attendance?${params}`)
      const js = await res.json()
      setRecords(js.records || [])
    } finally {
      setLoading(false)
    }
  }

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

  // Index: student → date → status
  const index: Record<string, Record<string, string>> = {}
  for (const r of records) {
    if (!index[r.student_id]) index[r.student_id] = {}
    index[r.student_id][r.date] = r.status
  }

  // Summary totals
  const totals = {
    present: records.filter((r) => r.status === 'present').length,
    absent:  records.filter((r) => r.status === 'absent').length,
    late:    records.filter((r) => r.status === 'late').length,
    excused: records.filter((r) => r.status === 'excused').length,
  }

  // Per-student summary (for weekly/monthly)
  const studentSummary = (sid: string) => {
    const days = index[sid] || {}
    return {
      present: Object.values(days).filter((s) => s === 'present').length,
      absent:  Object.values(days).filter((s) => s === 'absent').length,
      late:    Object.values(days).filter((s) => s === 'late').length,
      excused: Object.values(days).filter((s) => s === 'excused').length,
    }
  }

  const classLabel = (c: any) => c.class_level || c.name || 'Class'

  const exportCSV = () => {
    if (records.length === 0) return
    const cls = classes.find((c) => c.id === classId)
    const header = view === 'daily'
      ? ['Student', 'Status', 'Date']
      : ['Student', ...activeDates.map(fmtShort), 'Present', 'Absent', 'Late', 'Excused']

    const rows = students.map((s) => {
      if (view === 'daily') {
        const status = index[s.id]?.[dateRange.from] || '—'
        return [s.full_name, status, dateRange.from]
      }
      const sm = studentSummary(s.id)
      return [
        s.full_name,
        ...activeDates.map((d) => index[s.id]?.[d] || '—'),
        sm.present, sm.absent, sm.late, sm.excused,
      ]
    })

    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-${classLabel(cls || {})}-${dateRange.from}.csv`
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { key: 'present', label: 'Present',  icon: CheckCircle,  color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { key: 'absent',  label: 'Absent',   icon: XCircle,      color: 'text-red-600',     bg: 'bg-red-50 border-red-100' },
          { key: 'late',    label: 'Late',      icon: Clock,        color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100' },
          { key: 'excused', label: 'Excused',   icon: ShieldCheck,  color: 'text-sky-600',     bg: 'bg-sky-50 border-sky-100' },
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
              const status = index[student.id]?.[dateRange.from]
              if (!status && records.length > 0) return null // only show students with records for that day
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
                  {status ? (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[status]?.bg} ${STATUS_STYLES[status]?.text}`}>
                      {STATUS_STYLES[status]?.label}
                    </span>
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
                  <th className="px-3 py-3 text-center font-semibold text-sky-500 min-w-[50px]">E</th>
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
                        const s = index[student.id]?.[d]
                        return (
                          <td key={d} className="px-2 py-3 text-center">
                            {s ? (
                              <span className={`inline-block w-6 h-6 rounded-full text-xs font-bold leading-6 ${STATUS_STYLES[s]?.bg} ${STATUS_STYLES[s]?.text}`}>
                                {s.charAt(0).toUpperCase()}
                              </span>
                            ) : (
                              <span className="text-gray-200">·</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-3 py-3 text-center font-semibold text-emerald-600">{sm.present || '—'}</td>
                      <td className="px-3 py-3 text-center font-semibold text-red-500">{sm.absent || '—'}</td>
                      <td className="px-3 py-3 text-center font-semibold text-amber-500">{sm.late || '—'}</td>
                      <td className="px-3 py-3 text-center font-semibold text-sky-500">{sm.excused || '—'}</td>
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
            <span><strong className="text-sky-500">E</strong> Excused</span>
          </div>
        </div>
      )}
    </div>
  )
}
