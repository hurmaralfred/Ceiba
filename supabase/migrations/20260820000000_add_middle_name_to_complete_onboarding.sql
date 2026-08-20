-- Frontend sends p_middle_name but the DB function lacked that parameter,
-- causing "function does not exist" on every new registration.
-- This migration adds p_middle_name and uses it throughout the function.

DROP FUNCTION IF EXISTS public.complete_onboarding(
    p_first_name     text,
    p_first_surname  text,
    p_second_surname text,
    p_birth_date     date,
    p_birth_city     text,
    p_birth_country  text,
    p_gender         text
);

CREATE OR REPLACE FUNCTION public.complete_onboarding(
    p_first_name     text,
    p_middle_name    text    DEFAULT NULL,
    p_first_surname  text    DEFAULT NULL,
    p_second_surname text    DEFAULT NULL,
    p_birth_date     date    DEFAULT NULL,
    p_birth_city     text    DEFAULT NULL,
    p_birth_country  text    DEFAULT NULL,
    p_gender         text    DEFAULT NULL
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
    v_norm_full      text;
    v_norm_core      text;
    v_candidates     jsonb   := '[]'::jsonb;
    v_candidate_count integer := 0;
    v_gender         text;
BEGIN
    --------------------------------------------------------------------------
    -- 1. Autenticación
    --------------------------------------------------------------------------
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
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

    v_display_name := btrim(regexp_replace(
        concat_ws(' ',
            trim(p_first_name),
            NULLIF(trim(p_middle_name), ''),
            trim(p_first_surname),
            NULLIF(trim(p_second_surname), '')
        ),
        '\s+', ' ', 'g'
    ));

    --------------------------------------------------------------------------
    -- Claves normalizadas (misma lógica que el trigger normalize_person_name)
    --------------------------------------------------------------------------
    v_norm_full := btrim(regexp_replace(
        public.immutable_unaccent(
            coalesce(trim(p_first_name),    '') || ' ' ||
            coalesce(NULLIF(trim(p_middle_name), ''), '') || ' ' ||
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
    DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now();

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
    ORDER BY pc.approved_at DESC NULLS LAST, pc.claimed_at ASC
    LIMIT 1;

    --------------------------------------------------------------------------
    -- 5. Sin identidad → buscar coincidencias en la base
    --------------------------------------------------------------------------
    IF v_person_id IS NULL THEN
        WITH exact_name_matches AS (
            SELECT p.id AS person_id, p.first_name, p.first_surname,
                   40::integer AS match_score,
                   jsonb_build_object('exact_full_name', true, 'source', 'exact_name') AS match_reasons
            FROM public.persons p
            WHERE p.deleted_at IS NULL AND p.status = 'active'
              AND btrim(regexp_replace(coalesce(p.normalized_full_name,''), '\s+', ' ', 'g')) = v_norm_full
        ),
        core_name_matches AS (
            SELECT p.id AS person_id, p.first_name, p.first_surname,
                   36::integer AS match_score,
                   jsonb_build_object('core_name_match', true, 'source', 'core_name') AS match_reasons
            FROM public.persons p
            WHERE p.deleted_at IS NULL AND p.status = 'active'
              AND v_norm_core <> ''
              AND btrim(regexp_replace(
                      public.immutable_unaccent(
                          coalesce(p.first_name,'') || ' ' || coalesce(p.first_surname,'')),
                      '\s+', ' ', 'g')) = v_norm_core
              AND NOT (btrim(regexp_replace(coalesce(p.normalized_full_name,''), '\s+', ' ', 'g')) = v_norm_full)
        ),
        scored_matches AS (
            SELECT m.person_id, m.first_name, m.first_surname, m.match_score,
                   m.match_reasons || jsonb_build_object('source', 'matching_engine') AS match_reasons
            FROM public.find_person_matches(
                trim(p_first_name), trim(p_first_surname),
                NULLIF(trim(p_second_surname), ''),
                p_birth_date,
                NULLIF(trim(p_birth_city), ''),
                NULLIF(trim(p_birth_country), ''),
                NULL, NULL, NULL
            ) m
        ),
        all_matches AS (
            SELECT * FROM exact_name_matches
            UNION ALL SELECT * FROM core_name_matches
            UNION ALL SELECT * FROM scored_matches
        ),
        deduplicated_matches AS (
            SELECT DISTINCT ON (am.person_id)
                am.person_id, am.first_name, am.first_surname, am.match_score, am.match_reasons
            FROM all_matches am
            ORDER BY am.person_id, am.match_score DESC
        ),
        enriched_matches AS (
            SELECT dm.person_id, dm.first_name, dm.first_surname, dm.match_score, dm.match_reasons,
                   p.second_surname, p.birth_date, p.birth_city, p.birth_country, p.public_id,
                   EXISTS (
                       SELECT 1 FROM public.person_claims pc
                       WHERE pc.person_id = dm.person_id AND pc.claim_status = 'approved'
                   ) AS already_claimed
            FROM deduplicated_matches dm
            JOIN public.persons p ON p.id = dm.person_id
        )
        SELECT
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'person_id',       em.person_id,
                        'public_id',       em.public_id,
                        'first_name',      em.first_name,
                        'first_surname',   em.first_surname,
                        'second_surname',  em.second_surname,
                        'birth_date',      em.birth_date,
                        'birth_city',      em.birth_city,
                        'birth_country',   em.birth_country,
                        'match_score',     em.match_score,
                        'match_reasons',   em.match_reasons,
                        'already_claimed', em.already_claimed,
                        'claimable',       NOT em.already_claimed
                    ) ORDER BY em.match_score DESC
                ),
                '[]'::jsonb
            ),
            count(*)::integer
        INTO v_candidates, v_candidate_count
        FROM enriched_matches em;

        -- 6. Bloquear si hay coincidencias
        IF v_candidate_count > 0 THEN
            RETURN jsonb_build_object(
                'success', false, 'onboarding_completed', false,
                'action', 'review_required',
                'message', 'Encontramos una persona que podría corresponder a tu identidad. Revísala antes de crear un registro nuevo.',
                'candidate_count', v_candidate_count,
                'candidates', v_candidates
            );
        END IF;

        -- 7. Crear persona nueva
        SELECT created.person_id, created.public_id
        INTO   v_person_id, v_public_id
        FROM   public.create_person(
            jsonb_strip_nulls(
                jsonb_build_object(
                    'first_name',           trim(p_first_name),
                    'middle_name',          NULLIF(trim(p_middle_name), ''),
                    'first_surname',        trim(p_first_surname),
                    'second_surname',       NULLIF(trim(p_second_surname), ''),
                    'birth_date',           p_birth_date,
                    'birth_city',           NULLIF(trim(p_birth_city), ''),
                    'birth_country',        NULLIF(trim(p_birth_country), ''),
                    'birth_date_precision', CASE WHEN p_birth_date IS NOT NULL THEN 'exact' ELSE 'unknown' END,
                    'gender',               COALESCE(v_gender, 'unknown'),
                    'is_deceased',          false
                )
            ),
            v_user_id
        ) AS created;

        IF v_person_id IS NULL THEN
            RAISE EXCEPTION 'No fue posible crear la persona.';
        END IF;

        -- 8. Crear claim
        INSERT INTO public.person_claims (person_id, user_id, claim_status, verification_method, approved_at)
        VALUES (v_person_id, v_user_id, 'approved', 'self_registration', now())
        ON CONFLICT (person_id, user_id)
        DO UPDATE SET
            claim_status        = 'approved',
            verification_method = 'self_registration',
            approved_at         = COALESCE(public.person_claims.approved_at, now()),
            revoked_at          = NULL;

    ELSE
        -- 9. Usuario con identidad existente: actualizar datos
        UPDATE public.persons
        SET
            first_name     = trim(p_first_name),
            middle_name    = NULLIF(trim(p_middle_name), ''),
            first_surname  = trim(p_first_surname),
            second_surname = NULLIF(trim(p_second_surname), ''),
            birth_date     = COALESCE(p_birth_date, birth_date),
            birth_city     = COALESCE(NULLIF(trim(p_birth_city), ''), birth_city),
            birth_country  = COALESCE(NULLIF(trim(p_birth_country), ''), birth_country),
            gender         = CASE
                WHEN v_gender IS NULL THEN gender
                WHEN gender IS NULL OR gender = 'unknown' THEN v_gender
                ELSE gender
            END,
            status     = 'active',
            updated_at = now()
        WHERE id = v_person_id;
    END IF;

    --------------------------------------------------------------------------
    -- 10. Reutilizar espacio del usuario
    --------------------------------------------------------------------------
    SELECT sur.space_id INTO v_space_id
    FROM   public.space_user_roles sur
    JOIN   public.family_spaces fs ON fs.id = sur.space_id
    WHERE  sur.user_id = v_user_id AND COALESCE(fs.status, 'active') = 'active'
    ORDER BY CASE sur.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'editor' THEN 3 ELSE 4 END, sur.created_at
    LIMIT 1;

    -- 11. Reutilizar espacio de la persona
    IF v_space_id IS NULL THEN
        SELECT sm.space_id INTO v_space_id
        FROM   public.space_memberships sm
        JOIN   public.family_spaces fs ON fs.id = sm.space_id
        WHERE  sm.person_id = v_person_id AND COALESCE(fs.status, 'active') = 'active'
        ORDER BY sm.created_at
        LIMIT 1;
    END IF;

    -- 12. Crear espacio si no existe
    IF v_space_id IS NULL THEN
        INSERT INTO public.family_spaces (name, root_person_id, created_by, visibility, status)
        VALUES ('Familia de ' || v_display_name, v_person_id, v_user_id, 'private', 'active')
        RETURNING id INTO v_space_id;
    ELSE
        UPDATE public.family_spaces
        SET root_person_id = COALESCE(root_person_id, v_person_id), updated_at = now()
        WHERE id = v_space_id;
    END IF;

    -- 13. Garantizar membresía
    INSERT INTO public.space_memberships (space_id, person_id, added_by)
    VALUES (v_space_id, v_person_id, v_user_id)
    ON CONFLICT (space_id, person_id) DO NOTHING;

    -- 14. Garantizar rol owner
    INSERT INTO public.space_user_roles (space_id, user_id, role)
    VALUES (v_space_id, v_user_id, 'owner')
    ON CONFLICT (space_id, user_id)
    DO UPDATE SET role = CASE WHEN public.space_user_roles.role = 'owner' THEN 'owner' ELSE EXCLUDED.role END;

    --------------------------------------------------------------------------
    -- 15. Respuesta
    --------------------------------------------------------------------------
    RETURN jsonb_build_object(
        'success', true,
        'person_id', v_person_id,
        'public_id', v_public_id,
        'space_id',  v_space_id,
        'role',      'owner',
        'onboarding_completed', true
    );
END;
$function$;
