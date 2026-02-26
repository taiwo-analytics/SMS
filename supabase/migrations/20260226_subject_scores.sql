-- Subject Scores table for CA + Exam structure
CREATE TABLE IF NOT EXISTS subject_scores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  term_id UUID REFERENCES academic_terms(id) ON DELETE CASCADE NOT NULL,
  ca_score NUMERIC(5,2) DEFAULT 0,
  exam_score NUMERIC(5,2) DEFAULT 0,
  total NUMERIC(5,2) GENERATED ALWAYS AS (ca_score + exam_score) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, class_id, subject_id, term_id)
);

-- Add class_teacher_id to classes if not exists
ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_teacher_id UUID REFERENCES teachers(id);

-- Add class_teacher_remark and principal_remark columns for report cards
ALTER TABLE subject_scores ADD COLUMN IF NOT EXISTS class_teacher_remark TEXT;
ALTER TABLE subject_scores ADD COLUMN IF NOT EXISTS principal_remark TEXT;

-- Create a separate remarks table per student/class/term
CREATE TABLE IF NOT EXISTS report_remarks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  term_id UUID REFERENCES academic_terms(id) ON DELETE CASCADE NOT NULL,
  class_teacher_remark TEXT,
  principal_remark TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, class_id, term_id)
);

-- Enable RLS
ALTER TABLE subject_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_remarks ENABLE ROW LEVEL SECURITY;

-- RLS: Admin full access
CREATE POLICY "admin_all_subject_scores" ON subject_scores
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS: Teacher can access rows for subjects they teach in that class
CREATE POLICY "teacher_subject_scores" ON subject_scores
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teachers t
      JOIN class_subject_teachers cst ON cst.teacher_id = t.id
      WHERE t.user_id = auth.uid()
        AND cst.class_id = subject_scores.class_id
        AND cst.subject_id = subject_scores.subject_id
    )
    OR
    EXISTS (
      SELECT 1 FROM teachers t
      JOIN classes c ON c.class_teacher_id = t.id
      WHERE t.user_id = auth.uid()
        AND c.id = subject_scores.class_id
    )
  );

-- RLS: Admin full access to report_remarks
CREATE POLICY "admin_all_report_remarks" ON report_remarks
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS: Class teacher can manage remarks for their class
CREATE POLICY "class_teacher_report_remarks" ON report_remarks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teachers t
      JOIN classes c ON c.class_teacher_id = t.id
      WHERE t.user_id = auth.uid()
        AND c.id = report_remarks.class_id
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_subject_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subject_scores_updated_at
  BEFORE UPDATE ON subject_scores
  FOR EACH ROW EXECUTE FUNCTION update_subject_scores_updated_at();

CREATE TRIGGER report_remarks_updated_at
  BEFORE UPDATE ON report_remarks
  FOR EACH ROW EXECUTE FUNCTION update_subject_scores_updated_at();
