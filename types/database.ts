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
  title?: string
  staff_id?: string
  marital_status?: string
  next_of_kin?: string
  next_of_kin_phone?: string
  course_of_study?: string
  institution_name?: string
  years_of_experience?: number
  subjects_taught?: string[] | null
  degrees?: string[] | null
  certifications?: string[] | null
  workshops?: string[] | null
  photo_url?: string
  cv_url?: string | null
  certification_files?: string[] | null
  phone?: string
  gender?: string
  dob?: string
  address?: string
  status?: string
  admission?: string
  created_at: string
}

export interface Student {
  id: string
  user_id: string
  full_name: string
  nin?: string | null
  guardian_phone?: string | null
  guardian_occupation?: string | null
  phone?: string
  gender?: string
  dob?: string
  address?: string
  status?: string
  admission?: string
  department?: string | null
  guardian_name?: string | null
  photo_url?: string | null
  parent_id?: string
  created_at: string
}

export interface Subject {
  id: string
  name: string
  code?: string | null
  departments?: string[] | null
  department?: string | null
  is_elective?: boolean
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
  is_read?: boolean
  read_at?: string | null
  reply_to?: string | null
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
  description?: string | null
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

export interface AcademicSession {
  id: string
  name: string
  start_date?: string | null
  end_date?: string | null
  is_active: boolean
  created_at: string
}

export interface AcademicTerm {
  id: string
  session_id: string
  name: string
  start_date?: string | null
  end_date?: string | null
  is_active: boolean
  created_at: string
}

export interface ClassSubjectTeacher {
  id: string
  class_id: string
  subject_id: string
  teacher_id?: string | null
  created_at: string
}

export interface SubjectScore {
  id: string
  student_id: string
  class_id: string
  subject_id: string
  teacher_id?: string | null
  term_id: string
  ca_score: number
  exam_score: number
  total: number
  created_at: string
  updated_at: string
}

export interface ReportRemark {
  id: string
  student_id: string
  class_id: string
  term_id: string
  class_teacher_remark?: string | null
  principal_remark?: string | null
  created_at: string
  updated_at: string
}

export interface Timetable {
  id: string
  class_id: string
  subject?: string | null
  teacher_id?: string | null
  day_of_week: string
  start_time: string
  end_time: string
  room?: string | null
  created_at: string
}
