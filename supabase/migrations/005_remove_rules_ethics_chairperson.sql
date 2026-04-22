-- Remove non-elective Rules, Ethics and Privileges chairperson entries from election positions.
DELETE FROM election_positions
WHERE lower(trim(scope)) = 'rules, ethics and privileges'
  AND lower(trim(title)) IN ('committee chair', 'committee chairperson', 'chairperson');
