-- Add election/session tables to Supabase Realtime publication.
-- Guarded to avoid duplicate-table publication errors.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    WHERE p.pubname = 'supabase_realtime'
      AND c.relname = 'sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    WHERE p.pubname = 'supabase_realtime'
      AND c.relname = 'elections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE elections;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    WHERE p.pubname = 'supabase_realtime'
      AND c.relname = 'election_positions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE election_positions;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    WHERE p.pubname = 'supabase_realtime'
      AND c.relname = 'candidates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE candidates;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    WHERE p.pubname = 'supabase_realtime'
      AND c.relname = 'election_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE election_votes;
  END IF;
END
$$;
