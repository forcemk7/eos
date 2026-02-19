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

-- ── Profile-centric model: DB = source of truth, resume = view ─────────────────
-- Categories (single-word): Contact, Summary, Experience, Education, Achievements,
-- Skills, Languages, Additional. One profile per user; order via sort_order.
--
-- Schema mapping:
--   Contact     → profiles.identity (name, email, phone, location, links)
--   Summary     → profiles.summary
--   Additional  → profiles.additional
--   Experience  → experience + bullets
--   Education   → education
--   Achievements→ achievements
--   Skills      → skills
--   Languages   → languages

-- Migrate single-label renames (run once for existing deployments)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_experiences') THEN
    ALTER TABLE work_experiences RENAME TO experience;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bullets' AND column_name = 'work_experience_id') THEN
    ALTER TABLE bullets RENAME COLUMN work_experience_id TO experience_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'additional_sections') THEN
    ALTER TABLE profiles RENAME COLUMN additional_sections TO additional;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  identity JSONB NOT NULL DEFAULT '{"name":"","email":"","phone":"","location":"","links":[]}',
  summary TEXT NOT NULL DEFAULT '',
  additional JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'additional') THEN
    ALTER TABLE profiles ADD COLUMN additional JSONB NOT NULL DEFAULT '[]';
  END IF;
END $$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_select_own' AND tablename = 'profiles') THEN
    CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_insert_own' AND tablename = 'profiles') THEN
    CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_update_own' AND tablename = 'profiles') THEN
    CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Experience: one row per position; bullets = accomplishments per position
CREATE TABLE IF NOT EXISTS experience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  dates TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experience_user_id ON experience(user_id);
CREATE INDEX IF NOT EXISTS idx_experience_user_sort ON experience(user_id, sort_order);

ALTER TABLE experience ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'experience_select_own' AND tablename = 'experience') THEN
    CREATE POLICY "experience_select_own" ON experience FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'experience_insert_own' AND tablename = 'experience') THEN
    CREATE POLICY "experience_insert_own" ON experience FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'experience_update_own' AND tablename = 'experience') THEN
    CREATE POLICY "experience_update_own" ON experience FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'experience_delete_own' AND tablename = 'experience') THEN
    CREATE POLICY "experience_delete_own" ON experience FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Bullets: accomplishments per experience row
CREATE TABLE IF NOT EXISTS bullets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id UUID NOT NULL REFERENCES experience(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bullets_experience_id ON bullets(experience_id);
CREATE INDEX IF NOT EXISTS idx_bullets_experience_sort ON bullets(experience_id, sort_order);

ALTER TABLE bullets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bullets_select_own' AND tablename = 'bullets') THEN
    CREATE POLICY "bullets_select_own" ON bullets FOR SELECT USING (
      EXISTS (SELECT 1 FROM experience e WHERE e.id = bullets.experience_id AND e.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bullets_insert_own' AND tablename = 'bullets') THEN
    CREATE POLICY "bullets_insert_own" ON bullets FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM experience e WHERE e.id = bullets.experience_id AND e.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bullets_update_own' AND tablename = 'bullets') THEN
    CREATE POLICY "bullets_update_own" ON bullets FOR UPDATE USING (
      EXISTS (SELECT 1 FROM experience e WHERE e.id = bullets.experience_id AND e.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bullets_delete_own' AND tablename = 'bullets') THEN
    CREATE POLICY "bullets_delete_own" ON bullets FOR DELETE USING (
      EXISTS (SELECT 1 FROM experience e WHERE e.id = bullets.experience_id AND e.user_id = auth.uid())
    );
  END IF;
END $$;

-- Skills: one row per skill
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skills_user_id ON skills(user_id);
CREATE INDEX IF NOT EXISTS idx_skills_user_sort ON skills(user_id, sort_order);

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'skills_select_own' AND tablename = 'skills') THEN
    CREATE POLICY "skills_select_own" ON skills FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'skills_insert_own' AND tablename = 'skills') THEN
    CREATE POLICY "skills_insert_own" ON skills FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'skills_update_own' AND tablename = 'skills') THEN
    CREATE POLICY "skills_update_own" ON skills FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'skills_delete_own' AND tablename = 'skills') THEN
    CREATE POLICY "skills_delete_own" ON skills FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Education: one row per degree/credential
CREATE TABLE IF NOT EXISTS education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution TEXT NOT NULL DEFAULT '',
  degree TEXT NOT NULL DEFAULT '',
  field_of_study TEXT NOT NULL DEFAULT '',
  dates TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_education_user_id ON education(user_id);
CREATE INDEX IF NOT EXISTS idx_education_user_sort ON education(user_id, sort_order);

ALTER TABLE education ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'education_select_own' AND tablename = 'education') THEN
    CREATE POLICY "education_select_own" ON education FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'education_insert_own' AND tablename = 'education') THEN
    CREATE POLICY "education_insert_own" ON education FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'education_update_own' AND tablename = 'education') THEN
    CREATE POLICY "education_update_own" ON education FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'education_delete_own' AND tablename = 'education') THEN
    CREATE POLICY "education_delete_own" ON education FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Languages: one row per language + level
CREATE TABLE IF NOT EXISTS languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_languages_user_id ON languages(user_id);
CREATE INDEX IF NOT EXISTS idx_languages_user_sort ON languages(user_id, sort_order);

ALTER TABLE languages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'languages_select_own' AND tablename = 'languages') THEN
    CREATE POLICY "languages_select_own" ON languages FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'languages_insert_own' AND tablename = 'languages') THEN
    CREATE POLICY "languages_insert_own" ON languages FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'languages_update_own' AND tablename = 'languages') THEN
    CREATE POLICY "languages_update_own" ON languages FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'languages_delete_own' AND tablename = 'languages') THEN
    CREATE POLICY "languages_delete_own" ON languages FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Achievements: one row per award/certification
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  issuer TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_user_sort ON achievements(user_id, sort_order);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'achievements_select_own' AND tablename = 'achievements') THEN
    CREATE POLICY "achievements_select_own" ON achievements FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'achievements_insert_own' AND tablename = 'achievements') THEN
    CREATE POLICY "achievements_insert_own" ON achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'achievements_update_own' AND tablename = 'achievements') THEN
    CREATE POLICY "achievements_update_own" ON achievements FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'achievements_delete_own' AND tablename = 'achievements') THEN
    CREATE POLICY "achievements_delete_own" ON achievements FOR DELETE USING (auth.uid() = user_id);
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
