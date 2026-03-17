 'use client'
 
 import { Suspense } from 'react'
 import type { FormEvent } from 'react'
 import { useState } from 'react'
 import { useRouter, useSearchParams } from 'next/navigation'
 import SchoolLoader from '@/components/SchoolLoader'
 
function FirstAdminSetupContent() {
   const router = useRouter()
   const searchParams = useSearchParams()
 
   const [email, setEmail] = useState('')
   const [password, setPassword] = useState('')
   const [fullName, setFullName] = useState('')
   const [token, setToken] = useState(searchParams.get('token') || '')
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)
   const [success, setSuccess] = useState(false)
 
  const handleSubmit = async (e: FormEvent) => {
     e.preventDefault()
     setError(null)
     setSuccess(false)
 
     if (!email || !password || !token) {
       setError('Please provide token, email and password')
       return
     }
     if (password.length < 6) {
       setError('Password must be at least 6 characters')
       return
     }
 
     setLoading(true)
     try {
       const res = await fetch('/api/setup/first-admin', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'x-first-admin-token': token,
         },
         body: JSON.stringify({
           email,
           password,
           full_name: fullName || 'Admin User',
         }),
       })
       const json = await res.json()
       if (!res.ok) {
         if (res.status === 409) {
           setError('An admin already exists. You can proceed to login.')
         } else {
           setError(json.error || 'Failed to create first admin')
         }
         return
       }
       setSuccess(true)
       setTimeout(() => router.push('/auth/login'), 1200)
     } catch (e: any) {
       setError(e?.message || 'Unexpected error')
     } finally {
       setLoading(false)
     }
   }

   return (
     <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
       <div className="w-full max-w-md bg-white rounded-xl shadow border border-gray-100 p-8">
         <h1 className="text-2xl font-semibold text-gray-900 mb-2">First Admin Setup</h1>
         <p className="text-sm text-gray-600 mb-6">
           Create the very first administrator account for this installation.
           This action is protected by a one-time token set on the server.
         </p>
 
         {error && (
           <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
             {error === 'An admin already exists. You can proceed to login.' ? (
               <span>
                 {error}{' '}
                 <button
                   onClick={() => router.push('/auth/login')}
                   className="underline font-medium"
                 >
                   Go to login
                 </button>
               </span>
             ) : (
               error
             )}
           </div>
         )}
         {success && (
           <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
             Admin created successfully. Redirecting to login…
           </div>
         )}
 
         <form onSubmit={handleSubmit} className="space-y-4">
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Setup Token</label>
             <input
               type="password"
               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
               placeholder="Enter the setup token"
               value={token}
               onChange={(e) => setToken(e.target.value)}
               autoComplete="off"
             />
             <p className="text-xs text-gray-500 mt-1">
               Provided by the environment (not stored in the browser).
             </p>
           </div>
 
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
             <input
               type="email"
               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
               placeholder="admin@example.com"
               value={email}
               onChange={(e) => setEmail(e.target.value)}
             />
           </div>
 
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
             <input
               type="password"
               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
               placeholder="At least 6 characters"
               value={password}
               onChange={(e) => setPassword(e.target.value)}
             />
           </div>
 
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Full Name (optional)</label>
             <input
               type="text"
               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
               placeholder="Admin User"
               value={fullName}
               onChange={(e) => setFullName(e.target.value)}
             />
           </div>
 
           <button
             type="submit"
             disabled={loading}
             className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {loading ? 'Creating…' : 'Create Admin'}
           </button>
 
           <div className="text-xs text-gray-500 text-center">
             If an admin already exists, use the{' '}
             <button
               type="button"
               onClick={() => router.push('/auth/login')}
               className="text-blue-600 underline"
             >
               login page
             </button>
             .
           </div>
         </form>
       </div>
     </div>
   )
 }

export default function FirstAdminSetupPage() {
  return (
    <Suspense fallback={<SchoolLoader />}>
      <FirstAdminSetupContent />
    </Suspense>
  )
}
 
