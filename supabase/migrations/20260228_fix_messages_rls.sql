-- Fix messages RLS policies so admins can INSERT and teachers can send to all roles

-- Drop old admin policy
DROP POLICY IF EXISTS "Admins can manage messages" ON messages;
DROP POLICY IF EXISTS "Admins can insert messages" ON messages;
DROP POLICY IF EXISTS "Admins can update messages" ON messages;
DROP POLICY IF EXISTS "Admins can delete messages" ON messages;

-- Admin SELECT (already exists separately, keep it)
-- Admin INSERT
CREATE POLICY "Admins can insert messages"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admin UPDATE
CREATE POLICY "Admins can update messages"
  ON messages FOR UPDATE
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

-- Admin DELETE
CREATE POLICY "Admins can delete messages"
  ON messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Drop old teacher policies
DROP POLICY IF EXISTS "Teachers can create messages to admin or all" ON messages;
DROP POLICY IF EXISTS "Teachers can create messages" ON messages;
DROP POLICY IF EXISTS "Teachers can update messages" ON messages;
DROP POLICY IF EXISTS "Teachers can update read flags on own messages" ON messages;
DROP POLICY IF EXISTS "Teachers can delete own messages" ON messages;

-- Teacher INSERT (allow sending to any recipient)
CREATE POLICY "Teachers can create messages"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
  );

-- Teacher UPDATE (mark read, update own sent messages)
CREATE POLICY "Teachers can update messages"
  ON messages FOR UPDATE
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
  )
  WITH CHECK (
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

-- Teacher DELETE (own sent messages only)
CREATE POLICY "Teachers can delete own messages"
  ON messages FOR DELETE
  USING (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
  );
