-- Ensure every committee scope has a Deputy Secretary position.

-- Normalize legacy title first.
UPDATE election_positions
SET title = 'Deputy Secretary'
WHERE lower(trim(scope)) <> 'plenary'
  AND lower(trim(title)) IN ('deputy committee secretary', 'deputy secretary');

-- Insert missing Deputy Secretary rows using Committee Secretary scopes as the source of truth.
INSERT INTO election_positions (election_id, title, scope)
SELECT source.election_id, 'Deputy Secretary', source.scope
FROM election_positions AS source
WHERE lower(trim(source.scope)) <> 'plenary'
  AND lower(trim(source.title)) = 'committee secretary'
  AND NOT EXISTS (
    SELECT 1
    FROM election_positions AS existing
    WHERE existing.election_id = source.election_id
      AND lower(trim(existing.scope)) = lower(trim(source.scope))
      AND lower(trim(existing.title)) = 'deputy secretary'
  );
