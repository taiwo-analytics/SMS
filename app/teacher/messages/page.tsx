'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { MessageSquare, Send, Trash2, Reply, Mail, MailOpen } from 'lucide-react'

interface MessageItem {
  id: string
  sender_id?: string
  recipient_role?: string
  recipient_id?: string | null
  subject?: string
  content?: string
  is_read?: boolean
  read_at?: string | null
  reply_to?: string | null
  created_at: string
  date: string
  replies?: MessageItem[]
}

export default function TeacherMessagesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [newMessage, setNewMessage] = useState({ recipient: 'admin', subject: '', content: '', reply_to: null as string | null })
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const loadMessages = useCallback(async (currentUserId?: string) => {
    try {
      const uid = currentUserId || userId
      // Fetch broadcast messages (to 'teacher' or 'all' with no specific recipient)
      // and direct messages addressed specifically to this teacher
      const [broadcastRes, directRes] = await Promise.all([
        supabase
          .from('messages')
          .select('*')
          .in('recipient_role', ['teacher', 'all'])
          .is('recipient_id', null)
          .order('created_at', { ascending: false }),
        uid
          ? supabase
              .from('messages')
              .select('*')
              .eq('recipient_id', uid)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] as any[], error: null }),
      ])
      if (broadcastRes.error) throw broadcastRes.error
      // Merge and deduplicate by id
      const seen = new Set<string>()
      const combined: any[] = []
      for (const m of [...(broadcastRes.data || []), ...((directRes as any).data || [])]) {
        if (!seen.has(m.id)) { seen.add(m.id); combined.push(m) }
      }
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const allMessages = combined.map((m: any) => ({
        ...m,
        date: new Date(m.created_at).toLocaleString(),
      }))
      const parentMessages = allMessages.filter((m: any) => !m.reply_to)
      const replyMessages = allMessages.filter((m: any) => m.reply_to)
      const threaded = parentMessages.map((parent: any) => ({
        ...parent,
        replies: replyMessages
          .filter((r: any) => r.reply_to === parent.id)
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      }))
      setMessages(threaded)
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }, [userId])

  const checkAuth = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) { setLoading(false); router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'teacher') { router.push('/'); return }
      await loadMessages(user.id)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [loadMessages, router])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    const channel = supabase
      .channel('messages-teacher')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => { loadMessages() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadMessages])

  const handleSendMessage = async () => {
    if (!newMessage.subject && !newMessage.content) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const recipient_role = newMessage.recipient?.trim() || 'admin'

      const insertData: any = {
        sender_id: user?.id || null,
        recipient_role,
        subject: newMessage.subject,
        content: newMessage.content,
      }
      if (newMessage.reply_to) {
        insertData.reply_to = newMessage.reply_to
      }

      const { error } = await supabase.from('messages').insert(insertData)
      if (error) throw error

      setNewMessage({ recipient: 'admin', subject: '', content: '', reply_to: null })
      await loadMessages()
    } catch (error: any) {
      console.error('Error sending message:', error)
      alert(error.message || 'Failed to send message')
    }
  }

  const handleMarkAsRead = async (messageId: string) => {
    try {
      await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', messageId)
      await loadMessages()
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Delete this message?')) return
    try {
      await supabase.from('messages').delete().eq('id', messageId)
      if (selectedMessage?.id === messageId) setSelectedMessage(null)
      await loadMessages()
    } catch (error: any) {
      console.error('Error deleting message:', error)
      alert(error.message || 'Failed to delete message')
    }
  }

  const handleReply = (message: MessageItem) => {
    setNewMessage({
      recipient: message.recipient_role || 'admin',
      subject: `Re: ${message.subject || ''}`,
      content: '',
      reply_to: message.id,
    })
  }

  const handleSelectMessage = (message: MessageItem) => {
    setSelectedMessage(message)
    if (!message.is_read) {
      handleMarkAsRead(message.id)
    }
  }

  const unreadCount = messages.filter(m => !m.is_read).length

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
      <div>
        <div className="flex items-center gap-4 mb-6">
          <MessageSquare className="w-10 h-10 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-900">Messages</h2>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-medium px-2.5 py-1 rounded-full">
              {unreadCount} unread
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Inbox</h3>
              {messages.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p>No messages yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div key={message.id}>
                      <div
                        onClick={() => handleSelectMessage(message)}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          selectedMessage?.id === message.id ? 'border-blue-400 bg-blue-50' : 'hover:bg-gray-50'
                        } ${!message.is_read ? 'border-l-4 border-l-blue-500' : ''}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {message.is_read ? (
                              <MailOpen className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                            ) : (
                              <Mail className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`${!message.is_read ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                {message.subject || 'No subject'}
                              </p>
                              <p className="text-sm text-gray-600 truncate">{message.content}</p>
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                {message.recipient_id ? (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Direct message</span>
                                ) : (
                                  <span className="text-xs text-gray-400">To: {message.recipient_role || 'all'}</span>
                                )}
                                {message.replies && message.replies.length > 0 && (
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                    {message.replies.length} {message.replies.length === 1 ? 'reply' : 'replies'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                            <span className="text-xs text-gray-500">{message.date}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReply(message) }}
                              className="text-blue-500 hover:text-blue-700 p-1"
                              title="Reply"
                            >
                              <Reply className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteMessage(message.id) }}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {selectedMessage?.id === message.id && message.replies && message.replies.length > 0 && (
                        <div className="ml-8 mt-2 space-y-2">
                          {message.replies.map((reply) => (
                            <div key={reply.id} className="border rounded-lg p-3 bg-gray-50">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium text-sm">{reply.subject || 'No subject'}</p>
                                  <p className="text-sm text-gray-600">{reply.content}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-xs text-gray-500">{reply.date}</span>
                                  <button
                                    onClick={() => handleDeleteMessage(reply.id)}
                                    className="text-red-500 hover:text-red-700 p-1"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 h-fit sticky top-4">
            <h3 className="text-lg font-semibold mb-4">
              {newMessage.reply_to ? 'Reply to Message' : 'Compose Message'}
            </h3>
            {newMessage.reply_to && (
              <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <span className="text-xs text-blue-700">Replying to a message</span>
                <button
                  onClick={() => setNewMessage({ ...newMessage, reply_to: null, subject: '', content: '' })}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Cancel reply
                </button>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To (role)</label>
                <select
                  value={newMessage.recipient}
                  onChange={(e) => setNewMessage({ ...newMessage, recipient: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="admin">Admins</option>
                  <option value="teacher">Teachers</option>
                  <option value="all">All</option>
                  <option value="student">Students</option>
                  <option value="parent">Parents</option>
                </select>
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
                {newMessage.reply_to ? 'Send Reply' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
