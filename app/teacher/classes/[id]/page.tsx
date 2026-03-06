'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function TeacherClassDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const classId = params.id
  const [loading, setLoading] = useState(true)
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [classInfo, setClassInfo] = useState<any | null>(null)
  const [students, setStudents] = useState<any[]>([])
  const [gender, setGender] = useState<string>('all')
  const [department, setDepartment] = useState<string>('all')
  const [leaderSaving, setLeaderSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(id)
  }, [notice])

  useEffect(() => {
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/auth/login'); return }
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
        if (profile?.role !== 'teacher') { router.push('/'); return }
        const { data: teacher } = await supabase.from('teachers').select('id').eq('user_id', user.id).maybeSingle()
        if (!teacher) { router.push('/'); return }
        setTeacherId(teacher.id)

        const { data: cls } = await supabase
          .from('classes')
          .select('*')
          .eq('id', classId)
          .maybeSingle()
        setClassInfo(cls || null)

        // Fetch students via server API (bypasses RLS)
        try {
          const res = await fetch(`/api/teacher/class-students?class_id=${classId}`)
          if (res.ok) {
            const js = await res.json()
            setStudents(js.students || [])
          }
        } catch {}
      } finally {
        setLoading(false)
      }
    })()
  }, [classId, router])

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const gOk = gender === 'all' || String(s.gender || '').toLowerCase() === gender
      const d = String(s.department || '').trim() || 'None'
      const dOk = department === 'all' || department === d
      return gOk && dOk
    })
  }, [students, gender, department])

  const assignLeader = async (studentId: string) => {
    try {
      setLeaderSaving(true)
      const res = await fetch('/api/teacher/classes/leader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_id: classId, student_id: studentId })
      })
      const js = await res.json()
      if (!res.ok) throw new Error(js.error || 'Failed to assign leader')
      setNotice({ type: 'success', text: 'Class leader assigned' })
      setClassInfo((prev: any) => ({ ...(prev || {}), class_leader_id: studentId }))
    } catch (e: any) {
      setNotice({ type: 'error', text: e?.message || 'Failed to assign leader' })
    } finally {
      setLeaderSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div className="max-w-4xl mx-auto">
      {notice && (
        <div className={`mb-4 border rounded-lg px-4 py-3 text-sm ${
          notice.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'
        }`}>{notice.text}</div>
      )}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{(classInfo as any)?.class_level || classInfo?.name || 'Class'}</h2>
        <p className="text-sm text-gray-500 mt-1">{students.length} student{students.length !== 1 ? 's' : ''}</p>

        {/* Assign Class Leader */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Class Captain:</label>
          <select
            value={classInfo?.class_leader_id || ''}
            onChange={(e) => { if (e.target.value) assignLeader(e.target.value) }}
            disabled={leaderSaving}
            className="border rounded-lg px-3 py-2 text-sm min-w-[200px] disabled:opacity-50"
          >
            <option value="">— Select captain —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
          {leaderSaving && <span className="text-xs text-gray-400">Saving...</span>}
        </div>

        <div className="mt-4 flex gap-2">
          <a
            href={`/teacher/broadsheet?class_id=${classId}`}
            className="px-3 py-1.5 border rounded text-xs hover:bg-gray-50"
            title="Open broadsheet for this class"
          >
            Broadsheet
          </a>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
          <select value={gender} onChange={(e) => setGender(e.target.value)} className="border rounded px-3 py-2 text-sm">
            <option value="all">All</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className="border rounded px-3 py-2 text-sm">
            <option value="all">All</option>
            <option value="Science">Science</option>
            <option value="Business">Business</option>
            <option value="Humanities">Humanities</option>
            <option value="None">None</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-10">S/N</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gender</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No students match filters.</td></tr>
            ) : filtered.map((s, idx) => {
              const dept = s.department || 'None'
              return (
                <tr key={s.id} className={`hover:bg-gray-50 ${s.id === classInfo?.class_leader_id ? 'bg-amber-50' : ''}`}>
                  <td className="px-6 py-3 text-sm text-gray-500">{idx + 1}</td>
                  <td className="px-6 py-3 text-sm text-gray-800">
                    {s.full_name}
                    {s.id === classInfo?.class_leader_id && (
                      <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded">Captain</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{s.gender || '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{dept}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
