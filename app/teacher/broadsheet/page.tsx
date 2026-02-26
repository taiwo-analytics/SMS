'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function TeacherBroadsheetPage() {
  const [loading, setLoading] = useState(true)
  const [teacherId, setTeacherId] = useState('')
  const [isClassTeacher, setIsClassTeacher] = useState(false)
  const [myClassIds, setMyClassIds] = useState<string[]>([]) // classes I teach (any subject)
  const [classTeacherIds, setClassTeacherIds] = useState<string[]>([]) // classes where I'm class teacher
  const [allClasses, setAllClasses] = useState<any[]>([])
  const [terms, setTerms] = useState<any[]>([])
  const [classId, setClassId] = useState('')
  const [termId, setTermId] = useState('')
  const [broadsheet, setBroadsheet] = useState<any | null>(null)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: teacher } = await supabase.from('teachers').select('id').eq('user_id', user.id).single()
        if (!teacher) return
        setTeacherId(teacher.id)

        // Get all classes this teacher is assigned to (any subject)
        const { data: cst } = await supabase
          .from('class_subject_teachers')
          .select('class_id, classes(id, name)')
          .eq('teacher_id', teacher.id)
        const classMap = new Map()
        for (const r of (cst || [])) {
          const c = r.classes as any
          if (c) classMap.set(c.id, c)
        }

        // Check which classes this teacher is class teacher for
        const { data: classTeacherClasses } = await supabase
          .from('classes')
          .select('id, name')
          .eq('class_teacher_id', teacher.id)
        const ctIds = (classTeacherClasses || []).map((c: any) => c.id)
        setClassTeacherIds(ctIds)
        for (const c of (classTeacherClasses || [])) {
          classMap.set(c.id, c)
        }

        setMyClassIds(Array.from(classMap.keys()))
        setAllClasses(Array.from(classMap.values()))

        const { data: termsData } = await supabase
          .from('academic_terms')
          .select('*')
          .order('created_at', { ascending: false })
        setTerms(termsData || [])
        const active = (termsData || []).find((t: any) => t.is_active)
        if (active) setTermId(active.id)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!classId || !termId) { setBroadsheet(null); return }
    ;(async () => {
      setFetching(true)
      setError('')
      try {
        const isFullAccess = classTeacherIds.includes(classId)
        const view = isFullAccess ? 'students' : 'students'
        const res = await fetch(`/api/results/broadsheet?class_id=${classId}&term_id=${termId}&view=${view}`)
        const js = await res.json()
        if (!res.ok) throw new Error(js.error || 'Failed to load')
        setBroadsheet(js)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setFetching(false)
      }
    })()
  }, [classId, termId])

  const selectedClass = allClasses.find((c) => c.id === classId)
  const selectedTerm = terms.find((t) => t.id === termId)
  const isFullAccess = classTeacherIds.includes(classId)

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Broadsheet</h1>
        <p className="text-gray-500 text-sm">
          {isFullAccess
            ? 'You are the class teacher — showing full class broadsheet'
            : 'Showing results for your assigned subject(s) only'}
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Term</label>
          <select
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
            className="border rounded px-3 py-2 text-sm min-w-[140px]"
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
            className="border rounded px-3 py-2 text-sm min-w-[140px]"
          >
            <option value="">Select class</option>
            {allClasses.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}{classTeacherIds.includes(c.id) ? ' (Class Teacher)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {fetching && <div className="text-center py-12 text-gray-500">Loading broadsheet...</div>}

      {broadsheet && !fetching && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              {selectedClass?.name} — {selectedTerm?.name}
            </h2>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              isFullAccess ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {isFullAccess ? 'Full Access' : 'Subject View'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 sticky left-0 bg-gray-50 min-w-[160px]">Student</th>
                  {broadsheet.subjects?.map((s: any) => (
                    <th key={s.id} className="px-3 py-3 text-center font-semibold text-gray-700 min-w-[100px]">
                      <div>{s.name}</div>
                      <div className="text-xs font-normal text-gray-400">/100</div>
                    </th>
                  ))}
                  {isFullAccess && (
                    <>
                      <th className="px-3 py-3 text-center font-semibold text-gray-700">Avg</th>
                      <th className="px-3 py-3 text-center font-semibold text-gray-700">Pos</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {broadsheet.rows?.map((row: any) => (
                  <tr key={row.student.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900 sticky left-0 bg-white">{row.student.name}</td>
                    {broadsheet.subjects?.map((s: any) => {
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
                    {isFullAccess && (
                      <>
                        <td className="px-3 py-2 text-center">{row.average}</td>
                        <td className="px-3 py-2 text-center font-bold text-blue-600">{row.position}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!broadsheet && !fetching && classId && termId && (
        <div className="text-center py-12 text-gray-400">No scores found for this class and term.</div>
      )}
      {(!classId || !termId) && (
        <div className="text-center py-12 text-gray-400">Select a term and class to view the broadsheet.</div>
      )}
    </div>
  )
}
