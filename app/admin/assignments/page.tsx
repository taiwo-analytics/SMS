'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ClipboardList, BookOpen, Calendar, Search, Filter, Trash2, Eye, ChevronDown } from 'lucide-react'
import { Assignment, Class } from '@/types/database'
import SchoolLoader from '@/components/SchoolLoader'

interface EnrichedAssignment extends Assignment {
  class_name?: string
  class_subject?: string
  teacher_name?: string
}

export default function AdminAssignmentsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [assignments, setAssignments] = useState<EnrichedAssignment[]>([])
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') { router.push('/'); return }

      // Load all classes
      const { data: classesData } = await supabase
        .from('classes')
        .select('*')
        .order('name')
      setClasses(classesData || [])

      // Load all assignments
      const res = await fetch('/api/assignments')
      const data = await res.json()
      const rawAssignments: Assignment[] = data.assignments || []

      // Load teacher names
      const teacherIds = [...new Set(rawAssignments.map(a => a.teacher_id))]
      let teacherMap: Record<string, string> = {}
      if (teacherIds.length > 0) {
        const { data: teachers } = await supabase
          .from('teachers')
          .select('id, user_id')
          .in('id', teacherIds)

        if (teachers && teachers.length > 0) {
          const userIds = teachers.map(t => t.user_id)
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds)

          const userNameMap: Record<string, string> = {}
          for (const p of profiles || []) {
            userNameMap[p.id] = p.full_name || 'Unknown'
          }
          for (const t of teachers) {
            teacherMap[t.id] = userNameMap[t.user_id] || 'Unknown'
          }
        }
      }

      // Build class map
      const classMap: Record<string, Class> = {}
      for (const c of classesData || []) {
        classMap[c.id] = c
      }

      // Enrich assignments
      const enriched: EnrichedAssignment[] = rawAssignments.map(a => ({
        ...a,
        class_name: classMap[a.class_id]?.name || 'Unknown Class',
        class_subject: classMap[a.class_id]?.subject || '',
        teacher_name: teacherMap[a.teacher_id] || 'Unknown Teacher',
      }))

      setAssignments(enriched)
    } catch {
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assignment?')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/assignments?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to delete')
        return
      }
      setAssignments(prev => prev.filter(a => a.id !== id))
    } catch {
      alert('Failed to delete assignment')
    } finally {
      setDeleting(null)
    }
  }

  const filtered = assignments.filter(a => {
    const matchesClass = selectedClass === 'all' || a.class_id === selectedClass
    const matchesSearch = !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.description?.toLowerCase().includes(search.toLowerCase()) ||
      a.teacher_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.class_name?.toLowerCase().includes(search.toLowerCase())
    return matchesClass && matchesSearch
  })

  const now = new Date()
  const totalCount = filtered.length
  const upcomingCount = filtered.filter(a => a.due_date && new Date(a.due_date) >= now).length
  const pastCount = filtered.filter(a => a.due_date && new Date(a.due_date) < now).length
  const noDueCount = filtered.filter(a => !a.due_date).length

  // Group by class
  const groupedByClass: Record<string, EnrichedAssignment[]> = {}
  for (const a of filtered) {
    const key = a.class_name + (a.class_subject ? ` - ${a.class_subject}` : '')
    if (!groupedByClass[key]) groupedByClass[key] = []
    groupedByClass[key].push(a)
  }

  if (loading) return <SchoolLoader />

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-1">
          <ClipboardList className="w-10 h-10 text-indigo-600" />
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Assignments</h2>
            <p className="text-sm text-gray-500">View all assignments given to classes by teachers</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-emerald-500">
          <p className="text-sm text-gray-500">Upcoming</p>
          <p className="text-2xl font-bold text-emerald-600">{upcomingCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-red-400">
          <p className="text-sm text-gray-500">Past Due</p>
          <p className="text-2xl font-bold text-red-500">{pastCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-gray-400">
          <p className="text-sm text-gray-500">No Due Date</p>
          <p className="text-2xl font-bold text-gray-500">{noDueCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search assignments, teachers, classes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="pl-10 pr-8 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm appearance-none bg-white min-w-[200px]"
          >
            <option value="all">All Classes</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} {cls.subject ? `- ${cls.subject}` : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-medium">No assignments found</p>
          <p className="text-gray-400 text-sm mt-1">
            {search || selectedClass !== 'all'
              ? 'Try adjusting your filters'
              : 'Teachers haven\'t created any assignments yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByClass).sort(([a], [b]) => a.localeCompare(b)).map(([className, classAssignments]) => (
            <div key={className} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Class header */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-gray-900">{className}</h3>
                  </div>
                  <span className="text-xs font-medium text-indigo-600 bg-indigo-100 px-2.5 py-1 rounded-full">
                    {classAssignments.length} assignment{classAssignments.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Assignments list */}
              <div className="divide-y divide-gray-50">
                {classAssignments
                  .sort((a, b) => {
                    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
                    if (a.due_date) return -1
                    if (b.due_date) return 1
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  })
                  .map((a) => {
                    const isPast = a.due_date && new Date(a.due_date) < now
                    const isToday = a.due_date && new Date(a.due_date).toDateString() === now.toDateString()
                    const daysLeft = a.due_date
                      ? Math.ceil((new Date(a.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                      : null

                    return (
                      <div key={a.id} className={`px-5 py-4 hover:bg-gray-50/50 transition-colors ${isPast ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-gray-900">{a.title}</h4>
                              {isPast && (
                                <span className="text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">PAST DUE</span>
                              )}
                              {isToday && !isPast && (
                                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">DUE TODAY</span>
                              )}
                            </div>
                            {a.description && (
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{a.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" />
                                By: <span className="font-medium text-gray-700">{a.teacher_name}</span>
                              </span>
                              {a.due_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  Due: {new Date(a.due_date).toLocaleDateString()}
                                  {daysLeft !== null && daysLeft > 0 && (
                                    <span className={`ml-1 font-medium ${daysLeft <= 2 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                      ({daysLeft}d left)
                                    </span>
                                  )}
                                </span>
                              )}
                              <span className="text-gray-400">
                                Created: {new Date(a.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete(a.id)}
                            disabled={deleting === a.id}
                            className="flex-shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                            title="Delete assignment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
