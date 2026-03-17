'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Printer, FileText } from 'lucide-react'
import ReportCardTemplate from '@/components/ReportCardTemplate'
import SchoolLoader from '@/components/SchoolLoader'

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
  const [affective, setAffective] = useState<Array<{ name: string; score?: number }>>([])
  const [psychomotor, setPsychomotor] = useState<Array<{ name: string; score?: number }>>([])
  const [savingSkills, setSavingSkills] = useState(false)

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

        const { data: classTeacherClasses } = await supabase
          .from('classes')
          .select('id, name, class_level, class_teacher_id')
          .eq('class_teacher_id', teacher.id)

        setClasses(classTeacherClasses || [])

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

  useEffect(() => {
    if (!classId) { setStudents([]); setStudentId(''); return }
    ;(async () => {
      try {
        const res = await fetch(`/api/teacher/class-students?class_id=${classId}`)
        const js = await res.json()
        const list = (js.students || [])
          .map((s: any) => ({ id: s.id, full_name: s.full_name }))
          .sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || ''))
        setStudents(list)
        if (list.length > 0) setStudentId(list[0].id)
        else setStudentId('')
      } catch {}
      const cls = classes.find((c) => c.id === classId)
      setIsClassTeacher(cls?.class_teacher_id === teacherId)
    })()
  }, [classId, teacherId])

  useEffect(() => {
    if (!termId || !studentId || !classId) { setReport(null); return }
    ;(async () => {
      setFetching(true)
      setError('')
      setReport(null)
      try {
        const res = await fetch(`/api/results/report-card?student_id=${studentId}&term_id=${termId}`)
        const js = await res.json()
        if (!res.ok) throw new Error(js.error || 'Failed to load report card')

        let enriched = js.report
        try {
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
        } catch {}

        setReport(enriched)
        setRemark(enriched.class_teacher_remark || '')
        const af = (enriched?.skills?.affective as any[]) || [
          { name: 'Punctuality' }, { name: 'Politeness' }, { name: 'Neatness' }, { name: 'Honesty' },
          { name: 'Leadership Skill' }, { name: 'Cooperation' }, { name: 'Attentiveness' }, { name: 'Perseverance' }, { name: 'Attitude to Work' },
        ]
        const ps = (enriched?.skills?.psychomotor as any[]) || [
          { name: 'Handwriting' }, { name: 'Verbal Fluency' }, { name: 'Sports' }, { name: 'Handling Tools' }, { name: 'Drawing & Painting' },
        ]
        setAffective(af)
        setPsychomotor(ps)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setFetching(false)
      }
    })()
  }, [termId, studentId, classId])

  const handleSaveRemark = async () => {
    if (!studentId || !classId || !termId) return
    setSavingRemark(true)
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
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSavingRemark(false)
    }
  }

  const handleSaveSkills = async () => {
    if (!studentId || !classId || !termId) return
    setSavingSkills(true)
    try {
      const res = await fetch('/api/results/report-card', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          class_id: classId,
          term_id: termId,
          affective_skills: affective,
          psychomotor_skills: psychomotor,
        }),
      })
      const js = await res.json()
      if (!res.ok) throw new Error(js.error || 'Failed to save ratings')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSavingSkills(false)
    }
  }

  const handleUploadSignature = async (file: File, type: 'class_teacher' | 'principal') => {
    if (!classId || !termId) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('class_id', classId)
    formData.append('term_id', termId)
    formData.append('type', type)
    try {
      const res = await fetch('/api/results/signature', { method: 'POST', body: formData })
      const js = await res.json()
      if (!res.ok) throw new Error(js.error || 'Failed to upload signature')
      // Update current report to show signature immediately
      if (report) {
        const field = type === 'class_teacher' ? 'class_teacher_signature_url' : 'principal_signature_url'
        setReport({ ...report, [field]: js.signature_url })
      }
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (loading) return <SchoolLoader />

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Card</h1>
          <p className="text-gray-500 text-sm">View and print student report cards</p>
        </div>
        
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm print:hidden">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex flex-wrap gap-4 items-end print:hidden">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Term</label>
          <select value={termId} onChange={(e) => setTermId(e.target.value)} className="border rounded px-3 py-2 text-sm min-w-[160px]">
            <option value="">Select term</option>
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="border rounded px-3 py-2 text-sm min-w-[160px]">
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
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="border rounded px-3 py-2 text-sm min-w-[200px]">
            <option value="">Select student</option>
            {students.map((s: any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
      </div>

      {fetching && <div className="text-center py-12 text-gray-500 print:hidden">Loading report card...</div>}

      {report && !fetching && (
        <ReportCardTemplate
          report={report}
          isClassTeacher={isClassTeacher}
          remark={remark}
          onRemarkChange={setRemark}
          onSaveRemark={handleSaveRemark}
          savingRemark={savingRemark}
          affective={affective}
          onAffectiveChange={setAffective}
          psychomotor={psychomotor}
          onPsychomotorChange={setPsychomotor}
          onSaveSkills={handleSaveSkills}
          savingSkills={savingSkills}
          onUploadSignature={handleUploadSignature}
        />
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
