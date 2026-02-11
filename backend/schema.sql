-- earnOS: Resume persistence only. No users table — use auth.users.
-- Run in Supabase SQL Editor after wiping previous schema if needed.

CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER DEFAULT 1,
  raw_text TEXT,
  parsed_data JSONB,
  file_name TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user_created ON resumes(user_id, created_at DESC);

ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resumes_select_own" ON resumes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "resumes_insert_own" ON resumes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "resumes_update_own" ON resumes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "resumes_delete_own" ON resumes FOR DELETE USING (auth.uid() = user_id);
