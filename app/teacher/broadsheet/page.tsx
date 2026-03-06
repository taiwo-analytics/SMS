'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { getGrade } from '@/lib/gradeScale'
import { Save, Check } from 'lucide-react'

export default function TeacherBroadsheetPage() {
  const searchParams = useSearchParams()
  const initialClassId = searchParams.get('class_id') || ''
  const [loading, setLoading] = useState(true)
  const [teacherId, setTeacherId] = useState('')
  const [classTeacherIds, setClassTeacherIds] = useState<string[]>([])
  const [allClasses, setAllClasses] = useState<any[]>([])
  const [terms, setTerms] = useState<any[]>([])
  const [classId, setClassId] = useState('')
  const [termId, setTermId] = useState('')
  const [view, setView] = useState<'students' | 'subjects'>('students')
  const [broadsheet, setBroadsheet] = useState<any | null>(null)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  // Inline editing state
  const [editScores, setEditScores] = useState<Record<string, { ca: string; exam: string }>>({})
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set())
  const [savedCells, setSavedCells] = useState<Set<string>>(new Set())
  const [saveError, setSaveError] = useState('')
  const [editableSubjectIds, setEditableSubjectIds] = useState<string[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: teacher } = await supabase.from('teachers').select('id').eq('user_id', user.id).single()
        if (!teacher) return
        setTeacherId(teacher.id)

        const { data: cst } = await supabase
          .from('class_subject_teachers')
          .select('class_id, classes(id, name)')
          .eq('teacher_id', teacher.id)
        const classMap = new Map()
        for (const r of (cst || [])) {
          const c = r.classes as any
          if (c) classMap.set(c.id, c)
        }

        const { data: classTeacherClasses } = await supabase
          .from('classes')
          .select('id, name')
          .eq('class_teacher_id', teacher.id)
        const ctIds = (classTeacherClasses || []).map((c: any) => c.id)
        setClassTeacherIds(ctIds)
        for (const c of (classTeacherClasses || [])) {
          classMap.set(c.id, c)
        }

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
    if (initialClassId && allClasses.some((c) => c.id === initialClassId)) {
      setClassId(initialClassId)
    }
  }, [allClasses, initialClassId])

  useEffect(() => {
    if (!classId || !termId) { setBroadsheet(null); return }
    ;(async () => {
      setFetching(true)
      setError('')
      setEditScores({})
      setSavedCells(new Set())
      setSaveError('')
      try {
        const res = await fetch(`/api/results/broadsheet?class_id=${classId}&term_id=${termId}&view=${view}`)
        const js = await res.json()
        if (!res.ok) throw new Error(js.error || 'Failed to load')
        setBroadsheet(js)
        setEditableSubjectIds(js.editableSubjectIds || [])

        // Pre-populate edit scores from existing data
        if (js.view === 'students' && js.editableSubjectIds?.length > 0) {
          const init: Record<string, { ca: string; exam: string }> = {}
          for (const row of (js.rows || [])) {
            for (const subId of js.editableSubjectIds) {
              const key = `${row.student.id}:${subId}`
              const cell = row.cells[subId]
              init[key] = {
                ca: cell ? String(cell.ca) : '',
                exam: cell ? String(cell.exam) : '',
              }
            }
          }
          setEditScores(init)
        }
      } catch (e: any) {
        setError(e.message)
      } finally {
        setFetching(false)
      }
    })()
  }, [classId, termId, view])

  const isFullAccess = classTeacherIds.includes(classId)
  const canEdit = editableSubjectIds.length > 0
  const selectedClass = allClasses.find((c) => c.id === classId)
  const selectedTerm = terms.find((t) => t.id === termId)

  const handleScoreChange = (studentId: string, subjectId: string, field: 'ca' | 'exam', value: string) => {
    const key = `${studentId}:${subjectId}`
    setEditScores((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
    // Remove from saved when edited
    setSavedCells((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  const saveCell = async (studentId: string, subjectId: string) => {
    const key = `${studentId}:${subjectId}`
    const score = editScores[key]
    if (!score) return

    const ca = score.ca === '' ? 0 : Number(score.ca)
    const exam = score.exam === '' ? 0 : Number(score.exam)

    if (isNaN(ca) || ca < 0 || ca > 40) { setSaveError(`CA must be 0-40`); return }
    if (isNaN(exam) || exam < 0 || exam > 60) { setSaveError(`Exam must be 0-60`); return }

    setSavingCells((prev) => new Set(prev).add(key))
    setSaveError('')

    try {
      const res = await fetch('/api/results/subject-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          class_id: classId,
          subject_id: subjectId,
          term_id: termId,
          ca_score: ca,
          exam_score: exam,
        }),
      })
      const js = await res.json()
      if (!res.ok) throw new Error(js.error || 'Failed to save')

      setSavedCells((prev) => new Set(prev).add(key))

      // Update broadsheet data locally
      if (broadsheet?.view === 'students') {
        const total = ca + exam
        const { grade, remark } = getGrade(total)
        setBroadsheet((prev: any) => {
          if (!prev) return prev
          const newRows = prev.rows.map((row: any) => {
            if (row.student.id !== studentId) return row
            const newCells = { ...row.cells }
            newCells[subjectId] = { ca, exam, total, grade, remark }
            // Recalculate totals
            let totalSum = 0
            let subjectCount = 0
            for (const sub of prev.subjects) {
              const c = newCells[sub.id]
              if (c) { totalSum += c.total; subjectCount++ }
            }
            const average = subjectCount > 0 ? Math.round((totalSum / subjectCount) * 100) / 100 : 0
            return { ...row, cells: newCells, totalSum, average, subjectCount }
          })
          // Recalculate positions
          const sorted = [...newRows].sort((a: any, b: any) => b.average - a.average)
          const withPos = newRows.map((row: any) => ({
            ...row,
            position: sorted.findIndex((r: any) => r.student.id === row.student.id) + 1,
          }))
          return { ...prev, rows: withPos }
        })
      }
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSavingCells((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const saveAll = async () => {
    setSaveError('')
    const promises: Promise<void>[] = []
    for (const key of Object.keys(editScores)) {
      const [studentId, subjectId] = key.split(':')
      if (editableSubjectIds.includes(subjectId) && !savedCells.has(key)) {
        promises.push(saveCell(studentId, subjectId))
      }
    }
    await Promise.all(promises)
  }

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

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Broadsheet</h1>
        <p className="text-gray-500 text-sm">
          {classId
            ? canEdit
              ? 'You can edit CA/Exam scores for your assigned subjects'
              : isFullAccess
                ? 'You are the class teacher — showing full class broadsheet (view only)'
                : 'Showing results for your assigned subject(s) only'
            : 'Select a class to view the broadsheet'}
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>}
      {saveError && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{saveError}</div>}

      {/* Filters */}
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
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">View</label>
          <select
            value={view}
            onChange={(e) => setView(e.target.value as any)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="students">By Students</option>
            <option value="subjects">By Subjects</option>
          </select>
        </div>
        {broadsheet && (
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
          >
            Export CSV
          </button>
        )}
        {canEdit && broadsheet && view === 'students' && (
          <button
            onClick={saveAll}
            disabled={savingCells.size > 0}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {savingCells.size > 0 ? 'Saving...' : 'Save All'}
          </button>
        )}
      </div>

      {fetching && <div className="text-center py-12 text-gray-500">Loading broadsheet...</div>}

      {broadsheet && !fetching && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              {selectedClass?.name} — {selectedTerm?.name}
            </h2>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              canEdit ? 'bg-green-100 text-green-700' : isFullAccess ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {canEdit ? 'Editable' : isFullAccess ? 'Full Access (View Only)' : 'Subject View'}
            </span>
          </div>
          <div className="overflow-x-auto">
            {broadsheet.view === 'students' ? (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 sticky left-0 bg-gray-50 min-w-[160px]">Student</th>
                    {broadsheet.subjects?.map((s: any) => {
                      const isEditable = editableSubjectIds.includes(s.id)
                      return (
                        <th key={s.id} className={`px-3 py-3 text-center font-semibold text-gray-700 ${isEditable ? 'min-w-[160px]' : 'min-w-[100px]'}`}>
                          <div>{s.name}</div>
                          <div className="text-xs font-normal text-gray-400">
                            {isEditable ? 'CA/40 · Exam/60' : '/100'}
                          </div>
                        </th>
                      )
                    })}
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">Total</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">Avg</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">Pos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {broadsheet.rows?.map((row: any) => (
                    <tr key={row.student.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900 sticky left-0 bg-white">{row.student.name}</td>
                      {broadsheet.subjects?.map((s: any) => {
                        const c = row.cells[s.id]
                        const isEditable = editableSubjectIds.includes(s.id)
                        const key = `${row.student.id}:${s.id}`
                        const isSaving = savingCells.has(key)
                        const isSaved = savedCells.has(key)

                        if (isEditable) {
                          const scores = editScores[key] || { ca: '', exam: '' }
                          const caNum = scores.ca === '' ? 0 : Number(scores.ca)
                          const examNum = scores.exam === '' ? 0 : Number(scores.exam)
                          const total = caNum + examNum
                          const { grade } = getGrade(total)
                          return (
                            <td key={s.id} className="px-2 py-1 text-center">
                              <div className="flex items-center gap-1 justify-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="40"
                                  value={scores.ca}
                                  onChange={(e) => handleScoreChange(row.student.id, s.id, 'ca', e.target.value)}
                                  onBlur={() => saveCell(row.student.id, s.id)}
                                  className="w-14 px-1.5 py-1 border rounded text-center text-xs focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                                  placeholder="CA"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  max="60"
                                  value={scores.exam}
                                  onChange={(e) => handleScoreChange(row.student.id, s.id, 'exam', e.target.value)}
                                  onBlur={() => saveCell(row.student.id, s.id)}
                                  className="w-14 px-1.5 py-1 border rounded text-center text-xs focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                                  placeholder="Exam"
                                />
                                <span className={`text-xs font-medium w-8 ${grade === 'F9' ? 'text-red-600' : grade.startsWith('A') ? 'text-green-600' : 'text-gray-600'}`}>
                                  {total > 0 ? total : ''}
                                </span>
                                {isSaving && <span className="animate-spin text-blue-500 text-xs">&#9696;</span>}
                                {isSaved && <Check className="w-3 h-3 text-green-500" />}
                              </div>
                            </td>
                          )
                        }

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
                    {broadsheet.students?.map((s: any) => (
                      <th key={s.id} className="px-3 py-3 text-center font-semibold text-gray-700 min-w-[100px]">{s.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {broadsheet.rows?.map((row: any) => (
                    <tr key={row.subject.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900 sticky left-0 bg-white">{row.subject.name}</td>
                      {broadsheet.students?.map((s: any) => {
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

      {!broadsheet && !fetching && classId && termId && (
        <div className="text-center py-12 text-gray-400">No scores found for this class and term.</div>
      )}
      {(!classId || !termId) && (
        <div className="text-center py-12 text-gray-400">Select a term and class to view the broadsheet.</div>
      )}
    </div>
  )
}
