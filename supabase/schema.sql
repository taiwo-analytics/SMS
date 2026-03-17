-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student', 'parent')),
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create teachers table
CREATE TABLE IF NOT EXISTS teachers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create parents table
CREATE TABLE IF NOT EXISTS parents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create students table
CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  parent_id UUID REFERENCES parents(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  class_level TEXT, -- e.g., JSS1, JSS2, SS1, SS2, SS3
  department TEXT, -- e.g., Science, Humanities, Business (for senior students)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create teacher_subjects table (for assigning subjects to teachers)
CREATE TABLE IF NOT EXISTS teacher_subjects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  class_level TEXT, -- Optional: specific class level
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(teacher_id, subject, class_level)
);

-- Add photo_url to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add teacher photo_url and extra profile fields
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS admission TEXT;
-- Additional teacher fields
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS staff_id TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS next_of_kin TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS next_of_kin_phone TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS course_of_study TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS institution_name TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS years_of_experience INTEGER;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS subjects_taught TEXT[]; -- store subject IDs or names
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS degrees TEXT[]; -- e.g., B.Sc., M.Ed.
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS certifications TEXT[]; -- certification titles
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS workshops TEXT[]; -- workshops/trainings attended
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS cv_url TEXT; -- link to uploaded CV
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS certification_files TEXT[]; -- links to certification files

-- Add extra student fields
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS admission TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS department TEXT;
-- Additional student fields
ALTER TABLE students ADD COLUMN IF NOT EXISTS nin TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_occupation TEXT;

-- Create storage bucket for student photos (run this in Supabase Storage)
-- Note: This needs to be done manually in Supabase Dashboard > Storage
-- Bucket name: student-photos
-- Public: true

-- Create class_enrollments table
CREATE TABLE IF NOT EXISTS class_enrollments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(class_id, student_id)
);

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (NEW.id, 'student', NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call the function on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_leader_id UUID REFERENCES students(id);
CREATE OR REPLACE FUNCTION sync_student_department()
RETURNS trigger AS $$
BEGIN
  IF NEW.department IS NULL THEN
    UPDATE students SET department = NULL WHERE id = NEW.student_id;
    RETURN NEW;
  END IF;
  PERFORM 1 FROM classes WHERE id = NEW.class_id AND class_level ILIKE 'SS%';
  IF FOUND THEN
    UPDATE students SET department = NEW.department WHERE id = NEW.student_id;
  ELSE
    UPDATE students SET department = NULL WHERE id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_sync_student_dept_ins ON class_enrollments;
CREATE TRIGGER trg_sync_student_dept_ins
AFTER INSERT OR UPDATE OF department ON class_enrollments
FOR EACH ROW EXECUTE FUNCTION sync_student_department();

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Teachers policies
CREATE POLICY "Teachers can view their own record"
  ON teachers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all teachers"
  ON teachers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Students policies
CREATE POLICY "Students can view their own record"
  ON students FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Parents can view their children"
  ON students FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parents
      WHERE parents.user_id = auth.uid() AND parents.id = students.parent_id
    )
  );

CREATE POLICY "Teachers can view students in their classes"
  ON students FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classes
      JOIN teachers ON classes.teacher_id = teachers.id
      JOIN class_enrollments ON classes.id = class_enrollments.class_id
      WHERE teachers.user_id = auth.uid() 
        AND class_enrollments.student_id = students.id
    )
  );

CREATE POLICY "Admins can view all students"
  ON students FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Parents policies
CREATE POLICY "Parents can view their own record"
  ON parents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all parents"
  ON parents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Classes policies
CREATE POLICY "Teachers can view their own classes"
  ON classes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.user_id = auth.uid() AND teachers.id = classes.teacher_id
    )
  );

CREATE POLICY "Students can view classes they are enrolled in"
  ON classes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      JOIN class_enrollments ON students.id = class_enrollments.student_id
      WHERE students.user_id = auth.uid() 
        AND class_enrollments.class_id = classes.id
    )
  );

CREATE POLICY "Parents can view classes of their children"
  ON classes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parents
      JOIN students ON parents.id = students.parent_id
      JOIN class_enrollments ON students.id = class_enrollments.student_id
      WHERE parents.user_id = auth.uid() 
        AND class_enrollments.class_id = classes.id
    )
  );

CREATE POLICY "Admins can view all classes"
  ON classes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage classes"
  ON classes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Class enrollments policies
CREATE POLICY "Students can view their own enrollments"
  ON class_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.user_id = auth.uid() AND students.id = class_enrollments.student_id
    )
  );

CREATE POLICY "Teachers can view enrollments in their classes"
  ON class_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teachers
      JOIN classes ON teachers.id = classes.teacher_id
      WHERE teachers.user_id = auth.uid() 
        AND classes.id = class_enrollments.class_id
    )
  );

CREATE POLICY "Parents can view enrollments of their children"
  ON class_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parents
      JOIN students ON parents.id = students.parent_id
      WHERE parents.user_id = auth.uid() 
        AND students.id = class_enrollments.student_id
    )
  );

CREATE POLICY "Admins can view all enrollments"
  ON class_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  event_time TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Canonical event time columns (for professional scheduling semantics)
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_at   TIMESTAMP WITH TIME ZONE;

-- Backfill start_at/end_at from legacy columns, if needed
UPDATE events
SET
  start_at = COALESCE(start_at, event_date),
  end_at = COALESCE(
    end_at,
    CASE
      WHEN event_time IS NULL THEN date_trunc('day', COALESCE(start_at, event_date)) + INTERVAL '23 hours 59 minutes 59 seconds'
      ELSE COALESCE(start_at, event_date) + INTERVAL '1 hour'
    END
  )
WHERE start_at IS NULL OR end_at IS NULL;

-- Ensure chronological consistency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'events' AND constraint_name = 'events_end_after_start'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_end_after_start CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at);
  END IF;
END $$;

-- Helpful indexes for querying upcoming/ongoing events
CREATE INDEX IF NOT EXISTS idx_events_start_at ON events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_end_at   ON events(end_at);

-- Enable Row Level Security for events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Everyone can view events"
  ON events FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage events"
  ON events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_role TEXT, -- 'admin' | 'teacher' | 'student' | 'parent' | 'all'
  recipient_id UUID, -- optional specific recipient user id
  subject TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Professional messaging flags
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_role ON messages(recipient_role);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage messages"
  ON messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Teachers can read messages addressed to them or to all
CREATE POLICY "Teachers can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
    AND (
      recipient_role IN ('teacher','all') OR recipient_id = auth.uid()
    )
  );

-- Teachers can mark their messages as read
CREATE POLICY "Teachers can update read flags on own messages"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
    AND (
      recipient_role IN ('teacher','all') OR recipient_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
    AND (
      recipient_role IN ('teacher','all') OR recipient_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can create messages to admin or all"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
    AND (
      recipient_role IN ('admin','all')
    )
  );

-- Create books table for library
CREATE TABLE IF NOT EXISTS books (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,
  available BOOLEAN DEFAULT true,
  borrowed_by UUID REFERENCES students(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view books"
  ON books FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage books"
  ON books FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create inventory items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view inventory"
  ON inventory_items FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage inventory"
  ON inventory_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  type TEXT,
  status TEXT DEFAULT 'pending', -- pending | completed | failed
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view/manage payments"
  ON payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create grades table
CREATE TABLE IF NOT EXISTS grades (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL NOT NULL,
  assignment_name TEXT NOT NULL,
  score NUMERIC(7,2) NOT NULL,
  max_score NUMERIC(7,2) NOT NULL DEFAULT 100,
  term_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- Teachers can view/manage grades for their own classes
CREATE POLICY "Teachers can view grades in their classes"
  ON grades FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.user_id = auth.uid() AND teachers.id = grades.teacher_id
    )
  );

CREATE POLICY "Teachers can insert grades in their classes"
  ON grades FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teachers
      JOIN classes ON teachers.id = classes.teacher_id
      WHERE teachers.user_id = auth.uid()
        AND classes.id = grades.class_id
        AND teachers.id = grades.teacher_id
    )
  );

CREATE POLICY "Teachers can delete their own grades"
  ON grades FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.user_id = auth.uid() AND teachers.id = grades.teacher_id
    )
  );

-- Students can view their own grades
CREATE POLICY "Students can view their own grades"
  ON grades FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.user_id = auth.uid() AND students.id = grades.student_id
    )
  );

-- Parents can view grades of their children
CREATE POLICY "Parents can view grades of their children"
  ON grades FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parents
      JOIN students ON parents.id = students.parent_id
      WHERE parents.user_id = auth.uid()
        AND students.id = grades.student_id
    )
  );

-- Admins can view all grades
CREATE POLICY "Admins can view all grades"
  ON grades FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL NOT NULL,
  date DATE NOT NULL,
  statuses TEXT[] NOT NULL DEFAULT '{}'::text[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(student_id, class_id, date),
  CONSTRAINT attendance_statuses_allowed CHECK (statuses <@ ARRAY['present','absent','late']::text[])
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Teachers can view attendance in their classes
CREATE POLICY "Teachers can view attendance in their classes"
  ON attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.user_id = auth.uid() AND teachers.id = attendance.teacher_id
    )
  );

-- Teachers can insert attendance for their classes
CREATE POLICY "Teachers can insert attendance"
  ON attendance FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teachers
      JOIN classes ON teachers.id = classes.teacher_id
      WHERE teachers.user_id = auth.uid()
        AND classes.id = attendance.class_id
        AND teachers.id = attendance.teacher_id
    )
  );

-- Teachers can update attendance they created
CREATE POLICY "Teachers can update their attendance"
  ON attendance FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.user_id = auth.uid() AND teachers.id = attendance.teacher_id
    )
  );

-- Students can view their own attendance
CREATE POLICY "Students can view their own attendance"
  ON attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.user_id = auth.uid() AND students.id = attendance.student_id
    )
  );

-- Parents can view attendance of their children
CREATE POLICY "Parents can view attendance of their children"
  ON attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parents
      JOIN students ON parents.id = students.parent_id
      WHERE parents.user_id = auth.uid()
        AND students.id = attendance.student_id
    )
  );

-- Admins can manage all attendance
CREATE POLICY "Admins can manage all attendance"
  ON attendance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL NOT NULL,
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Teachers can view assignments in their classes
CREATE POLICY "Teachers can view their assignments"
  ON assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.user_id = auth.uid() AND teachers.id = assignments.teacher_id
    )
  );

-- Teachers can create assignments for their classes
CREATE POLICY "Teachers can create assignments"
  ON assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teachers
      JOIN classes ON teachers.id = classes.teacher_id
      WHERE teachers.user_id = auth.uid()
        AND classes.id = assignments.class_id
        AND teachers.id = assignments.teacher_id
    )
  );

-- Teachers can delete their own assignments
CREATE POLICY "Teachers can delete their assignments"
  ON assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.user_id = auth.uid() AND teachers.id = assignments.teacher_id
    )
  );

-- Students can view assignments in their enrolled classes
CREATE POLICY "Students can view assignments in their classes"
  ON assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      JOIN class_enrollments ON students.id = class_enrollments.student_id
      WHERE students.user_id = auth.uid()
        AND class_enrollments.class_id = assignments.class_id
    )
  );

-- Parents can view assignments for their children's classes
CREATE POLICY "Parents can view assignments for their children"
  ON assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parents
      JOIN students ON parents.id = students.parent_id
      JOIN class_enrollments ON students.id = class_enrollments.student_id
      WHERE parents.user_id = auth.uid()
        AND class_enrollments.class_id = assignments.class_id
    )
  );

-- Admins can manage all assignments
CREATE POLICY "Admins can manage all assignments"
  ON assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create settings key-value table
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Everyone can view settings
CREATE POLICY "Everyone can view settings"
  ON settings FOR SELECT
  USING (true);

-- Admins can manage settings
CREATE POLICY "Admins can manage settings"
  ON settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- ACADEMIC SESSIONS & TERMS
-- ============================================================

CREATE TABLE IF NOT EXISTS academic_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE academic_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view academic sessions"
  ON academic_sessions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage academic sessions"
  ON academic_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE TABLE IF NOT EXISTS academic_terms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES academic_sessions(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view academic terms"
  ON academic_terms FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage academic terms"
  ON academic_terms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add FK for grades.term_id after academic_terms exists
DO $$
BEGIN
  ALTER TABLE grades
    ADD CONSTRAINT grades_term_id_fkey FOREIGN KEY (term_id) REFERENCES academic_terms(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- SUBJECTS & CLASS-SUBJECT-TEACHER ASSIGNMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view subjects"
  ON subjects FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage subjects"
  ON subjects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE TABLE IF NOT EXISTS class_subject_teachers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(class_id, subject_id)
);

ALTER TABLE class_subject_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view class subject teachers"
  ON class_subject_teachers FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage class subject teachers"
  ON class_subject_teachers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- TIMETABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS timetables (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  subject TEXT,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  room TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE timetables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view timetables"
  ON timetables FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage timetables"
  ON timetables FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timetables' AND column_name = 'term_id'
  ) THEN
    ALTER TABLE timetables ADD COLUMN term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_timetables_term_id ON timetables(term_id);

-- Backfill existing timetable entries to the active term
DO $$
DECLARE active_term UUID;
BEGIN
  SELECT id INTO active_term FROM academic_terms WHERE is_active = TRUE LIMIT 1;
  IF active_term IS NOT NULL THEN
    UPDATE timetables SET term_id = active_term WHERE term_id IS NULL;
  END IF;
END $$;

-- ============================================================
-- ASSESSMENTS TIMETABLE (CA1 / CA2 / Exams)
-- ============================================================

CREATE TABLE IF NOT EXISTS assessment_timetables (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  subject TEXT,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('CA1','CA2','Exam')),
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE assessment_timetables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view assessment timetables"
  ON assessment_timetables FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage assessment timetables"
  ON assessment_timetables FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- MESSAGES ENHANCEMENTS
-- ============================================================

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES messages(id) ON DELETE SET NULL;
