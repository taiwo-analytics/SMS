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
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '' })

  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignForm, setAssignForm] = useState({ class_id: '', subject_id: '', teacher_id: '' })

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
        class_name: cls ? `${cls.name}${cls.class_level ? ` (${cls.class_level})` : ''}${cls.department ? ` - ${cls.department}` : ''}` : 'Unknown class',
        teacher_name: teacher?.full_name || 'Unknown teacher',
        subject_name: subject?.name || 'Unknown subject',
      }
    })
  }, [assignments, classes, teachers, subjects])

  async function handleSaveSubject() {
    const name = subjectForm.name.trim()
    const code = subjectForm.code.trim()
    if (!name) return

    try {
      if (editingSubject) {
        const { error } = await supabase
          .from('subjects')
          .update({ name, code: code || null })
          .eq('id', editingSubject.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('subjects').insert({ name, code: code || null })
        if (error) throw error
      }

      setShowSubjectModal(false)
      setEditingSubject(null)
      setSubjectForm({ name: '', code: '' })
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
    if (!assignForm.class_id || !assignForm.subject_id || !assignForm.teacher_id) return

    try {
      // Unique per (class_id, subject_id) so a class has one teacher per subject
      const { error } = await supabase.from('class_subject_teachers').upsert({
        class_id: assignForm.class_id,
        subject_id: assignForm.subject_id,
        teacher_id: assignForm.teacher_id,
      })
      if (error) throw error

      setShowAssignModal(false)
      setAssignForm({ class_id: '', subject_id: '', teacher_id: '' })
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
              setSubjectForm({ name: '', code: '' })
              setShowSubjectModal(true)
            }}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-black"
          >
            <Plus className="w-5 h-5" />
            Add Subject
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subjects.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-gray-500">
                    No subjects yet. Click “Add Subject”.
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
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingSubject(s)
                            setSubjectForm({ name: s.name, code: s.code || '' })
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

        {/* Assignments list */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">Class Subject Links</h3>
            <p className="text-sm text-gray-600">Assign a teacher to teach a subject in a class.</p>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {assignmentRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                    No links yet. Click “Link Teacher”.
                  </td>
                </tr>
              ) : (
                assignmentRows.map((a: any) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{a.class_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{a.subject_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{a.teacher_name}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteAssignment(a.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Remove link"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
                      {c.name}
                      {c.class_level ? ` (${c.class_level})` : ''}
                      {c.department ? ` - ${c.department}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <select
                  value={assignForm.subject_id}
                  onChange={(e) => setAssignForm({ ...assignForm, subject_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.code ? ` (${s.code})` : ''}
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

