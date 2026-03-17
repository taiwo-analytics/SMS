-- Add editable report card fields to report_remarks
ALTER TABLE report_remarks
  ADD COLUMN IF NOT EXISTS next_term_begins TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS school_fees TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS affective_skills JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS psychomotor_skills JSONB DEFAULT '{}';
