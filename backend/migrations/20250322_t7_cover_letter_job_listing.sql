-- T7: Link cover letter chats to tracked job_listings (optional FK; ON DELETE SET NULL)
-- Idempotent; safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cover_letter_chats' AND column_name = 'job_listing_id'
  ) THEN
    ALTER TABLE cover_letter_chats
      ADD COLUMN job_listing_id UUID REFERENCES job_listings(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cover_letter_chats_job_listing_id
  ON cover_letter_chats(job_listing_id)
  WHERE job_listing_id IS NOT NULL;
