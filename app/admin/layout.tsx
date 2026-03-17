export const dynamic = 'force-dynamic'
import AdminLayout from '@/components/AdminLayout'
import type { ReactNode } from 'react'

export default function Layout({ children }: { children: ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>
}
