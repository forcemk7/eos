-- T4: Target profile — role/sector recommendations on job_qualifications (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_qualifications' AND column_name = 'target_roles') THEN
    ALTER TABLE job_qualifications ADD COLUMN target_roles JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_qualifications' AND column_name = 'target_sectors') THEN
    ALTER TABLE job_qualifications ADD COLUMN target_sectors JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_qualifications' AND column_name = 'profile_as_of') THEN
    ALTER TABLE job_qualifications ADD COLUMN profile_as_of TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_qualifications' AND column_name = 'dismissed_role_keys') THEN
    ALTER TABLE job_qualifications ADD COLUMN dismissed_role_keys JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_qualifications' AND column_name = 'dismissed_sector_keys') THEN
    ALTER TABLE job_qualifications ADD COLUMN dismissed_sector_keys JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_qualifications' AND column_name = 'pinned_role_key') THEN
    ALTER TABLE job_qualifications ADD COLUMN pinned_role_key TEXT;
  END IF;
END $$;
