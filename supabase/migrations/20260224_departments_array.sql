-- Migrate subjects.department (text) -> subjects.departments (text[]) while keeping backward compatibility
-- Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='subjects' AND column_name='departments'
  ) THEN
    ALTER TABLE subjects ADD COLUMN departments TEXT[];
  END IF;
END $$;

-- Backfill array from legacy column if present and array is null
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='subjects' AND column_name='department'
  ) THEN
    UPDATE subjects
    SET departments = CASE
      WHEN department IS NULL OR btrim(department) = '' THEN NULL
      ELSE string_to_array(department, ';')
    END
    WHERE departments IS NULL;
  END IF;
END $$;

-- Optional: create a GIN index for efficient contains queries
CREATE INDEX IF NOT EXISTS idx_subjects_departments_gin ON subjects USING GIN (departments);

-- Optional view to ease transition (exposes legacy department as first token)
CREATE OR REPLACE VIEW subjects_with_department AS
SELECT
  s.*,
  CASE
    WHEN s.departments IS NULL OR array_length(s.departments, 1) IS NULL THEN NULL
    ELSE s.departments[1]
  END AS department
FROM subjects s;

