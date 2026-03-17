'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Clock } from 'lucide-react'
import { Timetable } from '@/types/database'
import SchoolLoader from '@/components/SchoolLoader'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export default function TeacherTimetablePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<Timetable[]>([])
  const [allClasses, setAllClasses] = useState<Record<string, string>>({}) // id -> label
  const [mode, setMode] = useState<'assigned' | 'myclass'>('assigned')
  const [sessions, setSessions] = useState<any[]>([])
  const [terms, setTerms] = useState<any[]>([])
  const [selectedSession, setSelectedSession] = useState<string>('')
  const [selectedTerm, setSelectedTerm] = useState<string>('')
  const [activeTermId, setActiveTermId] = useState<string>('')

  // Store teacher info so we can reload timetable without re-authing
  const teacherRef = useRef<{ id: string; myClassIds: string[]; assignmentMap: Map<string, Set<string>> } | null>(null)

  // 1. Auth + load teacher info (once)
  useEffect(() => {
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/auth/login'); return }
        const { data: profile } = await supabase
          .from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role !== 'teacher') { router.push('/'); return }
        const { data: teacher } = await supabase
          .from('teachers').select('id').eq('user_id', user.id).single()
        if (!teacher) { setLoading(false); return }

        // My classes (where I'm class teacher)
        const { data: myClassRes } = await supabase.from('classes').select('id, name, class_level').eq('class_teacher_id', teacher.id)
        const myClassIds = (myClassRes || []).map(c => c.id)

        // Subject assignments
        const { data: assignments } = await supabase
          .from('class_subject_teachers')
          .select('class_id, subject_id, classes(id, name, class_level)')
          .eq('teacher_id', teacher.id)

        // Build subject name map
        const subjIds = Array.from(new Set((assignments || []).map(a => a.subject_id)))
        const { data: subjectsRes } = subjIds.length
          ? await supabase.from('subjects').select('id, name').in('id', subjIds)
          : { data: [] as any[] }
        const subjectNameMap: Record<string, string> = {}
        ;(subjectsRes || []).forEach((s: any) => { subjectNameMap[s.id] = String(s.name || '').trim().toLowerCase() })

        // Build assignment map: class_id -> set of subject names (lowercased)
        const assignmentMap = new Map<string, Set<string>>()
        ;(assignments || []).forEach((a: any) => {
          const nm = subjectNameMap[a.subject_id] || ''
          if (!nm) return
          if (!assignmentMap.has(a.class_id)) assignmentMap.set(a.class_id, new Set<string>())
          assignmentMap.get(a.class_id)!.add(nm)
        })

        // Build class name map from all sources
        const classNameMap: Record<string, string> = {}
        ;(myClassRes || []).forEach((c: any) => { classNameMap[c.id] = c.class_level || c.name || 'Class' })
        ;(assignments || []).forEach((a: any) => {
          const c = (a as any).classes
          if (c && !classNameMap[c.id]) classNameMap[c.id] = c.class_level || c.name || 'Class'
        })
        setAllClasses(classNameMap)

        teacherRef.current = { id: teacher.id, myClassIds, assignmentMap }

        // Load sessions & terms
        const { data: sessionsData } = await supabase
          .from('academic_sessions')
          .select('id, name, is_active')
          .order('created_at', { ascending: false })
        setSessions(sessionsData || [])
        const activeSession = (sessionsData || []).find((s: any) => s.is_active) || (sessionsData || [])[0]
        if (activeSession?.id) {
          setSelectedSession(activeSession.id)
          const { data: termsData } = await supabase
            .from('academic_terms')
            .select('id, name, is_active, session_id, start_date, end_date')
            .eq('session_id', activeSession.id)
            .order('created_at', { ascending: false })
          setTerms(termsData || [])
          const activeTerm = (termsData || []).find((t: any) => t.is_active) || (termsData || [])[0]
          setSelectedTerm(activeTerm?.id || '')
          setActiveTermId(activeTerm?.id || '')
        }
      } catch (error) {
        console.error('Error:', error)
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  // 2. Reload terms when session changes (skip initial load, handled above)
  const initialLoadDone = useRef(false)
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      return
    }
    if (!selectedSession) { setTerms([]); setSelectedTerm(''); return }
    ;(async () => {
      const { data: termsData } = await supabase
        .from('academic_terms')
        .select('id, name, is_active, session_id, start_date, end_date')
        .eq('session_id', selectedSession)
        .order('created_at', { ascending: false })
      setTerms(termsData || [])
      const activeTerm = (termsData || []).find((t: any) => t.is_active) || (termsData || [])[0]
      setSelectedTerm(activeTerm?.id || '')
      setActiveTermId(activeTerm?.id || '')
    })()
  }, [selectedSession])

  // 3. Load timetable entries when mode/term changes
  useEffect(() => {
    if (!teacherRef.current || loading) return
    const { id: teacherId, myClassIds, assignmentMap } = teacherRef.current
    ;(async () => {
      try {
        const selectedTermObj = terms.find((t: any) => t.id === selectedTerm) || null
        const selectedStart = selectedTermObj?.start_date || ''
        const selectedEnd = selectedTermObj?.end_date || ''
        const includeLegacy = Boolean(selectedTerm && selectedTerm === activeTermId)

        const norm = (s: any) => String(s || '').trim().toLowerCase()

        if (mode === 'myclass') {
          // My Class: show ALL timetable entries for my homeroom class(es) — the full class schedule from admin
          if (myClassIds.length === 0) { setEntries([]); return }
          let q = supabase.from('timetables').select('*').in('class_id', myClassIds)
          if (selectedTerm) {
            q = q.or(`term_id.eq.${selectedTerm},term_id.is.null`)
          }
          let { data, error } = await q
          if (error && /term_id/i.test(String(error.message || ''))) {
            const fb = await supabase.from('timetables').select('*').in('class_id', myClassIds)
            data = fb.data
          }
          let filtered = data || []
          // Apply term filtering in JS for precision
          if (selectedTerm) {
            const inRange = (dtStr: string) => {
              if (!selectedStart || !selectedEnd) return false
              const dt = new Date(dtStr)
              const s = new Date(String(selectedStart))
              const e = new Date(String(selectedEnd))
              e.setHours(23, 59, 59, 999)
              return dt >= s && dt <= e
            }
            filtered = filtered.filter((e: any) => {
              const tid = String(e.term_id || '')
              if (tid === selectedTerm) return true
              if (includeLegacy && !tid) return inRange(String(e.created_at || ''))
              return false
            })
          }
          setEntries(filtered.sort((a: any, b: any) => String(a.start_time).localeCompare(String(b.start_time))))
        } else {
          // Assigned classes: show entries where teacher_id matches OR subject matches an assignment
          const assignedClassIds = Array.from(assignmentMap.keys())
          const allClassIds = Array.from(new Set([...myClassIds, ...assignedClassIds]))

          // Fetch entries by teacher_id
          let q1 = supabase.from('timetables').select('*').eq('teacher_id', teacherId)
          if (selectedTerm) q1 = q1.or(`term_id.eq.${selectedTerm},term_id.is.null`)
          let { data: byTeacher, error: err1 } = await q1
          if (err1 && /term_id/i.test(String(err1.message || ''))) {
            const fb = await supabase.from('timetables').select('*').eq('teacher_id', teacherId)
            byTeacher = fb.data
          }

          // Fetch entries for assigned classes (to match by subject name)
          let q2 = supabase.from('timetables').select('*')
          if (assignedClassIds.length > 0) {
            q2 = q2.in('class_id', assignedClassIds)
          } else {
            // No assigned classes, skip
            q2 = q2.eq('class_id', 'none')
          }
          if (selectedTerm) q2 = q2.or(`term_id.eq.${selectedTerm},term_id.is.null`)
          let { data: byClass, error: err2 } = await q2
          if (err2 && /term_id/i.test(String(err2.message || ''))) {
            const fb = assignedClassIds.length > 0
              ? await supabase.from('timetables').select('*').in('class_id', assignedClassIds)
              : { data: [] as any[] }
            byClass = (fb as any).data || []
          }

          // Merge and deduplicate
          const unique = new Map<string, any>()
          for (const e of (byTeacher || [])) unique.set(e.id, e)
          for (const e of (byClass || [])) {
            if (unique.has(e.id)) continue
            // Only include if subject matches an assignment for that class
            const set = assignmentMap.get(e.class_id)
            if (set && set.has(norm(e.subject))) unique.set(e.id, e)
          }

          let filtered = Array.from(unique.values())

          // Apply term filtering in JS
          if (selectedTerm) {
            const inRange = (dtStr: string) => {
              if (!selectedStart || !selectedEnd) return false
              const dt = new Date(dtStr)
              const s = new Date(String(selectedStart))
              const e = new Date(String(selectedEnd))
              e.setHours(23, 59, 59, 999)
              return dt >= s && dt <= e
            }
            filtered = filtered.filter((e: any) => {
              const tid = String(e.term_id || '')
              if (tid === selectedTerm) return true
              if (includeLegacy && !tid) return inRange(String(e.created_at || ''))
              return false
            })
          }

          setEntries(filtered.sort((a: any, b: any) => String(a.start_time).localeCompare(String(b.start_time))))
        }
      } catch (error) {
        console.error('Error loading timetable:', error)
      }
    })()
  }, [mode, selectedTerm, terms, activeTermId, loading])

  const formatDuration = (entry: Timetable) => {
    const st = String((entry as any).start_time || '').trim()
    const et = String((entry as any).end_time || '').trim()
    if (!st || !et) return ''
    const [sh, sm] = st.split(':').map(Number)
    const [eh, em] = et.split(':').map(Number)
    const sd = new Date(2000, 0, 1, sh || 0, sm || 0)
    const ed = new Date(2000, 0, 1, eh || 0, em || 0)
    const mins = Math.max(0, Math.round((ed.getTime() - sd.getTime()) / 60000))
    return `${mins}m`
  }

  const entriesByDay = useMemo(() => {
    const map: Record<string, Timetable[]> = {}
    DAYS.forEach(d => { map[d] = [] })
    entries.forEach(e => {
      if (map[e.day_of_week]) map[e.day_of_week].push(e)
    })
    DAYS.forEach(d => {
      map[d] = (map[d] || []).slice().sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
    })
    return map
  }, [entries])

  if (loading) {
    return <SchoolLoader />
  }

  return (
    <div>
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Clock className="w-10 h-10 text-blue-600" />
            <h2 className="text-3xl font-bold text-gray-900">Timetable</h2>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">View</label>
                <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                  {(['myclass','assigned'] as ('myclass'|'assigned')[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                        mode === m ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {m === 'myclass' ? 'My class' : 'Assigned classes'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Session</label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none min-w-[160px]"
                >
                  <option value="">All sessions</option>
                  {sessions.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Term</label>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none min-w-[160px]"
                >
                  {terms.length === 0 ? (
                    <option value="">No terms available</option>
                  ) : (
                    terms.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)
                  )}
                </select>
              </div>
            </div>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {mode === 'myclass' ? 'No timetable for your homeroom class.' : 'No timetable entries assigned to you yet.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100">
              {DAYS.map(day => (
                <div key={day} className="grid grid-cols-12">
                  <div className="col-span-2 bg-gray-50/80 px-4 py-3">
                    <span className="text-sm font-semibold text-gray-700">{day}</span>
                  </div>
                  <div className="col-span-10 px-3 py-2">
                    {entriesByDay[day].length === 0 ? (
                      <div className="py-2 text-xs text-gray-400">Free</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {entriesByDay[day].map(entry => (
                          <div key={entry.id} className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 min-w-[160px]">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{entry.subject || 'No subject'}</p>
                              <p className="text-xs text-gray-500">{entry.start_time} – {entry.end_time}</p>
                              <p className="text-xs text-blue-600 truncate">{allClasses[entry.class_id] || 'Unknown class'}</p>
                              {entry.room && <p className="text-xs text-gray-400">{entry.room}</p>}
                              <p className="text-xs text-gray-500">{formatDuration(entry)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  )
}
