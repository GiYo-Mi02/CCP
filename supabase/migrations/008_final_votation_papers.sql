-- Store uploaded final votation paper PDF for each final_votation period.
CREATE TABLE final_votation_papers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id   UUID NOT NULL UNIQUE REFERENCES periods(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  mime_type   TEXT NOT NULL DEFAULT 'application/pdf',
  pdf_base64  TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE final_votation_papers IS 'Uploaded final ConCon paper used for delegate final votation.';
COMMENT ON COLUMN final_votation_papers.pdf_base64 IS 'Raw base64 of uploaded PDF, rendered inline as data URI on final votation pages.';

ALTER TABLE final_votation_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Final votation papers: viewable by all authenticated"
  ON final_votation_papers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Final votation papers: admin full control"
  ON final_votation_papers FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Add to realtime publication if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    WHERE p.pubname = 'supabase_realtime'
      AND c.relname = 'final_votation_papers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE final_votation_papers;
  END IF;
END
$$;
