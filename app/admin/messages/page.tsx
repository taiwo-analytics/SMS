'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import SchoolLoader from '@/components/SchoolLoader'
import { MessageSquare, Send, Trash2, Reply, Mail, MailOpen, User, CheckCircle, Users } from 'lucide-react'

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
  senderName?: string
}

interface TeacherOption {
  id: string
  user_id: string
  full_name: string
}

export default function AdminMessagesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [newMessage, setNewMessage] = useState({
    recipientType: 'broadcast' as 'broadcast' | 'individual',
    teacherUserId: '' as string,
    subject: '',
    content: '',
    reply_to: null as string | null,
  })
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null)
  const [adminUserId, setAdminUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox')
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set())
  const [senderNames, setSenderNames] = useState<Record<string, string>>({})
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const loadReadStatus = useCallback(async (uid: string) => {
    try {
      const { data } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('user_id', uid)
      setReadMessageIds(new Set((data || []).map((r: any) => r.message_id)))
    } catch (e) {
      console.error('Error loading read status:', e)
    }
  }, [])

  const loadMessages = useCallback(async (currentUserId?: string) => {
    try {
      const uid = currentUserId || adminUserId
      if (!uid) return

      // Fetch messages relevant to admin using explicit OR filters
      const [toAdminRes, directRes, sentRes] = await Promise.all([
        // Messages addressed to admin role
        supabase
          .from('messages')
          .select('*')
          .in('recipient_role', ['admin', 'all'])
          .is('recipient_id', null)
          .order('created_at', { ascending: false }),
        // Direct messages to this admin
        supabase
          .from('messages')
          .select('*')
          .eq('recipient_id', uid)
          .order('created_at', { ascending: false }),
        // Messages sent by this admin
        supabase
          .from('messages')
          .select('*')
          .eq('sender_id', uid)
          .order('created_at', { ascending: false }),
      ])

      // Deduplicate
      const seen = new Set<string>()
      const rawMessages: any[] = []
      for (const res of [toAdminRes, directRes, sentRes]) {
        if (res.error) { console.error('Message query error:', res.error); continue }
        for (const m of (res.data || [])) {
          if (!seen.has(m.id)) { seen.add(m.id); rawMessages.push(m) }
        }
      }

      // Sort newest first
      rawMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      const senderIds = [...new Set(rawMessages.map((m: any) => m.sender_id).filter(Boolean))]
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', senderIds)
        const nameMap: Record<string, string> = {}
        ;(profiles || []).forEach((p: any) => { nameMap[p.id] = p.full_name })
        setSenderNames(nameMap)
      }

      const allMessages = rawMessages.map((m: any) => ({
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

      await loadReadStatus(uid)
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }, [adminUserId, loadReadStatus])

  const loadTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users/list/teachers')
      if (!res.ok) return
      const json = await res.json()
      setTeachers((json.teachers || []).map((t: any) => ({
        id: t.id,
        user_id: t.user_id,
        full_name: t.full_name,
      })))
    } catch (e) {
      console.error('Error loading teachers:', e)
    }
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) { setLoading(false); return }
      setAdminUserId(user.id)
      await Promise.all([loadMessages(user.id), loadTeachers()])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [loadMessages, loadTeachers])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!adminUserId) return
    const channel = supabase
      .channel('messages-admin-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => loadMessages(adminUserId))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadMessages, adminUserId])

  const handleSendMessage = async () => {
    if (!newMessage.subject && !newMessage.content) return
    setSendStatus('sending')
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const insertData: any = {
        sender_id: user?.id || null,
        subject: newMessage.subject,
        content: newMessage.content,
      }

      if (newMessage.reply_to) {
        insertData.reply_to = newMessage.reply_to
      }

      if (newMessage.recipientType === 'individual') {
        if (!newMessage.teacherUserId) { alert('Please select a teacher'); setSendStatus('idle'); return }
        insertData.recipient_role = 'teacher'
        insertData.recipient_id = newMessage.teacherUserId
      } else {
        // Broadcast to all teachers
        insertData.recipient_role = 'teacher'
        insertData.recipient_id = null
      }

      const { error } = await supabase.from('messages').insert(insertData)
      if (error) throw error

      setSendStatus('sent')
      setNewMessage({ recipientType: 'broadcast', teacherUserId: '', subject: '', content: '', reply_to: null })
      if (adminUserId) await loadMessages(adminUserId)

      // Reset status after 3 seconds
      setTimeout(() => setSendStatus('idle'), 3000)
    } catch (error: any) {
      console.error('Error sending message:', error)
      setSendStatus('error')
      alert(error.message || 'Failed to send message')
      setTimeout(() => setSendStatus('idle'), 3000)
    }
  }

  const handleMarkAsRead = async (messageId: string) => {
    if (!adminUserId) return
    try {
      await supabase
        .from('message_reads')
        .upsert({ message_id: messageId, user_id: adminUserId }, { onConflict: 'message_id,user_id' })
      setReadMessageIds(prev => new Set([...prev, messageId]))
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Delete this message?')) return
    try {
      await supabase.from('messages').delete().eq('id', messageId)
      if (selectedMessage?.id === messageId) setSelectedMessage(null)
      if (adminUserId) await loadMessages(adminUserId)
    } catch (error: any) {
      console.error('Error deleting message:', error)
      alert(error.message || 'Failed to delete message')
    }
  }

  const handleReply = (message: MessageItem) => {
    const isFromSomeoneElse = message.sender_id !== adminUserId
    if (isFromSomeoneElse && message.sender_id) {
      setNewMessage({
        recipientType: 'individual',
        teacherUserId: message.sender_id,
        subject: `Re: ${message.subject || ''}`,
        content: '',
        reply_to: message.id,
      })
    } else {
      setNewMessage({
        recipientType: message.recipient_id ? 'individual' : 'broadcast',
        teacherUserId: message.recipient_id || '',
        subject: `Re: ${message.subject || ''}`,
        content: '',
        reply_to: message.id,
      })
    }
  }

  const isMessageRead = (msg: MessageItem) => readMessageIds.has(msg.id)

  const handleSelectMessage = (message: MessageItem) => {
    setSelectedMessage(message)
    if (!isMessageRead(message) && message.sender_id !== adminUserId) {
      handleMarkAsRead(message.id)
    }
  }

  const teacherUserMap = Object.fromEntries(teachers.map(t => [t.user_id, t.full_name]))

  const recipientLabel = (msg: MessageItem) => {
    if (msg.recipient_id) {
      const name = teacherUserMap[msg.recipient_id]
      return name ? `${name}` : 'Teacher (direct)'
    }
    return 'All Teachers'
  }

  const inboxMessages = messages.filter((m: any) => m.sender_id !== adminUserId)
  const sentMessages = messages.filter((m: any) => m.sender_id === adminUserId)
  const displayedMessages = activeTab === 'inbox' ? inboxMessages : sentMessages
  const unreadCount = inboxMessages.filter(m => !isMessageRead(m)).length

  if (loading) {
    return <SchoolLoader />
  }

  return (
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
        {/* Message List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4 border-b pb-3">
              <button
                onClick={() => setActiveTab('inbox')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'inbox' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Inbox {unreadCount > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">{unreadCount}</span>}
              </button>
              <button
                onClick={() => setActiveTab('sent')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'sent' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Sent
              </button>
            </div>
            {displayedMessages.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p>No messages yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedMessages.map((message) => {
                  const read = isMessageRead(message)
                  return (
                    <div key={message.id}>
                      <div
                        onClick={() => handleSelectMessage(message)}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          selectedMessage?.id === message.id ? 'border-blue-400 bg-blue-50' : 'hover:bg-gray-50'
                        } ${!read && activeTab === 'inbox' ? 'border-l-4 border-l-blue-500' : ''}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {read || activeTab === 'sent' ? (
                              <MailOpen className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                            ) : (
                              <Mail className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`${!read && activeTab === 'inbox' ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                {message.subject || 'No subject'}
                              </p>
                              <p className="text-sm text-gray-600 truncate">{message.content}</p>
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                {activeTab === 'inbox' && message.sender_id && (
                                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                    From: {senderNames[message.sender_id] || 'Unknown'}
                                  </span>
                                )}
                                <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                  message.recipient_id
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-purple-100 text-purple-700'
                                }`}>
                                  {message.recipient_id ? (
                                    <User className="w-3 h-3" />
                                  ) : (
                                    <Users className="w-3 h-3" />
                                  )}
                                  To: {recipientLabel(message)}
                                </span>
                                {activeTab === 'sent' && (
                                  <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Sent
                                  </span>
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

                      {/* Thread view */}
                      {selectedMessage?.id === message.id && (
                        <div className="ml-8 mt-2 space-y-2">
                          {/* Full message content */}
                          <div className="border rounded-lg p-4 bg-white border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-gray-900">
                                {message.sender_id === adminUserId ? 'You' : (senderNames[message.sender_id || ''] || 'Unknown')}
                              </span>
                              <span className="text-xs text-gray-400">{message.date}</span>
                            </div>
                            <p className="text-gray-800 whitespace-pre-wrap">{message.content}</p>
                          </div>

                          {/* Replies */}
                          {message.replies && message.replies.map((reply) => (
                            <div key={reply.id} className="border rounded-lg p-3 bg-gray-50">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="text-xs text-gray-500 mb-1">
                                    {reply.sender_id === adminUserId ? 'You' : (senderNames[reply.sender_id || ''] || 'Unknown')}
                                    <span className="ml-2 text-gray-400">{reply.date}</span>
                                  </p>
                                  {reply.subject && <p className="font-medium text-sm">{reply.subject}</p>}
                                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{reply.content}</p>
                                </div>
                                <button
                                  onClick={() => handleDeleteMessage(reply.id)}
                                  className="text-red-500 hover:text-red-700 p-1 flex-shrink-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Compose */}
        <div className="bg-white rounded-lg shadow p-6 h-fit sticky top-4">
          <h3 className="text-lg font-semibold mb-4">
            {newMessage.reply_to ? 'Reply to Message' : 'Compose Message'}
          </h3>

          {/* Send status banner */}
          {sendStatus === 'sent' && (
            <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700 font-medium">Message sent successfully!</span>
            </div>
          )}
          {sendStatus === 'error' && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-sm text-red-700 font-medium">Failed to send message</span>
            </div>
          )}

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Send To</label>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  onClick={() => setNewMessage({ ...newMessage, recipientType: 'broadcast' })}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                    newMessage.recipientType === 'broadcast'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  All Teachers
                </button>
                <button
                  onClick={() => setNewMessage({ ...newMessage, recipientType: 'individual' })}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                    newMessage.recipientType === 'individual'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Individual Teacher
                </button>
              </div>
            </div>

            {newMessage.recipientType === 'individual' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Teacher</label>
                <select
                  value={newMessage.teacherUserId}
                  onChange={(e) => setNewMessage({ ...newMessage, teacherUserId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">— Choose a teacher —</option>
                  {teachers.map(t => (
                    <option key={t.user_id} value={t.user_id}>{t.full_name}</option>
                  ))}
                </select>
              </div>
            )}

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
              disabled={sendStatus === 'sending'}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                sendStatus === 'sending'
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Send className="w-5 h-5" />
              {sendStatus === 'sending' ? 'Sending...' : newMessage.reply_to ? 'Send Reply' : 'Send Message'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
