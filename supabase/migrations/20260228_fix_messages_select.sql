-- Fix teacher SELECT policy to also include messages they sent
DROP POLICY IF EXISTS "Teachers can view messages" ON messages;

CREATE POLICY "Teachers can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
    AND (
      recipient_role IN ('teacher', 'all')
      OR recipient_id = auth.uid()
      OR sender_id = auth.uid()
    )
  );
