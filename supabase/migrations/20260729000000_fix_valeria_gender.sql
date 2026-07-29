-- Fix: set gender = 'female' for Valeria Inés Pertuz Urueta.
--
-- Root cause: when she was added as the partner of the son (Alfredo Hurtado
-- Alarcon, 51d9086e-...), the add-relative form did not capture gender for
-- partner relations. persons.gender was stored as NULL.
-- resolveRelationsFromRoot calls applyGenderToRelation("son_in_law", null)
-- which returns "son_in_law" unchanged → RELATION_LABELS shows "Yerno".
--
-- After this migration:
--   applyGenderToRelation("son_in_law", "female") → "daughter_in_law"
--   RELATION_LABELS["daughter_in_law"] → "Nuera" ✓
--
-- Identification: Valeria is person_b_id of the relationship
--   c5cc47b6-72bb-44a9-abd6-97f1da8566ea  (51d9086e -> Valeria, partner)
-- which was verified active on 2026-07-27 in docs/repair/20260726_merge_duplicate_persons_alfredo.sql.
--
-- Idempotent: no-op if gender is already 'female'.

UPDATE public.persons p
SET    gender     = 'female',
       updated_at = now()
FROM   public.relationships r
WHERE  r.id            = 'c5cc47b6-72bb-44a9-abd6-97f1da8566ea'
  AND  r.deleted_at    IS NULL
  AND  p.id            = r.person_b_id
  AND  p.deleted_at    IS NULL
  AND  (p.gender IS NULL OR p.gender NOT IN ('female', 'f', 'femenina', 'mujer'));
