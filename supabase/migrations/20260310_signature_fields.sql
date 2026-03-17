-- Add signature URL fields to report_remarks
ALTER TABLE report_remarks
  ADD COLUMN IF NOT EXISTS class_teacher_signature_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS principal_signature_url TEXT DEFAULT '';
