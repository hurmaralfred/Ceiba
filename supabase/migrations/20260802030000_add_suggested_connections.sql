-- ─────────────────────────────────────────────────────────────────────────────
-- KINSHIP DISCOVERY  –  suggested_connections
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Tabla principal
CREATE TABLE IF NOT EXISTS public.suggested_connections (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id_a   uuid        NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  person_id_b   uuid        NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  space_id_a    uuid        NOT NULL REFERENCES public.family_spaces(id) ON DELETE CASCADE,
  space_id_b    uuid        NOT NULL REFERENCES public.family_spaces(id) ON DELETE CASCADE,
  score         numeric(4,3) NOT NULL CHECK (score >= 0 AND score <= 1),
  evidence      jsonb        NOT NULL DEFAULT '[]',
  status        text         NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','confirmed','dismissed')),
  confirmed_by  uuid        REFERENCES auth.users(id),
  dismissed_by  uuid        REFERENCES auth.users(id),
  created_at    timestamptz  DEFAULT now(),
  updated_at    timestamptz  DEFAULT now(),
  CONSTRAINT sc_no_self     CHECK (person_id_a <> person_id_b),
  CONSTRAINT sc_canonical   CHECK (person_id_a < person_id_b)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sc_unique_pair
  ON public.suggested_connections (person_id_a, person_id_b);

CREATE INDEX IF NOT EXISTS idx_sc_status  ON public.suggested_connections (status);
CREATE INDEX IF NOT EXISTS idx_sc_space_a ON public.suggested_connections (space_id_a);
CREATE INDEX IF NOT EXISTS idx_sc_space_b ON public.suggested_connections (space_id_b);

-- 2. RLS
ALTER TABLE public.suggested_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sc_select" ON public.suggested_connections
  FOR SELECT TO authenticated
  USING (
    space_id_a IN (SELECT space_id FROM public.space_user_roles WHERE user_id = auth.uid())
    OR
    space_id_b IN (SELECT space_id FROM public.space_user_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "sc_update" ON public.suggested_connections
  FOR UPDATE TO authenticated
  USING (
    space_id_a IN (SELECT space_id FROM public.space_user_roles WHERE user_id = auth.uid())
    OR
    space_id_b IN (SELECT space_id FROM public.space_user_roles WHERE user_id = auth.uid())
  );

-- 3. Función de matching  ─────────────────────────────────────────────────────
--
--    Scores:
--      Apellido compartido (token >3 chars)  → +0.38
--      Misma ciudad de nacimiento            → +0.22
--      Misma década de nacimiento (±10 años) → +0.13
--      Mismo país                            → +0.07
--    Umbral mínimo para emitir sugerencia    → 0.45
--
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
               AND lower(trim(city1)) = lower(trim(city2))   THEN 0.22 ELSE 0.0 END
        + CASE WHEN date1 IS NOT NULL AND date2 IS NOT NULL
               AND abs(date_part('year', date1::date)
                     - date_part('year', date2::date)) <= 10  THEN 0.13 ELSE 0.0 END
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
