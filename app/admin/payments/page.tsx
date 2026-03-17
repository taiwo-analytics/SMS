"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import {
  CreditCard, Plus, X, Search, Filter, Download, Edit3, Trash2,
  CheckCircle, Clock, AlertTriangle, XCircle, DollarSign, Users,
  TrendingUp, Eye, ChevronDown, RotateCcw
} from "lucide-react"

type PaymentStatus = 'paid' | 'half_paid' | 'owing' | 'pending' | 'waived' | 'overdue'

interface PaymentRecord {
  id: string
  student_id: string | null
  amount: number
  amount_paid?: number
  balance?: number
  status: PaymentStatus
  type?: string
  description?: string | null
  term?: string
  academic_year?: string
  payment_method?: string
  receipt_no?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at?: string
}

interface StudentInfo {
  id: string
  full_name: string
  admission?: string
  department?: string | null
  photo_url?: string | null
  class_label?: string
}

interface ClassOption {
  value: string
  label: string
}

const STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; bg: string; border: string; icon: any }> = {
  paid: { label: 'Paid', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle },
  half_paid: { label: 'Half Paid', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock },
  owing: { label: 'Owing', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle },
  pending: { label: 'Pending', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: Clock },
  waived: { label: 'Waived', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: RotateCcw },
  overdue: { label: 'Overdue', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: XCircle },
}

const PAYMENT_TYPES = ['Tuition', 'Registration', 'Exam Fee', 'Lab Fee', 'Library Fee', 'Uniform', 'Transport', 'Other']
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Card', 'Online', 'Other']
const TERMS = ['First Term', 'Second Term', 'Third Term']

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount)
}

function AdminPaymentsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [students, setStudents] = useState<Record<string, StudentInfo>>({})
  const [allStudents, setAllStudents] = useState<StudentInfo[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null)
  const [viewingPayment, setViewingPayment] = useState<PaymentRecord | null>(null)
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [classFilter, setClassFilter] = useState<string>('all')
  const [classOptions, setClassOptions] = useState<ClassOption[]>([])
  const [studentClassMap, setStudentClassMap] = useState<Record<string, string>>({})
  const [studentSearch, setStudentSearch] = useState('')
  const [showStudentDropdown, setShowStudentDropdown] = useState(false)

  const [form, setForm] = useState({
    student_id: '',
    amount: '',
    amount_paid: '',
    status: 'pending' as PaymentStatus,
    type: 'Tuition',
    description: '',
    term: 'First Term',
    academic_year: '2025/2026',
    payment_method: 'Cash',
    receipt_no: '',
  })

  const loadStudents = useCallback(async () => {
    try {
      const [{ data: studentData }, { data: classRows }, { data: enrollments }] = await Promise.all([
        supabase.from('students').select('id, full_name, admission, department, photo_url').order('full_name'),
        supabase.from('classes').select('id, name, class_level, department').order('name'),
        supabase.from('class_enrollments').select('student_id, class_id, created_at').order('created_at', { ascending: false }),
      ])

      // Build class label map
      const classLabelById: Record<string, string> = {}
      const levelOrder = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3']
      const opts: ClassOption[] = []
      for (const c of (classRows || []) as any[]) {
        const lvl = (c.class_level || c.name || '').trim()
        const dept = (c.department || '').trim()
        const label = dept ? `${lvl} - ${dept}` : lvl
        classLabelById[c.id] = label
        opts.push({ value: c.id, label })
      }
      opts.sort((a, b) => {
        const ai = levelOrder.findIndex(l => a.label.startsWith(l))
        const bi = levelOrder.findIndex(l => b.label.startsWith(l))
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.label.localeCompare(b.label)
      })
      setClassOptions(opts)

      // Build student -> latest class mapping
      const latestClassByStudent: Record<string, string> = {}
      for (const e of (enrollments || []) as any[]) {
        if (!e.student_id || !e.class_id) continue
        if (!latestClassByStudent[e.student_id]) {
          latestClassByStudent[e.student_id] = e.class_id
        }
      }
      setStudentClassMap(latestClassByStudent)

      // Build student list with class labels
      const list = (studentData || []).map((s: any) => ({
        ...s,
        class_label: latestClassByStudent[s.id] ? (classLabelById[latestClassByStudent[s.id]] || '—') : '—',
      })) as StudentInfo[]
      setAllStudents(list)
      const map: Record<string, StudentInfo> = {}
      list.forEach(s => { map[s.id] = s })
      setStudents(map)
    } catch (e) {
      console.error('Error loading students:', e)
    }
  }, [])

  const loadPayments = useCallback(async (studentId?: string | null) => {
    try {
      let query = supabase.from("payments").select("*").order("created_at", { ascending: false })
      if (studentId) query = query.eq("student_id", studentId)
      const { data, error } = await query
      if (error) throw error
      setPayments((data || []) as PaymentRecord[])
    } catch (e) {
      console.error(e)
      setPayments([])
    }
  }, [])

  useEffect(() => {
    const sid = searchParams.get("student_id")
    setActiveStudentId(sid || null)
  }, [searchParams])

  useEffect(() => {
    ;(async () => {
      await Promise.all([loadPayments(activeStudentId), loadStudents()])
      setLoading(false)
    })()
  }, [activeStudentId, loadPayments, loadStudents])

  const resetForm = () => {
    setForm({
      student_id: '', amount: '', amount_paid: '', status: 'pending',
      type: 'Tuition', description: '', term: 'First Term',
      academic_year: '2025/2026', payment_method: 'Cash', receipt_no: '',
    })
    setStudentSearch('')
    setEditingPayment(null)
  }

  const openCreateModal = () => {
    resetForm()
    if (activeStudentId) {
      setForm(f => ({ ...f, student_id: activeStudentId }))
      setStudentSearch(students[activeStudentId]?.full_name || '')
    }
    setShowModal(true)
  }

  const openEditModal = (p: PaymentRecord) => {
    setEditingPayment(p)
    setForm({
      student_id: p.student_id || '',
      amount: String(p.amount),
      amount_paid: String(p.amount_paid || ''),
      status: p.status,
      type: p.type || 'Tuition',
      description: p.description || '',
      term: p.term || 'First Term',
      academic_year: p.academic_year || '2025/2026',
      payment_method: p.payment_method || 'Cash',
      receipt_no: p.receipt_no || '',
    })
    setStudentSearch(p.student_id ? (students[p.student_id]?.full_name || '') : '')
    setShowModal(true)
  }

  const computeStatus = (amount: number, amountPaid: number): PaymentStatus => {
    if (amountPaid >= amount) return 'paid'
    if (amountPaid > 0) return 'half_paid'
    return 'owing'
  }

  const handleSave = async () => {
    try {
      const amount = parseFloat(form.amount)
      if (isNaN(amount) || amount <= 0) throw new Error("Enter a valid amount")
      const amountPaid = form.amount_paid ? parseFloat(form.amount_paid) : 0
      if (isNaN(amountPaid) || amountPaid < 0) throw new Error("Invalid amount paid")
      if (!form.student_id) throw new Error("Please select a student")

      const autoStatus = form.status === 'waived' ? 'waived' : computeStatus(amount, amountPaid)
      const balance = Math.max(0, amount - amountPaid)

      const record: any = {
        student_id: form.student_id,
        amount,
        status: autoStatus,
        type: form.type,
        description: form.description || null,
        metadata: {
          amount_paid: amountPaid,
          balance,
          term: form.term,
          academic_year: form.academic_year,
          payment_method: form.payment_method,
          receipt_no: form.receipt_no || null,
          updated_at: new Date().toISOString(),
        },
      }

      if (editingPayment) {
        const { error } = await supabase.from("payments").update(record).eq("id", editingPayment.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("payments").insert(record)
        if (error) throw error
      }

      setShowModal(false)
      resetForm()
      await loadPayments(activeStudentId)
    } catch (e: any) {
      alert(e.message || "Failed to save payment")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payment record?")) return
    try {
      const { error } = await supabase.from("payments").delete().eq("id", id)
      if (error) throw error
      await loadPayments(activeStudentId)
    } catch (e: any) {
      alert(e.message || "Failed to delete")
    }
  }

  const handleExportCSV = () => {
    const headers = ['Student', 'Amount', 'Amount Paid', 'Balance', 'Status', 'Type', 'Term', 'Method', 'Receipt', 'Description', 'Date']
    const rows = filteredPayments.map(p => {
      const meta = (p.metadata || {}) as any
      return [
        students[p.student_id || '']?.full_name || p.student_id || '—',
        p.amount,
        meta.amount_paid || 0,
        meta.balance || 0,
        p.status,
        p.type || '',
        meta.term || '',
        meta.payment_method || '',
        meta.receipt_no || '',
        p.description || '',
        new Date(p.created_at).toLocaleDateString(),
      ].join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `payments_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // Enrich payments with metadata fields
  const enriched = payments.map(p => {
    const meta = (p.metadata || {}) as any
    return {
      ...p,
      amount_paid: meta.amount_paid ?? 0,
      balance: meta.balance ?? p.amount,
      term: meta.term,
      academic_year: meta.academic_year,
      payment_method: meta.payment_method,
      receipt_no: meta.receipt_no,
    }
  })

  // Filters
  const filteredPayments = enriched.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (typeFilter !== 'all' && p.type !== typeFilter) return false
    if (classFilter !== 'all') {
      const studentClassId = studentClassMap[p.student_id || '']
      if (studentClassId !== classFilter) return false
    }
    if (searchTerm) {
      const name = students[p.student_id || '']?.full_name || ''
      const term = searchTerm.toLowerCase()
      if (!name.toLowerCase().includes(term) && !(p.receipt_no || '').toLowerCase().includes(term) && !(p.description || '').toLowerCase().includes(term)) return false
    }
    return true
  })

  // Summary stats
  const totalAmount = enriched.reduce((s, p) => s + p.amount, 0)
  const totalCollected = enriched.reduce((s, p) => s + (p.amount_paid || 0), 0)
  const totalOutstanding = enriched.reduce((s, p) => s + (p.balance || 0), 0)
  const statusCounts = enriched.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc }, {} as Record<string, number>)

  const filteredStudents = allStudents.filter(s =>
    s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    (s.admission || '').toLowerCase().includes(studentSearch.toLowerCase())
  ).slice(0, 8)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-gray-500">Loading payments...</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Payment Management</h2>
            <p className="text-sm text-gray-500">{enriched.length} total records</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeStudentId && (
            <div className="text-sm text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 flex items-center gap-2">
              Viewing: <span className="font-semibold">{students[activeStudentId]?.full_name || activeStudentId}</span>
              <button onClick={() => router.push("/admin/payments")} className="text-indigo-500 hover:text-indigo-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={openCreateModal} className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md">
            <Plus className="w-5 h-5" /> Record Payment
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Total Expected</span>
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
          <p className="text-xs text-gray-400 mt-1">{enriched.length} records</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Total Collected</span>
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalCollected)}</p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${totalAmount > 0 ? Math.min(100, (totalCollected / totalAmount) * 100) : 0}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Outstanding</span>
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOutstanding)}</p>
          <p className="text-xs text-gray-400 mt-1">{statusCounts['owing'] || 0} students owing</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Students</span>
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{new Set(enriched.map(p => p.student_id).filter(Boolean)).size}</p>
          <div className="flex gap-2 mt-1 flex-wrap">
            {Object.entries(statusCounts).map(([s, c]) => {
              const cfg = STATUS_CONFIG[s as PaymentStatus]
              return cfg ? (
                <span key={s} className={`text-xs px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{c} {cfg.label.toLowerCase()}</span>
              ) : null
            })}
          </div>
        </div>
      </div>

      {/* Status Quick Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', ...Object.keys(STATUS_CONFIG)] as const).map(s => {
          const isActive = statusFilter === s
          if (s === 'all') return (
            <button key={s} onClick={() => setStatusFilter('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${isActive ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'}`}>
              All ({enriched.length})
            </button>
          )
          const cfg = STATUS_CONFIG[s as PaymentStatus]
          const count = statusCounts[s] || 0
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                isActive ? `${cfg.bg} ${cfg.color} ${cfg.border} border shadow-md` : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}>
              <cfg.icon className="w-3.5 h-3.5" />
              {cfg.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student name, receipt no, or description..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="pl-10 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm appearance-none bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="all">All Types</option>
              {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
              className="pl-10 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm appearance-none bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="all">All Classes</option>
              {classOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Payment Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Class</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Paid</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance</th>
                <th className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Term</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center">
                    <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 font-medium">No payment records found</p>
                    <p className="text-gray-400 text-sm mt-1">Click &quot;Record Payment&quot; to add one</p>
                  </td>
                </tr>
              ) : filteredPayments.map((p) => {
                const student = students[p.student_id || '']
                const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending
                const StatusIcon = cfg.icon
                return (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-indigo-600">
                            {(student?.full_name || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{student?.full_name || '—'}</p>
                          {student?.admission && <p className="text-xs text-gray-400">{student.admission}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{student?.class_label || '—'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-600">{p.type || '—'}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(p.amount)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm font-medium text-emerald-600">{formatCurrency(p.amount_paid || 0)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className={`text-sm font-medium ${(p.balance || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {formatCurrency(p.balance || 0)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-600">{p.term || '—'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-500">{new Date(p.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewingPayment(p)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEditModal(p)} className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filteredPayments.length > 0 && (
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-sm text-gray-500">
            Showing {filteredPayments.length} of {enriched.length} records
          </div>
        )}
      </div>

      {/* View Payment Detail Modal */}
      {viewingPayment && (() => {
        const p = viewingPayment
        const meta = (p.metadata || {}) as any
        const student = students[p.student_id || '']
        const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending
        const StatusIcon = cfg.icon
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewingPayment(null)}>
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Payment Details</h3>
                  <button onClick={() => setViewingPayment(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-lg font-bold text-indigo-600">{(student?.full_name || '?')[0]}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{student?.full_name || '—'}</p>
                    <p className="text-sm text-gray-500">{student?.admission || ''} {student?.department ? `| ${student.department}` : ''}</p>
                  </div>
                  <span className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
                    <StatusIcon className="w-3.5 h-3.5" /> {cfg.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Amount</p>
                    <p className="font-bold text-gray-900">{formatCurrency(p.amount)}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Paid</p>
                    <p className="font-bold text-emerald-600">{formatCurrency(meta.amount_paid || 0)}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Balance</p>
                    <p className="font-bold text-red-600">{formatCurrency(meta.balance || 0)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Type</p>
                    <p className="font-bold text-gray-900">{p.type || '—'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Term:</span> <span className="font-medium">{meta.term || '—'}</span></div>
                  <div><span className="text-gray-500">Year:</span> <span className="font-medium">{meta.academic_year || '—'}</span></div>
                  <div><span className="text-gray-500">Method:</span> <span className="font-medium">{meta.payment_method || '—'}</span></div>
                  <div><span className="text-gray-500">Receipt:</span> <span className="font-medium">{meta.receipt_no || '—'}</span></div>
                  <div><span className="text-gray-500">Date:</span> <span className="font-medium">{new Date(p.created_at).toLocaleString()}</span></div>
                </div>
                {p.description && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Description</p>
                    <p className="text-sm text-gray-700">{p.description}</p>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-gray-100 flex justify-end gap-2">
                <button onClick={() => { setViewingPayment(null); openEditModal(p) }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
                  Edit Payment
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowModal(false); resetForm() }}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{editingPayment ? 'Edit Payment' : 'Record New Payment'}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{editingPayment ? 'Update payment details' : 'Add a new payment record for a student'}</p>
                </div>
                <button onClick={() => { setShowModal(false); resetForm() }} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Student Selector */}
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Student *</label>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => { setStudentSearch(e.target.value); setShowStudentDropdown(true); setForm(f => ({ ...f, student_id: '' })) }}
                  onFocus={() => setShowStudentDropdown(true)}
                  placeholder="Search student by name or admission no..."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                {form.student_id && (
                  <CheckCircle className="absolute right-3 top-9 w-5 h-5 text-emerald-500" />
                )}
                {showStudentDropdown && studentSearch && !form.student_id && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredStudents.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">No students found</div>
                    ) : filteredStudents.map(s => (
                      <button key={s.id} onClick={() => { setForm(f => ({ ...f, student_id: s.id })); setStudentSearch(s.full_name); setShowStudentDropdown(false) }}
                        className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 flex items-center gap-3 transition-colors">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-indigo-600">{s.full_name[0]}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{s.full_name}</p>
                          <p className="text-xs text-gray-400">{s.admission || 'No admission no.'}{s.department ? ` | ${s.department}` : ''}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Amount & Amount Paid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Total Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">NGN</span>
                    <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="w-full pl-14 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Amount Paid</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">NGN</span>
                    <input type="number" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
                      className="w-full pl-14 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0" />
                  </div>
                </div>
              </div>

              {/* Auto-calculated balance preview */}
              {form.amount && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
                  <span className="text-gray-500">Balance:</span>
                  <span className={`font-bold ${(parseFloat(form.amount) - (parseFloat(form.amount_paid) || 0)) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatCurrency(Math.max(0, parseFloat(form.amount) - (parseFloat(form.amount_paid) || 0)))}
                  </span>
                </div>
              )}

              {/* Status & Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PaymentStatus })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Auto-set based on amount paid (except Waived)</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Payment Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white">
                    {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Term & Academic Year */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Term</label>
                  <select value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white">
                    {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Academic Year</label>
                  <input type="text" value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="2025/2026" />
                </div>
              </div>

              {/* Payment Method & Receipt */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Payment Method</label>
                  <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Receipt No.</label>
                  <input type="text" value={form.receipt_no} onChange={(e) => setForm({ ...form, receipt_no: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Optional" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description / Note</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" rows={3} placeholder="Optional note about this payment..." />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => { setShowModal(false); resetForm() }} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md">
                {editingPayment ? 'Update Payment' : 'Save Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-gray-500">Loading payments...</p>
        </div>
      </div>
    }>
      <AdminPaymentsContent />
    </Suspense>
  )
}
