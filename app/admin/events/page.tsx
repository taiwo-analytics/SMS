'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Calendar, Plus, Edit, Trash2, X, Clock } from 'lucide-react'
import { Event } from '@/types/events'

export default function AdminEventsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<Event[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: '',
    event_time: '',
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

  const handleCreateEvent = async () => {
    try {
      const eventDateTime = formData.event_time
        ? `${formData.event_date}T${formData.event_time}:00`
        : formData.event_date

      const { error } = await supabase.from('events').insert({
        title: formData.title,
        description: formData.description,
        event_date: eventDateTime,
        event_time: formData.event_time,
        location: formData.location,
      })

      if (error) throw error

      setShowModal(false)
      setFormData({ title: '', description: '', event_date: '', event_time: '', location: '' })
      loadEvents()
    } catch (error: any) {
      alert(error.message || 'Error creating event')
    }
  }

  const handleUpdateEvent = async () => {
    if (!editingEvent) return

    try {
      const eventDateTime = formData.event_time
        ? `${formData.event_date}T${formData.event_time}:00`
        : formData.event_date

      await supabase
        .from('events')
        .update({
          title: formData.title,
          description: formData.description,
          event_date: eventDateTime,
          event_time: formData.event_time,
          location: formData.location,
        })
        .eq('id', editingEvent.id)

      setShowModal(false)
      setEditingEvent(null)
      setFormData({ title: '', description: '', event_date: '', event_time: '', location: '' })
      loadEvents()
    } catch (error: any) {
      alert(error.message || 'Error updating event')
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      await supabase.from('events').delete().eq('id', eventId)
      loadEvents()
    } catch (error: any) {
      alert(error.message || 'Error deleting event')
    }
  }

  const openEditModal = (event: Event) => {
    const eventDate = new Date(event.event_date)
    setEditingEvent(event)
    setFormData({
      title: event.title,
      description: event.description || '',
      event_date: eventDate.toISOString().split('T')[0],
      event_time: event.event_time || '',
      location: event.location || '',
    })
    setShowModal(true)
  }

  const openCreateModal = () => {
    setEditingEvent(null)
    setFormData({ title: '', description: '', event_date: '', event_time: '', location: '' })
    setShowModal(true)
  }

  const getEventStatus = (eventDate: string) => {
    const date = new Date(eventDate)
    const now = new Date()
    const diffTime = date.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const isOngoing = diffTime < 0 && Math.abs(diffTime) < 24 * 60 * 60 * 1000

    if (isOngoing) return { text: 'Ongoing', color: 'text-green-600 bg-green-50' }
    if (diffDays < 0) return { text: 'Past', color: 'text-gray-500 bg-gray-50' }
    if (diffDays === 0) return { text: 'Today', color: 'text-blue-600 bg-blue-50' }
    if (diffDays === 1) return { text: 'Tomorrow', color: 'text-orange-600 bg-orange-50' }
    return { text: `${diffDays} days left`, color: 'text-blue-600 bg-blue-50' }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
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
                  No events found. Click "Add Event" to create one.
                </td>
              </tr>
            ) : (
              events.map((event) => {
                const status = getEventStatus(event.event_date)
                const eventDate = new Date(event.event_date)
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
                      {event.event_time && (
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {event.event_time}
                        </div>
                      )}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.event_date}
                    onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={formData.event_time}
                    onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
