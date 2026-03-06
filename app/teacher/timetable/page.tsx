'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Clock } from 'lucide-react'
import { Timetable, Class } from '@/types/database'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export default function TeacherTimetablePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<Timetable[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [mode, setMode] = useState<'assigned' | 'myclass'>('assigned')

  const checkAuthAndLoad = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'teacher') { router.push('/'); return }
      const { data: teacher } = await supabase
        .from('teachers').select('id').eq('user_id', user.id).single()
      if (!teacher) { setLoading(false); return }
      const { data: myClassRes } = await supabase.from('classes').select('*').eq('class_teacher_id', teacher.id)
      const myClassIds = (myClassRes || []).map(c => c.id)
      const { data: assignments } = await supabase
        .from('class_subject_teachers')
        .select('class_id, subject_id, teacher_id')
        .eq('teacher_id', teacher.id)
      const subjIds = Array.from(new Set((assignments || []).map(a => a.subject_id)))
      const { data: subjectsRes } = subjIds.length
        ? await supabase.from('subjects').select('id, name').in('id', subjIds)
        : { data: [] as any[] }
      const subjectNameMap: Record<string, string> = {}
      ;(subjectsRes || []).forEach((s: any) => { subjectNameMap[s.id] = String(s.name || '').trim().toLowerCase() })
      const assignmentMap = new Map<string, Set<string>>() // class_id -> set of subject names (lowercased)
      ;(assignments || []).forEach((a: any) => {
        const nm = subjectNameMap[a.subject_id] || ''
        if (!nm) return
        if (!assignmentMap.has(a.class_id)) assignmentMap.set(a.class_id, new Set<string>())
        assignmentMap.get(a.class_id)!.add(nm)
      })

      const [byTeacher, byAssignedClasses, byMyClasses] = await Promise.all([
        supabase.from('timetables').select('*').eq('teacher_id', teacher.id),
        supabase.from('timetables').select('*'),
        (myClassIds.length > 0)
          ? supabase.from('timetables').select('*').in('class_id', myClassIds)
          : Promise.resolve({ data: [] as any[] }),
      ])
      const norm = (s: any) => String(s || '').trim().toLowerCase()
      let filtered: any[] = []
      if (mode === 'assigned') {
        const merged = [...(byTeacher.data || []), ...((byAssignedClasses as any).data || [])]
        filtered = merged.filter((e: any) => {
          if (e.teacher_id === teacher.id) return true
          const set = assignmentMap.get(e.class_id)
          if (!set) return false
          return set.has(norm(e.subject))
        })
      } else {
        filtered = (byMyClasses as any).data || []
      }
      const unique = new Map<string, Timetable>()
      filtered.forEach((e: any) => unique.set(e.id, e))
      const list = Array.from(unique.values()).sort((a, b) => a.start_time.localeCompare(b.start_time))
      setEntries(list as Timetable[])
      setClasses(myClassRes || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [router, mode])

  useEffect(() => { checkAuthAndLoad() }, [checkAuthAndLoad])

 

  const classMap = useMemo(() => {
    const map: Record<string, string> = {}
    classes.forEach(c => { map[c.id] = c.name })
    return map
  }, [classes])

  const entriesByDay = useMemo(() => {
    const map: Record<string, Timetable[]> = {}
    DAYS.forEach(d => { map[d] = [] })
    entries.forEach(e => {
      if (map[e.day_of_week]) map[e.day_of_week].push(e)
    })
    return map
  }, [entries])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
          <Clock className="w-10 h-10 text-blue-600" />
            <h2 className="text-3xl font-bold text-gray-900">Timetable</h2>
          </div>
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

        {entries.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {mode === 'myclass' ? 'No timetable for your homeroom class.' : 'No timetable entries assigned to you yet.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="grid grid-cols-5 divide-x divide-gray-200">
              {DAYS.map(day => (
                <div key={day}>
                  <div className="bg-gray-50 px-3 py-3 text-center">
                    <span className="text-sm font-semibold text-gray-700">{day}</span>
                  </div>
                  <div className="divide-y divide-gray-100 min-h-[250px]">
                    {entriesByDay[day].length === 0 ? (
                      <div className="px-3 py-8 text-center text-xs text-gray-400">Free</div>
                    ) : (
                      entriesByDay[day].map(entry => (
                        <div key={entry.id} className="px-3 py-2 hover:bg-blue-50">
                          <p className="text-sm font-medium text-gray-900">{entry.subject || 'No subject'}</p>
                          <p className="text-xs text-gray-500">{entry.start_time} - {entry.end_time}</p>
                          <p className="text-xs text-blue-600">{classMap[entry.class_id] || 'Unknown class'}</p>
                          {entry.room && <p className="text-xs text-gray-400">Room: {entry.room}</p>}
                        </div>
                      ))
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
