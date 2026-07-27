-- Fix: add_relative debe PREVENIR personas duplicadas.
--
-- Problema real (produccion): una familia se fragmento en dos mitades.
-- Un hijo, al registrarse, agrego a su padre desde "Construye tu arbol";
-- add_relative creo una SEGUNDA persona para el padre (ffb5fecc) en vez de
-- ofrecer vincular al padre real ya existente en el mismo grafo (a76b1a46).
-- Al no verse conectados, el padre volvio a agregar al hijo, creando un
-- SEGUNDO hijo (c2d083fd). Resultado: 4 personas para 2 individuos, y cada
-- rama colgando de un duplicado distinto.
--
-- Evidencia de que era prevenible: normalized_full_name de a76b1a46 y de
-- ffb5fecc es IDENTICO ("alfredo  hurtado martinez") — solo cambiaba la
-- tilde de "Martinez"/"Martínez". Ademas match_candidates estaba vacio:
-- add_relative nunca ejecutaba ningun matching, a diferencia de
-- complete_onboarding que si lo hace.
--
-- Cambios (aditivos; misma firma, no crea sobrecarga nueva):
--
--   1. Normalizacion de nombre/apellidos con public.immutable_unaccent,
--      la MISMA funcion que alimenta persons.normalized_full_name via el
--      trigger normalize_person_name — se compara igual que la BD.
--
--   2. FRONTERA DE AUTORIZACION unica (v_authorized_ids): grafo conectado
--      de la persona relacionada (CTE recursivo bidireccional, hasta 3
--      saltos — la misma profundidad por defecto de get_my_family_graph,
--      para no exponer a nadie que el usuario no pueda ya ver en su
--      arbol) UNION los miembros del espacio activo (cubre personas
--      todavia sin ninguna relacion). El MISMO conjunto acota tanto la
--      busqueda de candidatos como el destino admisible de
--      link_person_id.
--
--   3. Deteccion con niveles de confianza:
--        1.00  nombre completo normalizado identico (cubre tildes y
--              mayusculas/minusculas)
--        0.90  mismo nombre + primer apellido, difiere o falta el
--              segundo apellido
--        >=0.72 variaciones menores / typos, via similarity() de pg_trgm
--
--   4. Si hay candidatos: NO crea persona ni relacion. Devuelve
--      needs_confirmation con los candidatos ORDENADOS POR CONFIANZA
--      descendente, incluyendo is_claimed para que la UI distinga a quien
--      ya tiene cuenta.
--
--   5. Dos salidas explicitas para el usuario:
--        link_person_id            -> vincula a la persona EXISTENTE
--                                     (no crea persona). Restringido a
--                                     v_authorized_ids: un UUID arbitrario
--                                     de otra familia es rechazado.
--        confirm_create_duplicate  -> homonimo legitimo confirmado
--                                     (crea la persona)
--
--   6. NUNCA fusiona automaticamente: la decision es siempre del usuario.
--
--   7. Idempotente: repetir la misma llamada sin confirmacion vuelve a
--      devolver needs_confirmation (no acumula personas). Las relaciones
--      siguen protegidas por idx_relationships_parent_guardian_unique y
--      idx_relationships_partner_canonical.
--
-- Se conserva sin cambios: autenticacion, resolucion de espacio (incluido
-- el fallback por membresia), can_edit_space, validacion de nombres via
-- create_person, reglas de hermanos/medios hermanos, create_relationship,
-- prevencion de ciclos, auditoria y la forma del valor de retorno en el
-- camino de exito (solo se anaden 'success' y 'linked_existing').

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

    -- Deduplicación (prevención de personas duplicadas)
    v_link_person_id uuid;
    v_confirm_create boolean;
    v_cand_first text;
    v_cand_middle text;
    v_cand_first_surname text;
    v_cand_second_surname text;
    v_cand_norm_full text;
    v_cand_norm_core text;
    v_candidates jsonb := '[]'::jsonb;
    v_authorized_ids uuid[];
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

    ----------------------------------------------------------------------
    -- PREVENCION DE DUPLICADOS
    --
    -- Tres caminos mutuamente excluyentes:
    --   A) link_person_id  -> vincular a una persona EXISTENTE del grafo.
    --                         No se crea persona. Nunca fusiona nada.
    --   B) confirm_create  -> el usuario confirmo explicitamente que es un
    --                         homonimo legitimo. Se crea la persona.
    --   C) (por defecto)   -> se buscan candidatos en el GRAFO CONECTADO.
    --                         Si hay alguno, NO se crea nada y se devuelve
    --                         needs_confirmation con los candidatos
    --                         ordenados por confianza (descendente).
    --
    -- Nunca se fusiona automaticamente: la decision siempre es del usuario.
    ----------------------------------------------------------------------
    v_link_person_id := NULLIF(p_payload->>'link_person_id', '')::uuid;
    v_confirm_create := COALESCE(
        NULLIF(p_payload->>'confirm_create_duplicate', '')::boolean,
        false
    );

    ----------------------------------------------------------------------
    -- FRONTERA DE AUTORIZACION (se calcula UNA sola vez y se usa tanto
    -- para validar link_person_id como para buscar candidatos, de modo
    -- que ambos caminos comparten exactamente el mismo limite).
    --
    -- Conjunto = grafo conectado de la persona relacionada (hasta 3
    -- saltos, la MISMA profundidad por defecto que get_my_family_graph,
    -- para no exponer a nadie que el usuario no pueda ya ver en su arbol)
    -- UNION los miembros del espacio activo (cubre personas todavia sin
    -- ninguna relacion). El recorrido es bidireccional y corta ciclos con
    -- el array `visited`.
    ----------------------------------------------------------------------
    WITH RECURSIVE connected AS (
        SELECT v_related_person_id AS person_id,
               0 AS depth,
               ARRAY[v_related_person_id]::uuid[] AS visited
        UNION ALL
        SELECT
            CASE WHEN r.person_a_id = c.person_id
                 THEN r.person_b_id ELSE r.person_a_id END,
            c.depth + 1,
            c.visited || CASE WHEN r.person_a_id = c.person_id
                              THEN r.person_b_id ELSE r.person_a_id END
        FROM connected c
        JOIN public.relationships r
          ON r.person_a_id = c.person_id OR r.person_b_id = c.person_id
        WHERE c.depth < 3
          AND r.deleted_at IS NULL
          AND r.relationship_status = 'active'
          AND NOT (
            CASE WHEN r.person_a_id = c.person_id
                 THEN r.person_b_id ELSE r.person_a_id END = ANY(c.visited)
          )
    )
    SELECT array_agg(DISTINCT x.person_id)
    INTO v_authorized_ids
    FROM (
        SELECT person_id FROM connected
        UNION
        SELECT sm.person_id
        FROM public.space_memberships sm
        WHERE sm.space_id = v_space_id
    ) x;

    v_authorized_ids := COALESCE(v_authorized_ids, ARRAY[]::uuid[]);

    IF v_link_person_id IS NOT NULL THEN
        -- CAMINO A: vincular a persona existente (no crea persona).
        --
        -- SEGURIDAD: solo se admite una persona DENTRO de la frontera
        -- autorizada. Sin este filtro, cualquier UUID arbitrario de la
        -- base podria vincularse al arbol del usuario (y quedaria ademas
        -- insertado en sus space_memberships mas abajo), exponiendo a
        -- personas de otras familias. Se valida ademas que este activa y
        -- no borrada/fusionada/bloqueada (status = 'active' excluye
        -- 'merged', 'deleted' y 'locked').
        SELECT p.id, p.public_id
        INTO v_new_person_id, v_public_id
        FROM public.persons p
        WHERE p.id = v_link_person_id
          AND p.id = ANY(v_authorized_ids)
          AND p.deleted_at IS NULL
          AND p.status = 'active';

        IF v_new_person_id IS NULL THEN
            RAISE EXCEPTION
                'La persona a vincular no existe, no esta activa o no pertenece a tu arbol.';
        END IF;

        -- No permitir vincular a la propia persona relacionada consigo
        -- misma (create_relationship rechazaria el auto-vinculo, pero se
        -- corta antes con un mensaje claro).
        IF v_new_person_id = v_related_person_id THEN
            RAISE EXCEPTION 'No puedes vincular a una persona consigo misma.';
        END IF;
    ELSE
        -- Normalizacion de los campos entrantes (tildes, mayusculas,
        -- espacios). Se usa la MISMA funcion que alimenta
        -- persons.normalized_full_name, para comparar igual que la BD.
        v_cand_first          := NULLIF(trim(v_person_payload->>'first_name'), '');
        v_cand_middle         := NULLIF(trim(v_person_payload->>'middle_name'), '');
        v_cand_first_surname  := NULLIF(trim(v_person_payload->>'first_surname'), '');
        v_cand_second_surname := NULLIF(trim(v_person_payload->>'second_surname'), '');

        -- Nombre completo normalizado (mismo formato que el trigger
        -- normalize_person_name: 4 campos separados por espacio).
        v_cand_norm_full := public.immutable_unaccent(
            coalesce(v_cand_first, '') || ' ' ||
            coalesce(v_cand_middle, '') || ' ' ||
            coalesce(v_cand_first_surname, '') || ' ' ||
            coalesce(v_cand_second_surname, '')
        );

        -- Nucleo = nombre + primer apellido, sin segundo apellido ni
        -- segundo nombre. Permite detectar "Ana Perez" vs "Ana Perez Gomez".
        v_cand_norm_core := btrim(regexp_replace(
            public.immutable_unaccent(
                coalesce(v_cand_first, '') || ' ' || coalesce(v_cand_first_surname, '')
            ),
            '\s+', ' ', 'g'
        ));

        IF NOT v_confirm_create AND v_cand_norm_core <> '' THEN
            -- Busqueda de candidatos DENTRO de la misma frontera
            -- autorizada calculada arriba (v_authorized_ids): nunca se
            -- devuelven datos de personas que el usuario no pueda ya ver.
            WITH scored AS (
                SELECT
                    p.id,
                    p.public_id,
                    p.first_name,
                    p.middle_name,
                    p.first_surname,
                    p.second_surname,
                    p.birth_date,
                    p.gender,
                    (EXISTS (
                        SELECT 1 FROM public.person_claims pc
                        WHERE pc.person_id = p.id
                          AND pc.claim_status = 'approved'
                          AND pc.revoked_at IS NULL
                    )) AS is_claimed,
                    btrim(regexp_replace(
                        public.immutable_unaccent(
                            coalesce(p.first_name,'') || ' ' || coalesce(p.first_surname,'')
                        ), '\s+', ' ', 'g'
                    )) AS cand_core,
                    coalesce(p.normalized_full_name, '') AS cand_full
                FROM public.persons p
                WHERE p.id = ANY(v_authorized_ids)
                  AND p.deleted_at IS NULL
                  AND p.status = 'active'
                  AND p.id <> v_related_person_id
            ),
            ranked AS (
                SELECT
                    s.*,
                    CASE
                        -- Nombre completo identico tras normalizar
                        -- (cubre tildes y mayusculas/minusculas).
                        WHEN btrim(regexp_replace(s.cand_full, '\s+', ' ', 'g'))
                             = btrim(regexp_replace(v_cand_norm_full, '\s+', ' ', 'g'))
                            THEN 1.00
                        -- Mismo nombre + primer apellido; difiere el
                        -- segundo apellido (o falta en un lado).
                        WHEN s.cand_core = v_cand_norm_core
                            THEN 0.90
                        -- Variaciones menores (typos) via trigramas.
                        WHEN public.similarity(s.cand_core, v_cand_norm_core) >= 0.72
                            THEN public.similarity(s.cand_core, v_cand_norm_core)::numeric
                        ELSE 0
                    END AS confidence
                FROM scored s
            )
            SELECT COALESCE(jsonb_agg(
                       jsonb_build_object(
                           'person_id', r.id,
                           'public_id', r.public_id,
                           'first_name', r.first_name,
                           'middle_name', r.middle_name,
                           'first_surname', r.first_surname,
                           'second_surname', r.second_surname,
                           'birth_date', r.birth_date,
                           'gender', r.gender,
                           'is_claimed', r.is_claimed,
                           'confidence', round(r.confidence, 2)
                       )
                       ORDER BY r.confidence DESC, r.first_name ASC
                   ), '[]'::jsonb)
            INTO v_candidates
            FROM ranked r
            WHERE r.confidence >= 0.72;

            IF jsonb_array_length(v_candidates) > 0 THEN
                -- NO se crea persona ni relacion. El usuario decide.
                RETURN jsonb_build_object(
                    'success', false,
                    'needs_confirmation', true,
                    'action', 'possible_duplicate',
                    'space_id', v_space_id,
                    'related_person_id', v_related_person_id,
                    'candidates', v_candidates
                );
            END IF;
        END IF;

        -- CAMINO B/C: no hay candidatos, o el usuario confirmo homonimo.
        SELECT cp.person_id, cp.public_id
        INTO v_new_person_id, v_public_id
        FROM public.create_person(
            v_person_payload,
            v_user_id
        ) cp;

        IF v_new_person_id IS NULL THEN
            RAISE EXCEPTION 'No fue posible crear la persona.';
        END IF;
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
            'success', true,
            'linked_existing', (v_link_person_id IS NOT NULL),
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
        'success', true,
        'person_id', v_new_person_id,
        'public_id', v_public_id,
        'space_id', v_space_id,
        'relationship_id', v_relationship_id,
        'linked_existing', (v_link_person_id IS NOT NULL)
    );
END;
$function$;
