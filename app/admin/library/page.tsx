'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Library, Plus, Book, Search, User, X } from 'lucide-react'

export default function AdminLibraryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [books, setBooks] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [bookForm, setBookForm] = useState({ title: '', author: '', isbn: '', available: true })

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      await loadBooks()
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadBooks = async () => {
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setBooks(data || [])
    } catch (error) {
      console.error('Error loading books:', error)
    }
  }

  const handleCreateBook = async () => {
    try {
      const { error } = await supabase.from('books').insert({
        title: bookForm.title,
        author: bookForm.author || null,
        isbn: bookForm.isbn || null,
        available: bookForm.available,
      })

      if (error) throw error
      setShowModal(false)
      setBookForm({ title: '', author: '', isbn: '', available: true })
      await loadBooks()
      alert('Book added')
    } catch (e: any) {
      console.error('Error adding book:', e)
      alert(e.message || 'Failed to add book')
    }
  }

  const handleDeleteBook = async (id: string) => {
    if (!confirm('Delete this book?')) return
    try {
      const { error } = await supabase.from('books').delete().eq('id', id)
      if (error) throw error
      await loadBooks()
    } catch (e: any) {
      console.error('Error deleting book:', e)
      alert(e.message || 'Failed to delete book')
    }
  }

  const toggleAvailability = async (book: any) => {
    try {
      const { error } = await supabase.from('books').update({ available: !book.available }).eq('id', book.id)
      if (error) throw error
      await loadBooks()
    } catch (e: any) {
      console.error('Error toggling availability:', e)
      alert(e.message || 'Failed')
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Library className="w-10 h-10 text-purple-600" />
          <h2 className="text-3xl font-bold text-gray-900">Library Management</h2>
        </div>
        <button className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
          <Plus className="w-5 h-5" />
          Add Book
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            placeholder="Search books by title, author, or ISBN..."
          />
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div />
        <div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
            <Plus className="w-5 h-5" />
            Add Book
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {books.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Book className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p>No books in library yet</p>
            <button onClick={() => setShowModal(true)} className="mt-4 text-purple-600 hover:underline">Add your first book</button>
          </div>
        ) : (
          books.map((book) => (
            <div key={book.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <Book className="w-12 h-12 text-purple-600 mb-4" />
              <h3 className="font-semibold text-lg mb-2">{book.title}</h3>
              <p className="text-sm text-gray-600 mb-1">Author: {book.author || '—'}</p>
              <p className="text-sm text-gray-600 mb-4">ISBN: {book.isbn || '—'}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded ${book.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {book.available ? 'Available' : 'Borrowed'}
                  </span>
                  {book.borrowed_by && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <User className="w-4 h-4" />
                      {book.borrowed_by}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleAvailability(book)} className="text-blue-600 hover:text-blue-900">Toggle</button>
                  <button onClick={() => handleDeleteBook(book.id)} className="text-red-600 hover:text-red-900">Delete</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Add Book</h3>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                <input value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                <input value={bookForm.isbn} onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button onClick={handleCreateBook} className="px-4 py-2 bg-purple-600 text-white rounded-lg">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
