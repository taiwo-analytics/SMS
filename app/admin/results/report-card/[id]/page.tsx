'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import ReportCardTemplate from '@/components/ReportCardTemplate'
import SchoolLoader from '@/components/SchoolLoader'

export default function AdminReportCardPage() {
  const params = useParams()
  const router = useRouter()
  const search = useSearchParams()
  const studentId = String(params.id || '')
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<any | null>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [sessionId, setSessionId] = useState<string>('')
  const [allTerms, setAllTerms] = useState<any[]>([])
  const [terms, setTerms] = useState<any[]>([])
  const [termId, setTermId] = useState<string>(search.get('term_id') || '')
  const [principalRemark, setPrincipalRemark] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const [{ data: sessionsData }, { data: termsData }] = await Promise.all([
          supabase.from('academic_sessions').select('*').order('created_at', { ascending: false }),
          supabase.from('academic_terms').select('*').order('created_at', { ascending: false }),
        ])
        setSessions(sessionsData || [])
        setAllTerms(termsData || [])

        const preselectedTermId = search.get('term_id') || ''
        if (preselectedTermId) {
          const matched = (termsData || []).find((t: any) => t.id === preselectedTermId)
          if (matched?.session_id) {
            setSessionId(matched.session_id)
            setTerms((termsData || []).filter((t: any) => t.session_id === matched.session_id))
            setTermId(preselectedTermId)
            return
          }
        }

        const activeSession = (sessionsData || []).find((s: any) => s.is_active)
        if (activeSession) {
          setSessionId(activeSession.id)
          const filtered = (termsData || []).filter((t: any) => t.session_id === activeSession.id)
          setTerms(filtered)
          const activeTerm = filtered.find((t: any) => t.is_active)
          if (activeTerm) setTermId(activeTerm.id)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!sessionId) { setTerms([]); setTermId(''); return }
    const filtered = allTerms.filter((t: any) => t.session_id === sessionId)
    setTerms(filtered)
    setTermId('')
  }, [sessionId])

  useEffect(() => {
    if (!studentId || !termId) return
    ;(async () => {
      try {
        const res = await fetch(`/api/results/report-card?student_id=${studentId}&term_id=${termId}`)
        const js = await res.json()
        if (res.ok) {
          let enriched = js.report
          try {
            const classId = enriched?.class?.id
            if (classId) {
              const res2 = await fetch(`/api/results/broadsheet?class_id=${classId}&term_id=${termId}&view=subjects`)
              const js2 = await res2.json()
              if (res2.ok && Array.isArray(js2.rows) && Array.isArray(js2.students)) {
                const rows = js2.rows as Array<{ subject: any; cells: Record<string, any> }>
                const bySub: Record<string, { highs: number; lows: number; avg: number; positionOfStudent: number }> = {}
                for (const row of rows) {
                  const sid = row.subject?.id
                  if (!sid) continue
                  const totals: number[] = []
                  for (const [, cell] of Object.entries(row.cells || {})) {
                    if (cell && typeof cell.total === 'number') totals.push(Number(cell.total))
                  }
                  if (totals.length === 0) continue
                  totals.sort((a, b) => b - a)
                  const highest = totals[0]
                  const lowest = totals[totals.length - 1]
                  const avg = totals.reduce((a, b) => a + b, 0) / totals.length
                  let pos = 0
                  const myTotal = (row.cells?.[studentId]?.total ?? null)
                  if (myTotal !== null && myTotal !== undefined) {
                    pos = totals.findIndex((x) => x === Number(myTotal)) + 1
                  }
                  bySub[sid] = { highs: highest, lows: lowest, avg: Math.round(avg * 100) / 100, positionOfStudent: pos }
                }
                if (Array.isArray(enriched?.subjects)) {
                  enriched = {
                    ...enriched,
                    subjects: enriched.subjects.map((s: any) => {
                      const stats = bySub[s.subject_id] || null
                      return {
                        ...s,
                        subject_highest: stats ? stats.highs : null,
                        subject_lowest: stats ? stats.lows : null,
                        subject_average: stats ? stats.avg : null,
                        subject_position: stats ? stats.positionOfStudent : null,
                      }
                    }),
                  }
                }
              }
            }
          } catch {}
          setReport(enriched)
          setPrincipalRemark(enriched?.principal_remark || '')
        }
      } catch (e) {}
    })()
  }, [studentId, termId])

  const savePrincipalRemark = async () => {
    if (!report?.class?.id) return
    setSaving(true)
    try {
      const res = await fetch('/api/results/report-card', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          class_id: report.class.id,
          term_id: termId,
          principal_remark: principalRemark,
        }),
      })
      const js = await res.json()
      if (!res.ok) throw new Error(js.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleUploadSignature = async (file: File, type: 'class_teacher' | 'principal') => {
    if (!report?.class?.id || !termId) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('class_id', report.class.id)
    formData.append('term_id', termId)
    formData.append('type', type)
    try {
      const res = await fetch('/api/results/signature', { method: 'POST', body: formData })
      const js = await res.json()
      if (!res.ok) throw new Error(js.error || 'Failed to upload signature')
      if (report) {
        const field = type === 'class_teacher' ? 'class_teacher_signature_url' : 'principal_signature_url'
        setReport({ ...report, [field]: js.signature_url })
      }
    } catch (e: any) {
      // silently fail for now
    }
  }

  if (loading) return <SchoolLoader />

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Controls bar */}
      <div className="no-print sticky top-0 bg-white border-b z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => {
              const returnTo = search.get('return_to')
              const backClassId = search.get('class_id')
              if (returnTo) {
                router.push(returnTo)
              } else if (backClassId) {
                router.push(`/admin/results/report-card?class_id=${backClassId}`)
              } else {
                router.push('/admin/results/report-card')
              }
            }}
            className="px-3 py-2 border rounded text-sm hover:bg-gray-50"
          >
            ← Back
          </button>
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="">Select session</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              className="px-3 py-2 border rounded text-sm"
              disabled={!sessionId}
            >
              <option value="">Select term</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-blue-700 text-white rounded text-sm font-semibold hover:bg-blue-800"
            >
              Print / PDF
            </button>
          </div>
        </div>
      </div>

      {report ? (
        <ReportCardTemplate
          report={report}
          isAdmin={true}
          principalRemark={principalRemark}
          onPrincipalRemarkChange={setPrincipalRemark}
          onSavePrincipalRemark={savePrincipalRemark}
          savingPrincipalRemark={saving}
          onUploadSignature={handleUploadSignature}
        />
      ) : (
        <div className="max-w-4xl mx-auto my-6">
          <div className="bg-white shadow-lg p-8 text-center py-16 text-gray-400" style={{ fontSize: 13 }}>
            {termId ? 'No report data found for this student and term.' : 'Please select a session and term above.'}
          </div>
        </div>
      )}
    </div>
  )
}
