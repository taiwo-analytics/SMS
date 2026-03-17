-- Messages overhaul: per-user read tracking + student/parent access

-- 1. Create message_reads table for per-user read tracking
CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX idx_message_reads_user ON message_reads(user_id);
CREATE INDEX idx_message_reads_message ON message_reads(message_id);

-- Enable RLS on message_reads
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

-- All authenticated users can see their own reads
CREATE POLICY "Users can view own reads"
  ON message_reads FOR SELECT
  USING (user_id = auth.uid());

-- All authenticated users can insert their own reads
CREATE POLICY "Users can insert own reads"
  ON message_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- All authenticated users can delete their own reads
CREATE POLICY "Users can delete own reads"
  ON message_reads FOR DELETE
  USING (user_id = auth.uid());

-- 2. Student message policies
DROP POLICY IF EXISTS "Students can view messages" ON messages;
CREATE POLICY "Students can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'student'
    )
    AND (
      recipient_role IN ('student', 'all')
      OR recipient_id = auth.uid()
      OR sender_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can send messages" ON messages;
CREATE POLICY "Students can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'student'
    )
    AND sender_id = auth.uid()
  );

DROP POLICY IF EXISTS "Students can update messages" ON messages;
CREATE POLICY "Students can update messages"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'student'
    )
    AND (
      recipient_role IN ('student', 'all')
      OR recipient_id = auth.uid()
      OR sender_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'student'
    )
    AND (
      recipient_role IN ('student', 'all')
      OR recipient_id = auth.uid()
      OR sender_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can delete own messages" ON messages;
CREATE POLICY "Students can delete own messages"
  ON messages FOR DELETE
  USING (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'student'
    )
  );

-- 3. Parent message policies
DROP POLICY IF EXISTS "Parents can view messages" ON messages;
CREATE POLICY "Parents can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
    )
    AND (
      recipient_role IN ('parent', 'all')
      OR recipient_id = auth.uid()
      OR sender_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Parents can send messages" ON messages;
CREATE POLICY "Parents can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
    )
    AND sender_id = auth.uid()
  );

DROP POLICY IF EXISTS "Parents can update messages" ON messages;
CREATE POLICY "Parents can update messages"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
    )
    AND (
      recipient_role IN ('parent', 'all')
      OR recipient_id = auth.uid()
      OR sender_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
    )
    AND (
      recipient_role IN ('parent', 'all')
      OR recipient_id = auth.uid()
      OR sender_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Parents can delete own messages" ON messages;
CREATE POLICY "Parents can delete own messages"
  ON messages FOR DELETE
  USING (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
    )
  );
