CREATE TABLE IF NOT EXISTS subject_attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL NOT NULL,
  date DATE NOT NULL,
  statuses TEXT[] NOT NULL DEFAULT '{}'::text[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(student_id, class_id, subject_id, date),
  CONSTRAINT subject_attendance_statuses_allowed CHECK (statuses <@ ARRAY['present','absent','late']::text[])
);

CREATE INDEX IF NOT EXISTS subject_attendance_class_subject_date_idx
  ON subject_attendance (class_id, subject_id, date);

CREATE INDEX IF NOT EXISTS subject_attendance_student_date_idx
  ON subject_attendance (student_id, date);

ALTER TABLE subject_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view their subject attendance"
  ON subject_attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.user_id = auth.uid() AND teachers.id = subject_attendance.teacher_id
    )
  );

CREATE POLICY "Teachers can insert subject attendance"
  ON subject_attendance FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM teachers
      JOIN class_subject_teachers cst
        ON cst.teacher_id = teachers.id
      WHERE teachers.user_id = auth.uid()
        AND teachers.id = subject_attendance.teacher_id
        AND cst.class_id = subject_attendance.class_id
        AND cst.subject_id = subject_attendance.subject_id
    )
  );

CREATE POLICY "Teachers can update their subject attendance"
  ON subject_attendance FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.user_id = auth.uid() AND teachers.id = subject_attendance.teacher_id
    )
  );

CREATE POLICY "Students can view their own subject attendance"
  ON subject_attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.user_id = auth.uid() AND students.id = subject_attendance.student_id
    )
  );

CREATE POLICY "Parents can view subject attendance of their children"
  ON subject_attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parents
      JOIN students ON parents.id = students.parent_id
      WHERE parents.user_id = auth.uid() AND students.id = subject_attendance.student_id
    )
  );

CREATE POLICY "Admins can manage subject attendance"
  ON subject_attendance FOR ALL
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
