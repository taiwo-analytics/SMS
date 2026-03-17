'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { getGrade } from '@/lib/gradeScale'
import SchoolLoader from '@/components/SchoolLoader'

export default function TeacherResultsPage() {
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<any[]>([])
  const [allClasses, setAllClasses] = useState<any[]>([])
  const [terms, setTerms] = useState<any[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')
  const [termId, setTermId] = useState('')
  const [students, setStudents] = useState<any[]>([])
  const [scores, setScores] = useState<Record<string, { ca1: string; ca2: string; exam: string }>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [fetchingStudents, setFetchingStudents] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: teacher } = await supabase.from('teachers').select('id').eq('user_id', user.id).single()
        if (!teacher) return

        const { data: cst } = await supabase
          .from('class_subject_teachers')
          .select('*, classes(id, name), subjects(id, name, code)')
          .eq('teacher_id', teacher.id)
        setAssignments(cst || [])

        const classMap = new Map()
        for (const r of (cst || [])) {
          const c = r.classes as any
          if (c && !classMap.has(c.id)) classMap.set(c.id, c)
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
    const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    const cid = sp.get('class_id') || ''
    if (cid && allClasses.some((c: any) => c.id === cid)) {
      setSelectedClassId(cid)
    }
  }, [allClasses])

  const selectedAssignment = assignments.find((a) => a.id === selectedAssignmentId) || null
  const classSubjects = assignments.filter((a: any) => a.class_id === selectedClassId)

  useEffect(() => {
    if (!selectedAssignment || !termId) { setStudents([]); return }
    ;(async () => {
      setFetchingStudents(true)
      setError('')
      try {
        const resp = await fetch(`/api/teacher/subject-students?class_id=${selectedAssignment.class_id}&subject_id=${selectedAssignment.subject_id}`)
        const js1 = await resp.json()
        const studentList = ((js1.students || []) as any[])
          .slice()
          .sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || ''))
        setStudents(studentList)

        const res = await fetch(
          `/api/results/subject-scores?class_id=${selectedAssignment.class_id}&subject_id=${selectedAssignment.subject_id}&term_id=${termId}`
        )
        const js = await res.json()
        const scoreMap: Record<string, { ca1: string; ca2: string; exam: string }> = {}
        for (const sc of (js.scores || [])) {
          scoreMap[sc.student_id] = { ca1: String(sc.ca1_score), ca2: String(sc.ca2_score), exam: String(sc.exam_score) }
        }
        for (const s of studentList) {
          if (!scoreMap[s.id]) scoreMap[s.id] = { ca1: '', ca2: '', exam: '' }
        }
        setScores(scoreMap)
        setSaved({})
      } finally {
        setFetchingStudents(false)
      }
    })()
  }, [selectedAssignment?.id, termId])

  const handleScoreChange = (studentId: string, field: 'ca1' | 'ca2' | 'exam', value: string) => {
    setScores((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }))
    setSaved((prev) => ({ ...prev, [studentId]: false }))
  }

  const saveScore = async (studentId: string) => {
    if (!selectedAssignment || !termId) return
    const s = scores[studentId]
    const ca1 = parseFloat(s?.ca1 || '0') || 0
    const ca2 = parseFloat(s?.ca2 || '0') || 0
    const exam = parseFloat(s?.exam || '0') || 0
    setSaving((prev) => ({ ...prev, [studentId]: true }))
    try {
      const res = await fetch('/api/results/subject-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          class_id: selectedAssignment.class_id,
          subject_id: selectedAssignment.subject_id,
          term_id: termId,
          ca1_score: ca1,
          ca2_score: ca2,
          exam_score: exam,
        }),
      })
      if (!res.ok) {
        const js = await res.json()
        setError(js.error || 'Failed to save')
      } else {
        setSaved((prev) => ({ ...prev, [studentId]: true }))
      }
    } finally {
      setSaving((prev) => ({ ...prev, [studentId]: false }))
    }
  }

  const saveAll = async () => {
    for (const student of students) {
      await saveScore(student.id)
    }
  }

  if (loading) return <SchoolLoader />

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Results Entry</h1>
        <p className="text-gray-500 text-sm">Enter CA and Exam scores for your subjects</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>
      )}

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
            value={selectedClassId}
            onChange={(e) => { setSelectedClassId(e.target.value); setSelectedAssignmentId('') }}
            className="border rounded px-3 py-2 text-sm min-w-[140px]"
          >
            <option value="">Select class</option>
            {allClasses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
          <select
            value={selectedAssignmentId}
            onChange={(e) => setSelectedAssignmentId(e.target.value)}
            className="border rounded px-3 py-2 text-sm min-w-[160px]"
            disabled={!selectedClassId}
          >
            <option value="">Select subject</option>
            {classSubjects.map((a: any) => (
              <option key={a.id} value={a.id}>{(a.subjects as any)?.name}</option>
            ))}
          </select>
        </div>
        {students.length > 0 && (
          <button
            onClick={saveAll}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            Save All
          </button>
        )}
      </div>

      {fetchingStudents && <div className="text-center py-8 text-gray-500">Loading students...</div>}

      {!fetchingStudents && students.length > 0 && selectedAssignment && termId && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              {(selectedAssignment.classes as any)?.name} — {(selectedAssignment.subjects as any)?.name}
            </h2>
            <span className="text-xs text-gray-500">{students.length} students</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Student</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700">CA1 (/20)</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700">CA2 (/20)</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700">Exam (/60)</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700">Total</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700">Grade</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((student: any) => {
                  const s = scores[student.id] || { ca1: '', ca2: '', exam: '' }
                  const ca1 = parseFloat(s.ca1) || 0
                  const ca2 = parseFloat(s.ca2) || 0
                  const exam = parseFloat(s.exam) || 0
                  const total = ca1 + ca2 + exam
                  const hasScore = s.ca1 !== '' || s.ca2 !== '' || s.exam !== ''
                  const { grade } = hasScore ? getGrade(total) : { grade: '—' }
                  return (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{student.full_name}</td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          step="0.5"
                          value={s.ca1}
                          onChange={(e) => handleScoreChange(student.id, 'ca1', e.target.value)}
                          className="w-20 border rounded px-2 py-1 text-center text-sm"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          step="0.5"
                          value={s.ca2}
                          onChange={(e) => handleScoreChange(student.id, 'ca2', e.target.value)}
                          className="w-20 border rounded px-2 py-1 text-center text-sm"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          max="60"
                          step="0.5"
                          value={s.exam}
                          onChange={(e) => handleScoreChange(student.id, 'exam', e.target.value)}
                          className="w-20 border rounded px-2 py-1 text-center text-sm"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2 text-center font-semibold">
                        {hasScore ? total : '—'}
                      </td>
                      <td className={`px-3 py-2 text-center font-bold ${
                        grade === 'F' ? 'text-red-600' : grade === 'A' ? 'text-green-600' : 'text-gray-800'
                      }`}>
                        {grade}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {saved[student.id] ? (
                          <span className="text-green-600 text-xs font-medium">Saved ✓</span>
                        ) : (
                          <button
                            onClick={() => saveScore(student.id)}
                            disabled={saving[student.id]}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                          >
                            {saving[student.id] ? '...' : 'Save'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!fetchingStudents && selectedAssignment && termId && students.length === 0 && (
        <div className="text-center py-12 text-gray-400">No students enrolled in this class.</div>
      )}

      {!selectedAssignment && (
        <div className="text-center py-12 text-gray-400">Select a term, class and subject to enter scores.</div>
      )}
    </div>
  )
}
