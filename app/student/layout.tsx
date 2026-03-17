export const dynamic = 'force-dynamic'
import StudentLayout from '@/components/StudentLayout'
import type { ReactNode } from 'react'

export default function Layout({ children }: { children: ReactNode }) {
  return <StudentLayout>{children}</StudentLayout>
}
