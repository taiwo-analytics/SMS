'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Clock, Plus, Trash2, X, Pencil } from 'lucide-react'
import { Class, Teacher, Timetable } from '@/types/database'
import SchoolLoader from '@/components/SchoolLoader'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00'
]

export default function AdminTimetablePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<Timetable[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [sessions, setSessions] = useState<any[]>([])
  const [terms, setTerms] = useState<any[]>([])
  const [selectedSession, setSelectedSession] = useState<string>('')
  const [selectedTerm, setSelectedTerm] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Timetable | null>(null)
  const [formData, setFormData] = useState({
    class_id: '', subject: '', teacher_id: '', day_of_week: 'Monday', start_time: '08:00', end_time: '09:00', duration: '60', room: ''
  })
  const [assessmentType, setAssessmentType] = useState<'CA1' | 'CA2' | 'Exam'>('CA1')
  const [assessmentEntries, setAssessmentEntries] = useState<Timetable[]>([])
  const [showAssessmentModal, setShowAssessmentModal] = useState(false)
  const [assessmentFormData, setAssessmentFormData] = useState({
    class_id: '', subject: '', day_of_week: 'Monday', start_time: '08:00', end_time: '09:00', duration: '60'
  })
  const [assessmentTableMissing, setAssessmentTableMissing] = useState(false)
  const [editingAssessment, setEditingAssessment] = useState<Timetable | null>(null)

  const checkAuth = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) {
        console.error('Auth error:', authError)
        router.push('/auth/login')
        return
      }
      if (!user) {
        router.push('/auth/login')
        return
      }
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profileError) {
        console.error('Profile error:', profileError)
        router.push('/auth/login')
        return
      }
      if (profile?.role !== 'admin') {
        router.push('/')
        return
      }
    } catch (e) {
      console.error('Error checking auth:', e)
    } finally {
      setLoading(false)
    }
    // Load sessions/terms for filter
    try {
      const { data: sessionsData } = await supabase
        .from('academic_sessions')
        .select('id, name, is_active')
        .order('created_at', { ascending: false })
      setSessions(sessionsData || [])
      const activeSession = (sessionsData || []).find((s: any) => s.is_active) || (sessionsData || [])[0]
      setSelectedSession(activeSession?.id || '')
      if (activeSession?.id) {
        const { data: termsData } = await supabase
          .from('academic_terms')
          .select('id, name, is_active, session_id')
          .eq('session_id', activeSession.id)
          .order('created_at', { ascending: false })
        setTerms(termsData || [])
        const activeTerm = (termsData || []).find((t: any) => t.is_active) || (termsData || [])[0]
        setSelectedTerm(activeTerm?.id || '')
      }
    } catch {}
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [classesRes, teachersRes] = await Promise.all([
        fetch('/api/admin/classes'),
        fetch('/api/admin/users/list/teachers'),
      ])
      const classesJson = await classesRes.json()
      const teachersJson = await teachersRes.json()
      if (!classesRes.ok) throw new Error(classesJson.error || 'Failed to load classes')
      if (!teachersRes.ok) throw new Error(teachersJson.error || 'Failed to load teachers')
      const classesList = (classesJson.classes || []) as Class[]
      const teachersList = (teachersJson.teachers || []) as Teacher[]
      setClasses(classesList)
      setTeachers(teachersList)
      if (classesList.length > 0) {
        setSelectedClass(classesList[0].id)
        if (!formData.class_id) {
          setFormData((fd) => ({ ...fd, class_id: classesList[0].id }))
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setClasses([])
      setTeachers([])
    }
  }, [])

  const loadEntries = useCallback(async () => {
    try {
      let q = supabase
        .from('timetables')
        .select('*')
        .eq('class_id', selectedClass)
        .order('start_time')
      q = q.or(`term_id.eq.${selectedTerm},term_id.is.null`)
      const { data, error } = await q
      if (error && /term_id/i.test(String(error.message || ''))) {
        const { data: fallbackData, error: fbErr } = await supabase
          .from('timetables')
          .select('*')
          .eq('class_id', selectedClass)
          .order('start_time')
        if (fbErr) throw fbErr
        setEntries(fallbackData || [])
      } else {
        if (error) throw error
        setEntries(data || [])
      }
    } catch (error) {
      console.error('Error loading timetable:', error)
    }
  }, [selectedClass, selectedTerm])

  useEffect(() => { checkAuth() }, [checkAuth])
  useEffect(() => { if (!loading) loadData() }, [loading, loadData])
  useEffect(() => { if (selectedClass) loadEntries() }, [selectedClass, selectedTerm, loadEntries])

 

  const handleCreate = async () => {
    if (!formData.class_id || !formData.day_of_week || !formData.start_time) {
      alert('Please fill in required fields'); return
    }
    try {
      const pad2 = (n: number) => String(n).padStart(2, '0')
      const addMinutes = (hhmm: string, mins: number) => {
        const [h, m] = hhmm.split(':').map(Number)
        const d = new Date(2000, 0, 1, h, m, 0, 0)
        d.setMinutes(d.getMinutes() + mins)
        return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
      }
      const finalEnd = formData.end_time && formData.end_time.trim()
        ? formData.end_time
        : (formData.duration ? addMinutes(formData.start_time, Number(formData.duration)) : addMinutes(formData.start_time, 60))
      const { error } = await supabase.from('timetables').insert({
        class_id: formData.class_id,
        subject: formData.subject || null,
        teacher_id: formData.teacher_id || null,
        term_id: selectedTerm || null,
        day_of_week: formData.day_of_week,
        start_time: formData.start_time,
        end_time: finalEnd,
        room: formData.room || null,
      })
      if (error) throw error
      setShowModal(false)
      setFormData({ class_id: selectedClass, subject: '', teacher_id: '', day_of_week: 'Monday', start_time: '08:00', end_time: '09:00', duration: '60', room: '' })
      loadEntries()
    } catch (error: any) {
      alert(error.message || 'Failed to create entry')
    }
  }

  const openEditModal = (entry: Timetable) => {
    setEditingEntry(entry)
    setFormData({
      class_id: entry.class_id,
      subject: entry.subject || '',
      teacher_id: entry.teacher_id || '',
      day_of_week: entry.day_of_week,
      start_time: entry.start_time,
      end_time: entry.end_time,
      duration: String(Math.max(1, Math.round((toMinutes(entry.end_time) - toMinutes(entry.start_time))))) ,
      room: entry.room || '',
    })
    setShowModal(true)
  }

  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  }
  const formatDuration = (entry: Timetable) => {
    const mins = Math.max(0, toMinutes(entry.end_time) - toMinutes(entry.start_time))
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h && m) return `${h}h ${m}m`
    if (h) return `${h}h`
    return `${m}m`
  }

  const handleUpdate = async () => {
    if (!editingEntry) return
    if (!formData.class_id || !formData.day_of_week || !formData.start_time) return
    try {
      const pad2 = (n: number) => String(n).padStart(2, '0')
      const addMinutes = (hhmm: string, mins: number) => {
        const [h, m] = hhmm.split(':').map(Number)
        const d = new Date(2000, 0, 1, h, m, 0, 0)
        d.setMinutes(d.getMinutes() + mins)
        return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
      }
      const finalEnd = formData.end_time && formData.end_time.trim()
        ? formData.end_time
        : (formData.duration ? addMinutes(formData.start_time, Number(formData.duration)) : addMinutes(formData.start_time, 60))
      const { error } = await supabase
        .from('timetables')
        .update({
          class_id: formData.class_id,
          subject: formData.subject || null,
          teacher_id: formData.teacher_id || null,
          term_id: selectedTerm || null,
          day_of_week: formData.day_of_week,
          start_time: formData.start_time,
          end_time: finalEnd,
          room: formData.room || null,
        })
        .eq('id', editingEntry.id)
      if (error) throw error
      setShowModal(false)
      setEditingEntry(null)
      setFormData({ class_id: selectedClass, subject: '', teacher_id: '', day_of_week: 'Monday', start_time: '08:00', end_time: '09:00', duration: '60', room: '' })
      await loadEntries()
    } catch (e: any) {
      alert(e?.message || 'Failed to update entry')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this timetable entry?')) return
    try {
      await supabase.from('timetables').delete().eq('id', id)
      loadEntries()
    } catch (error: any) {
      alert(error.message || 'Failed to delete')
    }
  }

  const teacherMap = useMemo(() => {
    const map: Record<string, string> = {}
    teachers.forEach(t => { map[t.id] = t.full_name })
    return map
  }, [teachers])
  const classMap = useMemo(() => {
    const map: Record<string, string> = {}
    classes.forEach(c => { map[c.id] = (c as any).class_level || c.name || 'Untitled' })
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

  const loadAssessmentEntries = useCallback(async () => {
    try {
      if (!selectedClass) { setAssessmentEntries([]); return }
      const { data, error } = await supabase
        .from('assessment_timetables')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('assessment_type', assessmentType)
      if (error) throw error
      setAssessmentEntries(data || [])
    } catch (e) {
      console.error('Error loading assessment timetable:', e)
      const msg = (e as any)?.message || ''
      if (msg.includes('assessment_timetables')) {
        setAssessmentTableMissing(true)
      }
      setAssessmentEntries([])
    }
  }, [selectedClass, assessmentType])

  const handleDeleteAssessment = async (id: string) => {
    try {
      await supabase.from('assessment_timetables').delete().eq('id', id)
      await loadAssessmentEntries()
    } catch (error: any) {
      alert(error.message || 'Failed to delete')
    }
  }

  const openEditAssessmentModal = (entry: Timetable) => {
    setEditingAssessment(entry)
    setAssessmentFormData({
      class_id: entry.class_id,
      subject: entry.subject || '',
      day_of_week: entry.day_of_week,
      start_time: entry.start_time,
      end_time: entry.end_time,
      duration: String(Math.max(1, Math.round(toMinutes(entry.end_time) - toMinutes(entry.start_time)))),
    })
    setShowAssessmentModal(true)
  }

  const handleUpdateAssessment = async () => {
    if (!editingAssessment) return
    if (!assessmentFormData.class_id || !assessmentFormData.day_of_week || !assessmentFormData.start_time) {
      alert('Fill required fields'); return
    }
    const pad2 = (n: number) => String(n).padStart(2, '0')
    const addMinutes = (hhmm: string, mins: number) => {
      const [h, m] = hhmm.split(':').map(Number)
      const d = new Date(2000, 0, 1, h, m, 0, 0)
      d.setMinutes(d.getMinutes() + mins)
      return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    }
    const finalEnd = assessmentFormData.end_time && assessmentFormData.end_time.trim()
      ? assessmentFormData.end_time
      : (assessmentFormData.duration ? addMinutes(assessmentFormData.start_time, Number(assessmentFormData.duration)) : addMinutes(assessmentFormData.start_time, 60))
    const { error } = await supabase
      .from('assessment_timetables')
      .update({
        class_id: assessmentFormData.class_id,
        subject: assessmentFormData.subject || null,
        day_of_week: assessmentFormData.day_of_week,
        start_time: assessmentFormData.start_time,
        end_time: finalEnd,
      })
      .eq('id', editingAssessment.id)
    if (error) { alert(error.message || 'Failed to update'); return }
    setShowAssessmentModal(false)
    setEditingAssessment(null)
    setAssessmentFormData({ class_id: selectedClass, subject: '', day_of_week: 'Monday', start_time: '08:00', end_time: '09:00', duration: '60' })
    await loadAssessmentEntries()
  }

  useEffect(() => { if (selectedClass) loadAssessmentEntries() }, [selectedClass, assessmentType, loadAssessmentEntries])
  useEffect(() => {
    if (!formData.class_id) return
    const cls = classes.find(c => c.id === formData.class_id)
    const autoTeacher = cls?.teacher_id || ''
    if (autoTeacher && formData.teacher_id !== autoTeacher) {
      setFormData((fd) => ({ ...fd, teacher_id: autoTeacher }))
    }
  }, [formData.class_id, classes]) 

  if (loading) {
    return <SchoolLoader />
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Clock className="w-10 h-10 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-900">Timetable</h2>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            {classes.length === 0 ? (
              <option value="">No classes available</option>
            ) : (
              classes.map(c => (
                <option key={c.id} value={c.id}>{(c as any).class_level || c.name || 'Untitled'}</option>
              ))
            )}
          </select>
          <button
            onClick={() => {
              setFormData({ ...formData, class_id: selectedClass })
              setShowModal(true)
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Add Entry
          </button>
        </div>
      </div>
      {classes.length === 0 && (
        <div className="mb-4 border rounded-lg px-4 py-3 text-sm bg-yellow-50 border-yellow-200 text-yellow-800">
          No classes available. Create a class first.
          <button
            onClick={() => router.push('/admin/classes')}
            className="ml-2 inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Classes
          </button>
        </div>
      )}

      {/* Weekly Grid */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="divide-y divide-gray-200">
          {DAYS.map(day => (
            <div key={day} className="grid grid-cols-12">
              <div className="col-span-2 bg-gray-50 px-3 py-3">
                <span className="text-sm font-semibold text-gray-700">{day}</span>
              </div>
              <div className="col-span-10 px-2 py-2">
                {entriesByDay[day].length === 0 ? (
                  <div className="py-2 text-xs text-gray-400">No classes</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {entriesByDay[day].map(entry => (
                      <div key={entry.id} className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 min-w-[140px]">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{entry.subject || 'No subject'}</p>
                          <p className="text-xs text-gray-500">{entry.start_time} – {entry.end_time}</p>
                          {entry.teacher_id && (
                            <p className="text-xs text-blue-600 truncate">{teacherMap[entry.teacher_id] || 'Unknown'}</p>
                          )}
                          <p className="text-xs text-gray-500">{formatDuration(entry)}</p>
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0 mt-0.5">
                          <button
                            onClick={() => openEditModal(entry)}
                            className="text-blue-400 hover:text-blue-600"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Assessment Timetable (CA1 / CA2 / Exam) */}
      <div className="mt-6 bg-white rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Clock className="w-6 h-6 text-purple-600" />
            <h3 className="text-lg font-semibold">Assessments Timetable</h3>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={assessmentType}
              onChange={(e) => setAssessmentType(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="CA1">CA1</option>
              <option value="CA2">CA2</option>
              <option value="Exam">Exams</option>
            </select>
            <button
              onClick={() => { setAssessmentFormData({ ...assessmentFormData, class_id: selectedClass }); setShowAssessmentModal(true) }}
              disabled={assessmentTableMissing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${assessmentTableMissing ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
            >
              <Plus className="w-5 h-5" />
              Add Assessment Entry
            </button>
          </div>
        </div>
        {assessmentTableMissing && (
          <div className="px-4 py-3 text-sm bg-yellow-50 text-yellow-800 border-b border-yellow-200">
            Assessments table not found. Please apply the database migration to create &quot;assessment_timetables&quot;.
          </div>
        )}
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">Day</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subjects &amp; Times</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {assessmentEntries.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-6 py-12 text-center text-gray-500">
                  No {assessmentType} timetable entries for this class.
                </td>
              </tr>
            ) : (
              (() => {
                const byDay: Record<string, Timetable[]> = {}
                DAYS.forEach(d => { byDay[d] = [] })
                assessmentEntries.forEach(e => {
                  if (byDay[e.day_of_week]) byDay[e.day_of_week].push(e)
                })
                return DAYS.filter(d => byDay[d].length > 0).map(day => (
                  <tr key={day} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 align-top w-32">{day}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3">
                        {byDay[day]
                          .sort((a, b) => a.start_time.localeCompare(b.start_time))
                          .map(entry => (
                            <div key={entry.id} className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 min-w-[140px]">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{entry.subject || '—'}</p>
                                <p className="text-xs text-gray-500">{entry.start_time} – {entry.end_time}</p>
                                <p className="text-xs text-purple-600">{formatDuration(entry)}</p>
                              </div>
                              <div className="flex flex-col gap-1 flex-shrink-0 mt-0.5">
                                <button
                                  onClick={() => openEditAssessmentModal(entry)}
                                  className="text-blue-400 hover:text-blue-600"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteAssessment(entry.id)}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))
              })()
            )}
          </tbody>
        </table>
      </div>

      {/* Add Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{editingEntry ? 'Edit Timetable Entry' : 'Add Timetable Entry'}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  value={formData.class_id}
                  onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {classes.length === 0 ? (
                    <option value="">No classes available</option>
                  ) : (
                    classes.map(c => (
                      <option key={c.id} value={c.id}>{(c as any).class_level || c.name || 'Untitled'}</option>
                    ))
                  )}
                </select>
                {classes.length === 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    Create a class to add timetable entries.
                    <button
                      onClick={() => router.push('/admin/classes')}
                      className="ml-2 inline-flex items-center px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Go to Classes
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Mathematics"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
                <select
                  value={formData.teacher_id}
                  onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select teacher (optional)</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                <select
                  value={formData.day_of_week}
                  onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., 40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room (optional)</label>
                <input
                  type="text"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Room 101"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => { setShowModal(false); setEditingEntry(null) }} className="px-4 py-2 border rounded-lg">Cancel</button>
                {editingEntry ? (
                  <button
                    onClick={handleUpdate}
                    disabled={!formData.class_id}
                    className={`px-4 py-2 rounded-lg ${!formData.class_id ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                  >
                    Update
                  </button>
                ) : (
                  <button
                    onClick={handleCreate}
                    disabled={!formData.class_id}
                    className={`px-4 py-2 rounded-lg ${!formData.class_id ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                  >
                    Create
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Assessment Entry Modal */}
      {showAssessmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{editingAssessment ? `Edit ${assessmentType} Entry` : `Add ${assessmentType} Entry`}</h3>
              <button onClick={() => { setShowAssessmentModal(false); setEditingAssessment(null) }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  value={assessmentFormData.class_id}
                  onChange={(e) => setAssessmentFormData({ ...assessmentFormData, class_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {classes.length === 0 ? (
                    <option value="">No classes available</option>
                  ) : (
                    classes.map(c => (
                      <option key={c.id} value={c.id}>{(c as any).class_level || c.name || 'Untitled'}</option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={assessmentFormData.subject}
                  onChange={(e) => setAssessmentFormData({ ...assessmentFormData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Mathematics"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                <select
                  value={assessmentFormData.day_of_week}
                  onChange={(e) => setAssessmentFormData({ ...assessmentFormData, day_of_week: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={assessmentFormData.start_time}
                    onChange={(e) => setAssessmentFormData({ ...assessmentFormData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={assessmentFormData.end_time}
                    onChange={(e) => setAssessmentFormData({ ...assessmentFormData, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={assessmentFormData.duration}
                  onChange={(e) => setAssessmentFormData({ ...assessmentFormData, duration: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., 40"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => { setShowAssessmentModal(false); setEditingAssessment(null) }} className="px-4 py-2 border rounded-lg">Cancel</button>
                {editingAssessment ? (
                  <button
                    onClick={handleUpdateAssessment}
                    disabled={!assessmentFormData.class_id}
                    className={`px-4 py-2 rounded-lg ${!assessmentFormData.class_id ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                  >
                    Update
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      if (assessmentTableMissing) { alert('Assessments table missing. Please apply migration first.'); return }
                      if (!assessmentFormData.class_id || !assessmentFormData.day_of_week || !assessmentFormData.start_time) { alert('Fill required fields'); return }
                      const pad2 = (n: number) => String(n).padStart(2, '0')
                      const addMinutes = (hhmm: string, mins: number) => {
                        const [h, m] = hhmm.split(':').map(Number)
                        const d = new Date(2000, 0, 1, h, m, 0, 0)
                        d.setMinutes(d.getMinutes() + mins)
                        return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
                      }
                      const finalEnd = assessmentFormData.end_time && assessmentFormData.end_time.trim()
                        ? assessmentFormData.end_time
                        : (assessmentFormData.duration ? addMinutes(assessmentFormData.start_time, Number(assessmentFormData.duration)) : addMinutes(assessmentFormData.start_time, 60))
                      const { error } = await supabase
                        .from('assessment_timetables')
                        .insert({
                          class_id: assessmentFormData.class_id,
                          subject: assessmentFormData.subject || null,
                          assessment_type: assessmentType,
                          day_of_week: assessmentFormData.day_of_week,
                          start_time: assessmentFormData.start_time,
                          end_time: finalEnd,
                        })
                      if (error) { alert(error.message || 'Failed to add'); return }
                      setShowAssessmentModal(false)
                      setAssessmentFormData({ class_id: selectedClass, subject: '', day_of_week: 'Monday', start_time: '08:00', end_time: '09:00', duration: '60' })
                      await loadAssessmentEntries()
                    }}
                    disabled={!assessmentFormData.class_id}
                    className={`px-4 py-2 rounded-lg ${!assessmentFormData.class_id ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                  >
                    Create
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
