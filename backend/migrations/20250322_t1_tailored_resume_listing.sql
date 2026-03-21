-- T1: tie resume snapshot rows to job listings (tailoring history + JD snapshot)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'job_listing_id'
  ) THEN
    ALTER TABLE resumes
      ADD COLUMN job_listing_id UUID REFERENCES job_listings(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'tailored_title'
  ) THEN
    ALTER TABLE resumes ADD COLUMN tailored_title TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'tailored_company'
  ) THEN
    ALTER TABLE resumes ADD COLUMN tailored_company TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'tailored_url'
  ) THEN
    ALTER TABLE resumes ADD COLUMN tailored_url TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'jd_snapshot'
  ) THEN
    ALTER TABLE resumes ADD COLUMN jd_snapshot TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'tailored_source_tab'
  ) THEN
    ALTER TABLE resumes ADD COLUMN tailored_source_tab TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_resumes_user_job_listing
  ON resumes(user_id, job_listing_id)
  WHERE job_listing_id IS NOT NULL;
