-- Library loans table and triggers
-- Track borrow/return events for books with per-student linkage

CREATE TABLE IF NOT EXISTS library_loans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  due_at DATE,
  returned_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'borrowed' CHECK (status IN ('borrowed','returned','overdue')),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_library_loans_active ON library_loans (book_id) WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_loans_student ON library_loans (student_id, issued_at DESC);

-- Keep books.available and books.borrowed_by in sync
CREATE OR REPLACE FUNCTION public.library_loans_after_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE books
    SET available = false,
        borrowed_by = NEW.student_id
    WHERE id = NEW.book_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.library_loans_after_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.returned_at IS NOT NULL AND (OLD.returned_at IS NULL OR NEW.returned_at <> OLD.returned_at) THEN
    UPDATE books
      SET available = true,
          borrowed_by = NULL
      WHERE id = NEW.book_id;
    NEW.status := 'returned';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_library_loans_after_insert ON library_loans;
CREATE TRIGGER trg_library_loans_after_insert
AFTER INSERT ON library_loans
FOR EACH ROW EXECUTE FUNCTION library_loans_after_insert();

DROP TRIGGER IF EXISTS trg_library_loans_after_update ON library_loans;
CREATE TRIGGER trg_library_loans_after_update
AFTER UPDATE ON library_loans
FOR EACH ROW EXECUTE FUNCTION library_loans_after_update();

-- RLS
ALTER TABLE library_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view loans"
  ON library_loans FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage loans"
  ON library_loans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
