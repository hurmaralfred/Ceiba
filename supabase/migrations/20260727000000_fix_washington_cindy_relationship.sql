-- Fix Washington-Cindy relationship connectivity
-- Problem: Washington shows only connected to Joselin, not to Cindy
-- Cause: Relationship is likely inverted (Cindy->Washington) or deleted
-- Solution: Identify exact state and correct the relationship direction

-- 1. Find Washington and Cindy person IDs
WITH people AS (
  SELECT
    (SELECT id FROM persons WHERE first_names ILIKE '%washington%' ORDER BY created_at LIMIT 1) as washington_id,
    (SELECT id FROM persons WHERE first_names ILIKE '%cindy%' ORDER BY created_at LIMIT 1) as cindy_id
)

-- 2. Soft-delete any inverted relationships (Cindy->Washington as parent)
UPDATE relationships r
SET deleted_at = NOW()
WHERE r.person_a_id = (SELECT cindy_id FROM people)
  AND r.person_b_id = (SELECT washington_id FROM people)
  AND r.relationship_type = 'parent'
  AND r.deleted_at IS NULL;

-- 3. Restore the correct relationship if it was deleted
WITH people AS (
  SELECT
    (SELECT id FROM persons WHERE first_names ILIKE '%washington%' ORDER BY created_at LIMIT 1) as washington_id,
    (SELECT id FROM persons WHERE first_names ILIKE '%cindy%' ORDER BY created_at LIMIT 1) as cindy_id
)
UPDATE relationships r
SET deleted_at = NULL
WHERE r.person_a_id = (SELECT washington_id FROM people)
  AND r.person_b_id = (SELECT cindy_id FROM people)
  AND r.relationship_type = 'parent'
  AND r.deleted_at IS NOT NULL;

-- 4. Create the relationship if it doesn't exist
WITH people AS (
  SELECT
    (SELECT id FROM persons WHERE first_names ILIKE '%washington%' ORDER BY created_at LIMIT 1) as washington_id,
    (SELECT id FROM persons WHERE first_names ILIKE '%cindy%' ORDER BY created_at LIMIT 1) as cindy_id
),
must_create AS (
  SELECT COUNT(*) = 0 as should_create
  FROM relationships r
  WHERE r.person_a_id = (SELECT washington_id FROM people)
    AND r.person_b_id = (SELECT cindy_id FROM people)
    AND r.relationship_type = 'parent'
    AND r.deleted_at IS NULL
)
INSERT INTO relationships (person_a_id, person_b_id, relationship_type, created_at)
SELECT p.washington_id, p.cindy_id, 'parent', NOW()
FROM people p, must_create mc
WHERE mc.should_create;
