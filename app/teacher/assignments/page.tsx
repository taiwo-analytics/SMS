'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ClipboardList, BookOpen, Plus, Trash2, X, Calendar } from 'lucide-react'
import { Class, Assignment } from '@/types/database'

export default function TeacherAssignmentsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
  })

  const loadAssignments = useCallback(async () => {
    const res = await fetch(`/api/assignments?class_id=${selectedClass}`)
    const data = await res.json()
    setAssignments(data.assignments || [])
  }, [selectedClass])

  useEffect(() => {
    if (selectedClass) loadAssignments()
  }, [selectedClass, loadAssignments])

  const loadClasses = useCallback(async (userId: string) => {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (teacher) {
      const { data } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', teacher.id)

      setClasses(data || [])
      if (data && data.length > 0) {
        setSelectedClass(data[0].id)
      }
    }
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'teacher') { router.push('/'); return }

      await loadClasses(user.id)
    } catch {
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }, [router, loadClasses])

 

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

 

  const handleCreate = async () => {
    if (!formData.title.trim() || !selectedClass) return

    setSaving(true)
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: selectedClass,
          title: formData.title,
          description: formData.description || undefined,
          due_date: formData.due_date || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to create assignment')
        return
      }

      setShowModal(false)
      setFormData({ title: '', description: '', due_date: '' })
      loadAssignments()
    } catch {
      alert('Failed to create assignment')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assignment?')) return
    try {
      const res = await fetch(`/api/assignments?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to delete')
        return
      }
      loadAssignments()
    } catch {
      alert('Failed to delete assignment')
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <ClipboardList className="w-10 h-10 text-indigo-600" />
              <h2 className="text-3xl font-bold text-gray-900">Assignments</h2>
            </div>
            <button
              onClick={() => {
                setFormData({ title: '', description: '', due_date: '' })
                setShowModal(true)
              }}
              disabled={!selectedClass}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
              New Assignment
            </button>
          </div>

          {/* Class selector */}
          <div className="flex items-center gap-4 mb-6">
            <label className="text-sm font-medium text-gray-700">Class:</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a class</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} {cls.subject ? `- ${cls.subject}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedClass && assignments.length > 0 ? (
          <div className="space-y-4">
            {assignments.map((a) => (
              <div key={a.id} className="bg-white rounded-lg shadow p-5 border-l-4 border-indigo-400">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900">{a.title}</h4>
                    {a.description && (
                      <p className="text-sm text-gray-600 mt-1">{a.description}</p>
                    )}
                    {a.due_date && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-2">
                        <Calendar className="w-4 h-4" />
                        Due: {new Date(a.due_date).toLocaleDateString()}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Created: {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="text-red-500 hover:text-red-700 ml-4"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : selectedClass ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No assignments for this class yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <ClipboardList className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Select a class to manage assignments.</p>
          </div>
        )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">New Assignment</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Assignment title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !formData.title.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
