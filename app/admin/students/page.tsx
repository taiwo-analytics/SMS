'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { User, Plus, Edit, Trash2, X, Upload, Users, CheckSquare, BookOpen, ClipboardList } from 'lucide-react'
import { Student, Parent, Class } from '@/types/database'
import Image from 'next/image'
import Papa from 'papaparse'

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(id)
  }, [notice])
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
    admission_date: '',
    guardian_name: '',
    nin: '',
    guardian_phone: '',
    guardian_occupation: '',
    class_id: '',
    department: ''
  })
  const [showSubjectsModal, setShowSubjectsModal] = useState(false)
  const [subjectsForStudent, setSubjectsForStudent] = useState<any[]>([])
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportData, setReportData] = useState<any | null>(null)
  const [assignData, setAssignData] = useState({ class_id: '' })
  const [searchTerm, setSearchTerm] = useState('')
  const [filterLevel, setFilterLevel] = useState('')

  const checkAuth = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const loadClasses = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/classes')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load classes')
      setClasses(json.classes || [])
    } catch (error) {
      console.error('Error loading classes:', error)
      setNotice({ type: 'error', text: (error as any)?.message || 'Error loading classes' })
    }
  }, [])

  const loadParents = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('parents').select('*').order('full_name')
      if (error) throw error
      setParents(data || [])
    } catch (error) {
      console.error('Error loading parents:', error)
    }
  }, [])

  const loadStudents = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    if (!loading) {
      loadStudents()
      loadParents()
      loadClasses()
    }
  }, [loading, loadStudents, loadParents, loadClasses])
 

  const handlePhotoUpload = async (file: File, studentId: string) => {
    try {
      setUploadingPhoto(true)
      const fd = new FormData()
      fd.append('id', studentId)
      fd.append('photo', file)
      const res = await fetch('/api/admin/users/student', { method: 'PATCH', body: fd })
      const js = await res.json()
      if (!res.ok) throw new Error(js.error || 'Failed to upload student photo')
      return js.photo_url as string
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
          phone: formData.phone || null,
          gender: formData.gender || null,
          dob: formData.dob || null,
          address: formData.address || null,
          status: formData.status || null,
          admission: formData.admission || null,
          admission_date: formData.admission_date || null,
          guardian_name: formData.guardian_name || null,
          nin: formData.nin || null,
          guardian_phone: formData.guardian_phone || null,
          guardian_occupation: formData.guardian_occupation || null,
          class_id: formData.class_id || null
        })
      })
      let json: any = null
      if (!res.ok) {
        try {
          json = await res.json()
        } catch {
          const txt = await res.text()
          throw new Error((json && json.error) || txt || 'Failed to create student')
        }
        throw new Error(json.error || 'Failed to create student')
      } else {
        json = await res.json()
      }

      if (formData.photo && json?.student?.id) {
        await handlePhotoUpload(formData.photo, json.student.id)
      }

      setShowModal(false)
      setFormData({ full_name: '', email: '', password: '', parent_id: '', photo: null, phone: '', gender: '', dob: '', address: '', status: '', admission: '', admission_date: '', guardian_name: '', nin: '', guardian_phone: '', guardian_occupation: '', class_id: '', department: '' })
      loadStudents()
      setNotice({ type: 'success', text: 'Student created successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error creating student' })
    }
  }

  const handleEditStudent = async () => {
    if (!editingStudent) return
    try {
      const res = await fetch('/api/admin/users/student', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingStudent.id,
          full_name: formData.full_name,
          phone: formData.phone || null,
          gender: formData.gender || null,
          dob: formData.dob || null,
          address: formData.address || null,
          status: formData.status || null,
          admission: formData.admission || null,
          admission_date: formData.admission_date || null,
          guardian_name: formData.guardian_name || null,
          nin: formData.nin || null,
          guardian_phone: formData.guardian_phone || null,
          guardian_occupation: formData.guardian_occupation || null,
          parent_id: formData.parent_id || null,
          department: formData.department || null,
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update student')

      if (formData.photo) {
        await handlePhotoUpload(formData.photo, editingStudent.id)
      }

      setShowModal(false)
      setEditingStudent(null)
      setFormData({ full_name: '', email: '', password: '', parent_id: '', photo: null, phone: '', gender: '', dob: '', address: '', status: '', admission: '', admission_date: '', guardian_name: '', nin: '', guardian_phone: '', guardian_occupation: '', class_id: '', department: '' })
      await loadStudents()
      setNotice({ type: 'success', text: 'Student updated successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error updating student' })
    }
  }

  const [showBulkModal, setShowBulkModal] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<any[]>([])
  const [bulkResults, setBulkResults] = useState<any[] | null>(null)

  const downloadStudentTemplate = () => {
    const headers = ['full_name', 'gender', 'dob', 'address']
    const csv = headers.join(',') + '\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'students_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

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
      const rows = await new Promise<any[]>((resolve, reject) => {
        Papa.parse(csvFile, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim(),
          complete: (results) => resolve(results.data as any[]),
          error: (err) => reject(err),
        })
      })
      const res = await fetch('/api/admin/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'student', rows })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Bulk upload failed')
      const results = json.results || []
      setBulkResults(results)
      const errors = results.filter((r: any) => r.status === 'error')
      setNotice({
        type: errors.length ? 'error' : 'success',
        text: errors.length ? `Bulk upload completed with ${errors.length} errors` : 'Bulk upload finished',
      })
      setShowBulkModal(false)
      setCsvFile(null)
      setCsvPreview([])
      loadStudents()
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message || 'Bulk upload failed' })
    }
  }

  const handleAssignClass = async () => {
    if (!selectedStudent || !assignData.class_id) return

    try {
      const res = await fetch('/api/admin/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: assignData.class_id,
          student_id: selectedStudent.id,
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error assigning class')

      setShowAssignModal(false)
      setSelectedStudent(null)
      setAssignData({ class_id: '' })
      loadStudents()
      setNotice({ type: 'success', text: 'Class assigned successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error assigning class' })
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
      setNotice({ type: 'success', text: 'Parent linked successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error linking parent' })
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
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(studentId)
        return next
      })
      await loadStudents()
      setNotice({ type: 'success', text: 'Student deleted successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error deleting student' })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected student(s)?`)) return
    try {
      const res = await fetch('/api/admin/users/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'student', ids: [...selectedIds] })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete selected students')
      setSelectedIds(new Set())
      await loadStudents()
      setNotice({ type: 'success', text: 'Selected students deleted successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error deleting selected students' })
    }
  }

  const openAssignModal = (student: Student) => {
    setSelectedStudent(student)
    setAssignData({ class_id: '' })
    setShowAssignModal(true)
  }

  const openEditModal = (student: Student & { email?: string }) => {
    setEditingStudent(student)
    setFormData({
      full_name: student.full_name || '',
      email: student.email || '',
      password: '',
      parent_id: (student as any).parent_id || '',
      photo: null,
      phone: (student as any).phone || '',
      gender: (student as any).gender || '',
      dob: (student as any).dob || '',
      address: (student as any).address || '',
      status: (student as any).status || '',
      admission: (student as any).admission || '',
      admission_date: (student as any).admission_date || '',
      guardian_name: (student as any).guardian_name || '',
      nin: (student as any).nin || '',
      guardian_phone: (student as any).guardian_phone || '',
      guardian_occupation: (student as any).guardian_occupation || '',
      class_id: '',
      department: (student as any).department || '',
    })
    setShowModal(true)
  }

  const openSubjectsModal = async (studentId: string) => {
    try {
      const res = await fetch(`/api/admin/students/subjects?student_id=${studentId}`)
      const js = await res.json()
      if (!res.ok) throw new Error(js.error || 'Failed to load subjects')
      setSubjectsForStudent(js.subjects || [])
      setShowSubjectsModal(true)
    } catch (e: any) {
      setNotice({ type: 'error', text: e?.message || 'Failed to load subjects' })
    }
  }

  const openReportModal = async (studentId: string) => {
    try {
      const res = await fetch(`/api/admin/students/report?student_id=${studentId}`)
      const js = await res.json()
      if (!res.ok) throw new Error(js.error || 'Failed to load report')
      setReportData(js.report || null)
      setShowReportModal(true)
    } catch (e: any) {
      setNotice({ type: 'error', text: e?.message || 'Failed to load report' })
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(students.map((s) => s.id)))
    }
  }

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const exportStudents = async () => {
    try {
      const res = await fetch('/api/admin/users/list/students')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load students')
      const rows = (json.students || []).map((s: any) => {
        const classesLabel = Array.isArray(s.classes) && s.classes.length
          ? s.classes.map((c: any) => `${c.name}${c.class_level ? ` (${c.class_level})` : ''}`).join('; ')
          : ''
        return {
          full_name: s.full_name || '',
          admission: s.admission || '',
          dob: s.dob || '',
          address: s.address || '',
          email: s.email || '',
          gender: s.gender || '',
          class: classesLabel,
          photo_url: s.photo_url || '',
          nin: s.nin || '',
          guardian_name: s.guardian_name || '',
          guardian_phone: s.guardian_phone || '',
          guardian_occupation: s.guardian_occupation || '',
          phone: s.phone || '',
        }
      })
      const csv = Papa.unparse(rows)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `students_export_${new Date().toISOString().slice(0,10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message || 'Export failed' })
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  // helper: derive primary class level/name for ordering and filtering
  const classLabel = (s: any): string => {
    const cls = Array.isArray(s.classes) && s.classes[0] ? s.classes[0] : null
    return (cls?.class_level || cls?.name || '').toString()
  }
  const levelKey = (label: string): string => {
    const u = (label || '').toUpperCase()
    if (u.startsWith('JSS')) return `0-${u}`
    if (u.startsWith('SS')) return `1-${u}`
    return `2-${u}`
  }

  const filteredOrdered = students
    .filter((s) => {
      if (!filterLevel) return true
      const label = classLabel(s)
      return label.toUpperCase() === filterLevel.toUpperCase()
    })
    .filter((s) => {
      const q = searchTerm.trim().toLowerCase()
      if (!q) return true
      return (
        (s.full_name || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const ak = levelKey(classLabel(a))
      const bk = levelKey(classLabel(b))
      return ak.localeCompare(bk)
    })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <User className="w-10 h-10 text-green-600" />
          <h2 className="text-3xl font-bold text-gray-900">Students</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingStudent(null)
              setFormData({ full_name: '', email: '', password: '', parent_id: '', photo: null, phone: '', gender: '', dob: '', address: '', status: '', admission: '', admission_date: '', guardian_name: '', nin: '', guardian_phone: '', guardian_occupation: '', class_id: '', department: '' })
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
          <button
            onClick={exportStudents}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50"
            title="Export all students as CSV"
          >
            <Upload className="w-5 h-5 rotate-180" />
            Export
          </button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">All classes</option>
            {Array.from(new Set(students.flatMap((s: any) => {
              const c = s.classes && s.classes[0]
              const label = (c?.class_level || c?.name || '').toString()
              return label ? [label] : []
            }))).map((label) => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email"
            className="px-3 py-2 border border-gray-300 rounded-lg w-72"
          />
        </div>
      </div>

      {notice && (
        <div
          className={`mb-4 border rounded-lg px-4 py-3 text-sm ${
            notice.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-green-800">
            <CheckSquare className="w-5 h-5" />
            {selectedIds.size} selected
          </div>
          <button
            onClick={handleBulkDelete}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
          >
            Delete Selected
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={students.length > 0 && selectedIds.size === students.length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Photo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classes</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredOrdered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No students found. Click &quot;Onboard Student&quot; to add one.
                </td>
              </tr>
            ) : (
              filteredOrdered.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(student.id)}
                      onChange={() => toggleSelectOne(student.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {student.photo_url ? (
                      <Image
                        src={student.photo_url}
                        alt={student.full_name}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                        unoptimized
                      />
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
                            {cls.class_level || cls.name}
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
                        onClick={() => openEditModal(student)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit Student"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openAssignModal(student)}
                        className="text-green-600 hover:text-green-900"
                        title="Assign Class"
                      >
                        <BookOpen className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openParentModal(student)}
                        className="text-purple-600 hover:text-purple-900"
                        title="Link Parent"
                      >
                        <Users className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openSubjectsModal(student.id)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="View Subjects"
                      >
                        <BookOpen className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openReportModal(student.id)}
                        className="text-teal-600 hover:text-teal-900"
                        title="View Report"
                      >
                        <ClipboardList className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteStudent(student.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete Student"
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

      {/* Add/Edit Student Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{editingStudent ? 'Edit Student' : 'Onboard New Student'}</h3>
              <button onClick={() => { setShowModal(false); setEditingStudent(null) }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              {notice && notice.type === 'error' && (
                <div className="mb-3 border rounded-lg px-4 py-3 text-sm bg-red-50 border-red-200 text-red-700">
                  {notice.text}
                </div>
              )}
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
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DOB</label>
                  <input type="date" value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Admission</label>
                  <input type="date" value={formData.admission_date} onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admission No.</label>
                <input type="text" value={formData.admission} onChange={(e) => setFormData({ ...formData, admission: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">Select</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                    <option value="graduated">Graduated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-gray-400 font-normal">(SS only)</span></label>
                  <select value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">None</option>
                    <option value="Science">Science</option>
                    <option value="Humanities">Humanities</option>
                    <option value="Arts">Arts</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Name</label>
                  <input autoComplete="off" type="text" value={formData.guardian_name} onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Phone</label>
                  <input type="text" value={formData.guardian_phone} onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Occupation</label>
                  <input type="text" value={formData.guardian_occupation} onChange={(e) => setFormData({ ...formData, guardian_occupation: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NIN (Optional)</label>
                <input type="text" value={formData.nin} onChange={(e) => setFormData({ ...formData, nin: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
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
              {!editingStudent && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Class (Optional)</label>
                    <select
                      value={formData.class_id}
                      onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">No class</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.class_level || cls.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      autoComplete="off"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      autoComplete="new-password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      minLength={6}
                    />
                  </div>
                </>
              )}
              <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Student Photo (Optional)</label>
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
                      <div className="mt-2 w-16 h-16 rounded-full overflow-hidden border">
                        <img src={URL.createObjectURL(formData.photo)} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
             
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => { setShowModal(false); setEditingStudent(null) }} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button
                  onClick={editingStudent ? handleEditStudent : handleCreateStudent}
                  disabled={uploadingPhoto}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {uploadingPhoto ? 'Uploading...' : editingStudent ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSubjectsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Subjects</h3>
              <button onClick={() => setShowSubjectsModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {subjectsForStudent.length === 0 ? (
                <div className="text-sm text-gray-500">No subjects.</div>
              ) : (
                subjectsForStudent.map((s) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <div className="text-sm text-gray-800">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.code || '—'}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showReportModal && reportData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Student Report</h3>
              <button onClick={() => setShowReportModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-gray-800">{reportData.student.full_name}</div>
              <div className="text-sm text-gray-600">
                <span className="mr-2">Age: {reportData.student.age ?? '—'}</span>
                <span className="mr-2">Class: {reportData.class?.class_level || '—'}</span>
                <span>Department: {reportData.class?.department || '—'}</span>
              </div>
              <div className="text-sm text-gray-600">
                <span className="mr-2">Avg %: {reportData.grades.average_percent}</span>
                <span>Grades: {reportData.grades.count}</span>
              </div>
              <div className="text-sm text-gray-600">
                <span>Latest Payment: {reportData.payments?.status || '—'}</span>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700 mb-1">Subjects</div>
                <ul className="list-disc pl-5 text-sm text-gray-800 max-h-44 overflow-y-auto">
                  {reportData.subjects.map((s: any) => (
                    <li key={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</li>
                  ))}
                </ul>
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
                      {cls.class_level || cls.name}
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
                <div className="flex items-center gap-3">
                  <input type="file" accept="text/csv" onChange={(e) => handleCsvSelect(e.target.files?.[0] || null)} />
                  <button
                    type="button"
                    onClick={downloadStudentTemplate}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                    title="Download minimal CSV template"
                  >
                    Download template
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimal required columns: full_name, gender, dob, address</p>
                <p className="text-xs text-gray-500 mt-1">Optional columns: email,phone,admission,guardian_name,guardian_phone,guardian_occupation,nin,class,class_level,class_id,photo_url,department,status,parent_id</p>
                {bulkResults && (
                  <div className="mt-3 border rounded p-3 bg-yellow-50 border-yellow-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-yellow-900">
                        Results: {bulkResults.filter((r: any) => r.status === 'ok').length} succeeded, {bulkResults.filter((r: any) => r.status === 'error').length} failed
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const failures = bulkResults.filter((r: any) => r.status === 'error')
                          const headers = ['row', 'email', 'error']
                          const lines = [headers.join(',')].concat(
                            failures.map((f: any) => [f.row ?? '', f.email ?? '', (f.error ?? '').replace(/[\r\n]+/g, ' ')].join(','))
                          )
                          const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = 'students_failures.csv'
                          document.body.appendChild(a)
                          a.click()
                          document.body.removeChild(a)
                          URL.revokeObjectURL(url)
                        }}
                        className="px-3 py-1.5 border border-yellow-400 rounded text-sm text-yellow-900 bg-yellow-100 hover:bg-yellow-200"
                      >
                        Download failures
                      </button>
                    </div>
                    {bulkResults.some((r: any) => r.status === 'error') && (
                      <div className="mt-2 text-xs text-yellow-900 max-h-40 overflow-y-auto">
                        {(bulkResults as any[]).filter(r => r.status === 'error').slice(0, 10).map((f: any, idx: number) => (
                          <div key={idx}>Row {f.row ?? '?'} — {f.email || 'N/A'} — {f.error}</div>
                        ))}
                        {(bulkResults as any[]).filter(r => r.status === 'error').length > 10 && (
                          <div className="mt-1 italic">More errors hidden; use "Download failures" for full list.</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
