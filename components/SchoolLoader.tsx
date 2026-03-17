'use client'

import { useEffect, useState } from 'react'

interface Props {
  message?: string
}

export default function SchoolLoader({ message = 'Loading...' }: Props) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    try {
      const cached = localStorage.getItem('schoolLogo')
      if (cached) setLogoUrl(cached)
    } catch {}
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
      <div className="flex flex-col items-center gap-4">
        {logoUrl ? (
          <div className="relative">
            <img
              src={logoUrl}
              alt=""
              className="w-16 h-16 rounded-2xl object-contain"
            />
            <div className="absolute inset-0 rounded-2xl border-4 border-transparent border-t-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        )}
        <p className="text-sm text-gray-500 font-medium">{message}</p>
      </div>
    </div>
  )
}
