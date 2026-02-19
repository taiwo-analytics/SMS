'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface ModuleCardProps {
  title: string
  icon: ReactNode
  href: string
}

export default function ModuleCard({ title, icon, href }: ModuleCardProps) {
  const router = useRouter()

  const handleClick = () => {
    router.push(href)
  }

  return (
    <button
      onClick={handleClick}
      className="bg-white rounded-lg p-6 flex flex-col items-center justify-center gap-4 hover:shadow-lg transition-shadow duration-200 cursor-pointer min-h-[140px] w-full"
    >
      <div className="text-4xl">{icon}</div>
      <span className="text-gray-800 font-medium text-lg">{title}</span>
    </button>
  )
}
