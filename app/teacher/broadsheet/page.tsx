'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { getGrade } from '@/lib/gradeScale'
import { Save, Check } from 'lucide-react'
import SchoolLoader from '@/components/SchoolLoader'

function TeacherBroadsheetContent() {
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
  const [subjectFilter, setSubjectFilter] = useState('')
  const [classSubjectsMap, setClassSubjectsMap] = useState<Record<string, any[]>>({})
  const [broadsheet, setBroadsheet] = useState<any | null>(null)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  // Inline editing state
  const [editScores, setEditScores] = useState<Record<string, { ca1: string; ca2: string; exam: string }>>({})
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
          .select('class_id, subject_id, classes(id, name), subjects(id, name)')
          .eq('teacher_id', teacher.id)
        const classMap = new Map()
        const csMap: Record<string, any[]> = {}
        for (const r of (cst || [])) {
          const c = r.classes as any
          const s = r.subjects as any
          if (c) {
            classMap.set(c.id, c)
            if (s) {
              if (!csMap[c.id]) csMap[c.id] = []
              if (!csMap[c.id].some((x: any) => x.id === s.id)) {
                csMap[c.id].push(s)
              }
            }
          }
        }
        setClassSubjectsMap(csMap)

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

  // When class changes, default to the first assigned subject (no "All Subjects")
  useEffect(() => {
    const subs = classId ? (classSubjectsMap[classId] || []) : []
    if (subs.length > 0) {
      setSubjectFilter(subs[0].id)
    } else {
      setSubjectFilter('')
    }
  }, [classId, classSubjectsMap])

  useEffect(() => {
    if (!classId || !termId) { setBroadsheet(null); return }
    ;(async () => {
      setFetching(true)
      setError('')
      setEditScores({})
      setSavedCells(new Set())
      setSaveError('')
      try {
        let url = `/api/results/broadsheet?class_id=${classId}&term_id=${termId}&view=${view}`
        if (subjectFilter) url += `&subject_id=${subjectFilter}`
        const res = await fetch(url)
        const js = await res.json()
        if (!res.ok) throw new Error(js.error || 'Failed to load')
        setBroadsheet(js)
        setEditableSubjectIds(js.editableSubjectIds || [])

        // Pre-populate edit scores from existing data
        if (js.view === 'students' && js.editableSubjectIds?.length > 0) {
          const init: Record<string, { ca1: string; ca2: string; exam: string }> = {}
          for (const row of (js.rows || [])) {
            for (const subId of js.editableSubjectIds) {
              const key = `${row.student.id}:${subId}`
              const cell = row.cells[subId]
              init[key] = {
                ca1: cell ? String(cell.ca1) : '',
                ca2: cell ? String(cell.ca2) : '',
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
  }, [classId, termId, view, subjectFilter])

  const isFullAccess = classTeacherIds.includes(classId)
  const canEdit = editableSubjectIds.length > 0
  const selectedClass = allClasses.find((c) => c.id === classId)
  const selectedTerm = terms.find((t) => t.id === termId)

  const handleScoreChange = (studentId: string, subjectId: string, field: 'ca1' | 'ca2' | 'exam', value: string) => {
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

    const ca1 = score.ca1 === '' ? 0 : Number(score.ca1)
    const ca2 = score.ca2 === '' ? 0 : Number(score.ca2)
    const exam = score.exam === '' ? 0 : Number(score.exam)

    if (isNaN(ca1) || ca1 < 0 || ca1 > 20) { setSaveError('CA1 must be 0-20'); return }
    if (isNaN(ca2) || ca2 < 0 || ca2 > 20) { setSaveError('CA2 must be 0-20'); return }
    if (isNaN(exam) || exam < 0 || exam > 60) { setSaveError('Exam must be 0-60'); return }

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
          ca1_score: ca1,
          ca2_score: ca2,
          exam_score: exam,
        }),
      })
      const js = await res.json()
      if (!res.ok) throw new Error(js.error || 'Failed to save')

      setSavedCells((prev) => new Set(prev).add(key))

      // Update broadsheet data locally
      if (broadsheet?.view === 'students') {
        const ca = ca1 + ca2
        const total = ca + exam
        const complete = ca1 > 0 && ca2 > 0 && exam > 0
        const { grade, remark } = complete ? getGrade(total) : { grade: null, remark: null }
        setBroadsheet((prev: any) => {
          if (!prev) return prev
          const newRows = prev.rows.map((row: any) => {
            if (row.student.id !== studentId) return row
            const newCells = { ...row.cells }
            newCells[subjectId] = { ca1, ca2, ca, exam, total, grade, remark, complete }
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
          // Recalculate positions — only for students with scores
          const withScores = newRows.filter((r: any) => r.subjectCount > 0)
          const sorted = [...withScores].sort((a: any, b: any) => b.average - a.average)
          const withPos = newRows.map((row: any) => ({
            ...row,
            position: row.subjectCount > 0
              ? sorted.findIndex((r: any) => r.student.id === row.student.id) + 1
              : null,
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
      const headers: string[] = ['Student']
      for (const s of broadsheet.subjects) {
        headers.push(`${s.name} CA1`, `${s.name} CA2`, `${s.name} Exam`, `${s.name} Total`, `${s.name} Grade`)
      }
      headers.push('Grand Total', 'Average', 'Grade', 'Position')
      rows.push(headers)
      for (const row of broadsheet.rows) {
        const cells: string[] = []
        for (const s of broadsheet.subjects) {
          const c = row.cells[s.id]
          if (c) {
            cells.push(String(c.ca1), String(c.ca2), String(c.exam), String(c.total), c.grade || '—')
          } else {
            cells.push('-', '-', '-', '-', '-')
          }
        }
        const allComplete = broadsheet.subjects.every((s: any) => {
          const c = row.cells[s.id]
          return c != null && c.complete
        })
        const overallGrade = allComplete && row.average > 0 ? getGrade(Math.round(row.average)).grade : '—'
        rows.push([row.student.name, ...cells, String(row.totalSum), String(row.average), overallGrade, row.position ? String(row.position) : '—'])
      }
    } else {
      const headers = ['Subject', ...broadsheet.students.map((s: any) => s.name)]
      rows.push(headers)
      for (const row of broadsheet.rows) {
        const cells = broadsheet.students.map((s: any) => {
          const c = row.cells[s.id]
          return c ? `${c.total}${c.grade ? ` (${c.grade})` : ''}` : '-'
        })
        rows.push([row.subject.name, ...cells])
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const subName = subjectFilter && broadsheet.subjects?.[0]?.name ? `_${broadsheet.subjects[0].name}` : ''
    a.download = `broadsheet${subName}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <SchoolLoader />

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Broadsheet</h1>
        <p className="text-gray-500 text-sm">
          {classId
            ? canEdit
              ? 'You can edit CA1/CA2/Exam scores for your assigned subjects'
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
        {classId && (classSubjectsMap[classId]?.length ?? 0) > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="border rounded px-3 py-2 text-sm min-w-[160px]"
            >
              {(classSubjectsMap[classId] || []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
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
                        <th key={s.id} className={`px-3 py-3 text-center font-semibold text-gray-700 ${isEditable ? 'min-w-[220px]' : 'min-w-[100px]'}`}>
                          <div>{s.name}</div>
                          <div className="text-xs font-normal text-gray-400">
                            {isEditable ? 'CA1/20 · CA2/20 · Exam/60' : '/100'}
                          </div>
                        </th>
                      )
                    })}
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">Total</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">Avg</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">Grade</th>
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
                          const scores = editScores[key] || { ca1: '', ca2: '', exam: '' }
                          const ca1Num = scores.ca1 === '' ? 0 : Number(scores.ca1)
                          const ca2Num = scores.ca2 === '' ? 0 : Number(scores.ca2)
                          const examNum = scores.exam === '' ? 0 : Number(scores.exam)
                          const total = ca1Num + ca2Num + examNum
                          const allFilled = scores.ca1 !== '' && scores.ca2 !== '' && scores.exam !== ''
                          const { grade } = allFilled ? getGrade(total) : { grade: '' }
                          return (
                            <td key={s.id} className="px-2 py-1 text-center">
                              <div className="flex items-center gap-1 justify-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="20"
                                  value={scores.ca1}
                                  onChange={(e) => handleScoreChange(row.student.id, s.id, 'ca1', e.target.value)}
                                  onBlur={() => saveCell(row.student.id, s.id)}
                                  className="w-12 px-1 py-1 border rounded text-center text-xs focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                                  placeholder="CA1"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  max="20"
                                  value={scores.ca2}
                                  onChange={(e) => handleScoreChange(row.student.id, s.id, 'ca2', e.target.value)}
                                  onBlur={() => saveCell(row.student.id, s.id)}
                                  className="w-12 px-1 py-1 border rounded text-center text-xs focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                                  placeholder="CA2"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  max="60"
                                  value={scores.exam}
                                  onChange={(e) => handleScoreChange(row.student.id, s.id, 'exam', e.target.value)}
                                  onBlur={() => saveCell(row.student.id, s.id)}
                                  className="w-12 px-1 py-1 border rounded text-center text-xs focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                                  placeholder="Exam"
                                />
                                <span className={`text-xs font-medium w-8 ${grade === 'F' ? 'text-red-600' : grade === 'A' ? 'text-green-600' : 'text-gray-600'}`}>
                                  {allFilled ? total : ''}
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
                              <span className={`font-medium ${c.grade === 'F' ? 'text-red-600' : c.grade === 'A' ? 'text-green-600' : 'text-gray-800'}`}>
                                {c.total} {c.grade ? <span className="text-xs text-gray-500">({c.grade})</span> : null}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-center font-semibold">{row.totalSum}</td>
                      <td className="px-3 py-2 text-center">{row.average}</td>
                      {(() => {
                        // Only show grade when all subjects have complete scores (ca1, ca2, exam all > 0)
                        const allComplete = broadsheet.subjects.every((s: any) => {
                          const c = row.cells[s.id]
                          return c != null && c.complete
                        })
                        const { grade, remark } = allComplete && row.average > 0 ? getGrade(Math.round(row.average)) : { grade: '—', remark: '' }
                        return (
                          <td className={`px-3 py-2 text-center font-bold ${grade === 'F' ? 'text-red-600' : grade === 'A' ? 'text-green-600' : grade === '—' ? 'text-gray-300' : 'text-gray-800'}`} title={remark}>
                            {grade}
                          </td>
                        )
                      })()}
                      {(() => {
                        const pos = row.position
                        if (!pos) return <td className="px-3 py-2 text-center text-gray-300">—</td>
                        const posColor = pos === 1 ? 'text-yellow-500' : pos === 2 ? 'text-gray-400' : pos === 3 ? 'text-amber-600' : 'text-blue-600'
                        const posBg = pos === 1 ? 'bg-yellow-50' : pos === 2 ? 'bg-gray-50' : pos === 3 ? 'bg-amber-50' : ''
                        return (
                          <td className={`px-3 py-2 text-center font-bold ${posColor} ${posBg}`}>
                            {pos}<sup className="text-[10px]">{pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th'}</sup>
                          </td>
                        )
                      })()}
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
                              <span className={`font-medium ${c.grade === 'F' ? 'text-red-600' : c.grade === 'A' ? 'text-green-600' : 'text-gray-800'}`}>
                                {c.total} {c.grade ? <span className="text-xs text-gray-500">({c.grade})</span> : null}
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

export default function TeacherBroadsheetPage() {
  return (
    <Suspense fallback={<SchoolLoader />}>
      <TeacherBroadsheetContent />
    </Suspense>
  )
}
