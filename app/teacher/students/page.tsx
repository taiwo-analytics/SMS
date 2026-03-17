'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Users, BookOpen, ClipboardList, UserCheck } from 'lucide-react'
import SchoolLoader from '@/components/SchoolLoader'

interface AssignedClass {
  id: string
  name: string
  class_level?: string
  department?: string
  subjects: string[]
  isClassTeacher: boolean
}

export default function TeacherAssignedClassesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<AssignedClass[]>([])

  const loadData = useCallback(async (userId: string) => {
    try {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', userId)
        .single()
      if (!teacher) return

      const { data: classTeacherClasses } = await supabase
        .from('classes')
        .select('id, name, class_level, department')
        .eq('class_teacher_id', teacher.id)

      const { data: subjectAssigns } = await supabase
        .from('class_subject_teachers')
        .select('class_id, subject_id, classes(id, name, class_level, department), subjects(id, name)')
        .eq('teacher_id', teacher.id)

      const ctIds = new Set((classTeacherClasses || []).map((c) => c.id))

      // Build class map with assigned subject names
      const map = new Map<string, AssignedClass>()
      for (const c of (classTeacherClasses || [])) {
        map.set(c.id, { ...c, subjects: [], isClassTeacher: true })
      }
      for (const r of (subjectAssigns || [])) {
        const c = (r as any).classes
        const subName = (r as any).subjects?.name
        if (!c) continue
        if (!map.has(c.id)) {
          map.set(c.id, { ...c, subjects: [], isClassTeacher: ctIds.has(c.id) })
        }
        if (subName) {
          const entry = map.get(c.id)!
          if (!entry.subjects.includes(subName)) entry.subjects.push(subName)
        }
      }
      setClasses(Array.from(map.values()))
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'teacher') {
        router.push('/')
        return
      }

      await loadData(user.id)
    } catch (error) {
      console.error('Error checking auth:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }, [router, loadData])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (loading) {
    return <SchoolLoader />
  }

  return (
    <div>
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Users className="w-10 h-10 text-green-600" />
            <h2 className="text-3xl font-bold text-gray-900">Assigned Classes</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.length === 0 ? (
            <div className="col-span-full text-center text-gray-500 py-12">No assigned classes.</div>
          ) : (
            classes.map((c) => (
              <div key={c.id} className="border rounded-lg p-6 bg-white shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold text-gray-900">{c.class_level || c.name}</div>
                  </div>
                  {c.isClassTeacher && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">Class Teacher</span>
                  )}
                </div>
                {c.subjects.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.subjects.map((subName) => (
                      <span key={subName} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">
                        {subName}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => router.push(`/teacher/subject-attendance?class_id=${c.id}`)}
                    className="px-3 py-1.5 border rounded text-xs hover:bg-gray-50 flex items-center gap-1"
                    title="Take subject attendance"
                  >
                    <UserCheck className="w-3 h-3" />
                    Subject Attendance
                  </button>
                  <button
                    onClick={() => router.push(`/teacher/broadsheet?class_id=${c.id}`)}
                    className="px-3 py-1.5 border rounded text-xs hover:bg-gray-50 flex items-center gap-1"
                    title="View broadsheet"
                  >
                    <ClipboardList className="w-3 h-3" />
                    Broadsheet
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
    </div>
  )
}
