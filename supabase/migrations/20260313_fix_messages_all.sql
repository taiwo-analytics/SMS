-- ============================================================
-- COMPREHENSIVE MESSAGES FIX
-- Drops ALL existing message policies and recreates them cleanly.
-- Also enables Realtime replication for messages + message_reads.
-- ============================================================

-- 1. Ensure messages table has reply_to column
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES messages(id) ON DELETE SET NULL;

-- 2. Ensure message_reads table exists
CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_message_reads_user ON message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_message ON message_reads(message_id);
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

-- 3. Drop ALL existing policies on messages
DROP POLICY IF EXISTS "Admins can view messages" ON messages;
DROP POLICY IF EXISTS "Admins can manage messages" ON messages;
DROP POLICY IF EXISTS "Admins can insert messages" ON messages;
DROP POLICY IF EXISTS "Admins can update messages" ON messages;
DROP POLICY IF EXISTS "Admins can delete messages" ON messages;
DROP POLICY IF EXISTS "Teachers can view messages" ON messages;
DROP POLICY IF EXISTS "Teachers can create messages" ON messages;
DROP POLICY IF EXISTS "Teachers can create messages to admin or all" ON messages;
DROP POLICY IF EXISTS "Teachers can update messages" ON messages;
DROP POLICY IF EXISTS "Teachers can update read flags on own messages" ON messages;
DROP POLICY IF EXISTS "Teachers can delete own messages" ON messages;
DROP POLICY IF EXISTS "Students can view messages" ON messages;
DROP POLICY IF EXISTS "Students can send messages" ON messages;
DROP POLICY IF EXISTS "Students can update messages" ON messages;
DROP POLICY IF EXISTS "Students can delete own messages" ON messages;
DROP POLICY IF EXISTS "Parents can view messages" ON messages;
DROP POLICY IF EXISTS "Parents can send messages" ON messages;
DROP POLICY IF EXISTS "Parents can update messages" ON messages;
DROP POLICY IF EXISTS "Parents can delete own messages" ON messages;

-- 4. Drop ALL existing policies on message_reads
DROP POLICY IF EXISTS "Users can view own reads" ON message_reads;
DROP POLICY IF EXISTS "Users can insert own reads" ON message_reads;
DROP POLICY IF EXISTS "Users can delete own reads" ON message_reads;

-- ============================================================
-- 5. ADMIN POLICIES
-- ============================================================
CREATE POLICY "Admins can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can insert messages"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can update messages"
  ON messages FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can delete messages"
  ON messages FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================================
-- 6. TEACHER POLICIES
-- ============================================================
CREATE POLICY "Teachers can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
    AND (
      recipient_role IN ('teacher', 'all')
      OR recipient_id = auth.uid()
      OR sender_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can create messages"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
    AND sender_id = auth.uid()
  );

CREATE POLICY "Teachers can update messages"
  ON messages FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
    AND (
      recipient_role IN ('teacher', 'all')
      OR recipient_id = auth.uid()
      OR sender_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete own messages"
  ON messages FOR DELETE
  USING (
    sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
  );

-- ============================================================
-- 7. STUDENT POLICIES
-- ============================================================
CREATE POLICY "Students can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'student')
    AND (
      recipient_role IN ('student', 'all')
      OR recipient_id = auth.uid()
      OR sender_id = auth.uid()
    )
  );

CREATE POLICY "Students can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'student')
    AND sender_id = auth.uid()
  );

CREATE POLICY "Students can update messages"
  ON messages FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'student')
    AND (
      recipient_role IN ('student', 'all')
      OR recipient_id = auth.uid()
      OR sender_id = auth.uid()
    )
  );

CREATE POLICY "Students can delete own messages"
  ON messages FOR DELETE
  USING (
    sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'student')
  );

-- ============================================================
-- 8. PARENT POLICIES
-- ============================================================
CREATE POLICY "Parents can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'parent')
    AND (
      recipient_role IN ('parent', 'all')
      OR recipient_id = auth.uid()
      OR sender_id = auth.uid()
    )
  );

CREATE POLICY "Parents can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'parent')
    AND sender_id = auth.uid()
  );

CREATE POLICY "Parents can update messages"
  ON messages FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'parent')
    AND (
      recipient_role IN ('parent', 'all')
      OR recipient_id = auth.uid()
      OR sender_id = auth.uid()
    )
  );

CREATE POLICY "Parents can delete own messages"
  ON messages FOR DELETE
  USING (
    sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'parent')
  );

-- ============================================================
-- 9. MESSAGE_READS POLICIES
-- ============================================================
CREATE POLICY "Users can view own reads"
  ON message_reads FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own reads"
  ON message_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own reads"
  ON message_reads FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 10. ENABLE REALTIME for messages and message_reads
-- This is required for postgres_changes subscriptions to work
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reads;
