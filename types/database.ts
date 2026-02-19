export type UserRole = 'admin' | 'teacher' | 'student' | 'parent'

export interface User {
  id: string
  email: string
  role: UserRole
  full_name?: string
  created_at: string
}

export interface Teacher {
  id: string
  user_id: string
  full_name: string
  created_at: string
}

export interface Student {
  id: string
  user_id: string
  full_name: string
  parent_id?: string
  created_at: string
}

export interface Parent {
  id: string
  user_id: string
  full_name: string
  created_at: string
}

export interface Class {
  id: string
  name: string
  subject?: string
  teacher_id?: string
  class_level?: string
  department?: string
  created_at: string
}

export interface TeacherSubject {
  id: string
  teacher_id: string
  subject: string
  class_level?: string
  created_at: string
}

export interface ClassEnrollment {
  id: string
  class_id: string
  student_id: string
  created_at: string
}

export interface Grade {
  id: string
  student_id: string
  class_id: string
  teacher_id: string
  assignment_name: string
  score: number
  max_score: number
  term_id?: string | null
  notes?: string | null
  created_at: string
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export interface Attendance {
  id: string
  student_id: string
  class_id: string
  teacher_id: string
  date: string
  status: AttendanceStatus
  notes?: string | null
  created_at: string
}

export interface Event {
  id: string
  title: string
  description?: string
  event_date: string
  event_time?: string
  location?: string
  created_at: string
}

export interface Message {
  id: string
  sender_id?: string
  recipient_role?: string
  recipient_id?: string
  subject?: string
  content?: string
  created_at: string
}

export interface Book {
  id: string
  title: string
  author?: string
  isbn?: string
  available: boolean
  borrowed_by?: string
  created_at: string
}

export interface InventoryItem {
  id: string
  name: string
  category?: string
  quantity: number
  min_stock: number
  created_at: string
}

export interface Payment {
  id: string
  student_id?: string
  amount: number
  type?: string
  status: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface Assignment {
  id: string
  title: string
  description?: string | null
  class_id: string
  teacher_id: string
  due_date?: string | null
  created_at: string
}

export interface Setting {
  id: string
  key: string
  value: string
  created_at: string
  updated_at: string
}
