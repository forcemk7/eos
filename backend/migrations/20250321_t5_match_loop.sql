-- T5: Strong match loop — sessions + iterations (idempotent)
CREATE TABLE IF NOT EXISTS match_loop_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT match_loop_sessions_status_check CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_match_loop_sessions_user_created ON match_loop_sessions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS match_loop_iterations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES match_loop_sessions(id) ON DELETE CASCADE,
  iteration_index INTEGER NOT NULL,
  search_params JSONB NOT NULL DEFAULT '{}',
  listings JSONB NOT NULL DEFAULT '[]',
  evaluations JSONB NOT NULL DEFAULT '[]',
  strong_match_ids TEXT[],
  refinement_source TEXT,
  refinement_note TEXT,
  suggested_next JSONB,
  jsearch_requests_delta INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT match_loop_iterations_refine_check CHECK (
    refinement_source IS NULL OR refinement_source IN ('initial', 'rules', 'llm', 'user_override')
  ),
  UNIQUE (session_id, iteration_index)
);

CREATE INDEX IF NOT EXISTS idx_match_loop_iterations_session ON match_loop_iterations(session_id, iteration_index);

ALTER TABLE match_loop_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_loop_iterations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'match_loop_sessions_select_own' AND tablename = 'match_loop_sessions') THEN
    CREATE POLICY "match_loop_sessions_select_own" ON match_loop_sessions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'match_loop_sessions_insert_own' AND tablename = 'match_loop_sessions') THEN
    CREATE POLICY "match_loop_sessions_insert_own" ON match_loop_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'match_loop_sessions_update_own' AND tablename = 'match_loop_sessions') THEN
    CREATE POLICY "match_loop_sessions_update_own" ON match_loop_sessions FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'match_loop_sessions_delete_own' AND tablename = 'match_loop_sessions') THEN
    CREATE POLICY "match_loop_sessions_delete_own" ON match_loop_sessions FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'match_loop_iterations_select_own' AND tablename = 'match_loop_iterations') THEN
    CREATE POLICY "match_loop_iterations_select_own" ON match_loop_iterations FOR SELECT USING (
      EXISTS (SELECT 1 FROM match_loop_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'match_loop_iterations_insert_own' AND tablename = 'match_loop_iterations') THEN
    CREATE POLICY "match_loop_iterations_insert_own" ON match_loop_iterations FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM match_loop_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'match_loop_iterations_update_own' AND tablename = 'match_loop_iterations') THEN
    CREATE POLICY "match_loop_iterations_update_own" ON match_loop_iterations FOR UPDATE USING (
      EXISTS (SELECT 1 FROM match_loop_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'match_loop_iterations_delete_own' AND tablename = 'match_loop_iterations') THEN
    CREATE POLICY "match_loop_iterations_delete_own" ON match_loop_iterations FOR DELETE USING (
      EXISTS (SELECT 1 FROM match_loop_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
    );
  END IF;
END $$;
