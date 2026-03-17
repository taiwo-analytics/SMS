'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { GraduationCap, Plus, Edit, Trash2, X, BookOpen, User, Upload, CheckSquare, KeyRound } from 'lucide-react'
import Image from 'next/image'
import Papa from 'papaparse'
import { Teacher, Class, Subject } from '@/types/database'
import SchoolLoader from '@/components/SchoolLoader'

type TeacherSubjectAssignment = {
  id: string
  class_id: string
  subject_id: string
  class_label: string
  subject_label: string
}

type TeacherWithDetails = Teacher & {
  email?: string
  classes?: Class[]
  subjects?: string[]
  subject_assignments?: TeacherSubjectAssignment[]
}

export default function AdminTeachersPage() {
  const [loading, setLoading] = useState(true)
  const [teachers, setTeachers] = useState<TeacherWithDetails[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<any[]>([])
  const [bulkResults, setBulkResults] = useState<any[] | null>(null)
  const [showClassAssignModal, setShowClassAssignModal] = useState(false)
  const [showSubjectAssignModal, setShowSubjectAssignModal] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithDetails | null>(null)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [formData, setFormData] = useState({
    full_name: '',
    title: '',
    phone: '',
    dob: '',
    staff_id: '',
    address: '',
    email: '',
    gender: '',
    marital_status: '',
    next_of_kin: '',
    next_of_kin_phone: '',
    course_of_study: '',
    institution_name: '',
    years_of_experience: '',
    degrees: [] as string[],
    certifications: [] as string[],
    workshops: [] as string[],
    subjects_taught: [] as string[], // subject IDs
    password: '',
  })
  const [teacherPhoto, setTeacherPhoto] = useState<File | null>(null)
  const [certificationFiles, setCertificationFiles] = useState<File[]>([])
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [classAssignData, setClassAssignData] = useState({ class_id: '' })
  const [subjectAssignData, setSubjectAssignData] = useState({ class_id: '', subject_id: '', category: '', departments: [] as string[] })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetTeacher, setResetTeacher] = useState<TeacherWithDetails | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(id)
  }, [notice])

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
    }
  }, [])

  const loadSubjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name, code, created_at')
        .order('name')
      if (error) throw error
      setSubjects((data as Subject[]) || [])
    } catch (error) {
      console.error('Error loading subjects:', error)
      setSubjects([])
    }
  }, [])

  const loadTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users/list/teachers')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load teachers')
      setTeachers((json.teachers || []) as TeacherWithDetails[])
    } catch (error) {
      console.error('Error loading teachers:', error)
    }
  }, [])

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

  const downloadBulkTemplate = () => {
    const headers = ['full_name', 'email', 'gender', 'address']
    const csv = headers.join(',') + '\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'teachers_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleBulkUpload = async () => {
    if (!csvFile) {
      setNotice({ type: 'error', text: 'Select a CSV file' })
      return
    }
    try {
      const rows = await parseCSV(csvFile)
      const res = await fetch('/api/admin/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'teacher', rows })
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
      loadTeachers()
    } catch (e: any) {
      console.error('Bulk upload error', e)
      setNotice({ type: 'error', text: e.message || 'Bulk upload failed' })
    }
  }

  useEffect(() => {
    if (!loading) {
      loadTeachers()
      loadClasses()
      loadSubjects()
    }
  }, [loading, loadTeachers, loadClasses, loadSubjects])

  const handleCreateTeacher = async () => {
    try {
      const res = await fetch('/api/admin/users/teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          phone: formData.phone || null,
          gender: formData.gender || null,
          dob: formData.dob || null,
          address: formData.address || null,
          title: formData.title || null,
          staff_id: formData.staff_id || null,
          marital_status: formData.marital_status || null,
          next_of_kin: formData.next_of_kin || null,
          next_of_kin_phone: formData.next_of_kin_phone || null,
          course_of_study: formData.course_of_study || null,
          institution_name: formData.institution_name || null,
          years_of_experience: formData.years_of_experience ? Number(formData.years_of_experience) : null,
          degrees: formData.degrees,
          certifications: formData.certifications,
          workshops: formData.workshops,
          subjects_taught: formData.subjects_taught,
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create teacher')

      // Handle uploads: teacher photo, certifications, CV
      if (json?.teacher?.id) {
        const teacherId = json.teacher.id
        const updates: Record<string, any> = {}

        if (teacherPhoto) {
          const fd = new FormData()
          fd.append('id', teacherId)
          fd.append('photo', teacherPhoto)
          const res2 = await fetch('/api/admin/users/teacher', { method: 'PATCH', body: fd })
          const js2 = await res2.json()
          if (!res2.ok) throw new Error(js2.error || 'Failed to upload teacher photo')
        }

        if (cvFile) {
          const bucket = supabase.storage.from('teacher-files')
          const ext = cvFile.name.split('.').pop()
          const path = `${teacherId}/cv_${Date.now()}.${ext}`
          const { error: uErr } = await bucket.upload(path, cvFile)
          if (!uErr) {
            const { data } = bucket.getPublicUrl(path)
            updates.cv_url = data.publicUrl
          }
        }
        if (certificationFiles && certificationFiles.length > 0) {
          const bucket = supabase.storage.from('teacher-files')
          const urls: string[] = []
          for (const f of certificationFiles) {
            const ext = f.name.split('.').pop()
            const path = `${teacherId}/certs/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
            const { error: uErr } = await bucket.upload(path, f)
            if (!uErr) {
              const { data } = bucket.getPublicUrl(path)
              urls.push(data.publicUrl)
            }
          }
          if (urls.length) updates.certification_files = urls
        }
        if (Object.keys(updates).length) {
          const res2 = await fetch('/api/admin/users/teacher', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: teacherId, ...updates })
          })
          const js2 = await res2.json()
          if (!res2.ok) {
            throw new Error(js2.error || 'Failed to attach uploads to teacher')
          }
        }
      }

      setShowModal(false)
      setFormData({
        full_name: '', title: '', phone: '', dob: '', staff_id: '', address: '', email: '', gender: '',
        marital_status: '', next_of_kin: '', next_of_kin_phone: '', course_of_study: '', institution_name: '',
        years_of_experience: '', degrees: [], certifications: [], workshops: [], subjects_taught: [], password: ''
      })
      setTeacherPhoto(null)
      setCertificationFiles([])
      setCvFile(null)
      await loadTeachers()
      setNotice({ type: 'success', text: 'Teacher created successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error creating teacher' })
    }
  }

  const handleEditTeacher = async () => {
    if (!editingTeacher) return

    try {
      const res = await fetch('/api/admin/users/teacher', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTeacher.id,
          full_name: formData.full_name,
          email: formData.email || null,
          phone: formData.phone || null,
          gender: formData.gender || null,
          dob: formData.dob || null,
          address: formData.address || null,
          title: formData.title || null,
          staff_id: formData.staff_id || null,
          marital_status: formData.marital_status || null,
          next_of_kin: formData.next_of_kin || null,
          next_of_kin_phone: formData.next_of_kin_phone || null,
          course_of_study: formData.course_of_study || null,
          institution_name: formData.institution_name || null,
          years_of_experience: formData.years_of_experience ? Number(formData.years_of_experience) : null,
          degrees: formData.degrees,
          certifications: formData.certifications,
          workshops: formData.workshops,
          subjects_taught: formData.subjects_taught,
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update teacher')

      if (teacherPhoto) {
        const fd = new FormData()
        fd.append('id', editingTeacher.id)
        fd.append('photo', teacherPhoto)
        const res2 = await fetch('/api/admin/users/teacher', { method: 'PATCH', body: fd })
        const js2 = await res2.json()
        if (!res2.ok) throw new Error(js2.error || 'Failed to upload teacher photo')
      }

      setShowModal(false)
      setEditingTeacher(null)
      setTeacherPhoto(null)
      setFormData({
        full_name: '', title: '', phone: '', dob: '', staff_id: '', address: '', email: '', gender: '',
        marital_status: '', next_of_kin: '', next_of_kin_phone: '', course_of_study: '', institution_name: '',
        years_of_experience: '', degrees: [], certifications: [], workshops: [], subjects_taught: [], password: ''
      })
      await loadTeachers()
      setNotice({ type: 'success', text: 'Teacher updated successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error updating teacher' })
    }
  }

  const handleAssignClassTeacher = async () => {
    if (!selectedTeacher || !classAssignData.class_id) return

    try {
      const res = await fetch('/api/admin/teachers/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'class_teacher',
          teacher_id: selectedTeacher.id,
          class_id: classAssignData.class_id,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to assign class teacher')

      setShowClassAssignModal(false)
      setSelectedTeacher(null)
      setClassAssignData({ class_id: '' })
      await Promise.all([loadTeachers(), loadClasses()])
      setNotice({ type: 'success', text: 'Class teacher assigned successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error assigning class teacher' })
    }
  }

  const handleAssignSubjectTeacher = async () => {
    if (!selectedTeacher || !subjectAssignData.subject_id) {
      setNotice({ type: 'error', text: 'Please select a subject' })
      return
    }

    try {
      const res = await fetch('/api/admin/teachers/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subject_teacher',
          teacher_id: selectedTeacher.id,
          class_id: subjectAssignData.class_id,
          subject_id: subjectAssignData.subject_id,
          category: subjectAssignData.category,
          departments: subjectAssignData.departments,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to assign subject teacher')

      setShowSubjectAssignModal(false)
      setSelectedTeacher(null)
      setSubjectAssignData({ class_id: '', subject_id: '', category: '', departments: [] })
      await loadTeachers()
      const countText = typeof (json?.count) === 'number' ? ` to ${json.count} class(es)` : ''
      setNotice({ type: 'success', text: `Subject teacher assigned successfully${countText}` })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error assigning subject teacher' })
    }
  }

  const handleDeleteTeacher = async (teacherId: string) => {
    if (!confirm('Are you sure you want to delete this teacher?')) return
    try {
      const res = await fetch(`/api/admin/users/teacher?id=${teacherId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete teacher')
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(teacherId)
        return next
      })
      await loadTeachers()
      setNotice({ type: 'success', text: 'Teacher deleted successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error deleting teacher' })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected teacher(s)?`)) return
    try {
      const res = await fetch('/api/admin/users/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'teacher', ids: [...selectedIds] })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete selected teachers')
      setSelectedIds(new Set())
      await loadTeachers()
      setNotice({ type: 'success', text: 'Selected teachers deleted successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error deleting selected teachers' })
    }
  }

  const openClassAssignModal = (teacher: TeacherWithDetails) => {
    setSelectedTeacher(teacher)
    setClassAssignData({ class_id: '' })
    setShowClassAssignModal(true)
  }

  const openSubjectAssignModal = (teacher: TeacherWithDetails) => {
    setSelectedTeacher(teacher)
    setSubjectAssignData({ class_id: '', subject_id: '', category: '', departments: [] })
    setShowSubjectAssignModal(true)
  }

  const openEditModal = (teacher: TeacherWithDetails) => {
    setEditingTeacher(teacher)
    setTeacherPhoto(null)
    const fallbackSubjectIds = Array.isArray(teacher.subject_assignments)
      ? teacher.subject_assignments.map((a: any) => String(a.subject_id)).filter(Boolean)
      : []
    const subjectsTaught =
      Array.isArray((teacher as any).subjects_taught) && (teacher as any).subjects_taught.length > 0
        ? ((teacher as any).subjects_taught as any[])
        : fallbackSubjectIds
    setFormData({
      full_name: teacher.full_name || '',
      title: (teacher as any).title || '',
      phone: (teacher as any).phone || '',
      dob: (teacher as any).dob || '',
      staff_id: (teacher as any).staff_id || '',
      address: (teacher as any).address || '',
      email: teacher.email || '',
      gender: (teacher as any).gender || '',
      marital_status: (teacher as any).marital_status || '',
      next_of_kin: (teacher as any).next_of_kin || '',
      next_of_kin_phone: (teacher as any).next_of_kin_phone || '',
      course_of_study: (teacher as any).course_of_study || '',
      institution_name: (teacher as any).institution_name || '',
      years_of_experience: (teacher as any).years_of_experience ? String((teacher as any).years_of_experience) : '',
      degrees: ((teacher as any).degrees || []) as any,
      certifications: ((teacher as any).certifications || []) as any,
      workshops: ((teacher as any).workshops || []) as any,
      subjects_taught: subjectsTaught as any,
      password: '',
    })
    setShowModal(true)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === teachers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(teachers.map((t) => t.id)))
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

  // Upload inputs handling
  const handlePhotoChange = (file: File | null) => {
    setTeacherPhoto(file)
  }
  const handleCertFilesChange = (files: FileList | null) => {
    setCertificationFiles(files ? Array.from(files) : [])
  }
  const handleCvFileChange = (file: File | null) => {
    setCvFile(file)
  }

  const exportTeachers = async () => {
    try {
      const res = await fetch('/api/admin/users/list/teachers')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load teachers')
      const rows = (json.teachers || []).map((t: any) => ({
        full_name: t.full_name || '',
        title: t.title || '',
        phone: t.phone || '',
        dob: t.dob || '',
        staff_id: t.staff_id || '',
        address: t.address || '',
        email: t.email || '',
        gender: t.gender || '',
        marital_status: t.marital_status || '',
        next_of_kin: t.next_of_kin || '',
        next_of_kin_phone: t.next_of_kin_phone || '',
        course_of_study: t.course_of_study || '',
        institution_name: t.institution_name || '',
        years_of_experience: t.years_of_experience ?? '',
        degrees: Array.isArray(t.degrees) ? t.degrees.join('; ') : '',
        certifications: Array.isArray(t.certifications) ? t.certifications.join('; ') : '',
        workshops: Array.isArray(t.workshops) ? t.workshops.join('; ') : '',
        subjects_taught: Array.isArray(t.subjects_taught) ? t.subjects_taught.join('; ') : '',
        photo_url: t.photo_url || '',
        cv_url: t.cv_url || '',
        certification_files: Array.isArray(t.certification_files) ? t.certification_files.join('; ') : '',
      }))
      const csv = Papa.unparse(rows)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `teachers_export_${new Date().toISOString().slice(0,10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message || 'Export failed' })
    }
  }

  const departmentOptions = useMemo(() => {
    const set = new Set<string>()
    classes.forEach((c) => {
      const dep = (c as any).department
      if (dep && String(dep).trim() !== '') set.add(String(dep).trim())
    })
    subjects.forEach((s: any) => {
      const arr: string[] =
        Array.isArray(s?.departments) && s.departments.length
          ? s.departments
          : (s?.department
              ? String(s.department).split(/[;,]/).map((x: string) => x.trim()).filter(Boolean)
              : [])
      arr.forEach((d) => { if (d) set.add(d) })
    })
    set.add('Science'); set.add('Business'); set.add('Humanities')
    const arr = Array.from(set)
    const order: Record<string, number> = { Science: 0, Business: 1, Humanities: 2 }
    return arr.sort((a, b) => (order[a] ?? 99) - (order[b] ?? 99) || a.localeCompare(b))
  }, [classes, subjects])

  if (loading) {
    return <SchoolLoader />
  }

  const filteredTeachers = (() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return teachers
    return teachers.filter((t) => {
      const name = (t.full_name || '').toLowerCase()
      const email = (t.email || '').toLowerCase()
      const cls = (t.classes || []).map((c) => (c.class_level || c.name || '')).join(' ').toLowerCase()
      const subj = (t.subject_assignments || []).map((a) => (a.subject_label || '')).join(' ').toLowerCase()
      return name.includes(q) || email.includes(q) || cls.includes(q) || subj.includes(q)
    })
  })()

  const subjectColorClasses = [
    'bg-emerald-100 text-emerald-800',
    'bg-blue-100 text-blue-800',
    'bg-purple-100 text-purple-800',
    'bg-yellow-100 text-yellow-800',
    'bg-red-100 text-red-800',
    'bg-pink-100 text-pink-800',
    'bg-indigo-100 text-indigo-800',
    'bg-cyan-100 text-cyan-800',
  ]
  const colorForSubject = (s: string) => {
    let hash = 0
    for (let i = 0; i < s.length; i++) hash = (hash + s.charCodeAt(i)) % 997
    return subjectColorClasses[hash % subjectColorClasses.length]
  }

  const handleResetPassword = async () => {
    if (!resetTeacher || !newPassword) return
    setResetting(true)
    try {
      const res = await fetch('/api/admin/users/teacher/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id: resetTeacher.id, new_password: newPassword }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to reset password')
      setShowResetModal(false)
      setResetTeacher(null)
      setNewPassword('')
      setNotice({ type: 'success', text: `Password reset for ${resetTeacher.full_name}` })
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message || 'Failed to reset password' })
    } finally {
      setResetting(false)
    }
  }

  const handleUnassignSubjectClass = async (teacherId: string, subjectId: string, classId: string) => {
    try {
      const params = new URLSearchParams({ teacher_id: teacherId, subject_id: subjectId, class_id: classId })
      const res = await fetch(`/api/admin/teachers/assignments?${params.toString()}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to remove assignment')
      await loadTeachers()
      setNotice({ type: 'success', text: 'Assignment removed' })
    } catch (e: any) {
      setNotice({ type: 'error', text: e?.message || 'Failed to remove assignment' })
    }
  }

  const handleUnassignSubjectAll = async (teacherId: string, subjectId: string) => {
    try {
      const params = new URLSearchParams({ teacher_id: teacherId, subject_id: subjectId })
      const res = await fetch(`/api/admin/teachers/assignments?${params.toString()}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to remove subject' )
      await loadTeachers()
      setNotice({ type: 'success', text: 'Subject removed' })
    } catch (e: any) {
      setNotice({ type: 'error', text: e?.message || 'Failed to remove subject' })
    }
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
              setFormData({
                full_name: '',
                title: '',
                phone: '',
                dob: '',
                staff_id: '',
                address: '',
                email: '',
                gender: '',
                marital_status: '',
                next_of_kin: '',
                next_of_kin_phone: '',
                course_of_study: '',
                institution_name: '',
                years_of_experience: '',
                degrees: [],
                certifications: [],
                workshops: [],
                subjects_taught: [],
                password: '',
              })
              setTeacherPhoto(null)
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
            title="Bulk upload teachers via CSV"
          >
            <Upload className="w-5 h-5" />
            Bulk Upload
          </button>
          <button
            onClick={exportTeachers}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50"
            title="Export all teachers as CSV"
          >
            <Upload className="w-5 h-5 rotate-180" />
            Export
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, email, class or subject"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
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

      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
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
                  checked={filteredTeachers.length > 0 && filteredTeachers.every((t) => selectedIds.has(t.id))}
                  onChange={() => {
                    if (filteredTeachers.length > 0 && filteredTeachers.every((t) => selectedIds.has(t.id))) {
                      setSelectedIds(new Set())
                    } else {
                      setSelectedIds(new Set(filteredTeachers.map((t) => t.id)))
                    }
                  }}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class Teacher</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject Assignments</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTeachers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No teachers found.
                </td>
              </tr>
            ) : (
              filteredTeachers.map((teacher) => (
                <tr key={teacher.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(teacher.id)}
                      onChange={() => toggleSelectOne(teacher.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {teacher.photo_url ? (
                        <Image
                          src={teacher.photo_url}
                          alt={teacher.full_name}
                          width={32}
                          height={32}
                          className="rounded-full object-cover border"
                          unoptimized
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 border" />
                      )}
                      <div className="text-sm font-medium text-gray-900">{teacher.full_name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{teacher.email || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {teacher.classes && teacher.classes.length > 0 ? (
                        teacher.classes.map((cls) => (
                          <span key={cls.id} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {(cls.class_level && (cls.class_level as any).toString().trim()) ? cls.class_level : cls.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">No class-teacher assignment</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {teacher.subject_assignments && teacher.subject_assignments.length > 0 ? (
                      (() => {
                        const grouped: Record<string, { subject_id: string, subject_label: string, classes: Record<string, string> }> = {}
                        for (const a of teacher.subject_assignments as any[]) {
                          const sid = String(a.subject_id)
                          const sl = String(a.subject_label || 'Unknown')
                          const cid = String(a.class_id)
                          const cl = String(a.class_label || 'Unknown')
                          if (!grouped[sid]) grouped[sid] = { subject_id: sid, subject_label: sl, classes: {} }
                          grouped[sid].classes[cid] = cl
                        }
                        const entries = Object.entries(grouped).sort((a, b) => a[1].subject_label.localeCompare(b[1].subject_label))
                        return (
                          <div className="flex flex-col gap-2">
                            {entries.map(([sid, info]) => {
                              const classes = Object.entries(info.classes).sort((a, b) => a[1].localeCompare(b[1]))
                              const cc = colorForSubject(info.subject_label)
                              return (
                                <div key={sid}>
                                  <div className={`inline-flex items-center gap-2 ${cc} text-xs px-2 py-1 rounded`}>
                                    <span>{info.subject_label}</span>
                                    <span className="ml-1 bg-white/60 px-1.5 py-0.5 rounded-full text-gray-700">{classes.length}</span>
                                    <button
                                      onClick={() => handleUnassignSubjectAll(teacher.id, sid)}
                                      className="ml-1 p-1 bg-white/50 hover:bg-white rounded"
                                      title="Remove subject from all classes"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {classes.map(([cid, cl]) => (
                                      <span key={sid + '_' + cid} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded">
                                        <span>{cl}</span>
                                        <button
                                          onClick={() => handleUnassignSubjectClass(teacher.id, sid, cid)}
                                          className="p-0.5 hover:bg-gray-200 rounded"
                                          title="Remove from class"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()
                    ) : (
                      <span className="text-xs text-gray-400">No subject assignment</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openClassAssignModal(teacher)}
                        className="text-orange-600 hover:text-orange-900"
                        title="Assign class teacher"
                      >
                        <User className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openSubjectAssignModal(teacher)}
                        className="text-green-600 hover:text-green-900"
                        title="Assign subject in class"
                      >
                        <BookOpen className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openEditModal(teacher)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit teacher"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => { setResetTeacher(teacher); setNewPassword(''); setShowResetModal(true) }}
                        className="text-yellow-600 hover:text-yellow-900"
                        title="Reset password"
                      >
                        <KeyRound className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTeacher(teacher.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete teacher"
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
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}</h3>
              <button onClick={() => { setShowModal(false); setEditingTeacher(null) }}><X className="w-5 h-5" /></button>
            </div>
            {notice && notice.type === 'error' && (
              <div className="mb-3 border rounded-lg px-4 py-3 text-sm bg-red-50 border-red-200 text-red-700">
                {notice.text}
              </div>
            )}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Staff ID (optional)</label>
                  <input type="text" value={formData.staff_id} onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
                  <select value={formData.marital_status} onChange={(e) => setFormData({ ...formData, marital_status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">Select</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Next of Kin</label>
                  <input type="text" value={formData.next_of_kin} onChange={(e) => setFormData({ ...formData, next_of_kin: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Next of Kin Phone</label>
                  <input type="text" value={formData.next_of_kin_phone} onChange={(e) => setFormData({ ...formData, next_of_kin_phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Course of Study</label>
                  <input type="text" value={formData.course_of_study} onChange={(e) => setFormData({ ...formData, course_of_study: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Institution Name</label>
                  <input type="text" autoComplete="off" value={formData.institution_name} onChange={(e) => setFormData({ ...formData, institution_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience</label>
                  <input type="number" min={0} value={formData.years_of_experience} onChange={(e) => setFormData({ ...formData, years_of_experience: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Degrees (select multiple)</label>
                  <select
                    multiple
                    value={formData.degrees}
                    onChange={(e) => {
                      const options = Array.from(e.target.selectedOptions).map(o => o.value)
                      setFormData({ ...formData, degrees: options })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg h-28"
                  >
                    <option value="NCE">NCE</option>
                    <option value="B.Sc.">B.Sc.</option>
                    <option value="B.Ed.">B.Ed.</option>
                    <option value="M.Ed.">M.Ed.</option>
                    <option value="M.Sc.">M.Sc.</option>
                    <option value="Ph.D.">Ph.D.</option>
                    <option value="Other">Other</option>
                  </select>
                  {formData.degrees.includes('Other') && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Specify other degree"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const value = (e.target as HTMLInputElement).value.trim()
                            if (value) {
                              setFormData((prev) => ({
                                ...prev,
                                degrees: Array.from(new Set(prev.degrees.filter(d => d !== 'Other').concat(value))),
                              }))
                              ;(e.target as HTMLInputElement).value = ''
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="px-3 py-2 border rounded-lg"
                        onClick={(e) => {
                          const input = (e.currentTarget.previousSibling as HTMLInputElement)
                          const value = input.value.trim()
                          if (value) {
                            setFormData((prev) => ({
                              ...prev,
                              degrees: Array.from(new Set(prev.degrees.filter(d => d !== 'Other').concat(value))),
                            }))
                            input.value = ''
                          }
                        }}
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subjects Taught (multi-select) *</label>
                <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
                  {subjects.map((s) => {
                    const checked = formData.subjects_taught.includes(s.id as unknown as string)
                    return (
                      <label key={s.id} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setFormData(prev => {
                              const set = new Set(prev.subjects_taught)
                              if (e.target.checked) set.add(s.id as unknown as string)
                              else set.delete(s.id as unknown as string)
                              return { ...prev, subjects_taught: Array.from(set) }
                            })
                          }}
                        />
                        <span>{s.name}{s.code ? ` (${s.code})` : ''}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Certifications (labels, optional)</label>
                  <input
                    type="text"
                    value={formData.certifications.join(', ')}
                    onChange={(e) => setFormData({ ...formData, certifications: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., TRCN, IGCSE"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Workshops/Trainings (labels)</label>
                  <input
                    type="text"
                    value={formData.workshops.join(', ')}
                    onChange={(e) => setFormData({ ...formData, workshops: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., STEM Workshop, Safeguarding"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  autoComplete="off"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              {!editingTeacher && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    autoComplete="new-password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                    minLength={6}
                  />
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Photo (optional)</label>
                  <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <Upload className="w-5 h-5" />
                    <span className="text-sm">Upload Photo</span>
                    <input type="file" accept="image/*" onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                  {teacherPhoto && (
                    <div className="mt-2 w-16 h-16 rounded-full overflow-hidden border">
                      <img src={URL.createObjectURL(teacherPhoto)} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Certification Files (optional)</label>
                  <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <Upload className="w-5 h-5" />
                    <span className="text-sm">Upload Certificates</span>
                    <input type="file" multiple onChange={(e) => handleCertFilesChange(e.target.files)} className="hidden" />
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CV (optional)</label>
                  <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <Upload className="w-5 h-5" />
                    <span className="text-sm">Upload CV</span>
                    <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleCvFileChange(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => { setShowModal(false); setEditingTeacher(null) }} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button
                  onClick={editingTeacher ? handleEditTeacher : handleCreateTeacher}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingTeacher ? 'Save Changes' : 'Create'}
                </button>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">CSV File</label>
                <div className="flex items-center gap-3">
                  <input type="file" accept="text/csv" onChange={(e) => handleCsvSelect(e.target.files?.[0] || null)} />
                  <button
                    type="button"
                    onClick={downloadBulkTemplate}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                    title="Download minimal CSV template"
                  >
                    Download template
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimal required columns: full_name, email, gender, address</p>
                <p className="text-xs text-gray-500 mt-1">Optional columns: phone,dob,title,staff_id,marital_status,next_of_kin,next_of_kin_phone,course_of_study,institution_name,years_of_experience,degrees,certifications,workshops,subjects_taught,photo_url,cv_url,certification_files</p>
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
                          a.download = 'teachers_failures.csv'
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
                          <div className="mt-1 italic">More errors hidden; use &quot;Download failures&quot; for full list.</div>
                        )}
                      </div>
                    )}
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

      {/* Assign Class Teacher Modal */}
      {showClassAssignModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Assign Class Teacher: {selectedTeacher.full_name}</h3>
              <button onClick={() => { setShowClassAssignModal(false); setSelectedTeacher(null) }}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              This sets who is the primary class teacher for one class.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  value={classAssignData.class_id}
                  onChange={(e) => setClassAssignData({ class_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                <button onClick={() => { setShowClassAssignModal(false); setSelectedTeacher(null) }} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button
                  onClick={handleAssignClassTeacher}
                  disabled={!classAssignData.class_id}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign Class Teacher
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && resetTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Reset Password</h3>
              <button onClick={() => { setShowResetModal(false); setResetTeacher(null) }}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Set a new password for <span className="font-semibold">{resetTeacher.full_name}</span>.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Min. 6 characters"
                  minLength={6}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setShowResetModal(false); setResetTeacher(null) }} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button
                  onClick={handleResetPassword}
                  disabled={resetting || newPassword.length < 6}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                >
                  {resetting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Subject Teacher Modal */}
      {showSubjectAssignModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Assign Subject Teacher: {selectedTeacher.full_name}</h3>
              <button onClick={() => { setShowSubjectAssignModal(false); setSelectedTeacher(null) }}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              This assigns a teacher to teach a specific subject in a specific class.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class (optional)</label>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={subjectAssignData.category}
                    onChange={(e) => setSubjectAssignData({ ...subjectAssignData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">All</option>
                    <option value="junior">Junior</option>
                    <option value="senior">Senior</option>
                  </select>
                  <select
                    value={subjectAssignData.class_id}
                    onChange={(e) => setSubjectAssignData({ ...subjectAssignData, class_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select a class</option>
                    {classes
                      .filter((cls) => {
                        if (!subjectAssignData.category) return true
                        const lvl = (cls.class_level || cls.name || '').toUpperCase()
                        return subjectAssignData.category === 'junior'
                          ? lvl.startsWith('JSS')
                          : lvl.startsWith('SS')
                      })
                      .map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.class_level || cls.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departments (optional, multi-select)</label>
                  {departmentOptions.length === 0 ? (
                    <div className="text-xs text-gray-500">No departments defined</div>
                  ) : (
                    <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                      {departmentOptions.map((dep) => {
                        const checked = subjectAssignData.departments.includes(dep)
                        return (
                          <label key={dep} className="flex items-center gap-2 py-1">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSubjectAssignData(prev => {
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
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select
                  value={subjectAssignData.subject_id}
                  onChange={(e) => setSubjectAssignData({ ...subjectAssignData, subject_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select a subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name} {subject.code ? `(${subject.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => { setShowSubjectAssignModal(false); setSelectedTeacher(null) }} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button
                  onClick={handleAssignSubjectTeacher}
                  disabled={!subjectAssignData.subject_id}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign Subject Teacher
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
