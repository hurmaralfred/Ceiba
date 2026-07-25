-- Fix: complete_onboarding debe recibir y persistir el género del onboarding.
--
-- Contexto: el onboarding no capturaba el género de la persona, así que
-- create_person siempre insertaba 'gender': 'unknown' y la identidad
-- reclamada nunca se corregía. Sin este dato, las etiquetas familiares
-- (Esposo/Esposa, Abuelo/Abuela, etc.) dependen de un campo vacío.
--
-- IMPORTANTE — incidente evitado durante esta migración: un primer intento
-- de CREATE OR REPLACE con una firma distinta (parámetro nuevo) NO reemplazó
-- la función existente — creó una SEGUNDA sobrecarga, dejando ambas activas
-- y produciendo PGRST203 (ambigüedad) en la llamada real de producción
-- (que pasa los 6 parámetros de siempre, sin p_gender). Se corrigió
-- eliminando la sobrecarga vieja de 6 parámetros; esta migración ya
-- documenta el estado final correcto, con UNA sola función de 7 parámetros.
--
-- Cambios respecto a la versión anterior (solo adiciones):
--   1. Nuevo parámetro `p_gender text DEFAULT NULL` — opcional, para no
--      romper ninguna llamada existente que no lo envíe.
--   2. Si se envía, se valida contra ('male','female','unknown'); cualquier
--      otro valor lanza excepción. Si no se envía, el comportamiento es
--      IDÉNTICO al anterior.
--   3. Persona nueva: 'gender' usa COALESCE(v_gender, 'unknown') — mismo
--      valor por defecto que antes cuando no se envía género.
--   4. Identidad ya reclamada por el mismo usuario (re-onboarding): el
--      onboarding solo puede COMPLETAR un género vacío (NULL o 'unknown');
--      nunca sobrescribe uno ya definido (male/female). No es un backfill de
--      personas ajenas, es la propia identidad del usuario autenticado
--      completando su propio registro — y aun así, cambiar un género ya
--      definido requiere una edición de perfil explícita, no un efecto
--      secundario de volver a pasar por el onboarding.
--
-- Se conserva sin cambios: validaciones de nombre, matching, creación o
-- reclamación de persona, creación del espacio familiar, membresías, roles
-- y la forma del valor de retorno.

-- Elimina la sobrecarga vieja de 6 parámetros ANTES de crear la de 7: un
-- CREATE OR REPLACE con una lista de parámetros distinta no reemplaza una
-- función existente, crea una sobrecarga nueva. Sin este DROP, aplicar esta
-- migración en un entorno limpio reproduciría el mismo PGRST203.
DROP FUNCTION IF EXISTS public.complete_onboarding(
    p_first_name text,
    p_first_surname text,
    p_second_surname text,
    p_birth_date date,
    p_birth_city text,
    p_birth_country text
);

CREATE OR REPLACE FUNCTION public.complete_onboarding(p_first_name text, p_first_surname text, p_second_surname text DEFAULT NULL::text, p_birth_date date DEFAULT NULL::date, p_birth_city text DEFAULT NULL::text, p_birth_country text DEFAULT NULL::text, p_gender text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_user_id uuid;
    v_person_id uuid;
    v_public_id text;
    v_space_id uuid;
    v_display_name text;
    v_normalized_name text;
    v_candidates jsonb := '[]'::jsonb;
    v_candidate_count integer := 0;
    v_gender text;
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

    -- Género: opcional por compatibilidad con llamadas previas al onboarding
    -- (se comportan igual que antes, con 'unknown'). Si se envía un valor,
    -- debe ser uno de los tres que ofrece el formulario.
    IF p_gender IS NULL THEN
        v_gender := NULL;
    ELSE
        v_gender := lower(trim(p_gender));

        IF v_gender NOT IN ('male', 'female', 'unknown') THEN
            RAISE EXCEPTION
                'Género inválido. Debe ser male, female o unknown.';
        END IF;
    END IF;

    v_display_name := concat_ws(
        ' ',
        trim(p_first_name),
        trim(p_first_surname),
        NULLIF(trim(p_second_surname), '')
    );

    v_normalized_name := public.normalize_text(v_display_name);

    --------------------------------------------------------------------------
    -- 3. Crear o actualizar perfil de usuario
    --------------------------------------------------------------------------
    INSERT INTO public.profiles (
        user_id,
        display_name
    )
    VALUES (
        v_user_id,
        v_display_name
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        display_name = EXCLUDED.display_name,
        updated_at = now();

    --------------------------------------------------------------------------
    -- 4. Buscar identidad aprobada ya vinculada al usuario
    --------------------------------------------------------------------------
    SELECT
        pc.person_id,
        p.public_id
    INTO
        v_person_id,
        v_public_id
    FROM public.person_claims pc
    JOIN public.persons p
        ON p.id = pc.person_id
    WHERE pc.user_id = v_user_id
      AND pc.claim_status = 'approved'
      AND p.deleted_at IS NULL
      AND p.status = 'active'
    ORDER BY
        pc.approved_at DESC NULLS LAST,
        pc.claimed_at ASC
    LIMIT 1;

    --------------------------------------------------------------------------
    -- 5. Si el usuario todavía no tiene identidad, buscar coincidencias
    --------------------------------------------------------------------------
    IF v_person_id IS NULL THEN
        WITH exact_name_matches AS (
            SELECT
                p.id AS person_id,
                p.first_name,
                p.first_surname,
                40::integer AS match_score,
                jsonb_build_object(
                    'exact_full_name', true,
                    'normalized_name', p.normalized_full_name,
                    'birth_date_match',
                        CASE
                            WHEN p_birth_date IS NULL THEN NULL
                            ELSE p.birth_date = p_birth_date
                        END,
                    'birth_city_match',
                        CASE
                            WHEN NULLIF(trim(p_birth_city), '') IS NULL THEN NULL
                            ELSE p.birth_city ILIKE trim(p_birth_city)
                        END,
                    'birth_country_match',
                        CASE
                            WHEN NULLIF(trim(p_birth_country), '') IS NULL THEN NULL
                            ELSE p.birth_country ILIKE trim(p_birth_country)
                        END,
                    'source', 'exact_name'
                ) AS match_reasons
            FROM public.persons p
            WHERE p.deleted_at IS NULL
              AND p.status = 'active'
              AND p.normalized_full_name = v_normalized_name
        ),
        scored_matches AS (
            SELECT
                m.person_id,
                m.first_name,
                m.first_surname,
                m.match_score,
                m.match_reasons ||
                    jsonb_build_object('source', 'matching_engine')
                    AS match_reasons
            FROM public.find_person_matches(
                trim(p_first_name),
                trim(p_first_surname),
                NULLIF(trim(p_second_surname), ''),
                p_birth_date,
                NULLIF(trim(p_birth_city), ''),
                NULLIF(trim(p_birth_country), ''),
                NULL,
                NULL,
                NULL
            ) m
        ),
        all_matches AS (
            SELECT * FROM exact_name_matches
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
            ORDER BY
                am.person_id,
                am.match_score DESC
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
                    SELECT 1
                    FROM public.person_claims pc
                    WHERE pc.person_id = dm.person_id
                      AND pc.claim_status = 'approved'
                ) AS already_claimed
            FROM deduplicated_matches dm
            JOIN public.persons p
                ON p.id = dm.person_id
        )
        SELECT
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'person_id', em.person_id,
                        'public_id', em.public_id,
                        'first_name', em.first_name,
                        'first_surname', em.first_surname,
                        'second_surname', em.second_surname,
                        'birth_date', em.birth_date,
                        'birth_city', em.birth_city,
                        'birth_country', em.birth_country,
                        'match_score', em.match_score,
                        'match_reasons', em.match_reasons,
                        'already_claimed', em.already_claimed,
                        'claimable', NOT em.already_claimed
                    )
                    ORDER BY em.match_score DESC
                ),
                '[]'::jsonb
            ),
            count(*)::integer
        INTO
            v_candidates,
            v_candidate_count
        FROM enriched_matches em;

        ----------------------------------------------------------------------
        -- 6. Bloquear la creación cuando existen posibles coincidencias
        ----------------------------------------------------------------------
        IF v_candidate_count > 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'onboarding_completed', false,
                'action', 'review_required',
                'message',
                    'Encontramos una persona que podría corresponder a tu identidad. Revísala antes de crear un registro nuevo.',
                'candidate_count', v_candidate_count,
                'candidates', v_candidates
            );
        END IF;

        ----------------------------------------------------------------------
        -- 7. Crear persona solamente cuando no existe coincidencia
        ----------------------------------------------------------------------
        SELECT
            created.person_id,
            created.public_id
        INTO
            v_person_id,
            v_public_id
        FROM public.create_person(
            jsonb_strip_nulls(
                jsonb_build_object(
                    'first_name', trim(p_first_name),
                    'first_surname', trim(p_first_surname),
                    'second_surname',
                        NULLIF(trim(p_second_surname), ''),
                    'birth_date', p_birth_date,
                    'birth_city',
                        NULLIF(trim(p_birth_city), ''),
                    'birth_country',
                        NULLIF(trim(p_birth_country), ''),
                    'birth_date_precision',
                        CASE
                            WHEN p_birth_date IS NOT NULL THEN 'exact'
                            ELSE 'unknown'
                        END,
                    'gender', COALESCE(v_gender, 'unknown'),
                    'is_deceased', false
                )
            ),
            v_user_id
        ) AS created;

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
            claim_status = 'approved',
            verification_method = 'self_registration',
            approved_at = COALESCE(
                public.person_claims.approved_at,
                now()
            ),
            revoked_at = NULL;

    ELSE
        ----------------------------------------------------------------------
        -- 9. El usuario ya tiene identidad: completar datos faltantes
        ----------------------------------------------------------------------
        UPDATE public.persons
        SET
            first_name = trim(p_first_name),
            first_surname = trim(p_first_surname),
            second_surname = NULLIF(trim(p_second_surname), ''),
            birth_date = COALESCE(p_birth_date, birth_date),
            birth_city = COALESCE(
                NULLIF(trim(p_birth_city), ''),
                birth_city
            ),
            birth_country = COALESCE(
                NULLIF(trim(p_birth_country), ''),
                birth_country
            ),
            -- El onboarding solo puede COMPLETAR un género vacío/no declarado
            -- (NULL o 'unknown'); nunca sobrescribe uno ya definido
            -- (male/female). Cambiar un género ya definido es una acción de
            -- edición de perfil explícita, no un efecto secundario de
            -- volver a pasar por el onboarding.
            gender = CASE
                WHEN v_gender IS NULL THEN gender
                WHEN gender IS NULL OR gender = 'unknown' THEN v_gender
                ELSE gender
            END,
            status = 'active',
            updated_at = now()
        WHERE id = v_person_id;
    END IF;

    --------------------------------------------------------------------------
    -- 10. Reutilizar espacio controlado por el usuario
    --------------------------------------------------------------------------
    SELECT sur.space_id
    INTO v_space_id
    FROM public.space_user_roles sur
    JOIN public.family_spaces fs
        ON fs.id = sur.space_id
    WHERE sur.user_id = v_user_id
      AND COALESCE(fs.status, 'active') = 'active'
    ORDER BY
        CASE sur.role
            WHEN 'owner' THEN 1
            WHEN 'admin' THEN 2
            WHEN 'editor' THEN 3
            ELSE 4
        END,
        sur.created_at
    LIMIT 1;

    --------------------------------------------------------------------------
    -- 11. Reutilizar espacio al que ya pertenece la persona
    --------------------------------------------------------------------------
    IF v_space_id IS NULL THEN
        SELECT sm.space_id
        INTO v_space_id
        FROM public.space_memberships sm
        JOIN public.family_spaces fs
            ON fs.id = sm.space_id
        WHERE sm.person_id = v_person_id
          AND COALESCE(fs.status, 'active') = 'active'
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
            updated_at = now()
        WHERE id = v_space_id;
    END IF;

    --------------------------------------------------------------------------
    -- 13. Garantizar membresía de la persona
    --------------------------------------------------------------------------
    INSERT INTO public.space_memberships (
        space_id,
        person_id,
        added_by
    )
    VALUES (
        v_space_id,
        v_person_id,
        v_user_id
    )
    ON CONFLICT (space_id, person_id)
    DO NOTHING;

    --------------------------------------------------------------------------
    -- 14. Garantizar rol del usuario
    --------------------------------------------------------------------------
    INSERT INTO public.space_user_roles (
        space_id,
        user_id,
        role
    )
    VALUES (
        v_space_id,
        v_user_id,
        'owner'
    )
    ON CONFLICT (space_id, user_id)
    DO UPDATE SET
        role = CASE
            WHEN public.space_user_roles.role = 'owner'
                THEN 'owner'
            ELSE EXCLUDED.role
        END;

    --------------------------------------------------------------------------
    -- 15. Respuesta final
    --------------------------------------------------------------------------
    RETURN jsonb_build_object(
        'success', true,
        'person_id', v_person_id,
        'public_id', v_public_id,
        'space_id', v_space_id,
        'role', 'owner',
        'onboarding_completed', true
    );
END;
$function$
