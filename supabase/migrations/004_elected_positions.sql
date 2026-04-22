-- Track election-awarded offices on delegate profiles.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS elected_positions TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN profiles.elected_positions IS 'Current elected plenary/committee positions awarded after majority election results.';
