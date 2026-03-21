-- T3: persisted candidate readout (archetypes + tags) on job_qualifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_qualifications' AND column_name = 'candidate_readout'
  ) THEN
    ALTER TABLE job_qualifications ADD COLUMN candidate_readout JSONB;
  END IF;
END $$;
