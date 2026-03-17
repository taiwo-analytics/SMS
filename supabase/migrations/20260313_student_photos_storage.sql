-- Create the student-photos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-photos', 'student-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload to student-photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'student-photos');

-- Allow anyone to read (public bucket)
CREATE POLICY "Public read access for student-photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'student-photos');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update student-photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'student-photos');

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete from student-photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'student-photos');
