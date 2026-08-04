-- Fix: complete_onboarding no detecta personas ya existentes al registrarse.
--
-- Causa raíz — dos divergencias entre el lookup y el índice:
--
--   1. FUNCIÓN DIFERENTE: complete_onboarding usa public.normalize_text()
--      para construir v_normalized_name. El trigger normalize_person_name usa
--      public.immutable_unaccent() para escribir persons.normalized_full_name.
--      Son funciones distintas: el índice y el lookup no comparan igual.
--
--   2. ESPACIOS INCONSISTENTES: el trigger concatena los 4 campos de nombre
--      con espacios literales ("first || ' ' || middle || ' ' || first_surname
--      || ' ' || second_surname"), produciendo dobles espacios cuando
--      middle_name es NULL. complete_onboarding usaba concat_ws que omite
--      NULLs → un espacio simple. La comparación exacta siempre fallaba.
--
-- Consecuencia real (producción): Enna Martinez Pineda fue agregada por
-- Alfredo vía add_relative (creó una fila en persons). Al registrarse ella
-- sola, complete_onboarding no encontró ninguna coincidencia y creó una SEGUNDA
-- fila en persons — dos registros idénticos y desconectados. Enna quedó con
-- 0 familiares aunque ya estaba en el árbol de Alfredo.
--
-- Este mismo error afecta a cualquier usuario que haya sido añadido como
-- familiar ANTES de registrarse.
--
-- Cambios en complete_onboarding:
--   1. v_norm_full ahora usa immutable_unaccent en el mismo formato de 4 campos
--      que el trigger normalize_person_name — es lo que ya hace add_relative.
--   2. v_norm_core = nombre + primer apellido (sin segundo nombre ni segundo
--      apellido), para detectar "Enna Martinez" ≈ "Enna Martinez Pineda".
--   3. exact_name_matches normaliza espacios en AMBOS lados con
--      btrim(regexp_replace(..., '\s+', ' ', 'g')) antes de comparar.
--   4. Se añade core_name_matches (confianza 0.90) para el caso nombre+1er
--      apellido igual pero segundo apellido ausente o diferente.
--   5. find_person_matches ya manejaba el caso difuso — se conserva sin cambio.
--
-- Reparación de datos:
--   Se detectan los pares duplicados existentes (mismo nombre normalizado,
--   uno reclamado, uno sin reclamar) y se fusionan: las relaciones y membresías
--   del duplicado sin reclamar se transfieren al registro reclamado, y el
--   duplicado queda marcado status='merged'. Esto repara el caso de Enna y
--   cualquier otro que esté en la misma situación.
--
-- NUNCA fusiona automáticamente dos registros ambos reclamados — ese caso
-- requiere decisión manual.

-- ============================================================
-- PARTE 1: reparación de datos — fusionar duplicados existentes
-- ============================================================

DO $$
DECLARE
    r_dup RECORD;
    v_claimed_id   uuid;
    v_duplicate_id uuid;
    rel_row        RECORD;
BEGIN
    -- Detecta pares: mismo nombre normalizado (tras normalizar espacios),
    -- uno con person_claim aprobado (el "canonical") y otro sin reclamar.
    -- Sólo fusiona si el canonical existe y el duplicado NO está reclamado.
    FOR r_dup IN
        WITH candidates AS (
            SELECT
                p.id,
                p.normalized_full_name,
                btrim(regexp_replace(
                    coalesce(p.normalized_full_name,''), '\s+', ' ', 'g'
                )) AS norm_ws,
                EXISTS (
                    SELECT 1 FROM public.person_claims pc
                    WHERE pc.person_id = p.id
                      AND pc.claim_status = 'approved'
                      AND pc.revoked_at IS NULL
                ) AS is_claimed
            FROM public.persons p
            WHERE p.deleted_at IS NULL
              AND p.status = 'active'
        ),
        pairs AS (
            SELECT
                a.id AS canonical_id,
                b.id AS duplicate_id,
                a.norm_ws
            FROM candidates a
            JOIN candidates b
              ON b.norm_ws = a.norm_ws
             AND b.id <> a.id
            WHERE a.is_claimed = true
              AND b.is_claimed = false
        )
        SELECT DISTINCT ON (p.canonical_id)
            p.canonical_id,
            p.duplicate_id,
            p.norm_ws
        FROM pairs p
        ORDER BY p.canonical_id, p.duplicate_id
    LOOP
        v_claimed_id   := r_dup.canonical_id;
        v_duplicate_id := r_dup.duplicate_id;

        RAISE NOTICE 'Fusionando duplicado % → canonical %  (nombre normalizado: %)',
            v_duplicate_id, v_claimed_id, r_dup.norm_ws;

        -- 1. Transferir relaciones donde el duplicado es person_a
        FOR rel_row IN
            SELECT r.id, r.person_b_id, r.relationship_type, r.relationship_status
            FROM public.relationships r
            WHERE r.person_a_id = v_duplicate_id
              AND r.deleted_at IS NULL
        LOOP
            -- Sólo transferir si no existe ya la misma relación en el canonical
            IF NOT EXISTS (
                SELECT 1 FROM public.relationships r2
                WHERE r2.person_a_id = v_claimed_id
                  AND r2.person_b_id = rel_row.person_b_id
                  AND r2.relationship_type = rel_row.relationship_type
                  AND r2.deleted_at IS NULL
            ) THEN
                UPDATE public.relationships
                SET person_a_id = v_claimed_id, updated_at = now()
                WHERE id = rel_row.id;
            ELSE
                -- Ya existe: marcar la del duplicado como borrada
                UPDATE public.relationships
                SET deleted_at = now(), updated_at = now()
                WHERE id = rel_row.id;
            END IF;
        END LOOP;

        -- 2. Transferir relaciones donde el duplicado es person_b
        FOR rel_row IN
            SELECT r.id, r.person_a_id, r.relationship_type, r.relationship_status
            FROM public.relationships r
            WHERE r.person_b_id = v_duplicate_id
              AND r.deleted_at IS NULL
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.relationships r2
                WHERE r2.person_a_id = rel_row.person_a_id
                  AND r2.person_b_id = v_claimed_id
                  AND r2.relationship_type = rel_row.relationship_type
                  AND r2.deleted_at IS NULL
            ) THEN
                UPDATE public.relationships
                SET person_b_id = v_claimed_id, updated_at = now()
                WHERE id = rel_row.id;
            ELSE
                UPDATE public.relationships
                SET deleted_at = now(), updated_at = now()
                WHERE id = rel_row.id;
            END IF;
        END LOOP;

        -- 3. Transferir membresías de espacio del duplicado al canonical
        --    (si ya pertenece al espacio, ON CONFLICT DO NOTHING es suficiente)
        INSERT INTO public.space_memberships (space_id, person_id, added_by)
        SELECT sm.space_id, v_claimed_id, sm.added_by
        FROM public.space_memberships sm
        WHERE sm.person_id = v_duplicate_id
        ON CONFLICT (space_id, person_id) DO NOTHING;

        -- Eliminar membresías antiguas del duplicado
        DELETE FROM public.space_memberships
        WHERE person_id = v_duplicate_id;

        -- 4. Si algún family_space tenía al duplicado como root, actualizar
        UPDATE public.family_spaces
        SET root_person_id = v_claimed_id, updated_at = now()
        WHERE root_person_id = v_duplicate_id;

        -- 5. Marcar el duplicado como fusionado
        UPDATE public.persons
        SET
            status     = 'merged',
            deleted_at = now(),
            updated_at = now()
        WHERE id = v_duplicate_id;

        RAISE NOTICE 'Fusión completada: % eliminado, relaciones transferidas a %',
            v_duplicate_id, v_claimed_id;
    END LOOP;
END;
$$;

-- ============================================================
-- PARTE 2: corregir complete_onboarding para que no vuelva
--          a crear duplicados en el futuro
-- ============================================================

-- Eliminar la sobrecarga existente antes de reemplazar
-- (misma firma de 7 parámetros — se recrea a continuación)
DROP FUNCTION IF EXISTS public.complete_onboarding(
    p_first_name    text,
    p_first_surname text,
    p_second_surname text,
    p_birth_date    date,
    p_birth_city    text,
    p_birth_country text,
    p_gender        text
);

CREATE OR REPLACE FUNCTION public.complete_onboarding(
    p_first_name     text,
    p_first_surname  text,
    p_second_surname text DEFAULT NULL,
    p_birth_date     date DEFAULT NULL,
    p_birth_city     text DEFAULT NULL,
    p_birth_country  text DEFAULT NULL,
    p_gender         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_user_id        uuid;
    v_person_id      uuid;
    v_public_id      text;
    v_space_id       uuid;
    v_display_name   text;

    -- Claves de búsqueda normalizadas con immutable_unaccent,
    -- la MISMA función que usa el trigger normalize_person_name para escribir
    -- persons.normalized_full_name — garantiza que la comparación sea igual
    -- a lo que está almacenado en la BD.
    v_norm_full      text;   -- 4 campos separados por espacio (como el trigger)
    v_norm_core      text;   -- nombre + primer apellido (sin segundo ni middle)

    v_candidates     jsonb   := '[]'::jsonb;
    v_candidate_count integer := 0;
    v_gender         text;
BEGIN
    --------------------------------------------------------------------------
    -- 1. Autenticación
    --------------------------------------------------------------------------
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    --------------------------------------------------------------------------
    -- 2. Validación básica
    --------------------------------------------------------------------------
    IF NULLIF(trim(p_first_name), '') IS NULL THEN
        RAISE EXCEPTION 'El nombre es obligatorio.';
    END IF;

    IF NULLIF(trim(p_first_surname), '') IS NULL THEN
        RAISE EXCEPTION 'El primer apellido es obligatorio.';
    END IF;

    IF p_gender IS NULL THEN
        v_gender := NULL;
    ELSE
        v_gender := lower(trim(p_gender));
        IF v_gender NOT IN ('male', 'female', 'unknown') THEN
            RAISE EXCEPTION 'Género inválido. Debe ser male, female o unknown.';
        END IF;
    END IF;

    v_display_name := concat_ws(
        ' ',
        trim(p_first_name),
        trim(p_first_surname),
        NULLIF(trim(p_second_surname), '')
    );

    --------------------------------------------------------------------------
    -- Claves normalizadas con la MISMA función que el trigger:
    --   trigger: immutable_unaccent(first || ' ' || middle || ' ' || first_surname || ' ' || second_surname)
    --   complete_onboarding no recibe middle_name → se deja vacío, igual que
    --   una persona creada sin ese campo. El btrim+regexp_replace normaliza
    --   los dobles espacios antes de comparar.
    --------------------------------------------------------------------------
    v_norm_full := btrim(regexp_replace(
        public.immutable_unaccent(
            coalesce(trim(p_first_name),    '') || ' ' ||
            ''                                          || ' ' ||  -- middle_name ausente
            coalesce(trim(p_first_surname), '') || ' ' ||
            coalesce(NULLIF(trim(p_second_surname), ''), '')
        ),
        '\s+', ' ', 'g'
    ));

    v_norm_core := btrim(regexp_replace(
        public.immutable_unaccent(
            coalesce(trim(p_first_name),    '') || ' ' ||
            coalesce(trim(p_first_surname), '')
        ),
        '\s+', ' ', 'g'
    ));

    --------------------------------------------------------------------------
    -- 3. Crear o actualizar perfil de usuario
    --------------------------------------------------------------------------
    INSERT INTO public.profiles (user_id, display_name)
    VALUES (v_user_id, v_display_name)
    ON CONFLICT (user_id)
    DO UPDATE SET
        display_name = EXCLUDED.display_name,
        updated_at   = now();

    --------------------------------------------------------------------------
    -- 4. Buscar identidad aprobada ya vinculada al usuario
    --------------------------------------------------------------------------
    SELECT pc.person_id, p.public_id
    INTO   v_person_id, v_public_id
    FROM   public.person_claims pc
    JOIN   public.persons p ON p.id = pc.person_id
    WHERE  pc.user_id        = v_user_id
      AND  pc.claim_status   = 'approved'
      AND  p.deleted_at      IS NULL
      AND  p.status          = 'active'
    ORDER BY
        pc.approved_at DESC NULLS LAST,
        pc.claimed_at  ASC
    LIMIT 1;

    --------------------------------------------------------------------------
    -- 5. Si el usuario todavía no tiene identidad, buscar coincidencias
    --------------------------------------------------------------------------
    IF v_person_id IS NULL THEN
        WITH exact_name_matches AS (
            -- Coincidencia exacta de nombre completo normalizado.
            -- Normaliza espacios en AMBOS lados antes de comparar:
            -- el trigger puede dejar dobles espacios cuando middle_name es NULL.
            SELECT
                p.id                                                 AS person_id,
                p.first_name,
                p.first_surname,
                40::integer                                          AS match_score,
                jsonb_build_object(
                    'exact_full_name',  true,
                    'normalized_name',  p.normalized_full_name,
                    'birth_date_match',
                        CASE WHEN p_birth_date IS NULL THEN NULL
                             ELSE p.birth_date = p_birth_date END,
                    'birth_city_match',
                        CASE WHEN NULLIF(trim(p_birth_city), '') IS NULL THEN NULL
                             ELSE p.birth_city ILIKE trim(p_birth_city) END,
                    'birth_country_match',
                        CASE WHEN NULLIF(trim(p_birth_country), '') IS NULL THEN NULL
                             ELSE p.birth_country ILIKE trim(p_birth_country) END,
                    'source', 'exact_name'
                )                                                    AS match_reasons
            FROM public.persons p
            WHERE p.deleted_at IS NULL
              AND p.status     = 'active'
              AND btrim(regexp_replace(
                      coalesce(p.normalized_full_name,''), '\s+', ' ', 'g'))
                  = v_norm_full
        ),
        core_name_matches AS (
            -- Mismo nombre + primer apellido, aunque difieran segundo nombre
            -- o segundo apellido (p.ej. alguien añadido solo con "Enna Martinez"
            -- y que se registra como "Enna Martinez Pineda").
            SELECT
                p.id                                                 AS person_id,
                p.first_name,
                p.first_surname,
                36::integer                                          AS match_score,
                jsonb_build_object(
                    'core_name_match', true,
                    'source', 'core_name'
                )                                                    AS match_reasons
            FROM public.persons p
            WHERE p.deleted_at IS NULL
              AND p.status     = 'active'
              AND v_norm_core  <> ''
              AND btrim(regexp_replace(
                      public.immutable_unaccent(
                          coalesce(p.first_name,'') || ' ' || coalesce(p.first_surname,'')
                      ),
                      '\s+', ' ', 'g'))
                  = v_norm_core
              -- Excluir los que ya salieron como exact_name para no duplicar
              AND NOT (
                  btrim(regexp_replace(
                      coalesce(p.normalized_full_name,''), '\s+', ' ', 'g'))
                  = v_norm_full
              )
        ),
        scored_matches AS (
            SELECT
                m.person_id,
                m.first_name,
                m.first_surname,
                m.match_score,
                m.match_reasons ||
                    jsonb_build_object('source', 'matching_engine') AS match_reasons
            FROM public.find_person_matches(
                trim(p_first_name),
                trim(p_first_surname),
                NULLIF(trim(p_second_surname), ''),
                p_birth_date,
                NULLIF(trim(p_birth_city), ''),
                NULLIF(trim(p_birth_country), ''),
                NULL, NULL, NULL
            ) m
        ),
        all_matches AS (
            SELECT * FROM exact_name_matches
            UNION ALL
            SELECT * FROM core_name_matches
            UNION ALL
            SELECT * FROM scored_matches
        ),
        deduplicated_matches AS (
            SELECT DISTINCT ON (am.person_id)
                am.person_id,
                am.first_name,
                am.first_surname,
                am.match_score,
                am.match_reasons
            FROM all_matches am
            ORDER BY am.person_id, am.match_score DESC
        ),
        enriched_matches AS (
            SELECT
                dm.person_id,
                dm.first_name,
                dm.first_surname,
                dm.match_score,
                dm.match_reasons,
                p.second_surname,
                p.birth_date,
                p.birth_city,
                p.birth_country,
                p.public_id,
                EXISTS (
                    SELECT 1 FROM public.person_claims pc
                    WHERE pc.person_id  = dm.person_id
                      AND pc.claim_status = 'approved'
                ) AS already_claimed
            FROM deduplicated_matches dm
            JOIN public.persons p ON p.id = dm.person_id
        )
        SELECT
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'person_id',      em.person_id,
                        'public_id',      em.public_id,
                        'first_name',     em.first_name,
                        'first_surname',  em.first_surname,
                        'second_surname', em.second_surname,
                        'birth_date',     em.birth_date,
                        'birth_city',     em.birth_city,
                        'birth_country',  em.birth_country,
                        'match_score',    em.match_score,
                        'match_reasons',  em.match_reasons,
                        'already_claimed', em.already_claimed,
                        'claimable',      NOT em.already_claimed
                    )
                    ORDER BY em.match_score DESC
                ),
                '[]'::jsonb
            ),
            count(*)::integer
        INTO v_candidates, v_candidate_count
        FROM enriched_matches em;

        ----------------------------------------------------------------------
        -- 6. Bloquear la creación cuando existen posibles coincidencias
        ----------------------------------------------------------------------
        IF v_candidate_count > 0 THEN
            RETURN jsonb_build_object(
                'success',             false,
                'onboarding_completed', false,
                'action',              'review_required',
                'message',
                    'Encontramos una persona que podría corresponder a tu identidad. Revísala antes de crear un registro nuevo.',
                'candidate_count',     v_candidate_count,
                'candidates',          v_candidates
            );
        END IF;

        ----------------------------------------------------------------------
        -- 7. Crear persona solamente cuando no existe coincidencia
        ----------------------------------------------------------------------
        SELECT created.person_id, created.public_id
        INTO   v_person_id, v_public_id
        FROM   public.create_person(
            jsonb_strip_nulls(
                jsonb_build_object(
                    'first_name',           trim(p_first_name),
                    'first_surname',        trim(p_first_surname),
                    'second_surname',       NULLIF(trim(p_second_surname), ''),
                    'birth_date',           p_birth_date,
                    'birth_city',           NULLIF(trim(p_birth_city), ''),
                    'birth_country',        NULLIF(trim(p_birth_country), ''),
                    'birth_date_precision',
                        CASE WHEN p_birth_date IS NOT NULL THEN 'exact' ELSE 'unknown' END,
                    'gender',               COALESCE(v_gender, 'unknown'),
                    'is_deceased',          false
                )
            ),
            v_user_id
        ) AS created;

        IF v_person_id IS NULL THEN
            RAISE EXCEPTION 'No fue posible crear la persona.';
        END IF;

        ----------------------------------------------------------------------
        -- 8. Crear claim de la nueva persona
        ----------------------------------------------------------------------
        INSERT INTO public.person_claims (
            person_id,
            user_id,
            claim_status,
            verification_method,
            approved_at
        )
        VALUES (
            v_person_id,
            v_user_id,
            'approved',
            'self_registration',
            now()
        )
        ON CONFLICT (person_id, user_id)
        DO UPDATE SET
            claim_status        = 'approved',
            verification_method = 'self_registration',
            approved_at         = COALESCE(public.person_claims.approved_at, now()),
            revoked_at          = NULL;

    ELSE
        ----------------------------------------------------------------------
        -- 9. El usuario ya tiene identidad: completar datos faltantes
        ----------------------------------------------------------------------
        UPDATE public.persons
        SET
            first_name      = trim(p_first_name),
            first_surname   = trim(p_first_surname),
            second_surname  = NULLIF(trim(p_second_surname), ''),
            birth_date      = COALESCE(p_birth_date, birth_date),
            birth_city      = COALESCE(NULLIF(trim(p_birth_city), ''), birth_city),
            birth_country   = COALESCE(NULLIF(trim(p_birth_country), ''), birth_country),
            gender          = CASE
                WHEN v_gender IS NULL              THEN gender
                WHEN gender IS NULL OR gender = 'unknown' THEN v_gender
                ELSE gender
            END,
            status          = 'active',
            updated_at      = now()
        WHERE id = v_person_id;
    END IF;

    --------------------------------------------------------------------------
    -- 10. Reutilizar espacio controlado por el usuario
    --------------------------------------------------------------------------
    SELECT sur.space_id
    INTO   v_space_id
    FROM   public.space_user_roles sur
    JOIN   public.family_spaces fs ON fs.id = sur.space_id
    WHERE  sur.user_id = v_user_id
      AND  COALESCE(fs.status, 'active') = 'active'
    ORDER BY
        CASE sur.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'editor' THEN 3 ELSE 4 END,
        sur.created_at
    LIMIT 1;

    --------------------------------------------------------------------------
    -- 11. Reutilizar espacio al que ya pertenece la persona
    --------------------------------------------------------------------------
    IF v_space_id IS NULL THEN
        SELECT sm.space_id
        INTO   v_space_id
        FROM   public.space_memberships sm
        JOIN   public.family_spaces fs ON fs.id = sm.space_id
        WHERE  sm.person_id = v_person_id
          AND  COALESCE(fs.status, 'active') = 'active'
        ORDER BY sm.created_at
        LIMIT 1;
    END IF;

    --------------------------------------------------------------------------
    -- 12. Crear espacio cuando todavía no existe
    --------------------------------------------------------------------------
    IF v_space_id IS NULL THEN
        INSERT INTO public.family_spaces (
            name,
            root_person_id,
            created_by,
            visibility,
            status
        )
        VALUES (
            'Familia de ' || v_display_name,
            v_person_id,
            v_user_id,
            'private',
            'active'
        )
        RETURNING id INTO v_space_id;
    ELSE
        UPDATE public.family_spaces
        SET
            root_person_id = COALESCE(root_person_id, v_person_id),
            updated_at     = now()
        WHERE id = v_space_id;
    END IF;

    --------------------------------------------------------------------------
    -- 13. Garantizar membresía de la persona
    --------------------------------------------------------------------------
    INSERT INTO public.space_memberships (space_id, person_id, added_by)
    VALUES (v_space_id, v_person_id, v_user_id)
    ON CONFLICT (space_id, person_id) DO NOTHING;

    --------------------------------------------------------------------------
    -- 14. Garantizar rol del usuario
    --------------------------------------------------------------------------
    INSERT INTO public.space_user_roles (space_id, user_id, role)
    VALUES (v_space_id, v_user_id, 'owner')
    ON CONFLICT (space_id, user_id)
    DO UPDATE SET
        role = CASE
            WHEN public.space_user_roles.role = 'owner' THEN 'owner'
            ELSE EXCLUDED.role
        END;

    --------------------------------------------------------------------------
    -- 15. Respuesta final
    --------------------------------------------------------------------------
    RETURN jsonb_build_object(
        'success',              true,
        'person_id',            v_person_id,
        'public_id',            v_public_id,
        'space_id',             v_space_id,
        'role',                 'owner',
        'onboarding_completed', true
    );
END;
$function$;
