'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { User, Plus, Edit, Trash2, X, Upload, Image as ImageIcon, Users } from 'lucide-react'
import { Student, Parent, Class } from '@/types/database'

export default function AdminStudentsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<(Student & { email?: string; parent_name?: string; photo_url?: string; classes?: Class[] })[]>([])
  const [parents, setParents] = useState<Parent[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showParentModal, setShowParentModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [parentLinkData, setParentLinkData] = useState({ parent_id: '' })
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    parent_id: '',
    photo: null as File | null,
    phone: '',
    gender: '',
    dob: '',
    address: '',
    status: '',
    admission: '',
    guardian_name: '',
    class_id: ''
  })
  const [assignData, setAssignData] = useState({ class_id: '' })

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!loading) {
      loadStudents()
      loadParents()
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

  const loadParents = async () => {
    try {
      const { data, error } = await supabase.from('parents').select('*').order('full_name')
      if (error) throw error
      setParents(data || [])
    } catch (error) {
      console.error('Error loading parents:', error)
    }
  }

  const loadStudents = async () => {
    try {
      const res = await fetch('/api/admin/users/list/students')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load students')

      const studentsWithDetails = (json.students || []).map((student: any) => ({
        ...student,
        email: student.email || 'N/A',
        parent_name: student.parent?.full_name || 'None',
        classes: student.classes || [],
      }))

      setStudents(studentsWithDetails)
    } catch (error) {
      console.error('Error loading students:', error)
    }
  }

  const handlePhotoUpload = async (file: File, studentId: string) => {
    try {
      setUploadingPhoto(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${studentId}-${Date.now()}.${fileExt}`
      const filePath = `student-photos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('student-photos')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('student-photos').getPublicUrl(filePath)

      await supabase
        .from('students')
        .update({ photo_url: data.publicUrl })
        .eq('id', studentId)

      return data.publicUrl
    } catch (error: any) {
      console.error('Error uploading photo:', error)
      throw error
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleCreateStudent = async () => {
    try {
      const res = await fetch('/api/admin/users/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          parent_id: formData.parent_id || null,
          phone: (formData as any).phone || null,
          gender: (formData as any).gender || null,
          dob: (formData as any).dob || null,
          address: (formData as any).address || null,
          status: (formData as any).status || null,
          admission: (formData as any).admission || null,
          guardian_name: (formData as any).guardian_name || null,
          class_id: (formData as any).class_id || null
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create student')

      if (formData.photo && json?.student?.id) {
        await handlePhotoUpload(formData.photo, json.student.id)
      }

      setShowModal(false)
      setFormData({ full_name: '', email: '', password: '', parent_id: '', photo: null, phone: '', gender: '', dob: '', address: '', status: '', admission: '', guardian_name: '', class_id: '' })
      loadStudents()
    } catch (error: any) {
      alert(error.message || 'Error creating student')
    }
  }

  const [showBulkModal, setShowBulkModal] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<any[]>([])

  const handleCsvSelect = (file: File | null) => {
    setCsvFile(file)
    setCsvPreview([])
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = reader.result as string
        const [header, ...lines] = text.split(/\r?\n/).filter(Boolean)
        const headers = header.split(',').map(h => h.trim())
        const rows = lines.slice(0, 5).map(line => {
          const values = line.split(',')
          const obj: any = {}
          headers.forEach((h, i) => { obj[h] = values[i] || '' })
          return obj
        })
        setCsvPreview(rows)
      } catch {
        setCsvPreview([])
      }
    }
    reader.readAsText(file)
  }

  const handleBulkUpload = async () => {
    if (!csvFile) return alert('Select a CSV file')
    try {
      const text = await csvFile.text()
      const [header, ...lines] = text.split(/\r?\n/).filter(Boolean)
      const headers = header.split(',').map(h => h.trim())
      const rows = lines.map(line => {
        const values = line.split(',')
        const obj: any = {}
        headers.forEach((h, i) => { obj[h] = (values[i] || '').trim() })
        return obj
      })
      const res = await fetch('/api/admin/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'student', rows })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Bulk upload failed')
      const errors = (json.results || []).filter((r: any) => r.status === 'error')
      alert(errors.length ? `Completed with ${errors.length} errors` : 'Bulk upload finished')
      setShowBulkModal(false)
      setCsvFile(null)
      setCsvPreview([])
      loadStudents()
    } catch (e: any) {
      alert(e.message || 'Bulk upload failed')
    }
  }

  const handleAssignClass = async () => {
    if (!selectedStudent || !assignData.class_id) return

    try {
      const { error } = await supabase.from('class_enrollments').upsert({
        class_id: assignData.class_id,
        student_id: selectedStudent.id,
      })

      if (error) throw error

      setShowAssignModal(false)
      setSelectedStudent(null)
      setAssignData({ class_id: '' })
      loadStudents()
    } catch (error: any) {
      alert(error.message || 'Error assigning class')
    }
  }

  const handleLinkParent = async () => {
    if (!selectedStudent || !parentLinkData.parent_id) return

    try {
      const { error } = await supabase
        .from('students')
        .update({ parent_id: parentLinkData.parent_id })
        .eq('id', selectedStudent.id)

      if (error) throw error

      setShowParentModal(false)
      setSelectedStudent(null)
      setParentLinkData({ parent_id: '' })
      loadStudents()
    } catch (error: any) {
      alert(error.message || 'Error linking parent')
    }
  }

  const openParentModal = (student: Student) => {
    setSelectedStudent(student)
    setParentLinkData({ parent_id: student.parent_id || '' })
    setShowParentModal(true)
  }

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return
    try {
      const res = await fetch(`/api/admin/users/student?id=${studentId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete student')
      await loadStudents()
    } catch (error: any) {
      alert(error.message || 'Error deleting student')
    }
  }

  const openAssignModal = (student: Student) => {
    setSelectedStudent(student)
    setAssignData({ class_id: '' })
    setShowAssignModal(true)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <User className="w-10 h-10 text-green-600" />
          <h2 className="text-3xl font-bold text-gray-900">Students</h2>
        </div>
        <button
          onClick={() => {
            setEditingStudent(null)
            setFormData({ full_name: '', email: '', password: '', parent_id: '', photo: null, phone: '', gender: '', dob: '', address: '', status: '', admission: '', guardian_name: '', class_id: '' })
            setShowModal(true)
          }}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          <Plus className="w-5 h-5" />
          Onboard Student
        </button>
        <button
          onClick={() => setShowBulkModal(true)}
          className="flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50"
          title="Bulk upload students via CSV"
        >
          <Upload className="w-5 h-5" />
          Bulk Upload
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Photo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classes</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {students.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No students found. Click "Onboard Student" to add one.
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {student.photo_url ? (
                      <img src={student.photo_url} alt={student.full_name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{student.full_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{student.email || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{student.parent_name || 'None'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {student.classes && student.classes.length > 0 ? (
                        student.classes.map((cls) => (
                          <span key={cls.id} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {cls.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">No classes</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openAssignModal(student)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Assign Class"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openParentModal(student)}
                        className="text-purple-600 hover:text-purple-900"
                        title="Link Parent"
                      >
                        <Users className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteStudent(student.id)}
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

      {/* Add Student Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Onboard New Student</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent (Optional)</label>
                <select
                  value={formData.parent_id}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">None</option>
                  {parents.map((parent) => (
                    <option key={parent.id} value={parent.id}>{parent.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student Photo</label>
                <div className="mt-1 flex items-center gap-4">
                  <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <Upload className="w-5 h-5" />
                    <span className="text-sm">Upload Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFormData({ ...formData, photo: e.target.files?.[0] || null })}
                      className="hidden"
                    />
                  </label>
                  {formData.photo && (
                    <span className="text-sm text-gray-600">{formData.photo.name}</span>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button onClick={handleCreateStudent} disabled={uploadingPhoto} className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">
                  {uploadingPhoto ? 'Uploading...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Class Modal */}
      {showAssignModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Assign Class to {selectedStudent.full_name}</h3>
              <button onClick={() => setShowAssignModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
                <select
                  value={assignData.class_id}
                  onChange={(e) => setAssignData({ ...assignData, class_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select a class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.class_level ? `(${cls.class_level})` : ''} {cls.department ? `- ${cls.department}` : ''}
                    </option>
                  ))}
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

      {/* Link Parent Modal */}
      {showParentModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Link Parent to {selectedStudent.full_name}</h3>
              <button onClick={() => setShowParentModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Parent</label>
                <select
                  value={parentLinkData.parent_id}
                  onChange={(e) => setParentLinkData({ parent_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">No Parent (Remove Link)</option>
                  {parents.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setShowParentModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button onClick={handleLinkParent} className="px-4 py-2 bg-purple-600 text-white rounded-lg">Link Parent</button>
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
              <h3 className="text-xl font-bold">Bulk CSV Upload (Students)</h3>
              <button onClick={() => setShowBulkModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CSV File</label>
                <input type="file" accept="text/csv" onChange={(e) => handleCsvSelect(e.target.files?.[0] || null)} />
                <p className="text-xs text-gray-500 mt-1">Headers: full_name,email,phone,gender,dob,address,status,admission,guardian_t,class</p>
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
                              {Object.values(row).slice(0, 8).map((v: any, j: number) => (
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
                <button onClick={handleBulkUpload} className="px-4 py-2 bg-green-600 text-white rounded-lg">Upload</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
