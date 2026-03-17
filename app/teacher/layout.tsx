import TeacherLayout from '@/components/TeacherLayout'
import type { ReactNode } from 'react'

export default function Layout({ children }: { children: ReactNode }) {
  return <TeacherLayout>{children}</TeacherLayout>
}
