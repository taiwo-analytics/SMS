'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { CalendarRange, Plus, X, CheckCircle2, Edit } from 'lucide-react'
import SchoolLoader from '@/components/SchoolLoader'

type AcademicSession = {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  created_at: string
}

type AcademicTerm = {
  id: string
  session_id: string
  name: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  created_at: string
}

export default function AdminAcademicsPage() {
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<AcademicSession[]>([])
  const [terms, setTerms] = useState<AcademicTerm[]>([])

  const [showSessionModal, setShowSessionModal] = useState(false)
  const [sessionForm, setSessionForm] = useState({ name: '', start_date: '', end_date: '' })
  const [editingSession, setEditingSession] = useState<AcademicSession | null>(null)

  const [showTermModal, setShowTermModal] = useState(false)
  const [termForm, setTermForm] = useState({ session_id: '', name: '1st Term', start_date: '', end_date: '' })
  const [editingTerm, setEditingTerm] = useState<AcademicTerm | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        await Promise.all([loadSessions(), loadTerms()])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function loadSessions() {
    try {
      const { data, error } = await supabase.from('academic_sessions').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setSessions((data as AcademicSession[]) || [])
    } catch (e) {
      console.error('Load sessions error:', e)
      setSessions([])
    }
  }

  async function loadTerms() {
    try {
      const { data, error } = await supabase.from('academic_terms').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setTerms((data as AcademicTerm[]) || [])
    } catch (e) {
      console.error('Load terms error:', e)
      setTerms([])
    }
  }

  const termsBySession = useMemo(() => {
    const map = new Map<string, AcademicTerm[]>()
    for (const t of terms) {
      map.set(t.session_id, [...(map.get(t.session_id) || []), t])
    }
    // Sort terms by name for stable order
    Array.from(map.entries()).forEach(([k, v]) => {
      v.sort((a: AcademicTerm, b: AcademicTerm) => a.name.localeCompare(b.name))
      map.set(k, v)
    })
    return map
  }, [terms])

  async function saveSession() {
    const name = sessionForm.name.trim()
    if (!name) return

    try {
      if (editingSession) {
        const { error } = await supabase
          .from('academic_sessions')
          .update({
            name,
            start_date: sessionForm.start_date || null,
            end_date: sessionForm.end_date || null,
          })
          .eq('id', editingSession.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('academic_sessions').insert({
          name,
          start_date: sessionForm.start_date || null,
          end_date: sessionForm.end_date || null,
          is_active: false,
        })
        if (error) throw error
      }
      setShowSessionModal(false)
      setEditingSession(null)
      setSessionForm({ name: '', start_date: '', end_date: '' })
      await loadSessions()
    } catch (e: any) {
      alert(e?.message || 'Failed to save session')
    }
  }

  async function saveTerm() {
    if (!termForm.session_id || !termForm.name.trim()) return
    try {
      if (editingTerm) {
        const { error } = await supabase
          .from('academic_terms')
          .update({
            session_id: termForm.session_id,
            name: termForm.name.trim(),
            start_date: termForm.start_date || null,
            end_date: termForm.end_date || null,
          })
          .eq('id', editingTerm.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('academic_terms').insert({
          session_id: termForm.session_id,
          name: termForm.name.trim(),
          start_date: termForm.start_date || null,
          end_date: termForm.end_date || null,
          is_active: false,
        })
        if (error) throw error
      }
      setShowTermModal(false)
      setEditingTerm(null)
      setTermForm({ session_id: '', name: '1st Term', start_date: '', end_date: '' })
      await loadTerms()
    } catch (e: any) {
      alert(e?.message || 'Failed to save term')
    }
  }

  async function setActiveSession(sessionId: string) {
    try {
      await supabase.from('academic_sessions').update({ is_active: false }).neq('id', '')
      await supabase.from('academic_sessions').update({ is_active: true }).eq('id', sessionId)
      // When session changes, make its terms inactive first (optional)
      await loadSessions()
    } catch (e: any) {
      alert(e?.message || 'Failed to set active session')
    }
  }

  async function setActiveTerm(sessionId: string, termId: string) {
    try {
      await supabase.from('academic_terms').update({ is_active: false }).eq('session_id', sessionId)
      await supabase.from('academic_terms').update({ is_active: true }).eq('id', termId)
      await loadTerms()
    } catch (e: any) {
      alert(e?.message || 'Failed to set active term')
    }
  }

  if (loading) {
    return <SchoolLoader />
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <CalendarRange className="w-10 h-10 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-900">Academics</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTermModal(true)}
            className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-100"
          >
            <Plus className="w-5 h-5" />
            Add Term
          </button>
          <button
            onClick={() => setShowSessionModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Add Session
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {sessions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-10 text-center text-gray-600">
            No academic sessions yet. Click “Add Session”.
          </div>
        ) : (
          sessions.map((s) => (
            <div key={s.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-gray-900">{s.name}</h3>
                    {s.is_active && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-50 text-green-700 border border-green-200">
                        <CheckCircle2 className="w-4 h-4" />
                        Active Session
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {s.start_date ? new Date(s.start_date).toLocaleDateString() : '—'} →{' '}
                    {s.end_date ? new Date(s.end_date).toLocaleDateString() : '—'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveSession(s.id)}
                  className="px-4 py-2 rounded-lg border hover:bg-gray-50"
                >
                  Set Active
                </button>
                <button
                  onClick={() => {
                    setEditingSession(s)
                    setSessionForm({
                      name: s.name || '',
                      start_date: s.start_date || '',
                      end_date: s.end_date || '',
                    })
                    setShowSessionModal(true)
                  }}
                  className="ml-2 px-4 py-2 rounded-lg border hover:bg-gray-50"
                  title="Edit session"
                >
                  <Edit className="inline w-4 h-4 mr-1" />
                  Edit
                </button>
              </div>

              <div className="mt-4">
                <h4 className="font-semibold text-gray-900 mb-2">Terms</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(termsBySession.get(s.id) || []).length === 0 ? (
                    <div className="col-span-full text-sm text-gray-600">No terms yet for this session.</div>
                  ) : (
                    (termsBySession.get(s.id) || []).map((t) => (
                      <div key={t.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">{t.name}</p>
                              {t.is_active && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              {t.start_date ? new Date(t.start_date).toLocaleDateString() : '—'} →{' '}
                              {t.end_date ? new Date(t.end_date).toLocaleDateString() : '—'}
                            </p>
                          </div>
                          <button
                            onClick={() => setActiveTerm(s.id, t.id)}
                            className="px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm"
                          >
                            Set Active
                          </button>
                          <button
                            onClick={() => {
                              setEditingTerm(t)
                              setTermForm({
                                session_id: t.session_id,
                                name: t.name,
                                start_date: t.start_date || '',
                                end_date: t.end_date || '',
                              })
                              setShowTermModal(true)
                            }}
                            className="ml-2 px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm"
                            title="Edit term"
                          >
                            <Edit className="inline w-4 h-4 mr-1" />
                            Edit
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Session modal */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{editingSession ? 'Edit Academic Session' : 'Add Academic Session'}</h3>
              <button onClick={() => setShowSessionModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Session Name *</label>
                <input
                  value={sessionForm.name}
                  onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., 2025/2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={sessionForm.start_date}
                    onChange={(e) => setSessionForm({ ...sessionForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={sessionForm.end_date}
                    onChange={(e) => setSessionForm({ ...sessionForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setShowSessionModal(false)} className="px-4 py-2 border rounded-lg">
                  Cancel
                </button>
                <button onClick={saveSession} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                  {editingSession ? 'Save' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Term modal */}
      {showTermModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{editingTerm ? 'Edit Term' : 'Add Term'}</h3>
              <button onClick={() => setShowTermModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Session *</label>
                <select
                  value={termForm.session_id}
                  onChange={(e) => setTermForm({ ...termForm, session_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select session</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term Name *</label>
                <select
                  value={termForm.name}
                  onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="1st Term">1st Term</option>
                  <option value="2nd Term">2nd Term</option>
                  <option value="3rd Term">3rd Term</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={termForm.start_date}
                    onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={termForm.end_date}
                    onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setShowTermModal(false)} className="px-4 py-2 border rounded-lg">
                  Cancel
                </button>
                <button onClick={saveTerm} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                  {editingTerm ? 'Save' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

