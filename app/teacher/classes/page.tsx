'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { BookOpen, Users, ClipboardList, UserCheck, Eye, CheckCircle } from 'lucide-react'

export default function TeacherClassesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<any[]>([])
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

        // Get classes where this teacher is class teacher
        const { data: teacherClasses, error } = await supabase
          .from('classes')
          .select('*')
          .eq('class_teacher_id', teacher.id)
          .order('created_at', { ascending: false })
        if (error) throw error

        // Get student counts + attendance via server API (bypasses RLS)
        let countMap: Record<string, number> = {}
        let attendanceMap: Record<string, { present: number; absent: number; late: number; excused: number; total: number }> = {}
        try {
          const res = await fetch('/api/teacher/class-students')
          if (res.ok) {
            const js = await res.json()
            countMap = js.counts || {}
            attendanceMap = js.attendance || {}
          }
        } catch {}

        const classesWithData = (teacherClasses || []).map(cls => ({
          ...cls,
          studentCount: countMap[cls.id] || 0,
          attendance: attendanceMap[cls.id] || null,
        }))
        setClasses(classesWithData)
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

  const departmentColors: Record<string, string> = {
    Science: 'bg-blue-100 text-blue-700',
    Business: 'bg-amber-100 text-amber-700',
    Humanities: 'bg-purple-100 text-purple-700',
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <BookOpen className="w-7 h-7 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">My Class</h2>
            <p className="text-gray-500 text-sm">Classes where you are the class teacher</p>
          </div>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No classes assigned</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">You have not been assigned as a class teacher for any class. Ask the admin to assign you.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((classItem) => {
            const rawDep = classItem.department
            const dep = (rawDep && rawDep.toLowerCase() !== 'mixed') ? rawDep : null
            const depColor = dep ? (departmentColors[dep] || 'bg-gray-100 text-gray-700') : null

            return (
              <div
                key={classItem.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Card Header */}
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-200">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    {depColor && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${depColor}`}>
                        {dep}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {classItem.class_level || classItem.name}
                  </h3>
                  {classItem.class_level && classItem.name !== classItem.class_level && (
                    <p className="text-xs text-gray-500">{classItem.name}</p>
                  )}

                  {/* Student Count */}
                  <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>{classItem.studentCount} student{classItem.studentCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Today's Attendance Rate */}
                {(() => {
                  const att = classItem.attendance
                  if (!att || att.total === 0) {
                    return (
                      <div className="mx-5 mb-3 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>No attendance taken today</span>
                        </div>
                      </div>
                    )
                  }
                  const rate = Math.round(((att.present + att.late) / att.total) * 100)
                  const barColor = rate >= 80 ? 'bg-emerald-500' : rate >= 60 ? 'bg-amber-400' : 'bg-red-500'
                  const textColor = rate >= 80 ? 'text-emerald-700' : rate >= 60 ? 'text-amber-700' : 'text-red-700'
                  return (
                    <div className="mx-5 mb-3 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-gray-500">Today&apos;s Attendance</span>
                        <span className={`text-xs font-bold ${textColor}`}>{rate}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${rate}%` }} />
                      </div>
                      <div className="flex gap-3 mt-1.5 text-[10px] text-gray-400">
                        <span className="text-emerald-600">{att.present} present</span>
                        <span className="text-red-500">{att.absent} absent</span>
                        {att.late > 0 && <span className="text-amber-500">{att.late} late</span>}
                      </div>
                    </div>
                  )
                })()}

                {/* Action Buttons */}
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/teacher/classes/${classItem.id}`) }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    title="View students"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Students
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/teacher/attendance`) }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Take attendance"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Attendance
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/teacher/broadsheet?class_id=${classItem.id}`) }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    title="View broadsheet"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    Broadsheet
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
