'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function AdminReportCardIndexPage() {
  const router = useRouter()
  const [students, setStudents] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [classId, setClassId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const [{ data: classData }, { data: studentData }] = await Promise.all([
        supabase.from('classes').select('id, name').order('name'),
        supabase.from('students').select('id, full_name, admission_number').order('full_name'),
      ])
      setClasses(classData || [])
      setStudents(studentData || [])
      setLoading(false)
    })()
  }, [])

  const [enrollments, setEnrollments] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!classId) { setEnrollments({}); return }
    supabase
      .from('class_enrollments')
      .select('student_id')
      .eq('class_id', classId)
      .then(({ data }) => {
        const map: Record<string, string> = {}
        for (const e of (data || [])) map[e.student_id] = e.student_id
        setEnrollments(map)
      })
  }, [classId])

  const filtered = students.filter((s) => {
    const matchesSearch = !search ||
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.admission_number || '').toLowerCase().includes(search.toLowerCase())
    const matchesClass = !classId || enrollments[s.id]
    return matchesSearch && matchesClass
  })

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Report Cards</h1>
        <p className="text-gray-500 text-sm">Select a student to view their report card</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Filter by Class</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="border rounded px-3 py-2 text-sm min-w-[160px]"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Search Student</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or admission number..."
            className="border rounded px-3 py-2 text-sm w-full"
          />
        </div>
      </div>

      {/* Student List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No students found.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Student Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Admission No.</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.full_name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.admission_number || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => router.push(`/admin/results/report-card/${s.id}`)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                    >
                      View Report Card
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
