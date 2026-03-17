'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  BookOpen, Plus, Search, X, Trash2, RotateCcw, Send,
  BookCheck, BookX, AlertTriangle, Archive, FileText, Download, Upload, File
} from 'lucide-react'
import SchoolLoader from '@/components/SchoolLoader'

type Book = {
  id: string
  title: string
  author: string | null
  isbn: string | null
  available: boolean
  borrowed_by: string | null
  created_at: string
}

type Loan = {
  id: string
  book_id: string
  student_id: string
  issued_at: string
  due_at: string | null
  returned_at: string | null
  status: string
  notes: string | null
  books?: { id: string; title: string; author: string | null }
  students?: { id: string; full_name: string }
}

type ELibraryFile = {
  id: string
  title: string
  description: string | null
  file_name: string
  file_url: string
  file_size: number
  file_type: string
  category: string | null
  uploaded_by: string | null
  created_at: string
}

type Tab = 'books' | 'active' | 'history' | 'elibrary'

export default function AdminLibraryPage() {
  const [loading, setLoading] = useState(true)
  const [books, setBooks] = useState<Book[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [students, setStudents] = useState<{ id: string; full_name: string }[]>([])
  const [elibraryFiles, setElibraryFiles] = useState<ELibraryFile[]>([])
  const [tab, setTab] = useState<Tab>('books')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Modal states
  const [showBookModal, setShowBookModal] = useState(false)
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [bookForm, setBookForm] = useState({ title: '', author: '', isbn: '' })
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [issuingBookId, setIssuingBookId] = useState('')
  const [issueForm, setIssueForm] = useState({ student_id: '', due_at: '', notes: '' })
  const [studentSearch, setStudentSearch] = useState('')
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returningLoan, setReturningLoan] = useState<Loan | null>(null)
  const [returnNotes, setReturnNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // eLibrary Modal states
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadForm, setUploadForm] = useState({ title: '', description: '', category: '' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showNotice = useCallback((type: 'success' | 'error', message: string) => {
    setNotice({ type, message })
    setTimeout(() => setNotice(null), 4000)
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [{ data: booksData }, { data: loansData }, { data: studentsData }, { data: elibraryData }] = await Promise.all([
        supabase.from('books').select('*').order('created_at', { ascending: false }),
        supabase.from('library_loans').select('*, books(id, title, author), students(id, full_name)').order('issued_at', { ascending: false }),
        supabase.from('students').select('id, full_name').order('full_name'),
        supabase.from('elibrary_files').select('*').order('created_at', { ascending: false }),
      ])
      setBooks(booksData || [])
      setLoans(loansData || [])
      setStudents(studentsData || [])
      setElibraryFiles(elibraryData || [])
    } catch (e: any) {
      showNotice('error', e.message || 'Failed to load data')
    }
  }, [showNotice])

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await loadData()
      setLoading(false)
    })()
  }, [loadData])

  // Stats
  const today = new Date().toISOString().split('T')[0]
  const stats = useMemo(() => {
    const total = books.length
    const available = books.filter((b) => b.available).length
    const borrowed = books.filter((b) => !b.available).length
    const overdue = loans.filter((l) => !l.returned_at && l.due_at && l.due_at < today).length
    return { total, available, borrowed, overdue }
  }, [books, loans, today])

  // Filtered data
  const norm = (s: string) => (s || '').toLowerCase()
  const filteredBooks = useMemo(() => {
    if (!search) return books
    const q = norm(search)
    return books.filter((b) =>
      norm(b.title).includes(q) || norm(b.author || '').includes(q) || norm(b.isbn || '').includes(q)
    )
  }, [books, search])

  const filteredELibrary = useMemo(() => {
    if (!search) return elibraryFiles
    const q = norm(search)
    return elibraryFiles.filter((f) =>
      norm(f.title).includes(q) || norm(f.description || '').includes(q) || norm(f.category || '').includes(q)
    )
  }, [elibraryFiles, search])

  const activeLoans = useMemo(() =>
    loans.filter((l) => !l.returned_at), [loans])

  const historyLoans = useMemo(() =>
    loans.filter((l) => l.returned_at), [loans])

  const filteredStudents = useMemo(() => {
    if (!studentSearch) return students
    const q = norm(studentSearch)
    return students.filter((s) => norm(s.full_name).includes(q))
  }, [students, studentSearch])

  // CSV Export
  const handleExportBooks = () => {
    if (books.length === 0) return
    const headers = ['Title', 'Author', 'ISBN', 'Status', 'Borrowed By']
    const rows = books.map(b => [
      b.title,
      b.author || '',
      b.isbn || '',
      b.available ? 'Available' : 'Borrowed',
      b.borrowed_by ? (students.find(s => s.id === b.borrowed_by)?.full_name || b.borrowed_by) : ''
    ])
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `library_books_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Book CRUD
  const openAddBook = () => {
    setEditingBook(null)
    setBookForm({ title: '', author: '', isbn: '' })
    setShowBookModal(true)
  }

  const openEditBook = (book: Book) => {
    setEditingBook(book)
    setBookForm({ title: book.title, author: book.author || '', isbn: book.isbn || '' })
    setShowBookModal(true)
  }

  const handleSaveBook = async () => {
    if (!bookForm.title.trim()) return
    setSaving(true)
    try {
      if (editingBook) {
        const { error } = await supabase.from('books').update({
          title: bookForm.title, author: bookForm.author || null, isbn: bookForm.isbn || null,
        }).eq('id', editingBook.id)
        if (error) throw error
        showNotice('success', 'Book updated')
      } else {
        const { error } = await supabase.from('books').insert({
          title: bookForm.title, author: bookForm.author || null, isbn: bookForm.isbn || null,
        })
        if (error) throw error
        showNotice('success', 'Book added')
      }
      setShowBookModal(false)
      await loadData()
    } catch (e: any) {
      showNotice('error', e.message || 'Failed to save book')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBook = async (id: string) => {
    if (!confirm('Delete this book? This will also remove all loan records for it.')) return
    try {
      const { error } = await supabase.from('books').delete().eq('id', id)
      if (error) throw error
      showNotice('success', 'Book deleted')
      await loadData()
    } catch (e: any) {
      showNotice('error', e.message || 'Failed to delete')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} book(s)?`)) return
    try {
      const { error } = await supabase.from('books').delete().in('id', Array.from(selectedIds))
      if (error) throw error
      setSelectedIds(new Set())
      showNotice('success', `${selectedIds.size} book(s) deleted`)
      await loadData()
    } catch (e: any) {
      showNotice('error', e.message || 'Failed to delete')
    }
  }

  // eLibrary Actions
  const handleUploadFile = async () => {
    if (!selectedFile || !uploadForm.title.trim()) return
    setSaving(true)
    try {
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `elibrary/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath)

      const { error: dbError } = await supabase.from('elibrary_files').insert({
        title: uploadForm.title,
        description: uploadForm.description || null,
        category: uploadForm.category || null,
        file_name: selectedFile.name,
        file_url: publicUrl,
        file_size: selectedFile.size,
        file_type: selectedFile.type,
      })

      if (dbError) throw dbError

      showNotice('success', 'File uploaded to eLibrary')
      setShowUploadModal(false)
      setSelectedFile(null)
      setUploadForm({ title: '', description: '', category: '' })
      await loadData()
    } catch (e: any) {
      showNotice('error', e.message || 'Failed to upload file')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteFile = async (file: ELibraryFile) => {
    if (!confirm(`Delete "${file.title}" from eLibrary?`)) return
    try {
      // Extract file path from URL
      const path = file.file_url.split('/documents/')[1]
      if (path) {
        await supabase.storage.from('documents').remove([path])
      }
      const { error } = await supabase.from('elibrary_files').delete().eq('id', file.id)
      if (error) throw error
      showNotice('success', 'File deleted')
      await loadData()
    } catch (e: any) {
      showNotice('error', e.message || 'Failed to delete file')
    }
  }

  // Issue book
  const openIssueModal = (bookId: string) => {
    setIssuingBookId(bookId)
    setIssueForm({ student_id: '', due_at: '', notes: '' })
    setStudentSearch('')
    setShowIssueModal(true)
  }

  const handleIssueBook = async () => {
    if (!issueForm.student_id || !issuingBookId) return
    setSaving(true)
    try {
      const { error } = await supabase.from('library_loans').insert({
        book_id: issuingBookId,
        student_id: issueForm.student_id,
        due_at: issueForm.due_at || null,
        notes: issueForm.notes || null,
      })
      if (error) throw error
      setShowIssueModal(false)
      showNotice('success', 'Book issued to student')
      await loadData()
    } catch (e: any) {
      showNotice('error', e.message || 'Failed to issue book')
    } finally {
      setSaving(false)
    }
  }

  // Return book
  const openReturnModal = (loan: Loan) => {
    setReturningLoan(loan)
    setReturnNotes('')
    setShowReturnModal(true)
  }

  const handleReturnBook = async () => {
    if (!returningLoan) return
    setSaving(true)
    try {
      const { error } = await supabase.from('library_loans').update({
        returned_at: new Date().toISOString(),
        status: 'returned',
        notes: returnNotes || returningLoan.notes || null,
      }).eq('id', returningLoan.id)
      if (error) throw error
      setShowReturnModal(false)
      showNotice('success', 'Book returned')
      await loadData()
    } catch (e: any) {
      showNotice('error', e.message || 'Failed to return book')
    } finally {
      setSaving(false)
    }
  }

  // Checkbox helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selectedIds.size === filteredBooks.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredBooks.map((b) => b.id)))
  }

  // Helper: get student name for a borrowed_by id
  const studentName = (id: string | null) => {
    if (!id) return '—'
    return students.find((s) => s.id === id)?.full_name || id.slice(0, 8)
  }

  const isOverdue = (loan: Loan) => !loan.returned_at && loan.due_at && loan.due_at < today

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) return <SchoolLoader />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Library Management</h1>
            <p className="text-sm text-gray-500">Manage books, issue loans, and track returns</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportBooks} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">
            <Download className="w-4 h-4" />
            Export Books
          </button>
          {tab === 'elibrary' ? (
            <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors">
              <Upload className="w-4 h-4" />
              Upload File
            </button>
          ) : (
            <button onClick={openAddBook} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" />
              Add Book
            </button>
          )}
        </div>
      </div>

      {/* Notice */}
      {notice && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300 ${
          notice.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {notice.message}
          <button onClick={() => setNotice(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-100">
            <BookOpen className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-500">Total Books</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-100">
            <BookCheck className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.available}</div>
            <div className="text-xs text-gray-500">Available</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100">
            <BookX className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.borrowed}</div>
            <div className="text-xs text-gray-500">Borrowed</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-100">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.overdue}</div>
            <div className="text-xs text-gray-500">Overdue</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {([
          { key: 'books', label: 'Books', icon: BookOpen },
          { key: 'active', label: `Active Loans (${activeLoans.length})`, icon: Send },
          { key: 'history', label: 'Loan History', icon: Archive },
          { key: 'elibrary', label: 'Digital Library', icon: FileText },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch(''); setSelectedIds(new Set()) }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Search & Bulk Actions */}
      {(tab === 'books' || tab === 'elibrary') && (
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'books' ? "Search by title, author, or ISBN..." : "Search by title, description, or category..."}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          {tab === 'books' && selectedIds.size > 0 && (
            <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
              <span className="text-sm font-medium text-purple-700">{selectedIds.size} selected</span>
              <button onClick={handleBulkDelete} className="flex items-center gap-1 text-red-600 hover:text-red-800 text-sm font-medium">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== BOOKS TAB ===== */}
      {tab === 'books' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {filteredBooks.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">{search ? 'No books match your search' : 'No books in library yet'}</p>
              {!search && (
                <button onClick={openAddBook} className="text-sm text-purple-600 hover:underline font-medium">
                  Add your first book
                </button>
              )}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={selectedIds.size === filteredBooks.length && filteredBooks.length > 0} onChange={toggleAll} className="rounded border-gray-300" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Author</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ISBN</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Borrowed By</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBooks.map((book) => (
                  <tr key={book.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(book.id)} onChange={() => toggleSelect(book.id)} className="rounded border-gray-300" />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{book.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{book.author || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{book.isbn || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        book.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {book.available ? 'Available' : 'Borrowed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{studentName(book.borrowed_by)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {book.available ? (
                          <button onClick={() => openIssueModal(book.id)} className="text-purple-600 hover:text-purple-800" title="Issue to student">
                            <Send className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              const loan = loans.find((l) => l.book_id === book.id && !l.returned_at)
                              if (loan) openReturnModal(loan)
                            }}
                            className="text-green-600 hover:text-green-800"
                            title="Return book"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => openEditBook(book)} className="text-blue-600 hover:text-blue-800" title="Edit">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteBook(book.id)} className="text-red-600 hover:text-red-800" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ===== ACTIVE LOANS TAB ===== */}
      {tab === 'active' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {activeLoans.length === 0 ? (
            <div className="text-center py-16">
              <Send className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No active loans</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Book</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issued</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeLoans.map((loan) => {
                  const overdue = isOverdue(loan)
                  return (
                    <tr key={loan.id} className={overdue ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{(loan.students as any)?.full_name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{(loan.books as any)?.title || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{new Date(loan.issued_at).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{loan.due_at ? new Date(loan.due_at).toLocaleDateString('en-GB') : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          overdue ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {overdue ? 'Overdue' : 'Borrowed'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openReturnModal(loan)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                        >
                          <RotateCcw className="w-3 h-3" /> Return
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ===== LOAN HISTORY TAB ===== */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {historyLoans.length === 0 ? (
            <div className="text-center py-16">
              <Archive className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No loan history yet</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Book</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issued</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Returned</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historyLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{(loan.students as any)?.full_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{(loan.books as any)?.title || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(loan.issued_at).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{loan.due_at ? new Date(loan.due_at).toLocaleDateString('en-GB') : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{loan.returned_at ? new Date(loan.returned_at).toLocaleDateString('en-GB') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Returned</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ===== DIGITAL LIBRARY (eLibrary) TAB ===== */}
      {tab === 'elibrary' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {filteredELibrary.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">{search ? 'No files match your search' : 'No digital files in library yet'}</p>
              {!search && (
                <button onClick={() => setShowUploadModal(true)} className="text-sm text-purple-600 hover:underline font-medium">
                  Upload your first digital resource
                </button>
              )}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">File Info</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredELibrary.map((file) => (
                  <tr key={file.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{file.title}</div>
                      {file.description && <div className="text-xs text-gray-500 truncate max-w-xs">{file.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-50 text-purple-700">
                        {file.category || 'General'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-900 font-medium">{file.file_name}</div>
                      <div className="text-[10px] text-gray-500 uppercase">{file.file_type.split('/')[1]} • {formatFileSize(file.file_size)}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(file.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={file.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:text-purple-800 p-1"
                          title="Download/View"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleDeleteFile(file)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ===== ADD/EDIT BOOK MODAL ===== */}
      {showBookModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900">{editingBook ? 'Edit Book' : 'Add New Book'}</h3>
              <button onClick={() => setShowBookModal(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input
                  value={bookForm.title}
                  onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  placeholder="Enter book title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                <input
                  value={bookForm.author}
                  onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  placeholder="Enter author name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                <input
                  value={bookForm.isbn}
                  onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  placeholder="Enter ISBN"
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button onClick={() => setShowBookModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleSaveBook} disabled={saving || !bookForm.title.trim()} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm">
                {saving ? 'Saving...' : editingBook ? 'Update Book' : 'Add Book'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== UPLOAD ELIBRARY FILE MODAL ===== */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900">Upload to Digital Library</h3>
              <button onClick={() => setShowUploadModal(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  placeholder="e.g. Physics Textbook 2024"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  value={uploadForm.category}
                  onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  placeholder="e.g. Science, Mathematics, English"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  rows={2}
                  placeholder="Optional description of the file..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File <span className="text-red-500">*</span></label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg transition-colors ${
                    selectedFile ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-purple-400'
                  }`}
                >
                  {selectedFile ? (
                    <>
                      <File className="w-8 h-8 text-purple-600" />
                      <div className="text-sm font-medium text-purple-700">{selectedFile.name}</div>
                      <div className="text-xs text-purple-500">{formatFileSize(selectedFile.size)}</div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400" />
                      <div className="text-sm font-medium text-gray-700">Click to select file</div>
                      <div className="text-xs text-gray-500">PDF, DOCX, etc. (Max 10MB)</div>
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
              <button
                onClick={handleUploadFile}
                disabled={saving || !selectedFile || !uploadForm.title.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
              >
                {saving ? 'Uploading...' : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload Resource
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ISSUE BOOK MODAL ===== */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900">Issue Book</h3>
              <button onClick={() => setShowIssueModal(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="px-4 py-3 bg-purple-50 border border-purple-100 rounded-lg flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-purple-600" />
                <div>
                  <div className="text-xs text-purple-500 font-medium uppercase tracking-wider">Issuing Book</div>
                  <div className="text-sm font-bold text-purple-900">{books.find((b) => b.id === issuingBookId)?.title}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={studentSearch}
                    onChange={(e) => { setStudentSearch(e.target.value); setIssueForm({ ...issueForm, student_id: '' }) }}
                    placeholder="Search student by name..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                </div>
                {issueForm.student_id ? (
                  <div className="mt-2 flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-green-800">{students.find((s) => s.id === issueForm.student_id)?.full_name}</span>
                    </div>
                    <button onClick={() => setIssueForm({ ...issueForm, student_id: '' })} className="text-green-600 hover:text-green-800"><X className="w-4 h-4" /></button>
                  </div>
                ) : studentSearch && (
                  <div className="mt-1 border border-gray-200 rounded-lg max-h-40 overflow-y-auto shadow-sm bg-white">
                    {filteredStudents.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400 italic">No students found</div>
                    ) : (
                      filteredStudents.slice(0, 20).map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { setIssueForm({ ...issueForm, student_id: s.id }); setStudentSearch(s.full_name) }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 border-b border-gray-50 last:border-0 transition-colors"
                        >
                          {s.full_name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={issueForm.due_at}
                  onChange={(e) => setIssueForm({ ...issueForm, due_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={issueForm.notes}
                  onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  rows={2}
                  placeholder="Optional notes for this loan..."
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button onClick={() => setShowIssueModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleIssueBook} disabled={saving || !issueForm.student_id} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2">
                {saving ? 'Issuing...' : (
                  <>
                    <Send className="w-4 h-4" />
                    Issue Book
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== RETURN BOOK MODAL ===== */}
      {showReturnModal && returningLoan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900">Return Book</h3>
              <button onClick={() => setShowReturnModal(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm space-y-2">
                  <div className="flex justify-between"><span className="text-gray-500">Book:</span> <span className="font-bold text-gray-900">{(returningLoan.books as any)?.title}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Student:</span> <span className="font-medium text-gray-900">{(returningLoan.students as any)?.full_name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Issued:</span> <span className="text-gray-700">{new Date(returningLoan.issued_at).toLocaleDateString('en-GB')}</span></div>
                  {returningLoan.due_at && (
                    <div className="flex justify-between"><span className="text-gray-500">Due:</span> <span className={isOverdue(returningLoan) ? 'text-red-600 font-bold' : 'text-gray-700'}>{new Date(returningLoan.due_at).toLocaleDateString('en-GB')}</span></div>
                  )}
                </div>
                {isOverdue(returningLoan) && (
                  <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="font-medium">This book is overdue. Please check for any fines or damages.</div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  rows={2}
                  placeholder="Any notes about the book's condition or return process..."
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button onClick={() => setShowReturnModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleReturnBook} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2">
                {saving ? 'Processing...' : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Confirm Return
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
