'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Book, Plus, Edit, Trash2, X, Link2 } from 'lucide-react'
import { Class, Teacher } from '@/types/database'

type Subject = {
  id: string
  name: string
  code?: string | null
  created_at: string
}

type ClassSubjectAssignment = {
  id: string
  class_id: string
  subject_id: string
  teacher_id: string
  created_at: string
}

export default function AdminSubjectsPage() {
  const [loading, setLoading] = useState(true)

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [assignments, setAssignments] = useState<ClassSubjectAssignment[]>([])

  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', departments: [] as string[] })

  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignForm, setAssignForm] = useState({ class_id: '', subject_id: '', teacher_id: '' })
  const [assignClasses, setAssignClasses] = useState<string[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        await Promise.all([loadSubjects(), loadTeachers(), loadClasses(), loadAssignments()])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function loadSubjects() {
    try {
      const { data, error } = await supabase.from('subjects').select('*').order('name')
      if (error) throw error
      setSubjects((data as Subject[]) || [])
    } catch (e) {
      console.error('Load subjects error:', e)
      setSubjects([])
    }
  }

  async function loadTeachers() {
    try {
      const { data, error } = await supabase.from('teachers').select('*').order('full_name')
      if (error) throw error
      setTeachers((data as Teacher[]) || [])
    } catch (e) {
      console.error('Load teachers error:', e)
      setTeachers([])
    }
  }

  async function loadClasses() {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('class_level', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      setClasses((data as Class[]) || [])
    } catch (e) {
      console.error('Load classes error:', e)
      setClasses([])
    }
  }

  async function loadAssignments() {
    try {
      const { data, error } = await supabase
        .from('class_subject_teachers')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setAssignments((data as ClassSubjectAssignment[]) || [])
    } catch (e) {
      console.error('Load assignments error:', e)
      setAssignments([])
    }
  }

  const SENIOR_LEVELS = ['SS1', 'SS2', 'SS3']

  const filteredSubjectsForAssign = useMemo(() => {
    // No department-based filtering; show all subjects
    return subjects
  }, [subjects])

  const assignedClassCategory = useMemo(() => {
    if (!assignForm.class_id) return null
    const cls = classes.find((c) => c.id === assignForm.class_id)
    if (!cls) return null
    const u = (cls.class_level || '').toUpperCase()
    if (u.startsWith('JSS')) return 'Junior'
    if (u.startsWith('SS')) return 'Senior'
    return null
  }, [assignForm.class_id, classes])

  const assignmentRows = useMemo(() => {
    const classById = new Map(classes.map((c) => [c.id, c]))
    const teacherById = new Map(teachers.map((t) => [t.id, t]))
    const subjectById = new Map(subjects.map((s) => [s.id, s]))

    return assignments.map((a) => {
      const cls = classById.get(a.class_id)
      const teacher = teacherById.get(a.teacher_id)
      const subject = subjectById.get(a.subject_id)
      return {
        ...a,
        class_name: cls ? `${cls.class_level || cls.name}` : 'Unknown class',
        teacher_name: teacher?.full_name || 'Unknown teacher',
        subject_name: subject?.name || 'Unknown subject',
      }
    })
  }, [assignments, classes, teachers, subjects])

  const overviewRows = useMemo(() => {
    const classById = new Map(classes.map((c) => [c.id, c]))
    const subjectById = new Map(subjects.map((s) => [s.id, s]))
    const teacherById = new Map(teachers.map((t) => [t.id, t.full_name]))
    const rows: Record<string, { subject: string; junior: string[]; senior: string[]; teachers: Set<string>; teacherCounts: Map<string, number> }> = {}
    assignments.forEach((a) => {
      const sub = subjectById.get(a.subject_id)
      if (!sub) return
      const key = a.subject_id
      if (!rows[key]) rows[key] = { subject: sub.name, junior: [], senior: [], teachers: new Set(), teacherCounts: new Map() }
      const cls = classById.get(a.class_id)
      const tname = teacherById.get(a.teacher_id)
      if (tname) {
        rows[key].teachers.add(tname)
        rows[key].teacherCounts.set(tname, (rows[key].teacherCounts.get(tname) || 0) + 1)
      }
      if (cls) {
        const label = `${cls.name}${cls.class_level ? ` (${cls.class_level})` : ''}`
        const lvl = (cls.class_level || cls.name || '').toUpperCase()
        if (lvl.startsWith('JSS')) rows[key].junior.push(label)
        else if (lvl.startsWith('SS')) rows[key].senior.push(label)
        else rows[key].junior.push(label)
      }
    })
    return Object.values(rows).map((r) => ({
      subject: r.subject,
      junior: Array.from(new Set(r.junior)).sort().join('; '),
      senior: Array.from(new Set(r.senior)).sort().join('; '),
      teachers: Array.from(r.teachers).sort().join('; '),
      teacher_counts: Array.from(r.teacherCounts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, count]) => `${name}: ${count}`)
        .join('; ')
    }))
  }, [assignments, classes, subjects, teachers])

  async function handleSaveSubject() {
    const name = subjectForm.name.trim()
    const code = subjectForm.code.trim()
    const departments = subjectForm.departments && subjectForm.departments.length ? subjectForm.departments : null
    if (!name) return

    try {
      if (editingSubject) {
        const { error, status } = await supabase
          .from('subjects')
          .update({ name, code: code || null, departments })
          .eq('id', editingSubject.id)
        if (error) {
          const msg = String(error.message || '')
          const needsFallback = msg.includes("schema cache") || msg.toLowerCase().includes("departments") || status === 400
          if (!needsFallback) throw error
          const { error: err2 } = await supabase
            .from('subjects')
            .update({ name, code: code || null, department: departments ? departments.join(';') : null })
            .eq('id', editingSubject.id)
          if (err2) throw err2
        }
      } else {
        const res = await supabase.from('subjects').insert({ name, code: code || null, departments })
        if (res.error) {
          const msg = String(res.error.message || '')
          const needsFallback = msg.includes("schema cache") || msg.toLowerCase().includes("departments")
          if (!needsFallback) throw res.error
          const { error: err2 } = await supabase
            .from('subjects')
            .insert({ name, code: code || null, department: departments ? departments.join(';') : null })
          if (err2) throw err2
        }
      }

      setShowSubjectModal(false)
      setEditingSubject(null)
      setSubjectForm({ name: '', code: '', departments: [] })
      await loadSubjects()
    } catch (e: any) {
      alert(e?.message || 'Failed to save subject')
    }
  }

  async function handleDeleteSubject(subjectId: string) {
    if (!confirm('Delete this subject? This will also remove its class-teacher links.')) return

    try {
      await supabase.from('class_subject_teachers').delete().eq('subject_id', subjectId)
      const { error } = await supabase.from('subjects').delete().eq('id', subjectId)
      if (error) throw error
      await Promise.all([loadSubjects(), loadAssignments()])
    } catch (e: any) {
      alert(e?.message || 'Failed to delete subject')
    }
  }

  async function handleAssignTeacher() {
    if (!assignForm.subject_id || !assignForm.teacher_id) return
    const targetClasses = Array.from(
      new Set([assignForm.class_id, ...assignClasses].filter(Boolean))
    )
    if (targetClasses.length === 0) return

    try {
      for (const cid of targetClasses) {
        const { error } = await supabase.from('class_subject_teachers').upsert({
          class_id: cid,
          subject_id: assignForm.subject_id,
          teacher_id: assignForm.teacher_id,
        })
        if (error) throw error
      }

      setShowAssignModal(false)
      setAssignForm({ class_id: '', subject_id: '', teacher_id: '' })
      setAssignClasses([])
      await loadAssignments()
    } catch (e: any) {
      alert(e?.message || 'Failed to assign teacher')
    }
  }

  async function handleDeleteAssignment(id: string) {
    if (!confirm('Remove this subject-teacher link?')) return
    try {
      const { error } = await supabase.from('class_subject_teachers').delete().eq('id', id)
      if (error) throw error
      await loadAssignments()
    } catch (e: any) {
      alert(e?.message || 'Failed to remove link')
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Book className="w-10 h-10 text-indigo-600" />
          <h2 className="text-3xl font-bold text-gray-900">Subjects</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAssignForm({ class_id: '', subject_id: '', teacher_id: '' })
              setAssignClasses([])
              setShowAssignModal(true)
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            <Link2 className="w-5 h-5" />
            Link Teacher
          </button>
          <button
            onClick={() => {
              setEditingSubject(null)
              setSubjectForm({ name: '', code: '', departments: [] })
              setShowSubjectModal(true)
            }}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-black"
          >
            <Plus className="w-5 h-5" />
            Add Subject
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Subjects list */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">All Subjects</h3>
            <p className="text-sm text-gray-600">Create subjects used across classes, then link teachers.</p>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subjects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                    No subjects yet. Click "Add Subject".
                  </td>
                </tr>
              ) : (
                subjects.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{s.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{s.code || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const arr = ((s as any).departments as string[] | null | undefined)
                          ?? ((s as any).department
                            ? String((s as any).department).split(/[;,]/).map((x) => x.trim()).filter(Boolean)
                            : null)
                        if (!arr || arr.length === 0) return <span className="text-xs text-gray-400">Core</span>
                        const tokens = arr
                        return (
                          <div className="flex flex-wrap gap-1">
                            {tokens.map((tok: string) => (
                              <span key={tok} className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                tok === 'Science' ? 'bg-blue-100 text-blue-700' :
                                tok === 'Humanities' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-purple-100 text-purple-700'
                              }`}>{tok}</span>
                            ))}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingSubject(s)
                            const deps = ((s as any).departments as string[] | null | undefined)
                              ?? ((s as any).department
                                ? String((s as any).department).split(/[;,]/).map((x) => x.trim()).filter(Boolean)
                                : [])
                            setSubjectForm({ name: s.name, code: s.code || '', departments: deps })
                            setShowSubjectModal(true)
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSubject(s.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      <div className="mt-6 bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Subject Overview</h3>
          <p className="text-sm text-gray-600">Quick view with teachers and per‑teacher totals.</p>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Junior Classes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Senior Classes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teachers</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher Totals</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {overviewRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                  No data yet.
                </td>
              </tr>
            ) : (
              overviewRows.map((r, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{r.subject}</div>
                  </td>
                  <td className="px-6 py-4"><div className="text-sm text-gray-700">{r.junior || '—'}</div></td>
                  <td className="px-6 py-4"><div className="text-sm text-gray-700">{r.senior || '—'}</div></td>
                  <td className="px-6 py-4"><div className="text-sm text-gray-700">{r.teachers || '—'}</div></td>
                  <td className="px-6 py-4"><div className="text-sm text-gray-700">{(r as any).teacher_counts || '—'}</div></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Subject modal */}
      {showSubjectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{editingSubject ? 'Edit Subject' : 'Add Subject'}</h3>
              <button onClick={() => setShowSubjectModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name *</label>
                <input
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Mathematics"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., MTH"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Departments <span className="text-gray-400 font-normal">(leave empty for core/all students)</span></label>
                <div className="border rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-2">
                    {['Science', 'Humanities', 'Arts'].map((dep) => {
                      const checked = subjectForm.departments.includes(dep)
                      return (
                        <label key={dep} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSubjectForm((prev) => {
                                const set = new Set(prev.departments)
                                if (e.target.checked) set.add(dep)
                                else set.delete(dep)
                                return { ...prev, departments: Array.from(set) }
                              })
                            }}
                          />
                          <span>{dep}</span>
                        </label>
                      )
                    })}
                  </div>
                  {subjectForm.departments.length > 1 && (
                    <div className="mt-2 text-xs text-gray-600">
                      Selected: {subjectForm.departments.join(', ')}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setShowSubjectModal(false)} className="px-4 py-2 border rounded-lg">
                  Cancel
                </button>
                <button onClick={handleSaveSubject} className="px-4 py-2 bg-gray-900 text-white rounded-lg">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Link Teacher to Subject</h3>
              <button onClick={() => setShowAssignModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
                <select
                  value={assignForm.class_id}
                  onChange={(e) => setAssignForm({ ...assignForm, class_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {(c.class_level && c.class_level.trim()) ? c.class_level : c.name}
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const ids = classes
                        .filter((c) => ((c.class_level || c.name || '').toUpperCase().startsWith('JSS')))
                        .map((c) => c.id)
                      setAssignClasses(Array.from(new Set([...assignClasses, ...ids].filter((id) => id !== assignForm.class_id))))
                    }}
                    className="px-2.5 py-1 text-xs border rounded-lg hover:bg-gray-50"
                  >
                    Select all junior
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const ids = classes
                        .filter((c) => ((c.class_level || c.name || '').toUpperCase().startsWith('SS')))
                        .map((c) => c.id)
                      setAssignClasses(Array.from(new Set([...assignClasses, ...ids].filter((id) => id !== assignForm.class_id))))
                    }}
                    className="px-2.5 py-1 text-xs border rounded-lg hover:bg-gray-50"
                  >
                    Select all senior
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignClasses([])}
                    className="px-2.5 py-1 text-xs border rounded-lg hover:bg-gray-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Also assign to these classes (optional)
                </label>
                <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
                  {classes
                    .filter((c) => c.id !== assignForm.class_id)
                    .map((c) => {
                      const label = `${c.name}${c.class_level ? ` (${c.class_level})` : ''}`
                      const checked = assignClasses.includes(c.id)
                      return (
                        <label key={c.id} className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAssignClasses((prev) => Array.from(new Set(prev.concat(c.id))))
                              } else {
                                setAssignClasses((prev) => prev.filter((id) => id !== c.id))
                              }
                            }}
                          />
                          <span className="text-sm">{label}</span>
                        </label>
                      )
                    })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject *
                  {assignedClassCategory && (
                    <span className="ml-2 text-xs text-indigo-600 font-normal">{assignedClassCategory} class</span>
                  )}
                </label>
                <select
                  value={assignForm.subject_id}
                  onChange={(e) => setAssignForm({ ...assignForm, subject_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select subject</option>
                  {filteredSubjectsForAssign.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.code ? ` (${s.code})` : ''}
                      {Array.isArray((s as any).departments) && (s as any).departments.length ? ` — ${(s as any).departments.join(', ')}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teacher *</label>
                <select
                  value={assignForm.teacher_id}
                  onChange={(e) => setAssignForm({ ...assignForm, teacher_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select teacher</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 border rounded-lg">
                  Cancel
                </button>
                <button onClick={handleAssignTeacher} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
                  Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

