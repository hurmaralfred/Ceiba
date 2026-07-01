-- ═══════════════════════════════════════════════════════════════════════════════
-- CEIBA — Limpiar filas duplicadas en family_members
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. VER los duplicados ANTES de borrar (para verificar)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  fm.added_by,
  p.first_name || ' ' || coalesce(p.last_name,'') AS adder_name,
  fm.profile_id,
  count(*) AS num_rows,
  string_agg(fm.id::text, ', ') AS row_ids,
  string_agg(fm.first_name || ' ' || coalesce(fm.last_name,''), ' | ') AS stored_names
FROM family_members fm
JOIN profiles p ON p.id = fm.added_by
WHERE fm.profile_id IS NOT NULL
GROUP BY fm.added_by, p.first_name, p.last_name, fm.profile_id
HAVING count(*) > 1
ORDER BY adder_name;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. BORRAR los duplicados (guarda solo el más completo por added_by+profile_id)
--    "Más completo" = el que tiene last_name, o si igual, el más reciente (id mayor)
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM family_members
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY added_by, profile_id
        ORDER BY
          (last_name IS NOT NULL AND last_name <> '') DESC,  -- prefer rows with last_name
          created_at DESC NULLS LAST,                         -- then most recent
          id DESC                                             -- then higher id
      ) AS rn
    FROM family_members
    WHERE profile_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VERIFICAR que no queden duplicados
-- ─────────────────────────────────────────────────────────────────────────────
SELECT count(*) AS duplicates_remaining
FROM (
  SELECT added_by, profile_id, count(*) AS cnt
  FROM family_members
  WHERE profile_id IS NOT NULL
  GROUP BY added_by, profile_id
  HAVING count(*) > 1
) t;
-- Debe devolver 0
