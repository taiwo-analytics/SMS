'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function AdminReportCardPage() {
  const params = useParams()
  const router = useRouter()
  const search = useSearchParams()
  const studentId = String(params.id || '')
  const [loading, setLoading] = useState(true)
  const [schoolName, setSchoolName] = useState('School Management System')
  const [report, setReport] = useState<any | null>(null)
  const [terms, setTerms] = useState<any[]>([])
  const [termId, setTermId] = useState<string>(search.get('term_id') || '')
  const [principalRemark, setPrincipalRemark] = useState('')
  const [saving, setSaving] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ;(async () => {
      try {
        try {
          const res = await fetch('/api/settings')
          const js = await res.json()
          if (js?.settings?.schoolName) setSchoolName(js.settings.schoolName)
        } catch {}
        const { data: termsData } = await supabase.from('academic_terms').select('*').order('created_at', { ascending: false })
        setTerms(termsData || [])
        // set active term if no termId
        if (!termId) {
          const active = (termsData || []).find((t: any) => t.is_active)
          if (active) setTermId(active.id)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!studentId || !termId) return
    ;(async () => {
      try {
        const res = await fetch(`/api/results/report-card?student_id=${studentId}&term_id=${termId}`)
        const js = await res.json()
        if (res.ok) {
          setReport(js.report)
          setPrincipalRemark(js.report?.principal_remark || '')
        }
      } catch {}
    })()
  }, [studentId, termId])

  const onPrint = () => window.print()

  const savePrincipalRemark = async () => {
    if (!report?.class?.id) return
    setSaving(true)
    try {
      await fetch('/api/results/report-card', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          class_id: report.class.id,
          term_id: termId,
          principal_remark: principalRemark,
        }),
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4; margin: 16mm; }
        }
      `}</style>

      {/* Controls */}
      <div className="no-print sticky top-0 bg-white border-b z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <button onClick={() => router.back()} className="px-3 py-2 border rounded text-sm">← Back</button>
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            <select value={termId} onChange={(e) => setTermId(e.target.value)} className="px-3 py-2 border rounded text-sm">
              <option value="">Select term</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={onPrint} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium">
              Print / Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Report Card */}
      <div ref={printRef} className="max-w-4xl mx-auto bg-white shadow print:shadow-none my-6 p-8 print:my-0 print:p-4">
        {/* Header */}
        <header className="text-center mb-6 border-b pb-4">
          <h1 className="text-2xl font-extrabold tracking-wide uppercase">{schoolName}</h1>
          <p className="text-base font-semibold text-gray-700 mt-1">STUDENT TERMINAL REPORT CARD</p>
          {report?.term && (
            <p className="text-sm text-gray-500 mt-1">
              {report.term.session} — {report.term.name}
            </p>
          )}
        </header>

        {report ? (
          <>
            {/* Bio Section */}
            <section className="grid grid-cols-3 gap-4 mb-6 pb-4 border-b">
              <div className="col-span-2 space-y-1 text-sm">
                <div><span className="font-semibold w-32 inline-block">Student Name:</span> {report.student.full_name}</div>
                <div><span className="font-semibold w-32 inline-block">Class:</span> {report.class?.name || '—'}</div>
                <div><span className="font-semibold w-32 inline-block">Term:</span> {report.term?.name} / {report.term?.session}</div>
                <div><span className="font-semibold w-32 inline-block">Gender:</span> {report.student.gender || '—'}</div>
                <div><span className="font-semibold w-32 inline-block">Date of Birth:</span> {report.student.dob ? new Date(report.student.dob).toLocaleDateString() : '—'}</div>
                <div><span className="font-semibold w-32 inline-block">Guardian:</span> {report.student.guardian_name || '—'}</div>
                <div><span className="font-semibold w-32 inline-block">Admission No:</span> {report.student.admission || '—'}</div>
              </div>
              <div className="flex justify-center items-start">
                {report.student.photo_url ? (
                  <img src={report.student.photo_url} alt="Student" className="w-24 h-28 object-cover rounded border" />
                ) : (
                  <div className="w-24 h-28 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-400">No Photo</div>
                )}
              </div>
            </section>

            {/* Results Table */}
            <section className="mb-6">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="border border-gray-600 px-3 py-2 text-left">Subject</th>
                    <th className="border border-gray-600 px-3 py-2 text-center">CA (40)</th>
                    <th className="border border-gray-600 px-3 py-2 text-center">Exam (60)</th>
                    <th className="border border-gray-600 px-3 py-2 text-center">Total (100)</th>
                    <th className="border border-gray-600 px-3 py-2 text-center">Grade</th>
                    <th className="border border-gray-600 px-3 py-2 text-center">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {report.subjects.map((sub: any, i: number) => (
                    <tr key={sub.subject_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-200 px-3 py-2 font-medium">{sub.subject_name}</td>
                      <td className="border border-gray-200 px-3 py-2 text-center">{sub.ca_score}</td>
                      <td className="border border-gray-200 px-3 py-2 text-center">{sub.exam_score}</td>
                      <td className="border border-gray-200 px-3 py-2 text-center font-semibold">{sub.total}</td>
                      <td className={`border border-gray-200 px-3 py-2 text-center font-bold ${
                        sub.grade === 'F9' ? 'text-red-600' : sub.grade.startsWith('A') ? 'text-green-600' : 'text-gray-800'
                      }`}>{sub.grade}</td>
                      <td className="border border-gray-200 px-3 py-2 text-center text-gray-600">{sub.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Summary */}
            <section className="grid grid-cols-2 gap-6 mb-6 pb-4 border-b">
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Summary</h3>
                <div className="text-sm space-y-1">
                  <div><span className="font-medium w-40 inline-block">Total Marks:</span> {report.summary.total_marks}</div>
                  <div><span className="font-medium w-40 inline-block">Average:</span> {report.summary.average}%</div>
                  <div><span className="font-medium w-40 inline-block">Position in Class:</span> <span className="font-bold text-blue-700">{report.summary.position}</span></div>
                  <div><span className="font-medium w-40 inline-block">No. of Subjects:</span> {report.summary.subject_count}</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Attendance</h3>
                <div className="text-sm space-y-1">
                  <div><span className="font-medium w-28 inline-block">Days Present:</span> {report.attendance.present}</div>
                  <div><span className="font-medium w-28 inline-block">Days Absent:</span> {report.attendance.absent}</div>
                  <div><span className="font-medium w-28 inline-block">Total Days:</span> {report.attendance.total}</div>
                </div>
              </div>
            </section>

            {/* Grade Scale */}
            <section className="mb-6 text-xs text-gray-500">
              <span className="font-semibold text-gray-700">Grade Scale: </span>
              A1 (75–100) • B2 (70–74) • B3 (65–69) • C4 (60–64) • C5 (55–59) • C6 (50–54) • D7 (45–49) • E8 (40–44) • F9 (0–39)
            </section>

            {/* Remarks */}
            <section className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Class Teacher's Remark:</p>
                <div className="border rounded p-2 min-h-[60px] text-sm text-gray-700 bg-gray-50">
                  {report.class_teacher_remark || <span className="text-gray-400 italic">No remark</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">{report.class_teacher_name || '—'}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Principal's Remark:</p>
                <textarea
                  value={principalRemark}
                  onChange={(e) => setPrincipalRemark(e.target.value)}
                  className="no-print w-full border rounded p-2 text-sm min-h-[60px]"
                  placeholder="Enter principal's remark..."
                />
                <div className="hidden print:block border rounded p-2 min-h-[60px] text-sm text-gray-700 bg-gray-50">
                  {principalRemark || <span className="text-gray-400 italic">No remark</span>}
                </div>
                <button onClick={savePrincipalRemark} disabled={saving} className="no-print mt-1 px-3 py-1 bg-blue-600 text-white rounded text-xs">
                  {saving ? 'Saving...' : 'Save Remark'}
                </button>
              </div>
            </section>

            {/* Signature line */}
            <section className="grid grid-cols-2 gap-8 mt-8 pt-4 border-t">
              <div className="text-center">
                <div className="border-t border-gray-400 mt-8 pt-1 text-xs text-gray-600">Class Teacher's Signature</div>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-400 mt-8 pt-1 text-xs text-gray-600">Principal's Signature</div>
              </div>
            </section>
          </>
        ) : (
          <div className="text-center py-16 text-gray-400">
            {termId ? 'No report data available for this student and term.' : 'Please select a term above.'}
          </div>
        )}
      </div>
    </div>
  )
}
