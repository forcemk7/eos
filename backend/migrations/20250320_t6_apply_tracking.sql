-- T6: Apply logging + application_events (idempotent; safe to re-run)
-- Run in Supabase Dashboard → SQL Editor (or merge into your migration pipeline).
-- Full project schema also lives in ../schema.sql

-- job_listings: apply flow columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_listings' AND column_name = 'apply_outbound_at') THEN
    ALTER TABLE job_listings ADD COLUMN apply_outbound_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_listings' AND column_name = 'apply_decision') THEN
    ALTER TABLE job_listings ADD COLUMN apply_decision TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_listings' AND column_name = 'apply_decision_at') THEN
    ALTER TABLE job_listings ADD COLUMN apply_decision_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_listings' AND column_name = 'apply_notes') THEN
    ALTER TABLE job_listings ADD COLUMN apply_notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_listings' AND column_name = 'apply_remind_at') THEN
    ALTER TABLE job_listings ADD COLUMN apply_remind_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_listing_id UUID NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_events_user_created ON application_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_application_events_listing_created ON application_events(job_listing_id, created_at);

ALTER TABLE application_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'application_events_select_own' AND tablename = 'application_events') THEN
    CREATE POLICY "application_events_select_own" ON application_events FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'application_events_insert_own' AND tablename = 'application_events') THEN
    CREATE POLICY "application_events_insert_own" ON application_events FOR INSERT WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (SELECT 1 FROM job_listings j WHERE j.id = job_listing_id AND j.user_id = auth.uid())
    );
  END IF;
END $$;
