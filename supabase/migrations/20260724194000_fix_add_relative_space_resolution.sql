-- Fix: add_relative debe resolver el espacio familiar también por MEMBRESÍA.
--
-- Problema (producción): un usuario con person_claim aprobado y membresía
-- activa en space_memberships no podía usar add_relative si su persona
-- reclamada no era `root_person_id` del espacio. La resolución del espacio
-- dependía únicamente de:
--     WHERE fs.root_person_id = v_claimed_person_id
-- Caso real: Joselin reclamó su persona dentro del árbol de Alfredo (cuya
-- persona es la raíz del espacio) y recibía:
--     "No existe un espacio familiar. Ejecuta complete_onboarding primero."
--
-- Cambios respecto a la versión anterior (SOLO adiciones):
--   1. El claim exige además `revoked_at IS NULL` — un claim revocado no
--      autoriza.
--   2. Fallback: si no hay espacio cuya raíz sea la persona reclamada, se
--      resuelve por `space_memberships` de esa misma persona.
--
-- Se conserva sin cambios:
--   * claim_status = 'approved'
--   * resolución inicial por root_person_id (orden de precedencia intacto)
--   * validación final con can_edit_space (permiso real, no modificada)
--   * validaciones, planner, create_person, create_relationship, ciclos,
--     matching, auditoría y forma del valor de retorno
--
-- Esta migración documenta en el repo un cambio YA aplicado en la base
-- mediante CREATE OR REPLACE; es idempotente y segura de reejecutar.

CREATE OR REPLACE FUNCTION public.add_relative(p_payload jsonb, p_relationship relationship_type)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_user_id uuid;
    v_claimed_person_id uuid;
    v_related_person_id uuid;
    v_space_id uuid;

    v_new_person_id uuid;
    v_public_id text;
    v_relationship_id uuid;
    v_relationship_ids uuid[] := ARRAY[]::uuid[];

    v_relation_key text;
    v_parent_kind text;
    v_is_current boolean;
    v_close_previous_partners boolean;
    v_person_payload jsonb;

    v_person_a_id uuid;
    v_person_b_id uuid;

    v_parent_record record;
    v_parent_count integer := 0;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
        RAISE EXCEPTION 'p_payload debe ser un objeto JSON válido.';
    END IF;

    SELECT pc.person_id
    INTO v_claimed_person_id
    FROM public.person_claims pc
    WHERE pc.user_id = v_user_id
      AND pc.claim_status = 'approved'
      AND pc.revoked_at IS NULL
    ORDER BY pc.claimed_at ASC
    LIMIT 1;

    IF v_claimed_person_id IS NULL THEN
        RAISE EXCEPTION
            'No tienes una identidad aprobada. Completa primero el onboarding.';
    END IF;

    IF NULLIF(p_payload->>'space_id', '') IS NOT NULL THEN
        BEGIN
            v_space_id := (p_payload->>'space_id')::uuid;
        EXCEPTION
            WHEN invalid_text_representation THEN
                RAISE EXCEPTION 'space_id no es un UUID válido.';
        END;
    ELSE
        SELECT fs.id
        INTO v_space_id
        FROM public.family_spaces fs
        WHERE fs.root_person_id = v_claimed_person_id
          AND COALESCE(fs.status, 'active') = 'active'
        ORDER BY fs.created_at ASC
        LIMIT 1;

        -- El usuario puede ser MIEMBRO de un espacio que no es suyo (reclamó
        -- su persona dentro del árbol de otro familiar). En ese caso el espacio
        -- se resuelve por la membresía de su persona reclamada, no por ser la
        -- raíz del espacio. El permiso real lo sigue decidiendo can_edit_space.
        IF v_space_id IS NULL THEN
            SELECT sm.space_id
            INTO v_space_id
            FROM public.space_memberships sm
            JOIN public.family_spaces fs ON fs.id = sm.space_id
            WHERE sm.person_id = v_claimed_person_id
              AND COALESCE(fs.status, 'active') = 'active'
            ORDER BY fs.created_at ASC
            LIMIT 1;
        END IF;
    END IF;

    IF v_space_id IS NULL THEN
        RAISE EXCEPTION
            'No existe un espacio familiar. Ejecuta complete_onboarding primero.';
    END IF;

    IF NOT public.can_edit_space(v_space_id) THEN
        RAISE EXCEPTION
            'No tienes permiso para editar este espacio familiar.';
    END IF;

    IF NULLIF(p_payload->>'related_person_id', '') IS NOT NULL THEN
        BEGIN
            v_related_person_id :=
                (p_payload->>'related_person_id')::uuid;
        EXCEPTION
            WHEN invalid_text_representation THEN
                RAISE EXCEPTION
                    'related_person_id no es un UUID válido.';
        END;
    ELSE
        v_related_person_id := v_claimed_person_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.space_memberships sm
        WHERE sm.space_id = v_space_id
          AND sm.person_id = v_related_person_id
    ) THEN
        RAISE EXCEPTION
            'La persona relacionada no pertenece al espacio familiar.';
    END IF;

    v_relation_key :=
        lower(COALESCE(NULLIF(trim(p_payload->>'relation_key'), ''), ''));

    v_parent_kind :=
        lower(COALESCE(
            NULLIF(trim(p_payload->>'parent_kind'), ''),
            'unknown'
        ));

    v_is_current :=
        COALESCE(
            NULLIF(p_payload->>'is_current', '')::boolean,
            true
        );

    v_close_previous_partners :=
        COALESCE(
            NULLIF(
                p_payload->>'close_previous_partners',
                ''
            )::boolean,
            false
        );

    IF v_relation_key IN ('half_brother', 'half_sister', 'half_sibling') THEN
        RAISE EXCEPTION
            'Para agregar un medio hermano debes indicar cuál padre comparten.';
    END IF;

    IF v_relation_key IN ('brother', 'sister', 'sibling') THEN
        SELECT count(*)
        INTO v_parent_count
        FROM public.relationships r
        WHERE r.deleted_at IS NULL
          AND r.relationship_type = 'parent'
          AND r.person_b_id = v_related_person_id;

        IF v_parent_count = 0 THEN
            RAISE EXCEPTION
                'Para agregar un hermano, primero registra al menos uno de los padres que comparten.';
        END IF;
    END IF;

    v_person_payload := p_payload
        - 'space_id'
        - 'related_person_id'
        - 'relation_key'
        - 'parent_kind'
        - 'is_current'
        - 'close_previous_partners';

    IF p_payload ? 'is_living' AND NOT (p_payload ? 'is_deceased') THEN
        v_person_payload :=
            (v_person_payload - 'is_living')
            || jsonb_build_object(
                'is_deceased',
                NOT COALESCE(
                    NULLIF(p_payload->>'is_living', '')::boolean,
                    true
                )
            );
    ELSE
        v_person_payload := v_person_payload - 'is_living';
    END IF;

    SELECT cp.person_id, cp.public_id
    INTO v_new_person_id, v_public_id
    FROM public.create_person(
        v_person_payload,
        v_user_id
    ) cp;

    IF v_new_person_id IS NULL THEN
        RAISE EXCEPTION 'No fue posible crear la persona.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.space_memberships sm
        WHERE sm.space_id = v_space_id
          AND sm.person_id = v_new_person_id
    ) THEN
        INSERT INTO public.space_memberships (
            space_id,
            person_id,
            added_by
        )
        VALUES (
            v_space_id,
            v_new_person_id,
            v_user_id
        );
    END IF;

    IF v_relation_key IN ('brother', 'sister', 'sibling') THEN
        FOR v_parent_record IN
            SELECT
                r.person_a_id AS parent_id,
                COALESCE(r.parent_kind, 'unknown') AS parent_kind
            FROM public.relationships r
            WHERE r.deleted_at IS NULL
              AND r.relationship_type = 'parent'
              AND r.person_b_id = v_related_person_id
        LOOP
            v_relationship_id := public.create_relationship(
                p_person_a_id             => v_parent_record.parent_id,
                p_person_b_id             => v_new_person_id,
                p_relationship            => 'parent',
                p_parent_kind             => v_parent_record.parent_kind,
                p_is_current              => NULL,
                p_source                  => 'user_declared',
                p_created_by              => v_user_id,
                p_close_previous_partners => false
            );

            v_relationship_ids :=
                array_append(v_relationship_ids, v_relationship_id);
        END LOOP;

        PERFORM public.log_family_space_event(
            v_space_id,
            v_user_id,
            'relative_added',
            jsonb_build_object(
                'person_id', v_new_person_id,
                'related_person_id', v_related_person_id,
                'relationship_ids', to_jsonb(v_relationship_ids),
                'relationship_type', 'derived_sibling',
                'relation_key', v_relation_key
            )
        );

        RETURN jsonb_build_object(
            'person_id', v_new_person_id,
            'public_id', v_public_id,
            'space_id', v_space_id,
            'relationship_id',
                CASE
                    WHEN array_length(v_relationship_ids, 1) >= 1
                        THEN v_relationship_ids[1]
                    ELSE NULL
                END,
            'relationship_ids', to_jsonb(v_relationship_ids)
        );
    END IF;

    CASE p_relationship
        WHEN 'parent' THEN
            IF v_relation_key IN ('child', 'son', 'daughter') THEN
                v_person_a_id := v_related_person_id;
                v_person_b_id := v_new_person_id;
            ELSIF v_relation_key IN (
                'father',
                'mother',
                'parent',
                'biological_parent',
                'adoptive_parent'
            ) THEN
                v_person_a_id := v_new_person_id;
                v_person_b_id := v_related_person_id;
            ELSE
                RAISE EXCEPTION
                    'Para parent, relation_key debe indicar parent/father/mother o child.';
            END IF;

        WHEN 'partner' THEN
            v_person_a_id := v_related_person_id;
            v_person_b_id := v_new_person_id;
            v_parent_kind := NULL;

        WHEN 'guardian' THEN
            IF v_relation_key IN ('ward', 'dependent') THEN
                v_person_a_id := v_related_person_id;
                v_person_b_id := v_new_person_id;
            ELSE
                v_person_a_id := v_new_person_id;
                v_person_b_id := v_related_person_id;
            END IF;

            v_parent_kind := NULL;

        ELSE
            RAISE EXCEPTION 'Tipo de relación no soportado.';
    END CASE;

    v_relationship_id := public.create_relationship(
        p_person_a_id             => v_person_a_id,
        p_person_b_id             => v_person_b_id,
        p_relationship            => p_relationship,
        p_parent_kind             => CASE
            WHEN p_relationship = 'parent'
                THEN v_parent_kind
            ELSE NULL
        END,
        p_is_current              => CASE
            WHEN p_relationship = 'partner'
                THEN v_is_current
            ELSE NULL
        END,
        p_source                  => 'user_declared',
        p_created_by              => v_user_id,
        p_close_previous_partners => CASE
            WHEN p_relationship = 'partner'
                THEN v_close_previous_partners
            ELSE false
        END
    );

    PERFORM public.log_family_space_event(
        v_space_id,
        v_user_id,
        'relative_added',
        jsonb_build_object(
            'person_id', v_new_person_id,
            'related_person_id', v_related_person_id,
            'relationship_id', v_relationship_id,
            'relationship_type', p_relationship::text,
            'relation_key', v_relation_key
        )
    );

    RETURN jsonb_build_object(
        'person_id', v_new_person_id,
        'public_id', v_public_id,
        'space_id', v_space_id,
        'relationship_id', v_relationship_id
    );
END;
$function$
