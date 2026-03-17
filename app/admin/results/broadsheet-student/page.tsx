'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import SchoolLoader from '@/components/SchoolLoader'

export default function BroadsheetByStudentPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [terms, setTerms] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [sessionId, setSessionId] = useState('')
  const [termId, setTermId] = useState('')
  const [classId, setClassId] = useState('')
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('academic_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('classes').select('*').order('name'),
    ]).then(([sessionsRes, classesRes]) => {
      if (sessionsRes.data) setSessions(sessionsRes.data)
      if (classesRes.data) setClasses(classesRes.data)
    })
  }, [])

  useEffect(() => {
    if (!sessionId) { setTerms([]); setTermId(''); return }
    supabase.from('academic_terms').select('*').eq('session_id', sessionId).order('name').then(({ data }) => {
      setTerms(data || [])
      setTermId('')
    })
  }, [sessionId])

  const fetchData = async () => {
    if (!classId || !termId) return
    setLoading(true)
    setError('')
    setSelectedStudentId(null)
    try {
      const res = await fetch(`/api/results/broadsheet?class_id=${classId}&term_id=${termId}&view=students`)
      const js = await res.json()
      if (!res.ok) throw new Error(js.error || 'Failed to load')
      setData(js)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (classId && termId) fetchData()
  }, [classId, termId])

  const selectedClass = classes.find((c) => c.id === classId)
  const selectedTerm = terms.find((t) => t.id === termId)
  const selectedStudentRow = data?.rows?.find((r: any) => r.student.id === selectedStudentId)

  const getGradeColor = (grade: string) => {
    if (!grade) return 'text-gray-400'
    if (grade === 'F') return 'text-red-600'
    if (grade === 'A') return 'text-green-600'
    if (grade.startsWith('B')) return 'text-blue-600'
    return 'text-gray-700'
  }

  const getRowBg = (grade: string) => {
    if (!grade) return ''
    if (grade === 'F') return 'bg-red-50'
    if (grade === 'A') return 'bg-green-50'
    return ''
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Broadsheet by Student</h1>
        <p className="text-gray-500 text-sm">View each student&apos;s full subject results for a term</p>
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
      </div>

      {loading && <SchoolLoader />}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-4 mb-4">{error}</div>}

      {data && !loading && (
        <div className="flex gap-6">
          {/* Student list */}
          <div className="w-64 shrink-0">
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {selectedClass?.name} — {selectedTerm?.name}
                </p>
                <p className="text-sm font-medium text-gray-700 mt-0.5">{data.rows.length} Students</p>
              </div>
              <ul className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {data.rows.map((row: any) => (
                  <li key={row.student.id}>
                    <button
                      onClick={() => setSelectedStudentId(row.student.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${selectedStudentId === row.student.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''}`}
                    >
                      <div className="font-medium text-sm text-gray-800">{row.student.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">Avg: {row.average}</span>
                        <span className="text-xs font-semibold text-blue-600">#{row.position}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Student detail */}
          <div className="flex-1">
            {!selectedStudentId ? (
              <div className="bg-white rounded-xl shadow-sm border flex items-center justify-center h-64">
                <p className="text-gray-400 text-sm">Select a student to view their results</p>
              </div>
            ) : selectedStudentRow ? (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                {/* Student header */}
                <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{selectedStudentRow.student.name}</h2>
                      <p className="text-sm text-gray-500">{selectedClass?.name} · {selectedTerm?.name}</p>
                    </div>
                    <div className="flex gap-4 text-center">
                      <div className="bg-white rounded-lg px-4 py-2 shadow-sm border">
                        <div className="text-xs text-gray-500">Position</div>
                        <div className="text-xl font-bold text-blue-600">#{selectedStudentRow.position}</div>
                      </div>
                      <div className="bg-white rounded-lg px-4 py-2 shadow-sm border">
                        <div className="text-xs text-gray-500">Average</div>
                        <div className="text-xl font-bold text-gray-800">{selectedStudentRow.average}</div>
                      </div>
                      <div className="bg-white rounded-lg px-4 py-2 shadow-sm border">
                        <div className="text-xs text-gray-500">Total</div>
                        <div className="text-xl font-bold text-gray-800">{selectedStudentRow.totalSum}</div>
                      </div>
                      <div className="bg-white rounded-lg px-4 py-2 shadow-sm border">
                        <div className="text-xs text-gray-500">Subjects</div>
                        <div className="text-xl font-bold text-gray-800">{selectedStudentRow.subjectCount}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scores table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-3 text-left font-semibold text-gray-600">Subject</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-600 w-20">CA1</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-600 w-20">CA2</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-600 w-24">Exam</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-600 w-24">Total</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-600 w-20">Grade</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600 w-28">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.subjects.map((subject: any) => {
                        const cell = selectedStudentRow.cells[subject.id]
                        return (
                          <tr key={subject.id} className={`hover:bg-gray-50 ${cell ? getRowBg(cell.grade) : ''}`}>
                            <td className="px-5 py-3 font-medium text-gray-800">{subject.name}</td>
                            <td className="px-4 py-3 text-center text-gray-600">
                              {cell ? cell.ca1 : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600">
                              {cell ? cell.ca2 : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600">
                              {cell ? cell.exam : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-gray-800">
                              {cell ? cell.total : <span className="text-gray-300">—</span>}
                            </td>
                            <td className={`px-4 py-3 text-center font-bold ${cell?.grade ? getGradeColor(cell.grade) : 'text-gray-300'}`}>
                              {cell?.grade || <span className="text-gray-300">—</span>}
                            </td>
                            <td className={`px-4 py-3 text-sm ${cell?.grade ? getGradeColor(cell.grade) : ''}`}>
                              {cell?.remark || <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td className="px-5 py-3 font-bold text-gray-700">Total / Average</td>
                        <td className="px-4 py-3 text-center text-gray-500 text-xs">—</td>
                        <td className="px-4 py-3 text-center text-gray-500 text-xs">—</td>
                        <td className="px-4 py-3 text-center text-gray-500 text-xs">—</td>
                        <td className="px-4 py-3 text-center font-bold text-gray-900">{selectedStudentRow.totalSum}</td>
                        <td className="px-4 py-3 text-center font-bold text-gray-900">{selectedStudentRow.average}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {selectedStudentRow.subjectCount} subject{selectedStudentRow.subjectCount !== 1 ? 's' : ''}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {!data && !loading && (!classId || !termId) && (
        <div className="text-center py-16 text-gray-400">Select a session, term, and class to view results.</div>
      )}
    </div>
  )
}
