'use client'

import { Suspense } from 'react'
import ModuleCard from '@/components/ModuleCard'
import {
  Shield,
  GraduationCap,
  User,
  Users,
} from 'lucide-react'

function ModuleSelectionContent() {
  const modules = [
    { title: 'Administration', icon: <Shield className="w-10 h-10" />, href: '/admin' },
    { title: 'Teacher', icon: <GraduationCap className="w-10 h-10" />, href: '/teacher' },
    { title: 'Student', icon: <User className="w-10 h-10" />, href: '/student/classes' },
    { title: 'Parent', icon: <Users className="w-10 h-10" />, href: '/parent/children' },
  ]

  return (
    <div className="min-h-screen flex">
      {/* Left Sidebar - Branding */}
      <div className="w-1/2 bg-white flex flex-col justify-between p-12">
        <div>
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-blue-600 mb-2">SchoolMS</h1>
            <p className="text-sm text-gray-500">All-in-One ERP for Schools</p>
          </div>

          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            All-in-One ERP for Modern Schools
          </h2>

          <p className="text-lg text-gray-600 leading-relaxed">
            Manage administration, classes, students, teachers, and parents in one
            simple, modern platform.
          </p>
        </div>

        <div className="mt-8">
          <div className="w-64 h-64 bg-gray-200 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-32 h-32 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Right Side - Module Selection */}
      <div className="w-1/2 bg-[#1e3a8a] flex flex-col items-center justify-center p-12 rounded-tl-[40px]">
        <div className="w-full max-w-2xl">
          <h2 className="text-4xl font-bold text-white text-center mb-4">
            What Module Do You Want To Use?
          </h2>
          <p className="text-white text-center mb-12 text-lg">
            Please select to continue
          </p>

          <div className="grid grid-cols-2 gap-6 justify-items-center">
            {modules.map((module, index) => (
              <div key={index} className="w-full">
                <ModuleCard
                  title={module.title}
                  icon={module.icon}
                  href={module.href}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ModuleSelectionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ModuleSelectionContent />
    </Suspense>
  )
}
