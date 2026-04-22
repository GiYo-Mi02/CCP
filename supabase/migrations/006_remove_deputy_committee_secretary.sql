-- Normalize committee deputy secretary title.
UPDATE election_positions
SET title = 'Deputy Secretary'
WHERE lower(trim(scope)) <> 'plenary'
  AND lower(trim(title)) IN ('deputy committee secretary', 'deputy secretary');
