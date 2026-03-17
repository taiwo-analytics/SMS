'use client'

import { Suspense, useEffect, useState } from 'react'
import ModuleCard from '@/components/ModuleCard'
import SchoolLoader from '@/components/SchoolLoader'
import { supabase } from '@/lib/supabase/client'
import {
  Shield,
  GraduationCap,
  User,
  Users,
  Sparkles,
} from 'lucide-react'

function ModuleSelectionContent() {
  const year = new Date().getFullYear()
  const [schoolName, setSchoolName] = useState('')
  const [schoolLogo, setSchoolLogo] = useState('')

  useEffect(() => {
    loadBranding()
  }, [])

  const loadBranding = async () => {
    try {
      const cached = localStorage.getItem('schoolLogo')
      if (cached) setSchoolLogo(cached)
    } catch {}
    try {
      const { data } = await supabase.from('settings').select('key, value').in('key', ['schoolName', 'schoolLogo'])
      for (const row of (data || []) as any[]) {
        if (row.key === 'schoolName' && row.value) setSchoolName(row.value)
        if (row.key === 'schoolLogo' && row.value) {
          setSchoolLogo(row.value)
          try { localStorage.setItem('schoolLogo', row.value) } catch {}
        }
      }
    } catch {}
  }

  const modules = [
    { title: 'Administration', icon: <Shield className="w-7 h-7" />, href: '/admin', tone: 'navy' as const },
    { title: 'Teacher', icon: <GraduationCap className="w-7 h-7" />, href: '/teacher', tone: 'burgundy' as const },
    { title: 'Student', icon: <User className="w-7 h-7" />, href: '/student/classes', tone: 'emerald' as const },
    { title: 'Parent', icon: <Users className="w-7 h-7" />, href: '/parent/children', tone: 'indigo' as const },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-1">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute -top-32 -right-36 h-[520px] w-[520px] rounded-full bg-[#C8A24A]/10 blur-3xl" />
            <div className="absolute -bottom-40 -left-40 h-[520px] w-[520px] rounded-full bg-[#7A1E3A]/10 blur-3xl" />
            <div className="absolute top-24 left-1/2 -translate-x-1/2 h-[720px] w-[720px] rounded-full bg-[#0B1F3A]/5 blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.02]"
              style={{ backgroundImage: 'radial-gradient(circle, #0B1F3A 1px, transparent 1px)', backgroundSize: '32px 32px' }}
            />
          </div>

          <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16">
            <div className="flex items-center gap-3">
              {schoolLogo ? (
                <img
                  src={schoolLogo}
                  alt={schoolName ? `${schoolName} logo` : 'School logo'}
                  className="w-10 h-10 rounded-xl object-contain bg-white border border-slate-200 p-1"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-[#0B1F3A] flex items-center justify-center shadow-sm">
                  <Sparkles className="w-5 h-5 text-[#C8A24A]" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#0B1F3A] truncate">{schoolName || 'School Management System'}</div>
                <div className="text-xs text-slate-500">Student Information System (SIS)</div>
              </div>
            </div>

            <div className="mt-10 grid lg:grid-cols-2 gap-10 items-start">
              <section className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#C8A24A]/35 bg-white/70 px-4 py-2 text-xs font-semibold text-[#0B1F3A]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#C8A24A]" />
                  Academic. Secure. Role-based.
                </div>

                <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-slate-900 leading-[1.1]">
                  A premium SIS for modern schools
                </h1>

                <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                  Manage administration, classes, students, teachers, and parents in one clean platform designed for clarity, speed, and trust.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">Consistency</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">Unified records & workflows</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">Visibility</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">Reports and tracking that scale</div>
                  </div>
                </div>

                <p className="text-xs text-slate-500">Choose your role to continue.</p>
              </section>

              <section
                id="modules"
                className="rounded-3xl border border-slate-200 bg-[#F6F8FB]/80 backdrop-blur-sm p-6 sm:p-8 shadow-[0_1px_2px_rgba(15,23,42,.06),0_18px_50px_rgba(15,23,42,.12)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold tracking-wide text-[#7A1E3A] uppercase">Module selection</div>
                    <div className="mt-1 font-serif text-2xl text-slate-900">Select your module</div>
                    <div className="mt-1 text-sm text-slate-600">Continue as Admin, Teacher, Student, or Parent.</div>
                  </div>
                  <div className="hidden sm:flex h-11 w-11 items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <GraduationCap className="h-5 w-5 text-[#0B1F3A]" />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {modules.map((module) => (
                    <ModuleCard key={module.title} title={module.title} icon={module.icon} href={module.href} tone={module.tone} />
                  ))}
                </div>

                <div className="mt-5 text-xs text-slate-500">Tip: You can switch roles anytime by returning here.</div>
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-xs text-gray-400">© {year} Creative Minds Global Solutions Ltd. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default function ModuleSelectionPage() {
  return (
    <Suspense fallback={<SchoolLoader />}>
      <ModuleSelectionContent />
    </Suspense>
  )
}
