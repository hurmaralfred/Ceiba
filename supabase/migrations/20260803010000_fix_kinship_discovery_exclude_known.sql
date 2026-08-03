-- ─────────────────────────────────────────────────────────────────────────────
-- Fix run_kinship_discovery: exclude pairs that are already connected in Ceiba
--
-- Two exclusion layers:
--   1. Shared space  — both persons are already members of the same family_space
--   2. Tree hops     — they are connected within 3 hops via public.relationships
--      (parent, sibling, uncle/nephew, cousin, grandparent, spouse's parent, etc.)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.run_kinship_discovery()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted int := 0;
BEGIN
  WITH candidates AS (
    SELECT DISTINCT ON (
      CASE WHEN p1.id < p2.id THEN p1.id ELSE p2.id END,
      CASE WHEN p1.id < p2.id THEN p2.id ELSE p1.id END
    )
      CASE WHEN p1.id < p2.id THEN p1.id      ELSE p2.id      END AS pid_a,
      CASE WHEN p1.id < p2.id THEN p2.id      ELSE p1.id      END AS pid_b,
      CASE WHEN p1.id < p2.id THEN sm1.space_id ELSE sm2.space_id END AS sid_a,
      CASE WHEN p1.id < p2.id THEN sm2.space_id ELSE sm1.space_id END AS sid_b,
      p1.first_surname  AS fs1,
      p1.second_surname AS ss1,
      p2.first_surname  AS fs2,
      p2.second_surname AS ss2,
      p1.birth_city     AS city1,
      p2.birth_city     AS city2,
      p1.birth_country  AS country1,
      p2.birth_country  AS country2,
      p1.birth_date     AS date1,
      p2.birth_date     AS date2
    FROM public.persons p1
    JOIN public.space_memberships sm1 ON sm1.person_id = p1.id
    JOIN public.persons           p2  ON p2.id > p1.id
                                      AND p2.deleted_at IS NULL
    JOIN public.space_memberships sm2 ON sm2.person_id  = p2.id
                                      AND sm2.space_id <> sm1.space_id
    WHERE
      p1.deleted_at IS NULL

      -- ── Layer 1: exclude pairs that already share ANY family_space ──────────
      -- (covers: both in the same tree, even via a different membership row)
      AND NOT EXISTS (
        SELECT 1
        FROM public.space_memberships sx
        JOIN public.space_memberships sy
          ON sy.space_id = sx.space_id
         AND sy.person_id = p2.id
        WHERE sx.person_id = p1.id
      )

      -- ── Layer 2: exclude pairs connected ≤ 3 hops in the tree ──────────────
      -- (covers: parent/child, sibling, uncle/nephew, cousin, spouse chains)
      AND NOT EXISTS (
        WITH RECURSIVE near_relatives AS (
          -- seed: the person itself
          SELECT p1.id AS pid, 0 AS depth
          UNION ALL
          -- traverse one relationship edge at a time
          SELECT
            CASE WHEN r.person_a_id = nr.pid
                 THEN r.person_b_id
                 ELSE r.person_a_id END,
            nr.depth + 1
          FROM near_relatives nr
          JOIN public.relationships r
            ON (r.person_a_id = nr.pid OR r.person_b_id = nr.pid)
           AND (r.deleted_at IS NULL OR r.deleted_at > now())
          WHERE nr.depth < 3
        )
        SELECT 1 FROM near_relatives WHERE pid = p2.id
      )

      -- ── Surname token overlap (required gate) ─────────────────────────────
      AND EXISTS (
        SELECT 1
        FROM
          unnest(string_to_array(lower(trim(
            coalesce(p1.first_surname,'') || ' ' || coalesce(p1.second_surname,'')
          )), ' ')) t1(tok)
          CROSS JOIN
          unnest(string_to_array(lower(trim(
            coalesce(p2.first_surname,'') || ' ' || coalesce(p2.second_surname,'')
          )), ' ')) t2(tok)
        WHERE t1.tok = t2.tok AND length(t1.tok) > 3
      )
    ORDER BY
      CASE WHEN p1.id < p2.id THEN p1.id ELSE p2.id END,
      CASE WHEN p1.id < p2.id THEN p2.id ELSE p1.id END
  ),
  scored AS (
    SELECT
      pid_a, pid_b, sid_a, sid_b,
      (
        0.38
        + CASE WHEN city1 IS NOT NULL AND city2 IS NOT NULL
               AND lower(trim(city1)) = lower(trim(city2))    THEN 0.22 ELSE 0.0 END
        + CASE WHEN date1 IS NOT NULL AND date2 IS NOT NULL
               AND abs(date_part('year', date1::date)
                     - date_part('year', date2::date)) <= 10   THEN 0.13 ELSE 0.0 END
        + CASE WHEN country1 IS NOT NULL AND country2 IS NOT NULL
               AND lower(trim(country1)) = lower(trim(country2)) THEN 0.07 ELSE 0.0 END
      )::numeric(4,3) AS score,
      (
        SELECT jsonb_agg(e ORDER BY (e->>'weight')::numeric DESC)
        FROM (
          SELECT jsonb_build_object(
            'type', 'surname', 'weight', 0.38,
            'detail', (
              SELECT t1.tok
              FROM
                unnest(string_to_array(lower(trim(
                  coalesce(fs1,'') || ' ' || coalesce(ss1,'')
                )), ' ')) t1(tok)
                CROSS JOIN
                unnest(string_to_array(lower(trim(
                  coalesce(fs2,'') || ' ' || coalesce(ss2,'')
                )), ' ')) t2(tok)
              WHERE t1.tok = t2.tok AND length(t1.tok) > 3
              LIMIT 1
            )
          ) AS e
          UNION ALL
          SELECT jsonb_build_object('type','birth_city','weight',0.22,'detail',city1)
          WHERE city1 IS NOT NULL AND city2 IS NOT NULL
            AND lower(trim(city1)) = lower(trim(city2))
          UNION ALL
          SELECT jsonb_build_object('type','birth_decade','weight',0.13,
            'detail', date_part('year', date1::date)::int::text
                    || '–'
                    || date_part('year', date2::date)::int::text)
          WHERE date1 IS NOT NULL AND date2 IS NOT NULL
            AND abs(date_part('year', date1::date)
                  - date_part('year', date2::date)) <= 10
          UNION ALL
          SELECT jsonb_build_object('type','birth_country','weight',0.07,'detail',country1)
          WHERE country1 IS NOT NULL AND country2 IS NOT NULL
            AND lower(trim(country1)) = lower(trim(country2))
        ) sub
      ) AS evidence
    FROM candidates
  )
  INSERT INTO public.suggested_connections
    (person_id_a, person_id_b, space_id_a, space_id_b, score, evidence)
  SELECT pid_a, pid_b, sid_a, sid_b, score, coalesce(evidence, '[]')
  FROM scored
  WHERE score >= 0.45
  ON CONFLICT (person_id_a, person_id_b) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN jsonb_build_object('inserted', v_inserted, 'ran_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_kinship_discovery() TO service_role;

-- ─── Also purge existing suggestions between already-connected persons ─────────
-- Marks them dismissed so they don't appear in the feed while we wait for
-- the next cron run to refresh with clean data.
UPDATE public.suggested_connections
SET status = 'dismissed', updated_at = now()
WHERE status = 'pending'
  AND (
    -- shared space
    EXISTS (
      SELECT 1
      FROM public.space_memberships sx
      JOIN public.space_memberships sy
        ON sy.space_id = sx.space_id
       AND sy.person_id = suggested_connections.person_id_b
      WHERE sx.person_id = suggested_connections.person_id_a
    )
    OR
    -- already related within 3 hops
    EXISTS (
      WITH RECURSIVE near_relatives AS (
        SELECT suggested_connections.person_id_a AS pid, 0 AS depth
        UNION ALL
        SELECT
          CASE WHEN r.person_a_id = nr.pid THEN r.person_b_id ELSE r.person_a_id END,
          nr.depth + 1
        FROM near_relatives nr
        JOIN public.relationships r
          ON (r.person_a_id = nr.pid OR r.person_b_id = nr.pid)
         AND (r.deleted_at IS NULL OR r.deleted_at > now())
        WHERE nr.depth < 3
      )
      SELECT 1 FROM near_relatives WHERE pid = suggested_connections.person_id_b
    )
  );
