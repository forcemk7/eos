-- T8: pipeline_stage on job_listings (idempotent; safe to re-run)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_listings' AND column_name = 'pipeline_stage') THEN
    ALTER TABLE job_listings ADD COLUMN pipeline_stage TEXT;
  END IF;
END $$;
