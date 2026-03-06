'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Printer, FileText, Save, Check } from 'lucide-react'

export default function TeacherReportCardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [teacherId, setTeacherId] = useState('')
  const [isClassTeacher, setIsClassTeacher] = useState(false)

  const [terms, setTerms] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])

  const [termId, setTermId] = useState('')
  const [classId, setClassId] = useState('')
  const [studentId, setStudentId] = useState('')

  const [report, setReport] = useState<any | null>(null)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  const [remark, setRemark] = useState('')
  const [savingRemark, setSavingRemark] = useState(false)
  const [remarkSaved, setRemarkSaved] = useState(false)

  // Load initial data
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

        // Get classes (both class teacher and subject teacher)
        const { data: cst } = await supabase
          .from('class_subject_teachers')
          .select('class_id, classes(id, name, class_level, class_teacher_id)')
          .eq('teacher_id', teacher.id)

        const { data: classTeacherClasses } = await supabase
          .from('classes')
          .select('id, name, class_level, class_teacher_id')
          .eq('class_teacher_id', teacher.id)

        const classMap = new Map<string, any>()
        for (const r of (cst || [])) {
          const c = (r as any).classes
          if (c) classMap.set(c.id, c)
        }
        for (const c of (classTeacherClasses || [])) {
          classMap.set(c.id, c)
        }
        setClasses(Array.from(classMap.values()))

        // Load terms
        const { data: termsData } = await supabase
          .from('academic_terms')
          .select('*')
          .order('created_at', { ascending: false })
        setTerms(termsData || [])
        const active = (termsData || []).find((t: any) => t.is_active)
        if (active) setTermId(active.id)
      } catch {
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Load students when class changes
  useEffect(() => {
    if (!classId) { setStudents([]); setStudentId(''); return }
    ;(async () => {
      const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select('student_id, students(id, full_name)')
        .eq('class_id', classId)

      const list = (enrollments || [])
        .map((e: any) => e.students)
        .filter(Boolean)
        .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name))

      setStudents(list)
      if (list.length > 0) setStudentId(list[0].id)
      else setStudentId('')

      // Check if class teacher
      const cls = classes.find((c) => c.id === classId)
      setIsClassTeacher(cls?.class_teacher_id === teacherId)
    })()
  }, [classId, teacherId])

  // Fetch report card
  useEffect(() => {
    if (!termId || !studentId) { setReport(null); return }
    ;(async () => {
      setFetching(true)
      setError('')
      setReport(null)
      setRemarkSaved(false)
      try {
        const res = await fetch(`/api/results/report-card?student_id=${studentId}&term_id=${termId}`)
        const js = await res.json()
        if (!res.ok) throw new Error(js.error || 'Failed to load report card')
        setReport(js.report)
        setRemark(js.report.class_teacher_remark || '')
      } catch (e: any) {
        setError(e.message)
      } finally {
        setFetching(false)
      }
    })()
  }, [termId, studentId])

  const handleSaveRemark = async () => {
    if (!studentId || !classId || !termId) return
    setSavingRemark(true)
    setRemarkSaved(false)
    try {
      const res = await fetch('/api/results/report-card', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          class_id: classId,
          term_id: termId,
          class_teacher_remark: remark,
        }),
      })
      const js = await res.json()
      if (!res.ok) throw new Error(js.error || 'Failed to save remark')
      setRemarkSaved(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSavingRemark(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Card</h1>
          <p className="text-gray-500 text-sm">View and print student report cards</p>
        </div>
        {report && (
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 print:hidden"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm print:hidden">{error}</div>}

      {/* Selectors */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex flex-wrap gap-4 items-end print:hidden">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Term</label>
          <select
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
            className="border rounded px-3 py-2 text-sm min-w-[160px]"
          >
            <option value="">Select term</option>
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="border rounded px-3 py-2 text-sm min-w-[160px]"
          >
            <option value="">Select class</option>
            {classes.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.class_level || c.name}{c.class_teacher_id === teacherId ? ' (Class Teacher)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Student</label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="border rounded px-3 py-2 text-sm min-w-[200px]"
          >
            <option value="">Select student</option>
            {students.map((s: any) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {fetching && <div className="text-center py-12 text-gray-500 print:hidden">Loading report card...</div>}

      {report && !fetching && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden" id="report-card">
          {/* School Header */}
          <div className="text-center py-6 border-b bg-gradient-to-b from-blue-50 to-white">
            <h2 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">Student Report Card</h2>
            <p className="text-sm text-gray-600 mt-1">
              {report.term?.session} — {report.term?.name}
            </p>
          </div>

          {/* Student Demographics */}
          <div className="p-6 border-b">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500 block text-xs uppercase tracking-wide">Student Name</span>
                <span className="font-semibold text-gray-900">{report.student.full_name}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs uppercase tracking-wide">Class</span>
                <span className="font-semibold text-gray-900">{report.class?.name || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs uppercase tracking-wide">Gender</span>
                <span className="font-semibold text-gray-900">{report.student.gender || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs uppercase tracking-wide">Admission No.</span>
                <span className="font-semibold text-gray-900">{report.student.admission || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs uppercase tracking-wide">Date of Birth</span>
                <span className="font-semibold text-gray-900">{report.student.dob || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs uppercase tracking-wide">Guardian</span>
                <span className="font-semibold text-gray-900">{report.student.guardian_name || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs uppercase tracking-wide">Guardian Phone</span>
                <span className="font-semibold text-gray-900">{report.student.guardian_phone || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs uppercase tracking-wide">Term</span>
                <span className="font-semibold text-gray-900">{report.term?.name}</span>
              </div>
            </div>
          </div>

          {/* Subjects Table */}
          <div className="p-6 border-b">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Academic Performance</h3>
            {report.subjects.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No scores recorded for this term.</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">S/N</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Subject</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700">CA /40</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700">Exam /60</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700">Total /100</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700">Grade</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {report.subjects.map((sub: any, idx: number) => (
                    <tr key={sub.subject_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-3 py-2 text-center">{idx + 1}</td>
                      <td className="border border-gray-300 px-3 py-2 font-medium">{sub.subject_name}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">{sub.ca_score}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">{sub.exam_score}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center font-semibold">{sub.total}</td>
                      <td className={`border border-gray-300 px-3 py-2 text-center font-bold ${
                        sub.grade === 'F9' ? 'text-red-600' : sub.grade.startsWith('A') ? 'text-green-600' : 'text-gray-800'
                      }`}>{sub.grade}</td>
                      <td className="border border-gray-300 px-3 py-2">{sub.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Summary */}
          <div className="p-6 border-b">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 uppercase tracking-wide">Subjects</p>
                <p className="text-2xl font-bold text-blue-900">{report.summary.subject_count}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-green-600 uppercase tracking-wide">Total Marks</p>
                <p className="text-2xl font-bold text-green-900">{report.summary.total_marks}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-xs text-purple-600 uppercase tracking-wide">Average</p>
                <p className="text-2xl font-bold text-purple-900">{report.summary.average}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <p className="text-xs text-orange-600 uppercase tracking-wide">Position</p>
                <p className="text-2xl font-bold text-orange-900">
                  {report.summary.position}<sup className="text-xs">{getOrdinal(report.summary.position)}</sup>
                </p>
              </div>
            </div>
          </div>

          {/* Attendance Summary */}
          <div className="p-6 border-b">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Attendance Summary</h3>
            <div className="grid grid-cols-4 gap-4 text-center text-sm">
              <div>
                <p className="text-gray-500 text-xs">Total Days</p>
                <p className="font-bold text-gray-900">{report.attendance.total}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Present</p>
                <p className="font-bold text-emerald-600">{report.attendance.present}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Absent</p>
                <p className="font-bold text-red-600">{report.attendance.absent}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Late</p>
                <p className="font-bold text-amber-600">{report.attendance.late}</p>
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div className="p-6 border-b">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Remarks</h3>
            <div className="space-y-4">
              {/* Class Teacher Remark */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Class Teacher&apos;s Remark {report.class_teacher_name && <span className="text-gray-400">({report.class_teacher_name})</span>}
                </label>
                {isClassTeacher ? (
                  <div className="flex gap-2 print:hidden">
                    <textarea
                      value={remark}
                      onChange={(e) => { setRemark(e.target.value); setRemarkSaved(false) }}
                      rows={2}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                      placeholder="Enter remark..."
                    />
                    <button
                      onClick={handleSaveRemark}
                      disabled={savingRemark}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 self-end"
                    >
                      {remarkSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                      {savingRemark ? 'Saving...' : remarkSaved ? 'Saved' : 'Save'}
                    </button>
                  </div>
                ) : null}
                {/* Print-visible remark text */}
                <p className={`text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 min-h-[40px] ${isClassTeacher ? 'hidden print:block' : ''}`}>
                  {report.class_teacher_remark || '—'}
                </p>
              </div>

              {/* Principal Remark */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Principal&apos;s Remark</label>
                <p className="text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 min-h-[40px]">
                  {report.principal_remark || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="p-6">
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <div className="border-t border-gray-400 pt-2 mt-12">
                  <p className="text-sm font-medium text-gray-700">Class Teacher&apos;s Signature</p>
                  <p className="text-xs text-gray-500">{report.class_teacher_name || ''}</p>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-400 pt-2 mt-12">
                  <p className="text-sm font-medium text-gray-700">Principal&apos;s Signature</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!report && !fetching && studentId && termId && (
        <div className="text-center py-12 text-gray-400">No report data found for this student and term.</div>
      )}
      {(!studentId || !termId) && !fetching && (
        <div className="text-center py-12 text-gray-400 print:hidden">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p>Select a term, class, and student to view the report card.</p>
        </div>
      )}
    </div>
  )
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}
