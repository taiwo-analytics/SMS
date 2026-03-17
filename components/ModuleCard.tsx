'use client'

import { ReactNode } from 'react'

interface ModuleCardProps {
  title: string
  icon: ReactNode
  href: string
  tone?: 'navy' | 'burgundy' | 'emerald' | 'indigo'
}

const toneStyles = {
  navy: {
    wrapBg: 'bg-[#0B1F3A]/5',
    wrapBorder: 'border-[#0B1F3A]/10',
    wrapHoverBg: 'group-hover:bg-[#0B1F3A]',
    wrapHoverBorder: 'group-hover:border-[#0B1F3A]',
    icon: 'text-[#0B1F3A]',
    iconHover: 'group-hover:text-white',
  },
  burgundy: {
    wrapBg: 'bg-[#7A1E3A]/6',
    wrapBorder: 'border-[#7A1E3A]/15',
    wrapHoverBg: 'group-hover:bg-[#7A1E3A]',
    wrapHoverBorder: 'group-hover:border-[#7A1E3A]',
    icon: 'text-[#7A1E3A]',
    iconHover: 'group-hover:text-white',
  },
  emerald: {
    wrapBg: 'bg-[#0F766E]/7',
    wrapBorder: 'border-[#0F766E]/15',
    wrapHoverBg: 'group-hover:bg-[#0F766E]',
    wrapHoverBorder: 'group-hover:border-[#0F766E]',
    icon: 'text-[#0F766E]',
    iconHover: 'group-hover:text-white',
  },
  indigo: {
    wrapBg: 'bg-[#3730A3]/6',
    wrapBorder: 'border-[#3730A3]/15',
    wrapHoverBg: 'group-hover:bg-[#3730A3]',
    wrapHoverBorder: 'group-hover:border-[#3730A3]',
    icon: 'text-[#3730A3]',
    iconHover: 'group-hover:text-white',
  },
} as const

export default function ModuleCard({ title, icon, href, tone = 'navy' }: ModuleCardProps) {
  const t = toneStyles[tone]
  return (
    <a
      href={href}
      className="group relative rounded-2xl bg-white border border-slate-200 p-5 flex flex-col items-center justify-center gap-3 min-h-[132px] w-full transition-all duration-200 hover:border-[#C8A24A]/70 hover:shadow-[0_1px_2px_rgba(15,23,42,.06),0_18px_40px_rgba(15,23,42,.10)] active:shadow-[0_1px_2px_rgba(15,23,42,.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A24A] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
    >
      <div className={`w-12 h-12 rounded-xl ${t.wrapBg} border ${t.wrapBorder} flex items-center justify-center transition-all duration-200 ${t.wrapHoverBg} ${t.wrapHoverBorder}`}>
        <div className={`${t.icon} transition-colors duration-200 ${t.iconHover}`}>{icon}</div>
      </div>
      <span className="text-slate-900 font-semibold text-sm">{title}</span>
    </a>
  )
}
