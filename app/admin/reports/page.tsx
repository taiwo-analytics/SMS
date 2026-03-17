'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  BarChart3,
  Download,
  FileDown,
  Filter,
  RefreshCw,
  Users,
  UserCheck,
  GraduationCap,
  Wallet,
  BookOpen,
  PieChart as PieIcon,
  TrendingUp,
} from 'lucide-react'

type TabKey = 'overview' | 'attendance' | 'academics' | 'finance' | 'people'

type Option = { value: string; label: string }

type OverviewData = {
  kpis: {
    teachers: number
    students: number
    classes: number
    enrollments: number
    avgStudentsPerClass: number
    attendanceRate: number
    avgGrade: number
    totalRevenue: number
  }
  enrollmentsByLevel: { level: string; students: number }[]
  revenueByMonth: { month: string; amount: number }[]
  attendanceTrend: { date: string; rate: number }[]
  genderSplit: { name: string; value: number }[]
}

type AttendanceData = {
  summary: {
    total: number
    present: number
    absent: number
    late: number
    rate: number
  }
  trend: { date: string; present: number; absent: number; late: number; rate: number }[]
  byClass: { className: string; classId: string; present: number; absent: number; late: number; total: number; rate: number }[]
}

type AcademicsData = {
  summary: {
    totalScores: number
    avgTotal: number
    completionRate: number
  }
  scoreBands: { band: string; count: number }[]
  subjectAverages: { subject: string; average: number; count: number }[]
  topStudents: { studentId: string; student: string; classLabel: string; avgTotal: number; count: number }[]
  underperformingStudents: { studentId: string; student: string; classLabel: string; avgTotal: number; count: number }[]
}

type FinanceData = {
  summary: {
    totalPayments: number
    totalAmount: number
    totalCollected: number
    totalOutstanding: number
    collectionRate: number
    avgAmount: number
    paidCount: number
    halfPaidCount: number
    owingCount: number
    pendingCount: number
  }
  byStatus: { status: string; label: string; amount: number; collected: number; count: number; color: string }[]
  byType: { type: string; amount: number; collected: number; outstanding: number; count: number }[]
  revenueByMonth: { month: string; amount: number; collected: number }[]
  recent: { created_at: string; amount: number; amount_paid: number; balance: number; status: string; type: string; description: string; student_id: string | null; student_name: string; term: string; payment_method: string; receipt_no: string }[]
}

type PeopleData = {
  summary: {
    teachers: number
    students: number
    activeTeachers: number
    activeStudents: number
  }
  studentsByGender: { gender: string; count: number }[]
  studentsByStatus: { status: string; count: number }[]
  teacherLoadTop: { teacher: string; assignments: number; classTeacher: number; total: number }[]
  teacherPerformanceTop: { teacher: string; performanceScore: number; avgTotal: number; avgCa: number; avgExam: number; submissions: number; scoreCount: number }[]
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(dateIso: string, delta: number) {
  const dt = new Date(dateIso + 'T12:00:00')
  dt.setDate(dt.getDate() + delta)
  return isoDate(dt)
}

function monthKey(iso: string) {
  return iso.slice(0, 7)
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n || 0)
}

function normalizeStr(s: unknown) {
  return String(s || '').trim()
}

function safeCsvCell(v: unknown) {
  const s = String(v ?? '')
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`
  return s
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(headers.map((h) => safeCsvCell((r as any)[h])).join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportPdfViaPrint(title: string, element: HTMLElement) {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=800')
  if (!win) return
  const html = element.innerHTML
  win.document.open()
  win.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @media print { @page { margin: 12mm; } }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color: #111827; }
      .print-wrap { max-width: 1100px; margin: 0 auto; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
      th { background: #f9fafb; text-align: left; }
      .no-print { display: none !important; }
    </style>
  </head><body><div class="print-wrap">${html}</div></body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
    win.close()
  }, 300)
}

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#6366f1']

const STRICT_CLASS_LEVELS = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3']

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'attendance', label: 'Attendance', icon: UserCheck },
  { key: 'academics', label: 'Academics', icon: BookOpen },
  { key: 'finance', label: 'Finance', icon: Wallet },
  { key: 'people', label: 'People', icon: Users },
]

export default function AdminReportsPage() {
  const [authLoading, setAuthLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const tabRootRef = useRef<HTMLDivElement | null>(null)

  const [classes, setClasses] = useState<Option[]>([])
  const [terms, setTerms] = useState<Option[]>([])

  const today = useMemo(() => isoDate(new Date()), [])
  const defaultFrom = useMemo(() => addDays(today, -13), [today])

  const [attendanceFilters, setAttendanceFilters] = useState({
    classLevel: '',
    from: defaultFrom,
    to: today,
  })

  const [academicsFilters, setAcademicsFilters] = useState({
    termId: '',
    classId: '',
  })

  const [financeFilters, setFinanceFilters] = useState({
    status: 'all',
    classId: '',
    from: addDays(today, -365),
    to: today,
  })

  const [peopleFilters, setPeopleFilters] = useState({
    level: 'all',
    termId: '',
  })

  const [tabLoaded, setTabLoaded] = useState<Record<TabKey, boolean>>({
    overview: false,
    attendance: false,
    academics: false,
    finance: false,
    people: false,
  })
  const [tabLoading, setTabLoading] = useState<Record<TabKey, boolean>>({
    overview: false,
    attendance: false,
    academics: false,
    finance: false,
    people: false,
  })
  const [tabError, setTabError] = useState<Record<TabKey, string | null>>({
    overview: null,
    attendance: null,
    academics: null,
    finance: null,
    people: null,
  })

  const [overviewData, setOverviewData] = useState<OverviewData | null>(null)
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null)
  const [academicsData, setAcademicsData] = useState<AcademicsData | null>(null)
  const [financeData, setFinanceData] = useState<FinanceData | null>(null)
  const [peopleData, setPeopleData] = useState<PeopleData | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) {
          setAuthorized(false)
          setAuthError('You are not logged in.')
          return
        }
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (profileErr) {
          setAuthorized(false)
          setAuthError(profileErr.message)
          return
        }
        if (profile?.role !== 'admin') {
          setAuthorized(false)
          setAuthError('You do not have admin access.')
          return
        }
        setAuthorized(true)
      } catch (e: any) {
        setAuthorized(false)
        setAuthError(e?.message || 'Unexpected error')
      } finally {
        setAuthLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!authorized) return
    ;(async () => {
      const [{ data: classRows }, { data: termRows }] = await Promise.all([
        supabase.from('classes').select('id, name, class_level, department').order('name'),
        supabase.from('academic_terms').select('id, name, session_id, created_at').order('created_at', { ascending: false }),
      ])
      const classOptions = (classRows || []).map((c: any) => {
        const level = normalizeStr(c.class_level) || normalizeStr(c.name)
        const dept = normalizeStr(c.department)
        const label = dept ? `${level} - ${dept}` : level
        return { value: String(c.id), label }
      })
      // Sort by class level order
      const levelOrder = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3']
      classOptions.sort((a, b) => {
        const aLevel = levelOrder.findIndex(l => a.label.startsWith(l))
        const bLevel = levelOrder.findIndex(l => b.label.startsWith(l))
        return (aLevel === -1 ? 99 : aLevel) - (bLevel === -1 ? 99 : bLevel) || a.label.localeCompare(b.label)
      })
      setClasses([{ value: '', label: 'All classes' }, ...classOptions])

      const termRowList = (termRows || []) as any[]

      const termOrder = (name: string) => {
        const n = (name || '').toLowerCase()
        if (n.includes('first') || n.includes('1st') || n.includes('term 1') || n.includes('term1')) return 1
        if (n.includes('second') || n.includes('2nd') || n.includes('term 2') || n.includes('term2')) return 2
        if (n.includes('third') || n.includes('3rd') || n.includes('term 3') || n.includes('term3')) return 3
        return 99
      }

      const sessionOrder: string[] = []
      const seenSession = new Set<string>()
      for (const t of termRowList) {
        const sid = t?.session_id ? String(t.session_id) : ''
        if (!sid || seenSession.has(sid)) continue
        seenSession.add(sid)
        sessionOrder.push(sid)
      }

      const sortedTermRows = sessionOrder.flatMap((sid) => {
        return termRowList
          .filter((t) => String(t?.session_id || '') === sid)
          .sort((a, b) => {
            const ao = termOrder(String(a?.name || ''))
            const bo = termOrder(String(b?.name || ''))
            if (ao !== bo) return ao - bo
            return String(a?.name || '').localeCompare(String(b?.name || ''))
          })
      })

      const termOptions = sortedTermRows.map((t: any) => ({ value: String(t.id), label: String(t.name) }))
      setTerms([{ value: '', label: 'All terms' }, ...termOptions])
      setAcademicsFilters((prev) => ({
        ...prev,
        termId: prev.termId || (termOptions[0]?.value ?? ''),
      }))
      setPeopleFilters((prev) => ({
        ...prev,
        termId: prev.termId || (termOptions[0]?.value ?? ''),
      }))
    })()
  }, [authorized])

  const setLoadingState = (tab: TabKey, next: Partial<{ loading: boolean; error: string | null; loaded: boolean }>) => {
    if (typeof next.loading === 'boolean') {
      setTabLoading((p) => ({ ...p, [tab]: next.loading }))
    }
    if ('error' in next) {
      setTabError((p) => ({ ...p, [tab]: next.error ?? null }))
    }
    if (typeof next.loaded === 'boolean') {
      setTabLoaded((p) => ({ ...p, [tab]: next.loaded }))
    }
  }

  const loadOverview = async () => {
    setLoadingState('overview', { loading: true, error: null })
    try {
      const [teachersRes, studentsRes, classesRes, enrollmentsRes, attendanceRes, gradesRes, paymentsRes] = await Promise.all([
        supabase.from('teachers').select('id', { count: 'exact', head: true }),
        supabase.from('students').select('id, gender, status', { count: 'exact' }),
        supabase.from('classes').select('id, name, class_level, department'),
        supabase.from('class_enrollments').select('id', { count: 'exact', head: true }),
        supabase.from('attendance').select('date, statuses, class_id').gte('date', defaultFrom).lte('date', today),
        supabase.from('grades').select('score, max_score').limit(5000),
        supabase.from('payments').select('amount, status, created_at').gte('created_at', defaultFrom).lte('created_at', today).limit(5000),
      ])

      const classesRows = classesRes.data || []
      const totalClasses = classesRows.length
      const totalEnrollments = enrollmentsRes.count ?? 0
      const avgStudentsPerClass = totalClasses > 0 ? Math.round((totalEnrollments / totalClasses) * 10) / 10 : 0

      const attendanceRows = (attendanceRes.data || []) as any[]
      let present = 0, absent = 0, late = 0
      for (const a of attendanceRows) {
        const arr = Array.isArray(a.statuses) ? (a.statuses as string[]) : []
        if (arr.includes('present')) present++
        else if (arr.includes('late')) late++
        else absent++
      }
      const attendanceRate = attendanceRows.length ? Math.round((present / attendanceRows.length) * 1000) / 10 : 0

      const gradeRows = (gradesRes.data || []) as any[]
      const avgGrade = gradeRows.length
        ? Math.round((gradeRows.reduce((sum, g) => sum + (Number(g.score) / Math.max(Number(g.max_score) || 1, 1)) * 100, 0) / gradeRows.length) * 10) / 10
        : 0

      const payRows = (paymentsRes.data || []) as any[]
      const totalRevenue = payRows.reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const revenueByMonthMap = new Map<string, number>()
      for (const p of payRows) {
        const m = monthKey(String(p.created_at || ''))
        if (!m) continue
        revenueByMonthMap.set(m, (revenueByMonthMap.get(m) || 0) + Number(p.amount || 0))
      }
      const revenueByMonth = Array.from(revenueByMonthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, amount]) => ({ month, amount: Math.round(amount) }))

      const classById = new Map<string, { name: string; level: string }>()
      for (const c of (classesRows || []) as any[]) {
        classById.set(String(c.id), { name: String(c.name || ''), level: String(c.class_level || 'Unassigned') })
      }

      const enrollByLevelMap = new Map<string, number>()
      const { data: enrollmentRows } = await supabase
        .from('class_enrollments')
        .select('class_id')
        .limit(20000)
      for (const e of (enrollmentRows || []) as any[]) {
        const cls = classById.get(String(e.class_id))
        const lvl = cls?.level || 'Unassigned'
        enrollByLevelMap.set(lvl, (enrollByLevelMap.get(lvl) || 0) + 1)
      }
      const enrollmentsByLevel = Array.from(enrollByLevelMap.entries())
        .map(([level, students]) => ({ level, students }))
        .sort((a, b) => a.level.localeCompare(b.level))

      const dayMap = new Map<string, { total: number; present: number }>()
      for (let i = 0; i < 14; i++) {
        const d = addDays(defaultFrom, i)
        dayMap.set(d, { total: 0, present: 0 })
      }
      for (const a of attendanceRows) {
        const d = String(a.date || '')
        const entry = dayMap.get(d)
        if (!entry) continue
        entry.total++
        const arr = Array.isArray(a.statuses) ? (a.statuses as string[]) : []
        if (arr.includes('present')) entry.present++
      }
      const attendanceTrend = Array.from(dayMap.entries()).map(([date, v]) => ({
        date,
        rate: v.total ? Math.round((v.present / v.total) * 1000) / 10 : 0,
      }))

      const studentRows = (studentsRes.data || []) as any[]
      const genderMap = new Map<string, number>()
      for (const s of studentRows) {
        const g = normalizeStr(s.gender) || 'Unspecified'
        genderMap.set(g, (genderMap.get(g) || 0) + 1)
      }
      const genderSplit = Array.from(genderMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)

      const data: OverviewData = {
        kpis: {
          teachers: teachersRes.count ?? 0,
          students: studentsRes.count ?? 0,
          classes: totalClasses,
          enrollments: totalEnrollments,
          avgStudentsPerClass,
          attendanceRate,
          avgGrade,
          totalRevenue: Math.round(totalRevenue),
        },
        enrollmentsByLevel,
        revenueByMonth,
        attendanceTrend,
        genderSplit,
      }
      setOverviewData(data)
      setLoadingState('overview', { loaded: true })
    } catch (e: any) {
      setLoadingState('overview', { error: e?.message || 'Failed to load overview' })
    } finally {
      setLoadingState('overview', { loading: false })
    }
  }

  const loadAttendance = async () => {
    setLoadingState('attendance', { loading: true, error: null })
    try {
      const query = supabase.from('attendance').select('date, statuses, class_id').gte('date', attendanceFilters.from).lte('date', attendanceFilters.to)
      const [{ data: rows }, { data: classRows }] = await Promise.all([
        query.limit(20000),
        supabase.from('classes').select('id, name, class_level, department').order('name'),
      ])

      const levelFilter = normalizeStr(attendanceFilters.classLevel).toUpperCase()
      const allowedClassIds = new Set<string>()
      if (levelFilter) {
        for (const c of (classRows || []) as any[]) {
          const lvl = normalizeStr(c.class_level).toUpperCase()
          if (lvl === levelFilter) allowedClassIds.add(String(c.id))
        }
      }
      const filteredRows = levelFilter
        ? ((rows || []) as any[]).filter((r) => allowedClassIds.has(String(r.class_id || '')))
        : ((rows || []) as any[])

      const classNameMap = new Map<string, string>()
      for (const c of (classRows || []) as any[]) {
        const level = normalizeStr(c.class_level)
        const dept = normalizeStr(c.department)
        const suffix = [level, dept].filter(Boolean).join(' · ')
        classNameMap.set(String(c.id), suffix ? `${c.name} (${suffix})` : String(c.name))
      }

      const days: string[] = []
      const from = attendanceFilters.from
      const to = attendanceFilters.to
      for (let d = from; d <= to; d = addDays(d, 1)) days.push(d)

      const dayAgg = new Map<string, { present: number; absent: number; late: number; total: number }>()
      for (const d of days) dayAgg.set(d, { present: 0, absent: 0, late: 0, total: 0 })

      const classAgg = new Map<string, { present: number; absent: number; late: number; total: number }>()
      let present = 0, absent = 0, late = 0, total = 0
      for (const r of filteredRows) {
        const date = String(r.date || '')
        const day = dayAgg.get(date)
        const clsId = String(r.class_id || '')
        if (!classAgg.has(clsId)) classAgg.set(clsId, { present: 0, absent: 0, late: 0, total: 0 })
        const ca = classAgg.get(clsId)!
        const arr = Array.isArray(r.statuses) ? (r.statuses as string[]) : []

        total++
        ca.total++
        if (day) day.total++

        if (arr.includes('present')) {
          present++; ca.present++; if (day) day.present++
        } else if (arr.includes('late')) {
          late++; ca.late++; if (day) day.late++
        } else {
          absent++; ca.absent++; if (day) day.absent++
        }
      }

      const trend = days.map((date) => {
        const v = dayAgg.get(date)!
        const rate = v.total ? Math.round((v.present / v.total) * 1000) / 10 : 0
        return { date, present: v.present, absent: v.absent, late: v.late, rate }
      })

      const byClass = Array.from(classAgg.entries()).map(([classId, v]) => ({
        classId,
        className: classNameMap.get(classId) || classId.slice(0, 8),
        present: v.present,
        absent: v.absent,
        late: v.late,
        total: v.total,
        rate: v.total ? Math.round((v.present / v.total) * 1000) / 10 : 0,
      })).sort((a, b) => b.rate - a.rate)

      const data: AttendanceData = {
        summary: {
          total,
          present,
          absent,
          late,
          rate: total ? Math.round((present / total) * 1000) / 10 : 0,
        },
        trend,
        byClass,
      }
      setAttendanceData(data)
      setLoadingState('attendance', { loaded: true })
    } catch (e: any) {
      setLoadingState('attendance', { error: e?.message || 'Failed to load attendance analytics' })
    } finally {
      setLoadingState('attendance', { loading: false })
    }
  }

  const loadAcademics = async () => {
    setLoadingState('academics', { loading: true, error: null })
    try {
      let query = supabase
        .from('subject_scores')
        .select('student_id, subject_id, term_id, class_id, ca1_score, ca2_score, exam_score, total')
        .limit(20000)
      if (academicsFilters.termId) query = query.eq('term_id', academicsFilters.termId)
      if (academicsFilters.classId) query = query.eq('class_id', academicsFilters.classId)
      const [{ data: scores }, { data: subjects }, { data: students }, { data: classRows }, { data: enrollmentRows }] = await Promise.all([
        query,
        supabase.from('subjects').select('id, name, code').order('name'),
        supabase.from('students').select('id, full_name').limit(20000),
        supabase.from('classes').select('id, name, class_level, department').limit(20000),
        supabase.from('class_enrollments').select('student_id, class_id, created_at').order('created_at', { ascending: false }).limit(20000),
      ])

      const subjectMap = new Map<string, string>()
      for (const s of (subjects || []) as any[]) {
        subjectMap.set(String(s.id), s.code ? `${s.name} (${s.code})` : String(s.name))
      }
      const studentMap = new Map<string, string>()
      for (const s of (students || []) as any[]) {
        studentMap.set(String(s.id), String(s.full_name || '').trim() || String(s.id).slice(0, 8))
      }

      const classLabelById = new Map<string, string>()
      for (const c of (classRows || []) as any[]) {
        const lvl = normalizeStr(c.class_level) || normalizeStr(c.name)
        const dept = normalizeStr(c.department)
        classLabelById.set(String(c.id), dept ? `${lvl} - ${dept}` : lvl)
      }

      const latestEnrollment = new Map<string, { classId: string; createdAt: string }>()
      for (const e of (enrollmentRows || []) as any[]) {
        const sid = String(e.student_id || '')
        const cid = String(e.class_id || '')
        const ca = String(e.created_at || '')
        if (!sid || !cid) continue
        if (!latestEnrollment.has(sid)) {
          latestEnrollment.set(sid, { classId: cid, createdAt: ca })
        }
      }

      const rows = (scores || []) as any[]
      let complete = 0
      let totalCount = rows.length
      let totalSum = 0

      const band = (n: number) => {
        if (n >= 70) return '70–100'
        if (n >= 60) return '60–69'
        if (n >= 50) return '50–59'
        if (n >= 40) return '40–49'
        return '0–39'
      }
      const bandMap = new Map<string, number>()
      const subjAgg = new Map<string, { sum: number; count: number }>()
      const studentAgg = new Map<string, { sum: number; count: number }>()

      for (const r of rows) {
        const ca1 = Number(r.ca1_score || 0)
        const ca2 = Number(r.ca2_score || 0)
        const exam = Number(r.exam_score || 0)
        const isComplete = ca1 > 0 && ca2 > 0 && exam > 0
        if (isComplete) complete++
        const total = Math.round((Number(r.total || 0)) * 10) / 10
        totalSum += total
        bandMap.set(band(total), (bandMap.get(band(total)) || 0) + 1)
        const sid = String(r.subject_id || '')
        if (!subjAgg.has(sid)) subjAgg.set(sid, { sum: 0, count: 0 })
        const sa = subjAgg.get(sid)!
        sa.sum += total
        sa.count += 1

        const stid = String(r.student_id || '')
        if (!studentAgg.has(stid)) studentAgg.set(stid, { sum: 0, count: 0 })
        const sta = studentAgg.get(stid)!
        sta.sum += total
        sta.count += 1
      }

      const scoreBands = ['70–100', '60–69', '50–59', '40–49', '0–39'].map((b) => ({ band: b, count: bandMap.get(b) || 0 }))

      const subjectAverages = Array.from(subjAgg.entries())
        .map(([subjectId, v]) => ({
          subject: subjectMap.get(subjectId) || subjectId.slice(0, 8),
          average: v.count ? Math.round((v.sum / v.count) * 10) / 10 : 0,
          count: v.count,
        }))
        .sort((a, b) => b.average - a.average)
        .slice(0, 12)

      const classLabelForStudent = (studentId: string) => {
        if (academicsFilters.classId) {
          return classLabelById.get(String(academicsFilters.classId)) || 'Selected class'
        }
        const enr = latestEnrollment.get(studentId)
        return (enr?.classId && classLabelById.get(enr.classId)) || 'Unassigned'
      }

      const rankedStudents = Array.from(studentAgg.entries())
        .map(([studentId, v]) => ({
          studentId,
          student: studentMap.get(studentId) || studentId.slice(0, 8),
          classLabel: classLabelForStudent(studentId),
          avgTotal: v.count ? Math.round((v.sum / v.count) * 10) / 10 : 0,
          count: v.count,
        }))
        .filter((r) => r.count > 0)
        .sort((a, b) => b.avgTotal - a.avgTotal)

      const topStudents = rankedStudents.slice(0, 10)
      const underperformingStudents = [...rankedStudents].reverse().slice(0, 10)

      const data: AcademicsData = {
        summary: {
          totalScores: totalCount,
          avgTotal: totalCount ? Math.round((totalSum / totalCount) * 10) / 10 : 0,
          completionRate: totalCount ? Math.round((complete / totalCount) * 1000) / 10 : 0,
        },
        scoreBands,
        subjectAverages,
        topStudents,
        underperformingStudents,
      }
      setAcademicsData(data)
      setLoadingState('academics', { loaded: true })
    } catch (e: any) {
      setLoadingState('academics', { error: e?.message || 'Failed to load academics analytics' })
    } finally {
      setLoadingState('academics', { loading: false })
    }
  }

  const loadFinance = async () => {
    setLoadingState('finance', { loading: true, error: null })
    try {
      let query = supabase
        .from('payments')
        .select('id, student_id, amount, status, type, description, metadata, created_at')
        .gte('created_at', `${financeFilters.from}T00:00:00`)
        .lte('created_at', `${financeFilters.to}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(5000)
      if (financeFilters.status !== 'all') query = query.eq('status', financeFilters.status)
      const { data: payments } = await query

      let rows = (payments || []) as any[]

      // Filter by class if selected — load enrollments to match students
      if (financeFilters.classId) {
        const { data: enrollments } = await supabase
          .from('class_enrollments')
          .select('student_id')
          .eq('class_id', financeFilters.classId)
        const enrolledStudentIds = new Set((enrollments || []).map((e: any) => e.student_id))
        rows = rows.filter(p => p.student_id && enrolledStudentIds.has(p.student_id))
      }

      // Load student names for recent payments
      const studentIds = [...new Set(rows.map(p => p.student_id).filter(Boolean))]
      const studentNameMap: Record<string, string> = {}
      if (studentIds.length > 0) {
        const { data: students } = await supabase.from('students').select('id, full_name').in('id', studentIds)
        ;(students || []).forEach((s: any) => { studentNameMap[s.id] = s.full_name })
      }

      const totalPayments = rows.length
      const statusLabels: Record<string, string> = { paid: 'Paid', half_paid: 'Half Paid', owing: 'Owing', pending: 'Pending', waived: 'Waived', overdue: 'Overdue' }
      const statusColors: Record<string, string> = { paid: '#10b981', half_paid: '#f59e0b', owing: '#ef4444', pending: '#3b82f6', waived: '#a855f7', overdue: '#e11d48' }

      let totalAmount = 0, totalCollected = 0, totalOutstanding = 0
      let paidCount = 0, halfPaidCount = 0, owingCount = 0, pendingCount = 0

      const byStatusMap = new Map<string, { amount: number; collected: number; count: number }>()
      const byTypeMap = new Map<string, { amount: number; collected: number; outstanding: number; count: number }>()
      const byMonthMap = new Map<string, { amount: number; collected: number }>()

      for (const p of rows) {
        const meta = (p.metadata || {}) as any
        const amt = Number(p.amount || 0)
        const paid = Number(meta.amount_paid || 0)
        const bal = Number(meta.balance ?? (amt - paid))
        const st = normalizeStr(p.status) || 'pending'
        const ty = normalizeStr(p.type) || 'Unspecified'
        const mk = monthKey(String(p.created_at || ''))

        totalAmount += amt
        totalCollected += paid
        totalOutstanding += bal

        if (st === 'paid') paidCount++
        else if (st === 'half_paid') halfPaidCount++
        else if (st === 'owing') owingCount++
        else pendingCount++

        if (!byStatusMap.has(st)) byStatusMap.set(st, { amount: 0, collected: 0, count: 0 })
        const sv = byStatusMap.get(st)!
        sv.amount += amt; sv.collected += paid; sv.count++

        if (!byTypeMap.has(ty)) byTypeMap.set(ty, { amount: 0, collected: 0, outstanding: 0, count: 0 })
        const tv = byTypeMap.get(ty)!
        tv.amount += amt; tv.collected += paid; tv.outstanding += bal; tv.count++

        if (mk) {
          if (!byMonthMap.has(mk)) byMonthMap.set(mk, { amount: 0, collected: 0 })
          const mv = byMonthMap.get(mk)!
          mv.amount += amt; mv.collected += paid
        }
      }

      const avgAmount = totalPayments ? totalAmount / totalPayments : 0
      const collectionRate = totalAmount > 0 ? (totalCollected / totalAmount) * 100 : 0

      const byStatus = Array.from(byStatusMap.entries())
        .map(([status, v]) => ({ status, label: statusLabels[status] || status, amount: Math.round(v.amount), collected: Math.round(v.collected), count: v.count, color: statusColors[status] || '#6b7280' }))
        .sort((a, b) => b.count - a.count)
      const byType = Array.from(byTypeMap.entries())
        .map(([type, v]) => ({ type, amount: Math.round(v.amount), collected: Math.round(v.collected), outstanding: Math.round(v.outstanding), count: v.count }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)
      const revenueByMonth = Array.from(byMonthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, v]) => ({ month, amount: Math.round(v.amount), collected: Math.round(v.collected) }))

      const data: FinanceData = {
        summary: {
          totalPayments,
          totalAmount: Math.round(totalAmount),
          totalCollected: Math.round(totalCollected),
          totalOutstanding: Math.round(totalOutstanding),
          collectionRate: Math.round(collectionRate),
          avgAmount: Math.round(avgAmount),
          paidCount, halfPaidCount, owingCount, pendingCount,
        },
        byStatus,
        byType,
        revenueByMonth,
        recent: rows.slice(0, 15).map((p) => {
          const meta = (p.metadata || {}) as any
          return {
            created_at: String(p.created_at || ''),
            amount: Number(p.amount || 0),
            amount_paid: Number(meta.amount_paid || 0),
            balance: Number(meta.balance || 0),
            status: normalizeStr(p.status) || 'pending',
            type: normalizeStr(p.type) || 'Unspecified',
            description: normalizeStr(p.description) || '',
            student_id: p.student_id ? String(p.student_id) : null,
            student_name: p.student_id ? (studentNameMap[p.student_id] || '—') : '—',
            term: meta.term || '',
            payment_method: meta.payment_method || '',
            receipt_no: meta.receipt_no || '',
          }
        }),
      }
      setFinanceData(data)
      setLoadingState('finance', { loaded: true })
    } catch (e: any) {
      setLoadingState('finance', { error: e?.message || 'Failed to load finance analytics' })
    } finally {
      setLoadingState('finance', { loading: false })
    }
  }

  const loadPeople = async () => {
    setLoadingState('people', { loading: true, error: null })
    try {
      const perfFrom = addDays(today, -30)
      const perfTo = today

      let scoreQuery = supabase
        .from('subject_scores')
        .select('teacher_id, ca_score, exam_score, total, term_id')
        .limit(20000)
      if (peopleFilters.termId) scoreQuery = scoreQuery.eq('term_id', peopleFilters.termId)

      const [{ data: teachers }, { data: students }, { data: cst }, { data: classesRows }, { data: scoreRows }, { data: saRows }] = await Promise.all([
        supabase.from('teachers').select('id, user_id, full_name, status').limit(20000),
        supabase.from('students').select('id, gender, status, created_at').limit(20000),
        supabase.from('class_subject_teachers').select('teacher_id').limit(50000),
        supabase.from('classes').select('id, class_level, class_teacher_id').limit(20000),
        scoreQuery,
        supabase
          .from('subject_attendance')
          .select('teacher_id, class_id, subject_id, date')
          .gte('date', perfFrom)
          .lte('date', perfTo)
          .limit(50000),
      ])

      const teacherRows = (teachers || []) as any[]
      const studentRows = (students || []) as any[]

      const activeTeachers = teacherRows.filter((t) => (normalizeStr(t.status) || 'active').toLowerCase() !== 'inactive').length
      const activeStudents = studentRows.filter((s) => (normalizeStr(s.status) || 'active').toLowerCase() !== 'inactive').length

      const studentsByGenderMap = new Map<string, number>()
      const studentsByStatusMap = new Map<string, number>()
      for (const s of studentRows) {
        const g = normalizeStr(s.gender) || 'Unspecified'
        studentsByGenderMap.set(g, (studentsByGenderMap.get(g) || 0) + 1)
        const st = (normalizeStr(s.status) || 'active').toLowerCase()
        studentsByStatusMap.set(st, (studentsByStatusMap.get(st) || 0) + 1)
      }

      const studentsByGender = Array.from(studentsByGenderMap.entries()).map(([gender, count]) => ({ gender, count })).sort((a, b) => b.count - a.count)
      const studentsByStatus = Array.from(studentsByStatusMap.entries()).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count)

      const profileNameMap = new Map<string, string>()
      try {
        const userIds = Array.from(
          new Set(
            teacherRows
              .map((t) => (t?.user_id ? String(t.user_id) : ''))
              .filter(Boolean)
          )
        )
        for (let i = 0; i < userIds.length; i += 500) {
          const batch = userIds.slice(i, i + 500)
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', batch)
          for (const p of (profiles || []) as any[]) {
            const name = String(p?.full_name || '').trim()
            if (p?.id && name) profileNameMap.set(String(p.id), name)
          }
        }
      } catch {
      }

      const teacherNameMap = new Map<string, string>()
      for (const t of teacherRows) {
        const teacherId = String(t?.id || '').trim()
        const userId = String(t?.user_id || '').trim()
        const direct = String(t?.full_name || '').trim()
        const fromProfile = userId ? (profileNameMap.get(userId) || '') : ''
        const name = direct || fromProfile || (teacherId ? teacherId.slice(0, 8) : (userId ? userId.slice(0, 8) : 'Unknown'))
        if (teacherId) teacherNameMap.set(teacherId, name)
        if (userId) teacherNameMap.set(userId, name)
      }

      const assignMap = new Map<string, number>()
      for (const r of (cst || []) as any[]) {
        const tid = r.teacher_id ? String(r.teacher_id) : ''
        if (!tid) continue
        assignMap.set(tid, (assignMap.get(tid) || 0) + 1)
      }

      const classTeacherMap = new Map<string, number>()
      for (const c of (classesRows || []) as any[]) {
        const tid = c.class_teacher_id ? String(c.class_teacher_id) : ''
        if (!tid) continue
        classTeacherMap.set(tid, (classTeacherMap.get(tid) || 0) + 1)
      }

      const loadRows = teacherRows.map((t) => {
        const id = String(t.id)
        const assignments = assignMap.get(id) || 0
        const classTeacher = classTeacherMap.get(id) || 0
        return {
          teacher: teacherNameMap.get(id) || id.slice(0, 8),
          assignments,
          classTeacher,
          total: assignments + classTeacher,
        }
      })
      const teacherLoadTop = loadRows.sort((a, b) => b.total - a.total).slice(0, 12)

      const scoreAgg = new Map<string, { sumTotal: number; sumCa: number; sumExam: number; count: number }>()
      for (const r of (scoreRows || []) as any[]) {
        const tid = r.teacher_id ? String(r.teacher_id) : ''
        if (!tid) continue
        if (!scoreAgg.has(tid)) scoreAgg.set(tid, { sumTotal: 0, sumCa: 0, sumExam: 0, count: 0 })
        const a = scoreAgg.get(tid)!
        a.sumTotal += Number(r.total || 0)
        a.sumCa += Number(r.ca_score || 0)
        a.sumExam += Number(r.exam_score || 0)
        a.count += 1
      }

      const submissionAgg = new Map<string, Set<string>>()
      for (const r of (saRows || []) as any[]) {
        const tid = r.teacher_id ? String(r.teacher_id) : ''
        if (!tid) continue
        if (!submissionAgg.has(tid)) submissionAgg.set(tid, new Set())
        const key = `${String(r.class_id || '')}:${String(r.subject_id || '')}:${String(r.date || '')}`
        submissionAgg.get(tid)!.add(key)
      }
      const maxSubmissions = Math.max(0, ...Array.from(submissionAgg.values()).map((s) => s.size))

      const perfRows = teacherRows.map((t) => {
        const id = String(t.id)
        const s = scoreAgg.get(id)
        const avgTotal = s?.count ? Math.round((s.sumTotal / s.count) * 10) / 10 : 0
        const avgCa = s?.count ? Math.round((s.sumCa / s.count) * 10) / 10 : 0
        const avgExam = s?.count ? Math.round((s.sumExam / s.count) * 10) / 10 : 0
        const submissions = submissionAgg.get(id)?.size || 0
        const submissionScore = maxSubmissions ? (submissions / maxSubmissions) * 100 : 0
        const performanceScore = Math.round((avgTotal * 0.7 + submissionScore * 0.3) * 10) / 10
        return {
          teacher: teacherNameMap.get(id) || id.slice(0, 8),
          performanceScore,
          avgTotal,
          avgCa,
          avgExam,
          submissions,
          scoreCount: s?.count || 0,
        }
      })
      const teacherPerformanceTop = perfRows
        .sort((a, b) => b.performanceScore - a.performanceScore)
        .slice(0, 12)

      const data: PeopleData = {
        summary: {
          teachers: teacherRows.length,
          students: studentRows.length,
          activeTeachers,
          activeStudents,
        },
        studentsByGender,
        studentsByStatus,
        teacherLoadTop,
        teacherPerformanceTop,
      }
      setPeopleData(data)
      setLoadingState('people', { loaded: true })
    } catch (e: any) {
      setLoadingState('people', { error: e?.message || 'Failed to load people analytics' })
    } finally {
      setLoadingState('people', { loading: false })
    }
  }

  const refreshActive = async () => {
    if (!authorized) return
    if (activeTab === 'overview') return loadOverview()
    if (activeTab === 'attendance') return loadAttendance()
    if (activeTab === 'academics') return loadAcademics()
    if (activeTab === 'finance') return loadFinance()
    if (activeTab === 'people') return loadPeople()
  }

  useEffect(() => {
    if (!authorized) return
    if (!tabLoaded[activeTab] && !tabLoading[activeTab]) {
      refreshActive()
    }
  }, [activeTab, authorized])

  useEffect(() => {
    if (!authorized) return
    if (activeTab !== 'attendance') return
    if (!tabLoaded.attendance) return
    const id = setTimeout(() => loadAttendance(), 250)
    return () => clearTimeout(id)
  }, [attendanceFilters.from, attendanceFilters.to, attendanceFilters.classLevel, activeTab, authorized])

  useEffect(() => {
    if (!authorized) return
    if (activeTab !== 'academics') return
    if (!tabLoaded.academics) return
    const id = setTimeout(() => loadAcademics(), 250)
    return () => clearTimeout(id)
  }, [academicsFilters.termId, academicsFilters.classId, activeTab, authorized])

  useEffect(() => {
    if (!authorized) return
    if (activeTab !== 'finance') return
    if (!tabLoaded.finance) return
    const id = setTimeout(() => loadFinance(), 250)
    return () => clearTimeout(id)
  }, [financeFilters.status, financeFilters.classId, financeFilters.from, financeFilters.to, activeTab, authorized])

  useEffect(() => {
    if (!authorized) return
    if (activeTab !== 'people') return
    if (!tabLoaded.people) return
    const id = setTimeout(() => loadPeople(), 250)
    return () => clearTimeout(id)
  }, [peopleFilters.level, peopleFilters.termId, activeTab, authorized])

  const exportActiveCsv = async () => {
    if (activeTab === 'overview' && overviewData) {
      downloadCsv('overview_kpis.csv', [
        {
          teachers: overviewData.kpis.teachers,
          students: overviewData.kpis.students,
          classes: overviewData.kpis.classes,
          enrollments: overviewData.kpis.enrollments,
          avg_students_per_class: overviewData.kpis.avgStudentsPerClass,
          attendance_rate: overviewData.kpis.attendanceRate,
          avg_grade: overviewData.kpis.avgGrade,
          total_revenue: overviewData.kpis.totalRevenue,
        },
      ])
      return
    }
    if (activeTab === 'attendance' && attendanceData) {
      downloadCsv('attendance_trend.csv', attendanceData.trend)
      return
    }
    if (activeTab === 'academics' && academicsData) {
      downloadCsv(
        'academics_students_rank.csv',
        [
          ...academicsData.topStudents.map((r, idx) => ({ segment: 'top', rank: idx + 1, student: r.student, class: r.classLabel, avg_total: r.avgTotal, subjects: r.count })),
          ...academicsData.underperformingStudents.map((r, idx) => ({ segment: 'underperforming', rank: idx + 1, student: r.student, class: r.classLabel, avg_total: r.avgTotal, subjects: r.count })),
        ]
      )
      return
    }
    if (activeTab === 'finance' && financeData) {
      downloadCsv('finance_recent_payments.csv', financeData.recent)
      return
    }
    if (activeTab === 'people' && peopleData) {
      downloadCsv('people_teacher_load.csv', peopleData.teacherLoadTop)
      return
    }
  }

  const exportActivePdf = () => {
    if (!tabRootRef.current) return
    exportPdfViaPrint(`Reports - ${activeTab}`, tabRootRef.current)
  }

  const tabHeader = useMemo(() => {
    const t = TABS.find((x) => x.key === activeTab)
    return t?.label || 'Reports'
  }, [activeTab])

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-600">Loading…</div>
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h1 className="text-lg font-semibold text-gray-900">Reports</h1>
          </div>
          <p className="text-sm text-gray-600">{authError || 'Access denied.'}</p>
        </div>
      </div>
    )
  }

  const FilterRow = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-4 bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 text-gray-700">
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Filters</span>
      </div>
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>
    </div>
  )

  const Card = ({ title, value, icon: Icon, subtitle, tone }: { title: string; value: string; icon: any; subtitle?: string; tone?: string }) => (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${tone || ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle ? <p className="text-xs text-gray-500 mt-1">{subtitle}</p> : null}
        </div>
        <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-200">
          <Icon className="w-5 h-5 text-gray-700" />
        </div>
      </div>
    </div>
  )

  const TabShell = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">{children}</div>
  )

  const LoadingBlock = ({ label }: { label: string }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center text-sm text-gray-600">
      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
      {label}
    </div>
  )

  const ErrorBlock = ({ message }: { message: string }) => (
    <div className="bg-white border border-red-200 rounded-xl p-5">
      <p className="text-sm font-medium text-red-700">{message}</p>
      <p className="text-xs text-red-600 mt-1">Try refreshing or narrowing filters.</p>
    </div>
  )

  return (
    <div className="space-y-5" ref={tabRootRef}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
            <p className="text-sm text-gray-600">Lazy-loading tabs, exports, and filters</p>
          </div>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            onClick={() => refreshActive()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            disabled={tabLoading[activeTab]}
          >
            <RefreshCw className={`w-4 h-4 ${tabLoading[activeTab] ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => exportActiveCsv()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => exportActivePdf()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <FileDown className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-2 flex flex-wrap gap-2 no-print">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = t.key === activeTab
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{tabHeader}</h3>
        <p className="text-xs text-gray-500">Updated on demand</p>
      </div>

      {activeTab === 'overview' && (
        <>
          {tabError.overview ? <ErrorBlock message={tabError.overview} /> : null}
          {tabLoading.overview && !overviewData ? <LoadingBlock label="Loading overview…" /> : null}
          {overviewData ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card title="Teachers" value={String(overviewData.kpis.teachers)} icon={GraduationCap} />
                <Card title="Students" value={String(overviewData.kpis.students)} icon={Users} />
                <Card title="Attendance" value={`${overviewData.kpis.attendanceRate}%`} icon={UserCheck} subtitle={`Last 14 days`} />
                <Card title="Revenue" value={fmtMoney(overviewData.kpis.totalRevenue)} icon={Wallet} subtitle={`Last 14 days`} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TabShell>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-900">Attendance Trend</p>
                    <p className="text-xs text-gray-500">% Present</p>
                  </div>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={overviewData.attendanceTrend} margin={{ left: 4, right: 10, top: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => String(v).slice(5)} />
                        <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                        <Tooltip />
                        <Area type="monotone" dataKey="rate" stroke="#2563eb" fill="#93c5fd" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </TabShell>

                <TabShell>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-900">Enrollments by Class Level</p>
                    <p className="text-xs text-gray-500">Students</p>
                  </div>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overviewData.enrollmentsByLevel} margin={{ left: 4, right: 10, top: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="level" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="students" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabShell>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TabShell>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-gray-700" />
                      <p className="text-sm font-semibold text-gray-900">Revenue by Month</p>
                    </div>
                    <p className="text-xs text-gray-500">NGN</p>
                  </div>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overviewData.revenueByMonth} margin={{ left: 4, right: 10, top: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                        <Tooltip formatter={(v) => fmtMoney(Number(v))} />
                        <Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </TabShell>

                <TabShell>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <PieIcon className="w-4 h-4 text-gray-700" />
                      <p className="text-sm font-semibold text-gray-900">Student Gender Split</p>
                    </div>
                    <p className="text-xs text-gray-500">Count</p>
                  </div>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip />
                        <Legend />
                        <Pie data={overviewData.genderSplit} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2}>
                          {overviewData.genderSplit.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </TabShell>
              </div>
            </>
          ) : null}
        </>
      )}

      {activeTab === 'attendance' && (
        <>
          <FilterRow>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={attendanceFilters.classLevel}
                onChange={(e) => setAttendanceFilters((p) => ({ ...p, classLevel: e.target.value }))}
              >
                <option value="">All Classes</option>
                {STRICT_CLASS_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={attendanceFilters.from}
                onChange={(e) => setAttendanceFilters((p) => ({ ...p, from: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={attendanceFilters.to}
                onChange={(e) => setAttendanceFilters((p) => ({ ...p, to: e.target.value }))}
              />
            </div>
            <div>
              <button
                onClick={() => setAttendanceFilters({ classLevel: '', from: defaultFrom, to: today })}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </FilterRow>

          {tabError.attendance ? <ErrorBlock message={tabError.attendance} /> : null}
          {tabLoading.attendance && !attendanceData ? <LoadingBlock label="Loading attendance…" /> : null}
          {attendanceData ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card title="Attendance Rate" value={`${attendanceData.summary.rate}%`} icon={UserCheck} subtitle={`${attendanceData.summary.total} records`} />
                <Card title="Present" value={String(attendanceData.summary.present)} icon={TrendingUp} />
                <Card title="Late" value={String(attendanceData.summary.late)} icon={TrendingUp} />
                <Card title="Absent" value={String(attendanceData.summary.absent)} icon={TrendingUp} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TabShell>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-900">Daily Trend</p>
                    <p className="text-xs text-gray-500">Present / Absent / Late</p>
                  </div>
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={attendanceData.trend} margin={{ left: 4, right: 10, top: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => String(v).slice(5)} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </TabShell>

                <TabShell>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-900">Top Classes by Attendance</p>
                    <p className="text-xs text-gray-500">Rate %</p>
                  </div>
                  <div className="overflow-auto max-h-[320px]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500">
                          <th className="py-2 pr-2">Class</th>
                          <th className="py-2 pr-2">Rate</th>
                          <th className="py-2 pr-2">Present</th>
                          <th className="py-2 pr-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceData.byClass.slice(0, 12).map((r) => (
                          <tr key={r.classId} className="border-t">
                            <td className="py-2 pr-2 font-medium text-gray-900">{r.className}</td>
                            <td className="py-2 pr-2">{r.rate}%</td>
                            <td className="py-2 pr-2">{r.present}</td>
                            <td className="py-2 pr-2">{r.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabShell>
              </div>
            </>
          ) : null}
        </>
      )}

      {activeTab === 'academics' && (
        <>
          <FilterRow>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Term</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={academicsFilters.termId}
                onChange={(e) => setAcademicsFilters((p) => ({ ...p, termId: e.target.value }))}
              >
                {terms.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={academicsFilters.classId}
                onChange={(e) => setAcademicsFilters((p) => ({ ...p, classId: e.target.value }))}
              >
                {classes.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <button
                onClick={() => setAcademicsFilters((p) => ({ ...p, classId: '' }))}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                Clear Class
              </button>
            </div>
            <div>
              <button
                onClick={() => refreshActive()}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                <TrendingUp className="w-4 h-4" />
                Apply
              </button>
            </div>
          </FilterRow>

          {tabError.academics ? <ErrorBlock message={tabError.academics} /> : null}
          {tabLoading.academics && !academicsData ? <LoadingBlock label="Loading academics…" /> : null}
          {academicsData ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card title="Scores" value={String(academicsData.summary.totalScores)} icon={BookOpen} />
                <Card title="Avg Total" value={String(academicsData.summary.avgTotal)} icon={TrendingUp} subtitle="Subject score total" />
                <Card title="Completion" value={`${academicsData.summary.completionRate}%`} icon={UserCheck} subtitle="CA1+CA2+Exam filled" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TabShell>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-900">Score Distribution</p>
                    <p className="text-xs text-gray-500">Bands</p>
                  </div>
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={academicsData.scoreBands} margin={{ left: 4, right: 10, top: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="band" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabShell>

                <TabShell>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-900">Top Subjects by Average</p>
                    <p className="text-xs text-gray-500">Avg total</p>
                  </div>
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={academicsData.subjectAverages} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="subject" width={160} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="average" fill="#10b981" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabShell>
              </div>

              <TabShell>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-900">Top Students</p>
                  <p className="text-xs text-gray-500">By average total</p>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500">
                        <th className="py-2 pr-2">#</th>
                        <th className="py-2 pr-2">Student</th>
                        <th className="py-2 pr-2">Class</th>
                        <th className="py-2 pr-2">Avg Total</th>
                        <th className="py-2 pr-2">Subjects</th>
                      </tr>
                    </thead>
                    <tbody>
                      {academicsData.topStudents.map((r, idx) => (
                        <tr key={r.studentId} className="border-t">
                          <td className="py-2 pr-2 text-gray-500">{idx + 1}</td>
                          <td className="py-2 pr-2 font-medium text-gray-900">{r.student}</td>
                          <td className="py-2 pr-2 text-gray-600">{r.classLabel}</td>
                          <td className="py-2 pr-2">{r.avgTotal}</td>
                          <td className="py-2 pr-2">{r.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabShell>

              <TabShell>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-900">Underperforming Students</p>
                  <p className="text-xs text-gray-500">Lowest average total</p>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500">
                        <th className="py-2 pr-2">#</th>
                        <th className="py-2 pr-2">Student</th>
                        <th className="py-2 pr-2">Class</th>
                        <th className="py-2 pr-2">Avg Total</th>
                        <th className="py-2 pr-2">Subjects</th>
                      </tr>
                    </thead>
                    <tbody>
                      {academicsData.underperformingStudents.map((r, idx) => (
                        <tr key={r.studentId} className="border-t">
                          <td className="py-2 pr-2 text-gray-500">{idx + 1}</td>
                          <td className="py-2 pr-2 font-medium text-gray-900">{r.student}</td>
                          <td className="py-2 pr-2 text-gray-600">{r.classLabel}</td>
                          <td className="py-2 pr-2">{r.avgTotal}</td>
                          <td className="py-2 pr-2">{r.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabShell>
            </>
          ) : null}
        </>
      )}

      {activeTab === 'finance' && (
        <>
          <FilterRow>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={financeFilters.status}
                onChange={(e) => setFinanceFilters((p) => ({ ...p, status: e.target.value }))}
              >
                {[
                  { value: 'all', label: 'All statuses' },
                  { value: 'paid', label: 'Paid' },
                  { value: 'half_paid', label: 'Half Paid' },
                  { value: 'owing', label: 'Owing' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'waived', label: 'Waived' },
                  { value: 'overdue', label: 'Overdue' },
                ].map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={financeFilters.classId}
                onChange={(e) => setFinanceFilters((p) => ({ ...p, classId: e.target.value }))}
              >
                {classes.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={financeFilters.from}
                onChange={(e) => setFinanceFilters((p) => ({ ...p, from: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={financeFilters.to}
                onChange={(e) => setFinanceFilters((p) => ({ ...p, to: e.target.value }))}
              />
            </div>
            <div>
              <button
                onClick={() => setFinanceFilters({ status: 'all', classId: '', from: addDays(today, -365), to: today })}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </FilterRow>

          {tabError.finance ? <ErrorBlock message={tabError.finance} /> : null}
          {tabLoading.finance && !financeData ? <LoadingBlock label="Loading finance…" /> : null}
          {financeData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card title="Total Records" value={String(financeData.summary.totalPayments)} icon={Wallet} />
                <Card title="Total Expected" value={fmtMoney(financeData.summary.totalAmount)} icon={TrendingUp} />
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-500">Collected</span>
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{financeData.summary.collectionRate}%</span>
                  </div>
                  <p className="text-xl font-bold text-emerald-600">{fmtMoney(financeData.summary.totalCollected)}</p>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                    <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, financeData.summary.collectionRate)}%` }} />
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-500">Outstanding</span>
                  </div>
                  <p className="text-xl font-bold text-red-600">{fmtMoney(financeData.summary.totalOutstanding)}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">{financeData.summary.paidCount} paid</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{financeData.summary.halfPaidCount} half</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-700">{financeData.summary.owingCount} owing</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Revenue by Month - Expected vs Collected */}
                <TabShell>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-900">Monthly: Expected vs Collected</p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Expected</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Collected</span>
                    </div>
                  </div>
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={financeData.revenueByMonth} margin={{ left: 4, right: 10, top: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                        <Tooltip formatter={(v) => fmtMoney(Number(v))} />
                        <Bar dataKey="amount" name="Expected" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabShell>

                {/* By Status */}
                <TabShell>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-900">Payment Status Breakdown</p>
                    <p className="text-xs text-gray-500">{financeData.summary.totalPayments} total</p>
                  </div>
                  <div className="space-y-3">
                    {financeData.byStatus.map((s) => {
                      const pct = financeData.summary.totalPayments > 0 ? Math.round((s.count / financeData.summary.totalPayments) * 100) : 0
                      return (
                        <div key={s.status}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                              <span className="text-sm font-medium text-gray-700">{s.label}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="text-gray-500">{s.count} records</span>
                              <span className="font-semibold text-gray-900">{fmtMoney(s.amount)}</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </TabShell>
              </div>

              {/* By Type */}
              {financeData.byType.length > 0 && (
                <TabShell>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-900">Collection by Payment Type</p>
                  </div>
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b">
                          <th className="py-2 pr-4">Type</th>
                          <th className="py-2 pr-4 text-right">Expected</th>
                          <th className="py-2 pr-4 text-right">Collected</th>
                          <th className="py-2 pr-4 text-right">Outstanding</th>
                          <th className="py-2 pr-4 text-center">Records</th>
                          <th className="py-2 text-right">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financeData.byType.map((t) => {
                          const rate = t.amount > 0 ? Math.round((t.collected / t.amount) * 100) : 0
                          return (
                            <tr key={t.type} className="border-t">
                              <td className="py-2.5 pr-4 font-medium text-gray-900">{t.type}</td>
                              <td className="py-2.5 pr-4 text-right text-gray-700">{fmtMoney(t.amount)}</td>
                              <td className="py-2.5 pr-4 text-right text-emerald-600 font-medium">{fmtMoney(t.collected)}</td>
                              <td className="py-2.5 pr-4 text-right text-red-600">{fmtMoney(t.outstanding)}</td>
                              <td className="py-2.5 pr-4 text-center text-gray-500">{t.count}</td>
                              <td className="py-2.5 text-right">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rate >= 75 ? 'bg-emerald-50 text-emerald-700' : rate >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{rate}%</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </TabShell>
              )}

              {/* Recent Payments */}
              <TabShell>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-900">Recent Payments</p>
                  <p className="text-xs text-gray-500">Latest 15</p>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b">
                        <th className="py-2 pr-2">Date</th>
                        <th className="py-2 pr-2">Student</th>
                        <th className="py-2 pr-2">Type</th>
                        <th className="py-2 pr-2 text-right">Amount</th>
                        <th className="py-2 pr-2 text-right">Paid</th>
                        <th className="py-2 pr-2 text-right">Balance</th>
                        <th className="py-2 pr-2 text-center">Status</th>
                        <th className="py-2 pr-2">Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financeData.recent.map((p, idx) => {
                        const statusStyles: Record<string, string> = {
                          paid: 'bg-emerald-50 text-emerald-700',
                          half_paid: 'bg-amber-50 text-amber-700',
                          owing: 'bg-red-50 text-red-700',
                          pending: 'bg-blue-50 text-blue-700',
                          waived: 'bg-purple-50 text-purple-700',
                          overdue: 'bg-rose-50 text-rose-700',
                        }
                        const statusLabels: Record<string, string> = { paid: 'Paid', half_paid: 'Half Paid', owing: 'Owing', pending: 'Pending', waived: 'Waived', overdue: 'Overdue' }
                        return (
                          <tr key={idx} className="border-t hover:bg-gray-50/50">
                            <td className="py-2.5 pr-2 text-gray-500">{p.created_at.slice(0, 10)}</td>
                            <td className="py-2.5 pr-2 font-medium text-gray-900">{p.student_name}</td>
                            <td className="py-2.5 pr-2 text-gray-600">{p.type}</td>
                            <td className="py-2.5 pr-2 text-right font-medium text-gray-900">{fmtMoney(p.amount)}</td>
                            <td className="py-2.5 pr-2 text-right text-emerald-600">{fmtMoney(p.amount_paid)}</td>
                            <td className="py-2.5 pr-2 text-right text-red-600">{p.balance > 0 ? fmtMoney(p.balance) : '—'}</td>
                            <td className="py-2.5 pr-2 text-center">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyles[p.status] || 'bg-gray-100 text-gray-600'}`}>
                                {statusLabels[p.status] || p.status}
                              </span>
                            </td>
                            <td className="py-2.5 pr-2 text-gray-500">{p.payment_method || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </TabShell>
            </>
          ) : null}
        </>
      )}

      {activeTab === 'people' && (
        <>
          <FilterRow>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Class Level (optional)</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={peopleFilters.level}
                onChange={(e) => setPeopleFilters((p) => ({ ...p, level: e.target.value }))}
              >
                {['all', 'JSS', 'SS'].map((l) => (
                  <option key={l} value={l}>{l === 'all' ? 'All levels' : l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Term (teacher performance)</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={peopleFilters.termId}
                onChange={(e) => setPeopleFilters((p) => ({ ...p, termId: e.target.value }))}
              >
                {terms.filter((t) => t.value !== '').map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <button
                onClick={() => setPeopleFilters((p) => ({ ...p, level: 'all' }))}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </button>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500">Teacher load is based on class-subject assignments + class teacher role.</p>
            </div>
          </FilterRow>

          {tabError.people ? <ErrorBlock message={tabError.people} /> : null}
          {tabLoading.people && !peopleData ? <LoadingBlock label="Loading people analytics…" /> : null}
          {peopleData ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card title="Teachers" value={String(peopleData.summary.teachers)} icon={GraduationCap} subtitle={`${peopleData.summary.activeTeachers} active`} />
                <Card title="Students" value={String(peopleData.summary.students)} icon={Users} subtitle={`${peopleData.summary.activeStudents} active`} />
                <Card title="Student Statuses" value={String(peopleData.studentsByStatus.length)} icon={TrendingUp} subtitle="Distinct" />
                <Card title="Gender Categories" value={String(peopleData.studentsByGender.length)} icon={PieIcon} subtitle="Distinct" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TabShell>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-900">Students by Gender</p>
                    <p className="text-xs text-gray-500">Count</p>
                  </div>
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={peopleData.studentsByGender} margin={{ left: 4, right: 10, top: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="gender" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabShell>

                <TabShell>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-900">Student Status</p>
                    <p className="text-xs text-gray-500">Count</p>
                  </div>
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip />
                        <Legend />
                        <Pie data={peopleData.studentsByStatus} dataKey="count" nameKey="status" innerRadius={52} outerRadius={88} paddingAngle={2}>
                          {peopleData.studentsByStatus.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </TabShell>
              </div>

              <TabShell>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-900">Teacher Load (Top)</p>
                  <p className="text-xs text-gray-500">Assignments + Class Teacher</p>
                </div>
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={peopleData.teacherLoadTop} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="teacher" width={180} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="assignments" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="classTeacher" stackId="a" fill="#6366f1" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabShell>

              <TabShell>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-900">Teacher Performance (Top)</p>
                  <p className="text-xs text-gray-500">70% scores + 30% subject-attendance submissions (30d)</p>
                </div>
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={peopleData.teacherPerformanceTop} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="teacher" width={180} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v, name, props: any) => {
                        if (name === 'performanceScore') return [v, 'Performance']
                        if (name === 'avgCa') return [v, 'Avg CA']
                        if (name === 'avgExam') return [v, 'Avg Exam']
                        if (name === 'avgTotal') return [v, 'Avg Total']
                        if (name === 'submissions') return [v, 'Submissions']
                        return [v, name]
                      }} />
                      <Legend />
                      <Bar dataKey="performanceScore" fill="#2563eb" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-900">Score Breakdown (Avg)</p>
                    <p className="text-xs text-gray-500">CA vs Exam</p>
                  </div>
                  <div style={{ height: 320 }}>
                    {peopleData.teacherPerformanceTop.some((r) => r.scoreCount > 0 && (r.avgCa > 0 || r.avgExam > 0)) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={peopleData.teacherPerformanceTop.filter((r) => r.scoreCount > 0 && (r.avgCa > 0 || r.avgExam > 0))}
                          layout="vertical"
                          margin={{ left: 10, right: 10, top: 10, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                          <YAxis type="category" dataKey="teacher" width={180} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(v, name) => {
                            if (name === 'avgCa') return [v, 'Avg CA']
                            if (name === 'avgExam') return [v, 'Avg Exam']
                            return [v, name]
                          }} />
                          <Legend />
                          <Bar dataKey="avgCa" stackId="s" name="Avg CA" fill="#10b981" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="avgExam" stackId="s" name="Avg Exam" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-sm text-gray-400">
                        No CA/Exam scores found for the selected term.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500">
                        <th className="py-2 pr-2">Teacher</th>
                        <th className="py-2 pr-2">Performance</th>
                        <th className="py-2 pr-2">Avg CA</th>
                        <th className="py-2 pr-2">Avg Exam</th>
                        <th className="py-2 pr-2">Avg Total</th>
                        <th className="py-2 pr-2">Submissions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {peopleData.teacherPerformanceTop.map((r) => (
                        <tr key={r.teacher} className="border-t">
                          <td className="py-2 pr-2 font-medium text-gray-900">{r.teacher}</td>
                          <td className="py-2 pr-2">{r.performanceScore}</td>
                          <td className="py-2 pr-2">{r.avgCa}</td>
                          <td className="py-2 pr-2">{r.avgExam}</td>
                          <td className="py-2 pr-2">{r.avgTotal}</td>
                          <td className="py-2 pr-2">{r.submissions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabShell>
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
