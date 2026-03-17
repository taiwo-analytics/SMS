'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import SchoolLoader from '@/components/SchoolLoader'

export default function ReportCardPage() {
  const params = useParams()
  const router = useRouter()
  const search = useSearchParams()
  const studentId = String(params.id || '')
  const [loading, setLoading] = useState(true)
  const [schoolName, setSchoolName] = useState('School Management System')
  const [report, setReport] = useState<any | null>(null)
  const [terms, setTerms] = useState<any[]>([])
  const [termId, setTermId] = useState<string>(search.get('term_id') || '')

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
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const loadReport = async (sid: string, tid?: string) => {
    const url = new URL(window.location.origin + '/api/admin/students/report')
    url.searchParams.set('student_id', sid)
    if (tid) url.searchParams.set('term_id', tid)
    const res = await fetch(url.toString())
    const js = await res.json()
    if (!res.ok) throw new Error(js.error || 'Failed to load report')
    setReport(js.report || null)
  }

  useEffect(() => {
    if (!studentId) return
    ;(async () => {
      try {
        await loadReport(studentId, termId || undefined)
      } catch (e) {
        // ignore for now; page shows empty
      }
    })()
  }, [studentId, termId])

  const onPrint = () => {
    window.print()
  }

  const subjects = useMemo(() => report?.subjects || [], [report])

  if (loading) {
    return <SchoolLoader />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4; margin: 16mm; }
        }
      `}</style>
      <div className="no-print sticky top-0 bg-white border-b z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/admin/students')} className="px-3 py-2 border rounded">Back</button>
          <div className="ml-auto flex items-center gap-3">
            <select value={termId} onChange={(e) => setTermId(e.target.value)} className="px-3 py-2 border rounded">
              <option value="">All terms</option>
              {terms.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
            <button onClick={onPrint} className="px-4 py-2 bg-indigo-600 text-white rounded">Download PDF</button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto bg-white shadow print:shadow-none my-6 p-8">
        <header className="text-center mb-6">
          <h1 className="text-2xl font-extrabold tracking-wide">{schoolName}</h1>
          <div className="text-sm text-gray-600">Student Report Card</div>
        </header>

        {/* Student info */}
        <section className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-sm">
            <div><span className="font-semibold">Name:</span> {report?.student?.full_name || '—'}</div>
            <div><span className="font-semibold">Age:</span> {report?.student?.age ?? '—'}</div>
            <div><span className="font-semibold">Gender:</span> {report?.student?.gender || '—'}</div>
          </div>
          <div className="text-sm">
            <div><span className="font-semibold">Class:</span> {report?.class?.class_level || '—'}</div>
            <div><span className="font-semibold">Department:</span> {report?.class?.department || '—'}</div>
            <div><span className="font-semibold">Average %:</span> {report?.grades?.average_percent ?? 0}</div>
          </div>
        </section>

        {/* Subjects */}
        <section className="mb-6">
          <div className="font-semibold mb-2">Subjects</div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border px-3 py-2 text-left">Subject</th>
                <th className="border px-3 py-2 text-left">Code</th>
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 ? (
                <tr><td colSpan={2} className="border px-3 py-4 text-center text-gray-500">No subjects</td></tr>
              ) : subjects.map((s: any) => (
                <tr key={s.id}>
                  <td className="border px-3 py-2">{s.name}</td>
                  <td className="border px-3 py-2">{s.code || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Summary */}
        <section className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div><span className="font-semibold">Grades Recorded:</span> {report?.grades?.count ?? 0}</div>
            <div><span className="font-semibold">Average Percentage:</span> {report?.grades?.average_percent ?? 0}%</div>
          </div>
          <div className="space-y-1">
            <div><span className="font-semibold">Latest Payment Status:</span> {report?.payments?.status || '—'}</div>
            <div><span className="font-semibold">Latest Payment Date:</span> {report?.payments?.created_at ? new Date(report.payments.created_at).toLocaleDateString() : '—'}</div>
          </div>
        </section>

        <footer className="mt-8 text-xs text-gray-500 text-center">
          Generated on {new Date().toLocaleString()}
        </footer>
      </main>
    </div>
  )
}
