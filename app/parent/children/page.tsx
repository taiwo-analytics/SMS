'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Users, ArrowLeft } from 'lucide-react'
import { Student } from '@/types/database'
import SchoolLoader from '@/components/SchoolLoader'

export default function ParentChildrenPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [children, setChildren] = useState<Student[]>([])

  useEffect(() => {
    checkAuthAndLoadChildren()
  }, [])

  const checkAuthAndLoadChildren = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'parent') {
        router.push('/')
        return
      }

      // Get parent record
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (parent) {
        // Load children (students) linked to this parent
        const { data: childrenData, error } = await supabase
          .from('students')
          .select('*')
          .eq('parent_id', parent.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        setChildren(childrenData || [])
      }
    } catch (error) {
      console.error('Error loading children:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return <SchoolLoader />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">My Children</h1>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex items-center gap-4 mb-6">
            <Users className="w-12 h-12 text-blue-600" />
            <h2 className="text-3xl font-bold text-gray-900">My Children</h2>
          </div>
          
          <p className="text-gray-600 mb-8">
            View information about your children enrolled in the school.
          </p>

          {children.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No children registered yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {children.map((child) => (
                <div
                  key={child.id}
                  className="border rounded-lg p-6 hover:shadow-lg transition-shadow"
                >
                  <Users className="w-8 h-8 text-blue-600 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{child.full_name}</h3>
                  <p className="text-gray-600">Student ID: {child.id.slice(0, 8)}...</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
