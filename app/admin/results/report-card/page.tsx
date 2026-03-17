'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import SchoolLoader from '@/components/SchoolLoader'

function AdminReportCardIndexContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [students, setStudents] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [classId, setClassId] = useState(searchParams.get('class_id') || '')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingClass, setLoadingClass] = useState(false)

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

  useEffect(() => {
    ;(async () => {
      if (!classId) return
      setLoadingClass(true)
      try {
        const res = await fetch(`/api/admin/classes/students?class_id=${classId}`)
        const js = await res.json()
        if (res.ok && Array.isArray(js.students)) {
          setStudents(js.students)
        }
      } finally {
        setLoadingClass(false)
      }
    })()
  }, [classId])

  const normalize = (str: string) => (str || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const isNear = (a: string, b: string) => {
    if (a === b) return true
    if (Math.abs(a.length - b.length) > 1) return false
    let i = 0, j = 0, errors = 0
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; } else {
        errors++; if (errors > 1) return false
        if (a.length > b.length) i++
        else if (b.length > a.length) j++
        else { i++; j++; }
      }
    }
    return errors <= 1
  }
  const nameMatches = (name: string, query: string) => {
    const h = normalize(name)
    const n = normalize(query)
    if (!n) return true
    if (h.includes(n)) return true
    const ht = h.split(' ')
    const nt = n.split(' ')
    return nt.every((t) => ht.some((x) => x.startsWith(t) || t.startsWith(x) || isNear(x, t)))
  }
  const filtered = students.filter((s) => {
    const matchesSearch =
      !search ||
      nameMatches(s.full_name || '', search) ||
      normalize((s.admission_number || s.admission || '') as string).includes(normalize(search))
    return matchesSearch
  })

  if (loading) return <SchoolLoader />

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
          <div className="text-center py-16 text-gray-400">
            {loadingClass ? 'Loading class students…' : 'No students found.'}
          </div>
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
                      onClick={() => {
                        const ret = `/admin/results/report-card${classId ? `?class_id=${classId}` : ''}`
                        const qp = new URLSearchParams()
                        if (classId) qp.set('class_id', classId)
                        qp.set('return_to', ret)
                        router.push(`/admin/results/report-card/${s.id}?${qp.toString()}`)
                      }}
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

export default function AdminReportCardIndexPage() {
  return (
    <Suspense fallback={<SchoolLoader />}>
      <AdminReportCardIndexContent />
    </Suspense>
  )
}
