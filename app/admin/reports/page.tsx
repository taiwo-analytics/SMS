'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { BarChart3, TrendingUp, Users, BookOpen, Download, UserCheck, ClipboardList } from 'lucide-react'

interface ClassLevelStat {
  level: string
  count: number
}

interface ClassAttendanceStat {
  className: string
  rate: number
}

export default function AdminReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState({
    totalTeachers: 0,
    totalStudents: 0,
    totalClasses: 0,
    totalEnrollments: 0,
    averageStudentsPerClass: 0,
    attendanceRate: 0,
    averageGrade: 0,
  })
  const [classLevelStats, setClassLevelStats] = useState<ClassLevelStat[]>([])
  const [classAttendanceStats, setClassAttendanceStats] = useState<ClassAttendanceStat[]>([])

  const loadReports = useCallback(async () => {
    try {
      const [teachersRes, studentsRes, classesRes, enrollmentsRes, attendanceRes, gradesRes] = await Promise.all([
        supabase.from('teachers').select('id', { count: 'exact' }),
        supabase.from('students').select('id', { count: 'exact' }),
        supabase.from('classes').select('id, name, class_level'),
        supabase.from('class_enrollments').select('id', { count: 'exact' }),
        supabase.from('attendance').select('id, statuses, class_id'),
        supabase.from('grades').select('id, score, max_score'),
      ])
      const totalClasses = classesRes.data?.length || 0
      const totalEnrollments = enrollmentsRes.count || 0
      const averageStudentsPerClass = totalClasses > 0 ? parseFloat((totalEnrollments / totalClasses).toFixed(1)) : 0
      const allAttendance = attendanceRes.data || []
      const presentCount = allAttendance.filter((a: any) => Array.isArray(a.statuses) && a.statuses.includes('present')).length
      const attendanceRate = allAttendance.length > 0 ? parseFloat(((presentCount / allAttendance.length) * 100).toFixed(1)) : 0
      const allGrades = gradesRes.data || []
      const avgGrade = allGrades.length > 0
        ? parseFloat((allGrades.reduce((sum: number, g: any) => sum + (g.score / g.max_score) * 100, 0) / allGrades.length).toFixed(1))
        : 0
      setReports({
        totalTeachers: teachersRes.count || 0,
        totalStudents: studentsRes.count || 0,
        totalClasses,
        totalEnrollments,
        averageStudentsPerClass,
        attendanceRate,
        averageGrade: avgGrade,
      })
      const classes = classesRes.data || []
      const levelCounts: Record<string, number> = {}
      classes.forEach((c: any) => {
        const level = c.class_level || 'Unassigned'
        levelCounts[level] = (levelCounts[level] || 0) + 1
      })
      const levelStats = Object.entries(levelCounts).map(([level, count]) => ({ level, count }))
        .sort((a, b) => a.level.localeCompare(b.level))
      setClassLevelStats(levelStats)
      const classNames: Record<string, string> = {}
      classes.forEach((c: any) => { classNames[c.id] = c.name })
      const classAttMap: Record<string, { total: number; present: number }> = {}
      allAttendance.forEach((a: any) => {
        if (!classAttMap[a.class_id]) classAttMap[a.class_id] = { total: 0, present: 0 }
        classAttMap[a.class_id].total++
        if (Array.isArray(a.statuses) && a.statuses.includes('present')) classAttMap[a.class_id].present++
      })
      const attStats = Object.entries(classAttMap).map(([classId, data]) => ({
        className: classNames[classId] || classId.slice(0, 8),
        rate: parseFloat(((data.present / data.total) * 100).toFixed(1))
      })).sort((a, b) => b.rate - a.rate).slice(0, 10)
      setClassAttendanceStats(attStats)
    } catch (error) {
      console.error('Error loading reports:', error)
    }
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) { setLoading(false); return }
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') { setLoading(false); return }
      await loadReports()
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [loadReports])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const exportCSV = async (type: 'teachers' | 'students') => {
    try {
      const res = await fetch(`/api/admin/users/list/${type}`)
      const json = await res.json()
      const data = json[type] || []

      let csv = ''
      if (type === 'teachers') {
        csv = 'Name,Email,Phone,Gender,Classes,Subjects\n'
        data.forEach((t: any) => {
          const classes = (t.classes || []).map((c: any) => c.name).join('; ')
          const subjects = (t.subjects || []).join('; ')
          csv += `"${t.full_name}","${t.email || ''}","${t.phone || ''}","${t.gender || ''}","${classes}","${subjects}"\n`
        })
      } else {
        csv = 'Name,Email,Phone,Gender,Guardian,Classes\n'
        data.forEach((s: any) => {
          const classes = (s.classes || []).map((c: any) => c.name).join('; ')
          csv += `"${s.full_name}","${s.email || ''}","${s.phone || ''}","${s.gender || ''}","${s.guardian_name || ''}","${classes}"\n`
        })
      }

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_export.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export data')
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  const maxLevelCount = Math.max(...classLevelStats.map(s => s.count), 1)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <BarChart3 className="w-10 h-10 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-900">Reports & Analytics</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportCSV('teachers')}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export Teachers
          </button>
          <button
            onClick={() => exportCSV('students')}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export Students
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8 text-blue-500" />
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total Teachers</h3>
          <p className="text-3xl font-bold text-gray-900">{reports.totalTeachers}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8 text-green-500" />
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total Students</h3>
          <p className="text-3xl font-bold text-gray-900">{reports.totalStudents}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-4">
            <BookOpen className="w-8 h-8 text-purple-500" />
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total Classes</h3>
          <p className="text-3xl font-bold text-gray-900">{reports.totalClasses}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8 text-orange-500" />
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total Enrollments</h3>
          <p className="text-3xl font-bold text-gray-900">{reports.totalEnrollments}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500">
          <div className="flex items-center justify-between mb-4">
            <BarChart3 className="w-8 h-8 text-indigo-500" />
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Avg Students/Class</h3>
          <p className="text-3xl font-bold text-gray-900">{reports.averageStudentsPerClass}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-teal-500">
          <div className="flex items-center justify-between mb-4">
            <UserCheck className="w-8 h-8 text-teal-500" />
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Attendance Rate</h3>
          <p className={`text-3xl font-bold ${reports.attendanceRate >= 80 ? 'text-green-600' : reports.attendanceRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
            {reports.attendanceRate}%
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-pink-500">
          <div className="flex items-center justify-between mb-4">
            <ClipboardList className="w-8 h-8 text-pink-500" />
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Avg Grade</h3>
          <p className={`text-3xl font-bold ${reports.averageGrade >= 70 ? 'text-green-600' : reports.averageGrade >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
            {reports.averageGrade}%
          </p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Students per Class Level */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Students per Class Level</h3>
          {classLevelStats.length === 0 ? (
            <p className="text-gray-500 text-sm">No class data available</p>
          ) : (
            <div className="space-y-3">
              {classLevelStats.map((stat) => (
                <div key={stat.level} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 w-24">{stat.level}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                      style={{ width: `${Math.max((stat.count / maxLevelCount) * 100, 10)}%` }}
                    >
                      <span className="text-xs text-white font-medium">{stat.count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attendance Rate per Class */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Attendance Rate by Class</h3>
          {classAttendanceStats.length === 0 ? (
            <p className="text-gray-500 text-sm">No attendance data available</p>
          ) : (
            <div className="space-y-3">
              {classAttendanceStats.map((stat) => (
                <div key={stat.className} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 w-24 truncate" title={stat.className}>{stat.className}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className={`h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500 ${
                        stat.rate >= 80 ? 'bg-green-500' : stat.rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.max(stat.rate, 5)}%` }}
                    >
                      <span className="text-xs text-white font-medium">{stat.rate}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">Summary</h3>
        <div className="space-y-2 text-gray-600">
          <p>School has {reports.totalTeachers} active teachers</p>
          <p>{reports.totalStudents} students are enrolled across {reports.totalClasses} classes</p>
          <p>Average of {reports.averageStudentsPerClass} students per class</p>
          <p>Overall attendance rate: <span className={reports.attendanceRate >= 80 ? 'text-green-600 font-medium' : reports.attendanceRate >= 60 ? 'text-yellow-600 font-medium' : 'text-red-600 font-medium'}>{reports.attendanceRate}%</span></p>
          <p>Average grade across all assessments: <span className={reports.averageGrade >= 70 ? 'text-green-600 font-medium' : reports.averageGrade >= 50 ? 'text-yellow-600 font-medium' : 'text-red-600 font-medium'}>{reports.averageGrade}%</span></p>
        </div>
      </div>
    </div>
  )
}
