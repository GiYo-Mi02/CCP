-- ============================================================
-- CCP Initial Schema
-- Constitutional Convention Platform
-- Supabase PostgreSQL Migration
-- ============================================================

-- 0. ENUMS
-- ============================================================
CREATE TYPE user_role       AS ENUM ('admin', 'delegate');
CREATE TYPE session_status  AS ENUM ('draft', 'active', 'concluded');
CREATE TYPE period_type     AS ENUM ('amendment', 'insertion', 'quash', 'quick_motion', 'election', 'final_votation');
CREATE TYPE period_state    AS ENUM ('pending', 'active', 'votation', 'results', 'closed');
CREATE TYPE motion_type     AS ENUM ('amendment', 'insertion', 'quash', 'quick_motion');
CREATE TYPE motion_status   AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE vote_value      AS ENUM ('adapt', 'quash', 'abstain');
CREATE TYPE election_status AS ENUM ('pending', 'active', 'closed');

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT        NOT NULL DEFAULT '',
  college     TEXT        NOT NULL DEFAULT '',
  committee   TEXT        NOT NULL DEFAULT '',
  credentials TEXT[]      NOT NULL DEFAULT '{}',
  avatar_url  TEXT,
  role        user_role   NOT NULL DEFAULT 'delegate',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS 'Delegate/Admin profiles linked 1:1 to auth.users';

-- Auto-create profile row when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. SESSIONS
-- ============================================================
CREATE TABLE sessions (
  id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT           NOT NULL,
  status     session_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ    NOT NULL DEFAULT now()
);

COMMENT ON TABLE sessions IS 'Constitutional Convention sessions (e.g. "Session IV")';

-- ============================================================
-- 3. PERIODS
-- ============================================================
CREATE TABLE periods (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID         NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  period_type period_type  NOT NULL,
  state       period_state NOT NULL DEFAULT 'pending',
  deadline    TIMESTAMPTZ,           -- NULL = no active timer
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE periods IS 'Time-bound periods within a session (amendment, insertion, quash, etc.)';
CREATE INDEX idx_periods_session ON periods(session_id);
CREATE INDEX idx_periods_state   ON periods(state);

-- ============================================================
-- 4. MOTIONS
-- ============================================================
CREATE TABLE motions (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id     UUID          NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  author_id     UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  motion_type   motion_type   NOT NULL,
  article_ref   TEXT          NOT NULL DEFAULT '',
  section_ref   TEXT          NOT NULL DEFAULT '',
  original_text TEXT,
  proposed_text TEXT,
  justification TEXT,
  status        motion_status NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE motions IS 'Amendments, insertions, quash proposals, and quick motions';
CREATE INDEX idx_motions_period ON motions(period_id);
CREATE INDEX idx_motions_author ON motions(author_id);

-- ============================================================
-- 5. VOTES
-- ============================================================
CREATE TABLE votes (
  id         UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  motion_id  UUID       NOT NULL REFERENCES motions(id) ON DELETE CASCADE,
  voter_id   UUID       NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote_value vote_value NOT NULL,
  cast_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each delegate may vote once per motion
  UNIQUE(motion_id, voter_id)
);

COMMENT ON TABLE votes IS 'Individual delegate votes on motions (immutable after cast)';
CREATE INDEX idx_votes_motion ON votes(motion_id);

-- ============================================================
-- 6. ELECTIONS
-- ============================================================
CREATE TABLE elections (
  id         UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID            NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name       TEXT            NOT NULL,
  status     election_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE elections IS 'Plenary and committee election events within a session';

-- ============================================================
-- 7. ELECTION POSITIONS
-- ============================================================
CREATE TABLE election_positions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,                  -- e.g. "Presiding Officer"
  scope       TEXT NOT NULL DEFAULT 'plenary' -- 'plenary' or committee name
);

COMMENT ON TABLE election_positions IS 'Positions being elected (Presiding Officer, Secretary General, etc.)';

-- ============================================================
-- 8. CANDIDATES
-- ============================================================
CREATE TABLE candidates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES election_positions(id) ON DELETE CASCADE,

  UNIQUE(profile_id, position_id)
);

COMMENT ON TABLE candidates IS 'Delegates running for election positions';

-- ============================================================
-- 9. ELECTION VOTES
-- ============================================================
CREATE TABLE election_votes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  position_id  UUID NOT NULL REFERENCES election_positions(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  cast_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each delegate votes once per position
  UNIQUE(voter_id, position_id)
);

COMMENT ON TABLE election_votes IS 'Secret ballot votes for election positions';

-- ============================================================
-- 10. DATABASE FUNCTIONS (Atomic Operations)
-- ============================================================

-- Cast a vote atomically (prevents double-voting at DB level)
CREATE OR REPLACE FUNCTION cast_vote(
  p_motion_id UUID,
  p_voter_id  UUID,
  p_value     vote_value
)
RETURNS UUID AS $$
DECLARE
  v_period_state period_state;
  v_vote_id UUID;
BEGIN
  -- Verify the period is in 'votation' state
  SELECT p.state INTO v_period_state
  FROM periods p
  JOIN motions m ON m.period_id = p.id
  WHERE m.id = p_motion_id;

  IF v_period_state IS NULL THEN
    RAISE EXCEPTION 'Motion not found';
  END IF;

  IF v_period_state != 'votation' THEN
    RAISE EXCEPTION 'Voting is not open for this period (current state: %)', v_period_state;
  END IF;

  INSERT INTO votes (motion_id, voter_id, vote_value)
  VALUES (p_motion_id, p_voter_id, p_value)
  RETURNING id INTO v_vote_id;

  RETURN v_vote_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get aggregated vote results for a motion
CREATE OR REPLACE FUNCTION get_motion_results(p_motion_id UUID)
RETURNS TABLE(
  total_votes BIGINT,
  adapt_count BIGINT,
  quash_count BIGINT,
  abstain_count BIGINT,
  adapt_pct NUMERIC,
  quash_pct NUMERIC,
  abstain_pct NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)                                                              AS total_votes,
    COUNT(*) FILTER (WHERE v.vote_value = 'adapt')                        AS adapt_count,
    COUNT(*) FILTER (WHERE v.vote_value = 'quash')                        AS quash_count,
    COUNT(*) FILTER (WHERE v.vote_value = 'abstain')                      AS abstain_count,
    ROUND(COUNT(*) FILTER (WHERE v.vote_value = 'adapt')   * 100.0 / NULLIF(COUNT(*), 0), 1) AS adapt_pct,
    ROUND(COUNT(*) FILTER (WHERE v.vote_value = 'quash')   * 100.0 / NULLIF(COUNT(*), 0), 1) AS quash_pct,
    ROUND(COUNT(*) FILTER (WHERE v.vote_value = 'abstain') * 100.0 / NULLIF(COUNT(*), 0), 1) AS abstain_pct
  FROM votes v
  WHERE v.motion_id = p_motion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods            ENABLE ROW LEVEL SECURITY;
ALTER TABLE motions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE elections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_votes     ENABLE ROW LEVEL SECURITY;

-- Helper: Check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ----- PROFILES -----
CREATE POLICY "Profiles: viewable by all authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Profiles: users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Profiles: admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ----- SESSIONS (read-only for delegates, full for admins) -----
CREATE POLICY "Sessions: viewable by all authenticated"
  ON sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sessions: admin full control"
  ON sessions FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ----- PERIODS -----
CREATE POLICY "Periods: viewable by all authenticated"
  ON periods FOR SELECT TO authenticated USING (true);

CREATE POLICY "Periods: admin full control"
  ON periods FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ----- MOTIONS -----
CREATE POLICY "Motions: viewable by all authenticated"
  ON motions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Motions: delegates can insert their own (when period is active)"
  ON motions FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM periods
      WHERE id = period_id AND state = 'active'
    )
  );

CREATE POLICY "Motions: admin full control"
  ON motions FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ----- VOTES -----
CREATE POLICY "Votes: viewable by all authenticated"
  ON votes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Votes: delegates can insert their own vote"
  ON votes FOR INSERT TO authenticated
  WITH CHECK (voter_id = auth.uid());

-- No UPDATE/DELETE on votes — votes are immutable once cast

-- ----- ELECTIONS, POSITIONS, CANDIDATES (read for all, write for admin) -----
CREATE POLICY "Elections: viewable"
  ON elections FOR SELECT TO authenticated USING (true);

CREATE POLICY "Elections: admin control"
  ON elections FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Election Positions: viewable"
  ON election_positions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Election Positions: admin control"
  ON election_positions FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Candidates: viewable"
  ON candidates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Candidates: admin control"
  ON candidates FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ----- ELECTION VOTES -----
CREATE POLICY "Election Votes: viewable by admin only"
  ON election_votes FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "Election Votes: delegates vote for themselves"
  ON election_votes FOR INSERT TO authenticated
  WITH CHECK (voter_id = auth.uid());

-- ============================================================
-- 12. REALTIME PUBLICATION
-- ============================================================
-- Enable Supabase Realtime change events for live-updating tables
ALTER PUBLICATION supabase_realtime ADD TABLE periods;
ALTER PUBLICATION supabase_realtime ADD TABLE motions;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
