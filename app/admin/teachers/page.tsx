'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { GraduationCap, Plus, Edit, Trash2, X, BookOpen, User, Upload } from 'lucide-react'
import Papa from 'papaparse'
import { Teacher, Class } from '@/types/database'

export default function AdminTeachersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [teachers, setTeachers] = useState<(Teacher & { email?: string; classes?: Class[]; subjects?: string[] })[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<any[]>([])
  const [bulkType, setBulkType] = useState<'teacher' | 'student'>('teacher')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [formData, setFormData] = useState({ full_name: '', email: '', password: '', phone: '', gender: '', dob: '', address: '', status: '', admission: '' })
  const [assignData, setAssignData] = useState({ class_id: '', subject: '', class_level: '' })

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!loading) {
      loadTeachers()
      loadClasses()
    }
  }, [loading])

  const checkAuth = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) {
        console.error('Auth error:', authError)
        setLoading(false)
        return
      }
      if (!user) {
        console.warn('No user logged in')
        setLoading(false)
        return
      }
    } catch (error) {
      console.error('Error checking auth:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadClasses = async () => {
    try {
      const { data, error } = await supabase.from('classes').select('*').order('name')
      if (error) throw error
      setClasses(data || [])
    } catch (error) {
      console.error('Error loading classes:', error)
    }
  }

  const parseCSV = async (file: File) => {
    return new Promise<any[]>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        complete: (results) => resolve(results.data as any[]),
        error: (err) => reject(err),
      })
    })
  }

  const handleCsvSelect = (file: File | null) => {
    setCsvFile(file)
    setCsvPreview([])
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => setCsvPreview(results.data as any[]),
    })
  }

  const handleBulkUpload = async () => {
    if (!csvFile) return alert('Select a CSV file')
    try {
      const rows = await parseCSV(csvFile)
      const res = await fetch('/api/admin/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: bulkType, rows })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Bulk upload failed')
      const errors = (json.results || []).filter((r: any) => r.status === 'error')
      alert(errors.length ? `Completed with ${errors.length} errors` : 'Bulk upload finished')
      loadTeachers()
    } catch (e: any) {
      console.error('Bulk upload error', e)
      alert(e.message || 'Bulk upload failed')
    }
  }

  const loadTeachers = async () => {
    try {
      const res = await fetch('/api/admin/users/list/teachers')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load teachers')
      setTeachers(json.teachers || [])
    } catch (error) {
      console.error('Error loading teachers:', error)
    }
  }

  const handleCreateTeacher = async () => {
    try {
      const res = await fetch('/api/admin/users/teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          phone: (formData as any).phone || null,
          gender: (formData as any).gender || null,
          dob: (formData as any).dob || null,
          address: (formData as any).address || null,
          status: (formData as any).status || null,
          admission: (formData as any).admission || null,
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create teacher')

      if ((formData as any).photo && json?.teacher?.id) {
        const file: File = (formData as any).photo
        const fileExt = file.name.split('.').pop()
        const fileName = `${json.teacher.id}-${Date.now()}.${fileExt}`
        const filePath = `teacher-photos/${fileName}`
        const { error: uploadError } = await supabase.storage.from('student-photos').upload(filePath, file)
        if (!uploadError) {
          const { data } = supabase.storage.from('student-photos').getPublicUrl(filePath)
          await supabase.from('teachers').update({ photo_url: data.publicUrl }).eq('id', json.teacher.id)
        }
      }

      setShowModal(false)
      setFormData({ full_name: '', email: '', password: '', phone: '', gender: '', dob: '', address: '', status: '', admission: '' })
      await loadTeachers()
    } catch (error: any) {
      alert(error.message || 'Error creating teacher')
    }
  }

  const handleAssignClass = async () => {
    if (!selectedTeacher || !assignData.class_id) return

    try {
      await supabase
        .from('classes')
        .update({ teacher_id: selectedTeacher.id })
        .eq('id', assignData.class_id)

      if (assignData.subject) {
        await supabase.from('teacher_subjects').upsert({
          teacher_id: selectedTeacher.id,
          subject: assignData.subject,
          class_level: assignData.class_level || null,
        })
      }

      setShowAssignModal(false)
      setSelectedTeacher(null)
      setAssignData({ class_id: '', subject: '', class_level: '' })
      loadTeachers()
    } catch (error: any) {
      alert(error.message || 'Error assigning class/subject')
    }
  }

  const handleDeleteTeacher = async (teacherId: string) => {
    if (!confirm('Are you sure you want to delete this teacher?')) return
    try {
      const res = await fetch(`/api/admin/users/teacher?id=${teacherId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete teacher')
      await loadTeachers()
    } catch (error: any) {
      alert(error.message || 'Error deleting teacher')
    }
  }

  const openAssignModal = (teacher: Teacher) => {
    setSelectedTeacher(teacher)
    setAssignData({ class_id: '', subject: '', class_level: '' })
    setShowAssignModal(true)
  }

  // Add photo to form data handling
  const handlePhotoChange = (file: File | null) => {
    setFormData({ ...(formData as any), photo: file } as any)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <GraduationCap className="w-10 h-10 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-900">Teachers</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingTeacher(null)
              setFormData({ full_name: '', email: '', password: '', phone: '', gender: '', dob: '', address: '', status: '', admission: '' })
              setShowModal(true)
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Add Teacher
          </button>

          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50"
            title="Bulk upload teachers or students via CSV"
          >
            <Upload className="w-5 h-5" />
            Bulk Upload
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subjects</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {teachers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No teachers found. Click "Add Teacher" to create one.
                </td>
              </tr>
            ) : (
              teachers.map((teacher) => (
                <tr key={teacher.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{teacher.full_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{teacher.email || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {teacher.classes && teacher.classes.length > 0 ? (
                        teacher.classes.map((cls) => (
                          <span key={cls.id} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {cls.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">No classes</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {teacher.subjects && teacher.subjects.length > 0 ? (
                        teacher.subjects.map((subject, idx) => (
                          <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                            {subject}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">No subjects</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openAssignModal(teacher)}
                        className="text-green-600 hover:text-green-900"
                        title="Assign Class/Subject"
                      >
                        <BookOpen className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTeacher(teacher.id)}
                        className="text-red-600 hover:text-red-900"
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

      {/* Add/Edit Teacher Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Add New Teacher</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo (optional)</label>
                <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <Upload className="w-5 h-5" />
                  <span className="text-sm">Upload Photo</span>
                  <input type="file" accept="image/*" onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)} className="hidden" />
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="text" value={(formData as any).phone} onChange={(e) => setFormData({ ...(formData as any), phone: e.target.value } as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <input type="text" value={(formData as any).gender} onChange={(e) => setFormData({ ...(formData as any), gender: e.target.value } as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DOB</label>
                  <input type="date" value={(formData as any).dob} onChange={(e) => setFormData({ ...(formData as any), dob: e.target.value } as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admission</label>
                  <input type="text" value={(formData as any).admission} onChange={(e) => setFormData({ ...(formData as any), admission: e.target.value } as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" value={(formData as any).address} onChange={(e) => setFormData({ ...(formData as any), address: e.target.value } as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                  minLength={6}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button onClick={handleCreateTeacher} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Bulk CSV Upload</h3>
              <button onClick={() => setShowBulkModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={bulkType} onChange={(e) => setBulkType(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="teacher">Teachers</option>
                  <option value="student">Students</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CSV File</label>
                <input type="file" accept="text/csv" onChange={(e) => handleCsvSelect(e.target.files?.[0] || null)} />
                <p className="text-xs text-gray-500 mt-1">Expected headers: full_name,email,phone,gender,dob,address,status,admission,guardian_t,class</p>
                {csvPreview && csvPreview.length > 0 && (
                  <div className="mt-3 border rounded p-3 bg-gray-50">
                    <div className="text-sm font-medium mb-2">Preview (first 5 rows):</div>
                    <div className="overflow-x-auto">
                      <table className="text-xs w-full table-auto">
                        <thead>
                          <tr>
                            {Object.keys(csvPreview[0]).slice(0, 8).map((h) => (
                              <th key={h} className="px-2 py-1 text-left text-gray-600">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.slice(0, 5).map((row, idx) => (
                            <tr key={idx} className="odd:bg-white even:bg-gray-100">
                              {Object.values(row).slice(0, 8).map((v, j) => (
                                <td key={j} className="px-2 py-1">{String(v)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setShowBulkModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button onClick={handleBulkUpload} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Upload</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Class/Subject Modal */}
      {showAssignModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Assign to {selectedTeacher.full_name}</h3>
              <button onClick={() => setShowAssignModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Class</label>
                <select
                  value={assignData.class_id}
                  onChange={(e) => setAssignData({ ...assignData, class_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select a class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.class_level ? `(${cls.class_level})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={assignData.subject}
                  onChange={(e) => setAssignData({ ...assignData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Mathematics, English"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Level (Optional)</label>
                <select
                  value={assignData.class_level}
                  onChange={(e) => setAssignData({ ...assignData, class_level: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">All Levels</option>
                  <option value="JSS1">JSS1</option>
                  <option value="JSS2">JSS2</option>
                  <option value="JSS3">JSS3</option>
                  <option value="SS1">SS1</option>
                  <option value="SS2">SS2</option>
                  <option value="SS3">SS3</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button onClick={handleAssignClass} className="px-4 py-2 bg-green-600 text-white rounded-lg">Assign</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
