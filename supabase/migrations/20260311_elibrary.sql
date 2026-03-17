-- E-Library files table
CREATE TABLE IF NOT EXISTS elibrary_files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  category TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE elibrary_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view elibrary files"
  ON elibrary_files FOR SELECT USING (true);

CREATE POLICY "Admins can insert elibrary files"
  ON elibrary_files FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update elibrary files"
  ON elibrary_files FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete elibrary files"
  ON elibrary_files FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Storage bucket for e-library files
INSERT INTO storage.buckets (id, name, public)
VALUES ('elibrary', 'elibrary', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can read elibrary files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'elibrary');

CREATE POLICY "Admins can upload elibrary files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'elibrary'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete elibrary files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'elibrary'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
