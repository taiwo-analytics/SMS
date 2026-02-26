'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { BookOpen, Users } from 'lucide-react'
import { Class } from '@/types/database'

export default function TeacherClassesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<Class[]>([])
  const [teacherId, setTeacherId] = useState<string | null>(null)

  const checkAuthAndLoadClasses = useCallback(async () => {
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
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single()
      if (teacher) {
        setTeacherId(teacher.id)
        const { data: teacherClasses, error } = await supabase
          .from('classes')
          .select('*')
          .eq('teacher_id', teacher.id)
          .order('created_at', { ascending: false })
        if (error) throw error
        const { data: subjects } = await supabase
          .from('teacher_subjects')
          .select('subject, class_level')
          .eq('teacher_id', teacher.id)
        const classesWithSubjects = (teacherClasses || []).map(cls => ({
          ...cls,
          assignedSubjects: subjects?.filter(s => !s.class_level || s.class_level === (cls as any).class_level).map(s => s.subject) || []
        }))
        setClasses(classesWithSubjects)
      }
    } catch (error) {
      console.error('Error loading classes:', error)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    checkAuthAndLoadClasses()
  }, [checkAuthAndLoadClasses])

 

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex items-center gap-4 mb-6">
            <BookOpen className="w-12 h-12 text-blue-600" />
            <h2 className="text-3xl font-bold text-gray-900">My Classes</h2>
          </div>
          
          <p className="text-gray-600 mb-8">
            Here are all the classes assigned to you. You can only see classes you are teaching.
          </p>

          {classes.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No classes assigned yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.map((classItem) => (
                <div
                  key={classItem.id}
                  className="border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/teacher/classes/${classItem.id}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <BookOpen className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{classItem.name}</h3>
                  {(classItem as any).class_level && (
                    <p className="text-xs text-gray-500 mb-1">Level: {(classItem as any).class_level}</p>
                  )}
                  {/* Department removed from class UI */}
                  {classItem.subject && (
                    <p className="text-gray-600 mb-2">{classItem.subject}</p>
                  )}
                  {(classItem as any).assignedSubjects && (classItem as any).assignedSubjects.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 mb-1">Your Subjects:</p>
                      <div className="flex flex-wrap gap-1">
                        {(classItem as any).assignedSubjects.map((subject: string, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                            {subject}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Users className="w-4 h-4" />
                    <span>View Details</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  )
}
