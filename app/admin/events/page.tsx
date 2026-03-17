'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Calendar, Plus, Edit, Trash2, X, Clock } from 'lucide-react'
import { Event } from '@/types/events'
import SchoolLoader from '@/components/SchoolLoader'

export default function AdminEventsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<Event[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    start_time: '',
    end_time: '',
    location: '',
  })

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!loading) {
      loadEvents()
    }
  }, [loading])

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(id)
  }, [notice])

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
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Error loading events:', error)
    }
  }

  const pad2 = (n: number) => String(n).padStart(2, '0')
  const parseTime24 = (s?: string): string | null => {
    if (!s) return null
    const t = s.trim().toUpperCase()
    const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
    if (!m) return null
    let h = Number(m[1])
    const mm = Number(m[2])
    const ap = m[3]
    if (Number.isNaN(h) || Number.isNaN(mm)) return null
    if (ap === 'PM' && h < 12) h += 12
    if (ap === 'AM' && h === 12) h = 0
    return `${pad2(h)}:${pad2(mm)}`
  }
  const splitRange24 = (s?: string): { start: string | null, end: string | null } => {
    if (!s) return { start: null, end: null }
    if (!s.includes('-')) return { start: parseTime24(s), end: null }
    const [a, b] = s.split('-')
    return { start: parseTime24(a || ''), end: parseTime24(b || '') }
  }
  const addMinutes24 = (hhmm: string, mins: number) => {
    const [h, m] = hhmm.split(':').map(Number)
    const d = new Date(2000, 0, 1, h, m, 0, 0)
    d.setMinutes(d.getMinutes() + mins)
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  }

  const handleCreateEvent = async () => {
    try {
      if (!formData.date) {
        alert('Please select a date')
        return
      }
      const startIso = formData.start_time
        ? new Date(`${formData.date}T${formData.start_time}:00`).toISOString()
        : new Date(`${formData.date}T00:00:00`).toISOString()
      const endIso = formData.end_time
        ? new Date(`${formData.date}T${formData.end_time}:00`).toISOString()
        : formData.start_time
          ? new Date(new Date(`${formData.date}T${formData.start_time}:00`).getTime() + 60 * 60 * 1000).toISOString()
          : new Date(`${formData.date}T23:59:59`).toISOString()

      const payload = {
        title: formData.title,
        description: formData.description,
        start_at: startIso,
        end_at: endIso,
        event_date: startIso,
        event_time: formData.start_time || null,
        location: formData.location,
      } as any
      let { error } = await supabase.from('events').insert(payload)

      // Fallback for older schema without start_at/end_at
      if (error && String(error.message).toLowerCase().includes('end_at')) {
        const dateOnly = formData.date // "YYYY-MM-DD" from <input type='date'>
        const combinedTime =
          formData.start_time && formData.end_time
            ? `${formData.start_time}-${formData.end_time}`
            : formData.start_time || null
        const legacyPayload = {
          title: formData.title,
          description: formData.description,
          event_date: dateOnly,
          event_time: combinedTime,
          location: formData.location,
        }
        const res = await supabase.from('events').insert(legacyPayload)
        error = res.error || null
      }

      if (error) throw error

      setShowModal(false)
      setFormData({ title: '', description: '', date: '', start_time: '', end_time: '', location: '' })
      loadEvents()
      setNotice({ type: 'success', text: 'Event created successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error creating event' })
    }
  }

  const handleUpdateEvent = async () => {
    if (!editingEvent) return

    try {
      if (!formData.date) {
        alert('Please select a date')
        return
      }
      const startIso = formData.start_time
        ? new Date(`${formData.date}T${formData.start_time}:00`).toISOString()
        : new Date(`${formData.date}T00:00:00`).toISOString()
      const endIso = formData.end_time
        ? new Date(`${formData.date}T${formData.end_time}:00`).toISOString()
        : formData.start_time
          ? new Date(new Date(`${formData.date}T${formData.start_time}:00`).getTime() + 60 * 60 * 1000).toISOString()
          : new Date(`${formData.date}T23:59:59`).toISOString()

      let { error } = await supabase
        .from('events')
        .update({
          title: formData.title,
          description: formData.description,
          start_at: startIso,
          end_at: endIso,
          event_date: startIso,
          event_time: formData.start_time || null,
          location: formData.location,
        })
        .eq('id', editingEvent.id)

      if (error && String(error.message).toLowerCase().includes('end_at')) {
        const dateOnly = formData.date
        const combinedTime =
          formData.start_time && formData.end_time
            ? `${formData.start_time}-${formData.end_time}`
            : formData.start_time || null
        const { error: err2 } = await supabase
          .from('events')
          .update({
            title: formData.title,
            description: formData.description,
            event_date: dateOnly,
            event_time: combinedTime,
            location: formData.location,
          })
          .eq('id', editingEvent.id)
        error = err2 || null
      }
      if (error) throw error

      setShowModal(false)
      setEditingEvent(null)
      setFormData({ title: '', description: '', date: '', start_time: '', end_time: '', location: '' })
      loadEvents()
      setNotice({ type: 'success', text: 'Event updated successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error updating event' })
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      await supabase.from('events').delete().eq('id', eventId)
      loadEvents()
      setNotice({ type: 'success', text: 'Event deleted successfully' })
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Error deleting event' })
    }
  }

  const openEditModal = (event: Event) => {
    const startDate = new Date(event.start_at || (event as any).event_date as string)
    const endDate = (event as any).end_at ? new Date((event as any).end_at) : null
    let startTime = `${pad2(startDate.getHours())}:${pad2(startDate.getMinutes())}`
    let endTime = endDate ? `${pad2(endDate.getHours())}:${pad2(endDate.getMinutes())}` : ''
    const et = (event as any).event_time as string | undefined
    if (et) {
      const { start, end } = splitRange24(et)
      if (start) startTime = start
      if (end) endTime = end
    }
    if (!endTime && startTime) endTime = addMinutes24(startTime, 30)
    setEditingEvent(event)
    setFormData({
      title: event.title,
      description: event.description || '',
      date: startDate.toISOString().split('T')[0],
      start_time: startTime,
      end_time: endTime,
      location: event.location || '',
    })
    setShowModal(true)
  }

  const openCreateModal = () => {
    setEditingEvent(null)
    setFormData({ title: '', description: '', date: '', start_time: '', end_time: '', location: '' })
    setShowModal(true)
  }

  const resolveStartEnd = (ev: any) => {
    let start = ev.start_at ? new Date(ev.start_at) : new Date(ev.event_date)
    const { start: s24, end: e24 } = splitRange24(ev.event_time)
    if (s24) {
      const [h, m] = s24.split(':').map(Number)
      start.setHours(h, m, 0, 0)
    }
    let end: Date
    if (ev.end_at) {
      end = new Date(ev.end_at)
    } else {
      if (e24) {
        end = new Date(start)
        const [h2, m2] = e24.split(':').map(Number)
        end.setHours(h2, m2, 0, 0)
      } else if (parseTime24(ev.end_time || '')) {
        end = new Date(start)
        const t = parseTime24(ev.end_time)!
        const [h, m] = t.split(':').map(Number)
        end.setHours(h, m, 0, 0)
      } else {
        end = new Date(start.getTime() + 60 * 60 * 1000)
      }
    }
    return { start, end }
  }

  const getEventStatus = (ev: any) => {
    const now = new Date()
    const { start, end } = resolveStartEnd(ev)
    if (now >= start && now <= end) return { text: 'Ongoing', color: 'text-green-600 bg-green-50' }
    if (now > end) return { text: 'Completed', color: 'text-gray-600 bg-gray-50' }
    const sameDay = start.toDateString() === now.toDateString()
    if (sameDay) {
      const ms = start.getTime() - now.getTime()
      const hrs = Math.max(1, Math.ceil(ms / (1000 * 60 * 60)))
      return { text: `${hrs}h left`, color: 'text-orange-600 bg-orange-50' }
    }
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
    if (start.toDateString() === tomorrow.toDateString()) return { text: 'Tomorrow', color: 'text-orange-600 bg-orange-50' }
    const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfStart = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const daysLeft = Math.round((startOfStart.getTime() - startOfNow.getTime()) / (1000 * 60 * 60 * 24))
    return { text: `${daysLeft} days left`, color: 'text-blue-600 bg-blue-50' }
  }

  const formatDuration = (ev: any) => {
    const { start, end } = resolveStartEnd(ev)
    const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h && m) return `${h}h ${m}m`
    if (h) return `${h}h`
    return `${m}m`
  }

  if (loading) {
    return <SchoolLoader />
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Calendar className="w-10 h-10 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-900">Events Management</h2>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Event
        </button>
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

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date & Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No events found. Click &quot;Add Event&quot; to create one.
                </td>
              </tr>
            ) : (
              events.map((event) => {
                const status = getEventStatus(event)
                const { start } = resolveStartEnd(event as any)
                const eventDate = new Date(start)
                return (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{event.title}</div>
                      {event.description && (
                        <div className="text-sm text-gray-500 mt-1">{event.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {eventDate.toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span>{formatDuration(event)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500">{event.location || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${status.color}`}>
                        {status.text}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(event)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(event.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {editingEvent ? 'Edit Event' : 'Add New Event'}
              </h3>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                  placeholder="e.g., PTA Meeting"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Event description..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={(formData as any).date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={(formData as any).start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    step="60"
                    className="w-full min-w-[8rem] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={(formData as any).end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    step="60"
                    className="w-full min-w-[8rem] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., School Auditorium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={editingEvent ? handleUpdateEvent : handleCreateEvent}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingEvent ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
