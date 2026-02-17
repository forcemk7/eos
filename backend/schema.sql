-- earnOS: Supabase schema. No users table — use auth.users.
-- Safe to re-run: uses IF NOT EXISTS / DO $$ guards throughout.

-- Resumes
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'resumes_select_own' AND tablename = 'resumes') THEN
    CREATE POLICY "resumes_select_own" ON resumes FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'resumes_insert_own' AND tablename = 'resumes') THEN
    CREATE POLICY "resumes_insert_own" ON resumes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'resumes_update_own' AND tablename = 'resumes') THEN
    CREATE POLICY "resumes_update_own" ON resumes FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'resumes_delete_own' AND tablename = 'resumes') THEN
    CREATE POLICY "resumes_delete_own" ON resumes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Applications tracker
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  company TEXT,
  url TEXT,
  location TEXT,
  status TEXT DEFAULT 'applied',
  applied_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_status ON applications(user_id, status);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'applications_select_own' AND tablename = 'applications') THEN
    CREATE POLICY "applications_select_own" ON applications FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'applications_insert_own' AND tablename = 'applications') THEN
    CREATE POLICY "applications_insert_own" ON applications FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'applications_update_own' AND tablename = 'applications') THEN
    CREATE POLICY "applications_update_own" ON applications FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'applications_delete_own' AND tablename = 'applications') THEN
    CREATE POLICY "applications_delete_own" ON applications FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Job preferences (one row per user)
CREATE TABLE IF NOT EXISTS job_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  titles TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  locations TEXT[] DEFAULT '{}',
  remote_only BOOLEAN DEFAULT false,
  max_applications_per_run INTEGER DEFAULT 10,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE job_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'job_prefs_select_own' AND tablename = 'job_preferences') THEN
    CREATE POLICY "job_prefs_select_own" ON job_preferences FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'job_prefs_insert_own' AND tablename = 'job_preferences') THEN
    CREATE POLICY "job_prefs_insert_own" ON job_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'job_prefs_update_own' AND tablename = 'job_preferences') THEN
    CREATE POLICY "job_prefs_update_own" ON job_preferences FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Platform credentials (encrypted passwords stored here)
CREATE TABLE IF NOT EXISTS platform_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  email TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform)
);

ALTER TABLE platform_credentials ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'creds_select_own' AND tablename = 'platform_credentials') THEN
    CREATE POLICY "creds_select_own" ON platform_credentials FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'creds_insert_own' AND tablename = 'platform_credentials') THEN
    CREATE POLICY "creds_insert_own" ON platform_credentials FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'creds_update_own' AND tablename = 'platform_credentials') THEN
    CREATE POLICY "creds_update_own" ON platform_credentials FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'creds_delete_own' AND tablename = 'platform_credentials') THEN
    CREATE POLICY "creds_delete_own" ON platform_credentials FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Activity log (agent writes actions here)
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  action TEXT NOT NULL,
  platform TEXT,
  details JSONB DEFAULT '{}',
  status TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_user_run ON activity_log(user_id, run_id);
CREATE INDEX IF NOT EXISTS idx_activity_user_created ON activity_log(user_id, created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'activity_select_own' AND tablename = 'activity_log') THEN
    CREATE POLICY "activity_select_own" ON activity_log FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'activity_insert_own' AND tablename = 'activity_log') THEN
    CREATE POLICY "activity_insert_own" ON activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
