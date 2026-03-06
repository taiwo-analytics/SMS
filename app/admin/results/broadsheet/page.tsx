'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function BroadsheetPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [terms, setTerms] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [sessionId, setSessionId] = useState('')
  const [termId, setTermId] = useState('')
  const [classId, setClassId] = useState('')
  const [view, setView] = useState<'students' | 'subjects'>('students')
  const [broadsheet, setBroadsheet] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setLoadError('')
    Promise.all([
      supabase.from('academic_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('classes').select('*').order('name'),
    ]).then(([sessionsRes, classesRes]) => {
      let err = ''
      if (sessionsRes.error) err += `Sessions: ${sessionsRes.error.message}`
      else setSessions(sessionsRes.data || [])
      if (classesRes.error) err += (err ? ` | ` : '') + `Classes: ${classesRes.error!.message}`
      else setClasses(classesRes.data || [])
      setLoadError(err)
    })
  }, [])

  useEffect(() => {
    if (!sessionId) { setTerms([]); setTermId(''); return }
    supabase.from('academic_terms').select('*').eq('session_id', sessionId).order('name').then(({ data }) => {
      setTerms(data || [])
      setTermId('')
    })
  }, [sessionId])

  const fetchBroadsheet = async () => {
    if (!classId || !termId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/results/broadsheet?class_id=${classId}&term_id=${termId}&view=${view}`)
      const js = await res.json()
      if (!res.ok) throw new Error(js.error || 'Failed to load')
      setBroadsheet(js)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (classId && termId) fetchBroadsheet()
  }, [classId, termId, view])

  const exportCSV = () => {
    if (!broadsheet) return
    const rows: string[][] = []
    if (broadsheet.view === 'students') {
      const headers = ['Student', ...broadsheet.subjects.map((s: any) => s.name), 'Total', 'Average', 'Position']
      rows.push(headers)
      for (const row of broadsheet.rows) {
        const cells = broadsheet.subjects.map((s: any) => {
          const c = row.cells[s.id]
          return c ? `${c.total} (${c.grade})` : '-'
        })
        rows.push([row.student.name, ...cells, row.totalSum, row.average, row.position])
      }
    } else {
      const headers = ['Subject', ...broadsheet.students.map((s: any) => s.name)]
      rows.push(headers)
      for (const row of broadsheet.rows) {
        const cells = broadsheet.students.map((s: any) => {
          const c = row.cells[s.id]
          return c ? `${c.total} (${c.grade})` : '-'
        })
        rows.push([row.subject.name, ...cells])
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'broadsheet.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectedClass = classes.find((c) => c.id === classId)
  const selectedTerm = terms.find((t) => t.id === termId)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Class Broadsheet</h1>
        <p className="text-gray-500 text-sm">Full results table by class and term</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Session</label>
          <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="border rounded px-3 py-2 text-sm min-w-[140px]">
            <option value="">Select session</option>
            {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Term</label>
          <select value={termId} onChange={(e) => setTermId(e.target.value)} className="border rounded px-3 py-2 text-sm min-w-[140px]" disabled={!sessionId}>
            <option value="">Select term</option>
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="border rounded px-3 py-2 text-sm min-w-[140px]">
            <option value="">Select class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">View</label>
          <select value={view} onChange={(e) => setView(e.target.value as any)} className="border rounded px-3 py-2 text-sm">
            <option value="students">By Students</option>
            <option value="subjects">By Subjects</option>
          </select>
        </div>
        {broadsheet && (
          <button onClick={exportCSV} className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700">
            Export CSV
          </button>
        )}
      </div>

      {loadError && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-4 mb-4">Filter load error: {loadError}</div>}
      {loading && <div className="text-center py-12 text-gray-500">Loading broadsheet...</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-4 mb-4">{error}</div>}

      {broadsheet && !loading && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-800">
              {selectedClass?.name} — {selectedTerm?.name}
            </h2>
          </div>
          <div className="overflow-x-auto">
            {broadsheet.view === 'students' ? (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 sticky left-0 bg-gray-50 min-w-[160px]">Student</th>
                    {broadsheet.subjects.map((s: any) => (
                      <th key={s.id} className="px-3 py-3 text-center font-semibold text-gray-700 min-w-[100px]">
                        <div>{s.name}</div>
                        <div className="text-xs font-normal text-gray-400">/100</div>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">Total</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">Avg</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">Pos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {broadsheet.rows.map((row: any) => (
                    <tr key={row.student.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900 sticky left-0 bg-white">{row.student.name}</td>
                      {broadsheet.subjects.map((s: any) => {
                        const c = row.cells[s.id]
                        return (
                          <td key={s.id} className="px-3 py-2 text-center">
                            {c ? (
                              <span className={`font-medium ${c.grade === 'F9' ? 'text-red-600' : c.grade.startsWith('A') ? 'text-green-600' : 'text-gray-800'}`}>
                                {c.total} <span className="text-xs text-gray-500">({c.grade})</span>
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-center font-semibold">{row.totalSum}</td>
                      <td className="px-3 py-2 text-center">{row.average}</td>
                      <td className="px-3 py-2 text-center font-bold text-blue-600">{row.position}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 sticky left-0 bg-gray-50 min-w-[140px]">Subject</th>
                    {broadsheet.students.map((s: any) => (
                      <th key={s.id} className="px-3 py-3 text-center font-semibold text-gray-700 min-w-[100px]">{s.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {broadsheet.rows.map((row: any) => (
                    <tr key={row.subject.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900 sticky left-0 bg-white">{row.subject.name}</td>
                      {broadsheet.students.map((s: any) => {
                        const c = row.cells[s.id]
                        return (
                          <td key={s.id} className="px-3 py-2 text-center">
                            {c ? (
                              <span className={`font-medium ${c.grade === 'F9' ? 'text-red-600' : c.grade.startsWith('A') ? 'text-green-600' : 'text-gray-800'}`}>
                                {c.total} <span className="text-xs text-gray-500">({c.grade})</span>
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {!broadsheet && !loading && classId && termId && (
        <div className="text-center py-16 text-gray-400">No scores found for this class and term.</div>
      )}
      {!classId || !termId ? (
        <div className="text-center py-16 text-gray-400">Select a session, term, and class to view the broadsheet.</div>
      ) : null}
    </div>
  )
}
