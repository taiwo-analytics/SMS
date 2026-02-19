'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { BarChart3, TrendingUp, Users, BookOpen } from 'lucide-react'

export default function AdminReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState({
    totalTeachers: 0,
    totalStudents: 0,
    totalClasses: 0,
    totalEnrollments: 0,
    averageStudentsPerClass: 0,
  })

  useEffect(() => {
    checkAuth()
  }, [])

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

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.error('Profile error:', profileError)
          setLoading(false)
          return
        }

        if (profile?.role !== 'admin') {
          console.warn('User is not admin')
          setLoading(false)
          return
        }
      } catch (profileErr) {
        console.error('Error checking profile:', profileErr)
        setLoading(false)
        return
      }

      await loadReports()
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadReports = async () => {
    try {
      const [teachersRes, studentsRes, classesRes, enrollmentsRes] = await Promise.all([
        supabase.from('teachers').select('id', { count: 'exact' }),
        supabase.from('students').select('id', { count: 'exact' }),
        supabase.from('classes').select('id', { count: 'exact' }),
        supabase.from('class_enrollments').select('id', { count: 'exact' }),
      ])

      const totalClasses = classesRes.count || 0
      const totalEnrollments = enrollmentsRes.count || 0
      const averageStudentsPerClass = totalClasses > 0 ? (totalEnrollments / totalClasses).toFixed(1) : 0

      setReports({
        totalTeachers: teachersRes.count || 0,
        totalStudents: studentsRes.count || 0,
        totalClasses: totalClasses,
        totalEnrollments: totalEnrollments,
        averageStudentsPerClass: parseFloat(String(averageStudentsPerClass)),
      })
    } catch (error) {
      console.error('Error loading reports:', error)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <BarChart3 className="w-10 h-10 text-blue-600" />
        <h2 className="text-3xl font-bold text-gray-900">Reports & Analytics</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">Summary</h3>
        <div className="space-y-2 text-gray-600">
          <p>• School has {reports.totalTeachers} active teachers</p>
          <p>• {reports.totalStudents} students are enrolled</p>
          <p>• {reports.totalClasses} classes are currently active</p>
          <p>• Average of {reports.averageStudentsPerClass} students per class</p>
        </div>
      </div>
    </div>
  )
}
