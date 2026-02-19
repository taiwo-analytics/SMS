'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { MessageSquare, Send, User, Clock } from 'lucide-react'
export default function AdminMessagesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState({ recipient: '', subject: '', content: '' })

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
        setLoading(false)
        return
      }
      await loadMessages()
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setMessages((data || []).map((m: any) => ({
        ...m,
        date: new Date(m.created_at).toLocaleString(),
      })))
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const handleSendMessage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const recipient_role = newMessage.recipient?.trim() || 'all'

      const { error } = await supabase.from('messages').insert({
        sender_id: user?.id || null,
        recipient_role,
        subject: newMessage.subject,
        content: newMessage.content,
      })

      if (error) throw error
      setNewMessage({ recipient: '', subject: '', content: '' })
      await loadMessages()
      alert('Message sent')
    } catch (error: any) {
      console.error('Error sending message:', error)
      alert(error.message || 'Failed to send message')
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <MessageSquare className="w-10 h-10 text-blue-600" />
        <h2 className="text-3xl font-bold text-gray-900">Messages</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Inbox</h3>
          {messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p>No messages yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{message.subject || 'No subject'}</p>
                      <p className="text-sm text-gray-600">{message.content}</p>
                      <p className="text-xs text-gray-400 mt-2">To: {message.recipient_role || 'all'}</p>
                    </div>
                    <span className="text-xs text-gray-500">{message.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Compose Message</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To (role)</label>
              <input
                type="text"
                value={newMessage.recipient}
                onChange={(e) => setNewMessage({ ...newMessage, recipient: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="admin, teacher, student, parent (or leave blank for all)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={newMessage.subject}
                onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Message subject"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={newMessage.content}
                onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={6}
                placeholder="Type your message..."
              />
            </div>
            <button
              onClick={handleSendMessage}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Send className="w-5 h-5" />
              Send Message
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
