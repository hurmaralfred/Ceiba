-- Consentimiento mutuo para conexiones familiares.
--
-- Problema: cuando Alfredo agrega a Alejandro (quien ya tiene cuenta),
-- el sistema vinculaba los registros de inmediato sin que Alejandro lo
-- supiera ni pudiera aceptar o rechazar. Cualquiera podía insertar a
-- alguien registrado en su árbol sin permiso.
--
-- Solución: si el candidato detectado ya tiene un person_claim aprobado
-- (is_claimed = true), se crea una solicitud pendiente en lugar de vincular
-- en el acto. El destinatario aprueba o rechaza desde su árbol. Solo en la
-- aprobación se fusionan registros y se crea la relación.
--
-- Tabla: family_connection_requests
--   requester_person_id → quien quiere agregar (Alfredo)
--   target_person_id    → la persona registrada (Alejandro)
--   source_person_id    → copia sin reclamar en el árbol del solicitante
--                         (el duplicado que se fusionará al aprobar; nullable
--                         si no existe copia, solo se crea la relación)
--   related_person_id   → familiar conector en el árbol del solicitante
--                         (p.ej. "Alfredo" cuando Alejandro es su hijo)
--   relation_key        → cómo el solicitante describe el parentesco ('son')
--   relationship_type   → primitiva RPC ('parent')
--   space_id            → espacio donde se creará la relación al aprobar
--   parent_kind         → 'biological'/'adoptive'/'unknown' (para parent)
--   status              → pending / approved / rejected / cancelled

-- ============================================================
-- TABLA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.family_connection_requests (
    id                   uuid        DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    requester_person_id  uuid        NOT NULL REFERENCES public.persons(id)  ON DELETE CASCADE,
    requester_user_id    uuid        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
    target_person_id     uuid        NOT NULL REFERENCES public.persons(id)  ON DELETE CASCADE,
    target_user_id       uuid        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
    -- Copia sin reclamar en el árbol del solicitante (puede no existir)
    source_person_id     uuid        REFERENCES public.persons(id)            ON DELETE SET NULL,
    -- Familiar de referencia en el árbol del solicitante
    related_person_id    uuid        NOT NULL REFERENCES public.persons(id)  ON DELETE CASCADE,
    relation_key         text        NOT NULL,
    relationship_type    text        NOT NULL,
    parent_kind          text        DEFAULT 'unknown',
    space_id             uuid        NOT NULL REFERENCES public.family_spaces(id) ON DELETE CASCADE,
    status               text        NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending','approved','rejected','cancelled')),
    message              text,
    created_at           timestamptz DEFAULT now() NOT NULL,
    resolved_at          timestamptz,
    resolved_by          uuid        REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_fcr_target_user  ON public.family_connection_requests(target_user_id)  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_fcr_requester    ON public.family_connection_requests(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_fcr_source       ON public.family_connection_requests(source_person_id);

ALTER TABLE ONLY public.family_connection_requests FORCE ROW LEVEL SECURITY;

-- El solicitante y el destinatario pueden ver la solicitud
CREATE POLICY "fcr_participants_select"
    ON public.family_connection_requests FOR SELECT
    USING (
        requester_user_id = auth.uid()
        OR target_user_id = auth.uid()
    );

-- Solo el solicitante puede crear
CREATE POLICY "fcr_requester_insert"
    ON public.family_connection_requests FOR INSERT
    WITH CHECK (requester_user_id = auth.uid());

-- Ambas partes pueden actualizar (cancelar/aprobar/rechazar — la lógica real
-- está en los RPCs que validan el rol)
CREATE POLICY "fcr_participants_update"
    ON public.family_connection_requests FOR UPDATE
    USING (
        requester_user_id = auth.uid()
        OR target_user_id = auth.uid()
    );

-- ============================================================
-- RPC: request_family_connection
--
-- El solicitante (Alfredo) llama a este RPC cuando:
--   a) add_relative devolvió needs_confirmation con is_claimed=true, y
--   b) el usuario eligió "Enviar solicitud" en lugar de vincular directamente.
--
-- Parámetros:
--   p_target_person_id  → persona reclamada a conectar (Alejandro)
--   p_source_person_id  → copia sin reclamar en el árbol (nullable)
--   p_related_person_id → familiar conector del solicitante
--   p_relation_key      → 'son', 'father', 'mother', ...
--   p_relationship_type → 'parent', 'partner', 'guardian'
--   p_parent_kind       → 'biological'/'adoptive'/'unknown'
--   p_space_id          → espacio familiar del solicitante
--   p_message           → mensaje opcional para el destinatario
--
-- Devuelve: { success, request_id } o lanza excepción.
-- ============================================================

CREATE OR REPLACE FUNCTION public.request_family_connection(
    p_target_person_id  uuid,
    p_source_person_id  uuid    DEFAULT NULL,
    p_related_person_id uuid    DEFAULT NULL,
    p_relation_key      text    DEFAULT NULL,
    p_relationship_type text    DEFAULT 'parent',
    p_parent_kind       text    DEFAULT 'unknown',
    p_space_id          uuid    DEFAULT NULL,
    p_message           text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_user_id            uuid;
    v_requester_person_id uuid;
    v_target_user_id     uuid;
    v_space_id           uuid;
    v_request_id         uuid;
    v_related_person_id  uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Persona reclamada del solicitante
    SELECT pc.person_id INTO v_requester_person_id
    FROM public.person_claims pc
    WHERE pc.user_id = v_user_id
      AND pc.claim_status = 'approved'
      AND pc.revoked_at IS NULL
    ORDER BY pc.claimed_at ASC LIMIT 1;

    IF v_requester_person_id IS NULL THEN
        RAISE EXCEPTION 'Debes completar el onboarding antes de enviar solicitudes.';
    END IF;

    -- No puedes enviarte una solicitud a ti mismo
    IF p_target_person_id = v_requester_person_id THEN
        RAISE EXCEPTION 'No puedes enviar una solicitud de conexión a tu propio perfil.';
    END IF;

    -- El destinatario debe existir y tener una cuenta registrada
    SELECT pc.user_id INTO v_target_user_id
    FROM public.person_claims pc
    WHERE pc.person_id    = p_target_person_id
      AND pc.claim_status = 'approved'
      AND pc.revoked_at   IS NULL
    LIMIT 1;

    IF v_target_user_id IS NULL THEN
        RAISE EXCEPTION 'La persona destino no tiene una cuenta registrada.';
    END IF;

    -- Resolver espacio si no se indicó
    v_space_id := p_space_id;
    IF v_space_id IS NULL THEN
        SELECT sur.space_id INTO v_space_id
        FROM public.space_user_roles sur
        JOIN public.family_spaces fs ON fs.id = sur.space_id
        WHERE sur.user_id = v_user_id
          AND COALESCE(fs.status,'active') = 'active'
        ORDER BY CASE sur.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, sur.created_at
        LIMIT 1;
    END IF;

    IF v_space_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró un espacio familiar activo.';
    END IF;

    -- Resolver related_person_id (default: el propio solicitante)
    v_related_person_id := COALESCE(p_related_person_id, v_requester_person_id);

    -- Cancelar solicitudes previas pendientes del mismo par (idempotente)
    UPDATE public.family_connection_requests
    SET status = 'cancelled', resolved_at = now(), resolved_by = v_user_id
    WHERE requester_user_id = v_user_id
      AND target_person_id  = p_target_person_id
      AND status            = 'pending';

    -- Crear la nueva solicitud
    INSERT INTO public.family_connection_requests (
        requester_person_id,
        requester_user_id,
        target_person_id,
        target_user_id,
        source_person_id,
        related_person_id,
        relation_key,
        relationship_type,
        parent_kind,
        space_id,
        message
    ) VALUES (
        v_requester_person_id,
        v_user_id,
        p_target_person_id,
        v_target_user_id,
        p_source_person_id,
        v_related_person_id,
        lower(trim(p_relation_key)),
        lower(trim(p_relationship_type)),
        lower(trim(COALESCE(p_parent_kind, 'unknown'))),
        v_space_id,
        NULLIF(trim(COALESCE(p_message,'')), '')
    )
    RETURNING id INTO v_request_id;

    RETURN jsonb_build_object(
        'success',     true,
        'request_id',  v_request_id
    );
END;
$function$;

-- ============================================================
-- RPC: respond_to_family_request
--
-- El destinatario (Alejandro) aprueba o rechaza la solicitud.
--
-- En la aprobación:
--   1. Si existe source_person_id (copia sin reclamar), se fusiona en
--      target_person_id (transfiere relaciones y membresías, marca merged).
--   2. Se añade target_person_id al espacio del solicitante.
--   3. Se crea la relación entre related_person_id y target_person_id.
--   4. Se marca la solicitud como approved.
--
-- Solo el destinatario puede aprobar/rechazar.
-- Solo el solicitante puede cancelar.
-- ============================================================

CREATE OR REPLACE FUNCTION public.respond_to_family_request(
    p_request_id uuid,
    p_action     text    -- 'approve' | 'reject' | 'cancel'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_user_id   uuid;
    v_req       record;
    rel_row     record;

    v_person_a_id uuid;
    v_person_b_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF lower(p_action) NOT IN ('approve','reject','cancel') THEN
        RAISE EXCEPTION 'Acción inválida. Usa approve, reject o cancel.';
    END IF;

    -- Cargar la solicitud
    SELECT * INTO v_req
    FROM public.family_connection_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada.';
    END IF;

    IF v_req.status <> 'pending' THEN
        RAISE EXCEPTION 'Esta solicitud ya fue procesada (%).', v_req.status;
    END IF;

    -- Validar quién puede hacer qué
    IF lower(p_action) = 'cancel' THEN
        IF v_req.requester_user_id <> v_user_id THEN
            RAISE EXCEPTION 'Solo el solicitante puede cancelar.';
        END IF;
        UPDATE public.family_connection_requests
        SET status = 'cancelled', resolved_at = now(), resolved_by = v_user_id
        WHERE id = p_request_id;
        RETURN jsonb_build_object('success', true, 'action', 'cancelled');
    END IF;

    IF v_req.target_user_id <> v_user_id THEN
        RAISE EXCEPTION 'Solo el destinatario puede aprobar o rechazar.';
    END IF;

    IF lower(p_action) = 'reject' THEN
        UPDATE public.family_connection_requests
        SET status = 'rejected', resolved_at = now(), resolved_by = v_user_id
        WHERE id = p_request_id;
        RETURN jsonb_build_object('success', true, 'action', 'rejected');
    END IF;

    -- ── APPROVE ──────────────────────────────────────────────
    -- 1. Fusionar source_person_id → target_person_id (si existe copia)
    IF v_req.source_person_id IS NOT NULL THEN
        -- Transferir relaciones donde source es person_a
        FOR rel_row IN
            SELECT r.id, r.person_b_id, r.relationship_type
            FROM public.relationships r
            WHERE r.person_a_id = v_req.source_person_id
              AND r.deleted_at IS NULL
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.relationships r2
                WHERE r2.person_a_id      = v_req.target_person_id
                  AND r2.person_b_id      = rel_row.person_b_id
                  AND r2.relationship_type = rel_row.relationship_type
                  AND r2.deleted_at       IS NULL
            ) THEN
                UPDATE public.relationships
                SET person_a_id = v_req.target_person_id, updated_at = now()
                WHERE id = rel_row.id;
            ELSE
                UPDATE public.relationships
                SET deleted_at = now(), updated_at = now()
                WHERE id = rel_row.id;
            END IF;
        END LOOP;

        -- Transferir relaciones donde source es person_b
        FOR rel_row IN
            SELECT r.id, r.person_a_id, r.relationship_type
            FROM public.relationships r
            WHERE r.person_b_id = v_req.source_person_id
              AND r.deleted_at IS NULL
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.relationships r2
                WHERE r2.person_a_id      = rel_row.person_a_id
                  AND r2.person_b_id      = v_req.target_person_id
                  AND r2.relationship_type = rel_row.relationship_type
                  AND r2.deleted_at       IS NULL
            ) THEN
                UPDATE public.relationships
                SET person_b_id = v_req.target_person_id, updated_at = now()
                WHERE id = rel_row.id;
            ELSE
                UPDATE public.relationships
                SET deleted_at = now(), updated_at = now()
                WHERE id = rel_row.id;
            END IF;
        END LOOP;

        -- Transferir membresías
        INSERT INTO public.space_memberships (space_id, person_id, added_by)
        SELECT sm.space_id, v_req.target_person_id, sm.added_by
        FROM public.space_memberships sm
        WHERE sm.person_id = v_req.source_person_id
        ON CONFLICT (space_id, person_id) DO NOTHING;

        DELETE FROM public.space_memberships
        WHERE person_id = v_req.source_person_id;

        -- Actualizar root de espacios que apuntaban a la copia
        UPDATE public.family_spaces
        SET root_person_id = v_req.target_person_id, updated_at = now()
        WHERE root_person_id = v_req.source_person_id;

        -- Marcar la copia como fusionada
        UPDATE public.persons
        SET status = 'merged', deleted_at = now(), updated_at = now()
        WHERE id = v_req.source_person_id;
    END IF;

    -- 2. Asegurar que target está en el espacio del solicitante
    INSERT INTO public.space_memberships (space_id, person_id, added_by)
    VALUES (v_req.space_id, v_req.target_person_id, v_req.requester_user_id)
    ON CONFLICT (space_id, person_id) DO NOTHING;

    -- 3. Crear la relación (si no existe ya gracias a la fusión)
    CASE lower(v_req.relationship_type)
        WHEN 'parent' THEN
            IF v_req.relation_key IN ('child','son','daughter') THEN
                v_person_a_id := v_req.related_person_id;
                v_person_b_id := v_req.target_person_id;
            ELSE
                v_person_a_id := v_req.target_person_id;
                v_person_b_id := v_req.related_person_id;
            END IF;
        WHEN 'partner' THEN
            v_person_a_id := v_req.related_person_id;
            v_person_b_id := v_req.target_person_id;
        ELSE
            v_person_a_id := v_req.target_person_id;
            v_person_b_id := v_req.related_person_id;
    END CASE;

    IF NOT EXISTS (
        SELECT 1 FROM public.relationships r
        WHERE r.person_a_id      = v_person_a_id
          AND r.person_b_id      = v_person_b_id
          AND r.relationship_type::text = lower(v_req.relationship_type)
          AND r.deleted_at       IS NULL
    ) THEN
        PERFORM public.create_relationship(
            p_person_a_id             => v_person_a_id,
            p_person_b_id             => v_person_b_id,
            p_relationship            => lower(v_req.relationship_type)::relationship_type,
            p_parent_kind             => CASE
                WHEN lower(v_req.relationship_type) = 'parent' THEN v_req.parent_kind
                ELSE NULL
            END,
            p_is_current              => CASE
                WHEN lower(v_req.relationship_type) = 'partner' THEN true
                ELSE NULL
            END,
            p_source                  => 'user_declared',
            p_created_by              => v_req.requester_user_id,
            p_close_previous_partners => false
        );
    END IF;

    -- 4. Marcar solicitud como aprobada
    UPDATE public.family_connection_requests
    SET status = 'approved', resolved_at = now(), resolved_by = v_user_id
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'action',  'approved',
        'target_person_id', v_req.target_person_id
    );
END;
$function$;

-- ============================================================
-- ReparaciOn de datos: reejecutar merge para nuevos duplicados
-- (captura a Alejandro Veliz y cualquiera que se haya registrado
-- despues del migration 20260804)
-- ============================================================
DO $$
DECLARE
    r_dup RECORD;
    v_claimed_id   uuid;
    v_duplicate_id uuid;
    rel_row        RECORD;
BEGIN
    FOR r_dup IN
        WITH candidates AS (
            SELECT
                p.id,
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
            SELECT a.id AS canonical_id, b.id AS duplicate_id, a.norm_ws
            FROM candidates a
            JOIN candidates b ON b.norm_ws = a.norm_ws AND b.id <> a.id
            WHERE a.is_claimed = true AND b.is_claimed = false
        )
        SELECT DISTINCT ON (p.canonical_id)
            p.canonical_id, p.duplicate_id, p.norm_ws
        FROM pairs p
        ORDER BY p.canonical_id, p.duplicate_id
    LOOP
        v_claimed_id   := r_dup.canonical_id;
        v_duplicate_id := r_dup.duplicate_id;

        RAISE NOTICE 'Fusionando % → % (%)', v_duplicate_id, v_claimed_id, r_dup.norm_ws;

        FOR rel_row IN
            SELECT r.id, r.person_b_id, r.relationship_type
            FROM public.relationships r
            WHERE r.person_a_id = v_duplicate_id AND r.deleted_at IS NULL
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.relationships r2
                WHERE r2.person_a_id = v_claimed_id AND r2.person_b_id = rel_row.person_b_id
                  AND r2.relationship_type = rel_row.relationship_type AND r2.deleted_at IS NULL
            ) THEN
                UPDATE public.relationships SET person_a_id = v_claimed_id, updated_at = now() WHERE id = rel_row.id;
            ELSE
                UPDATE public.relationships SET deleted_at = now(), updated_at = now() WHERE id = rel_row.id;
            END IF;
        END LOOP;

        FOR rel_row IN
            SELECT r.id, r.person_a_id, r.relationship_type
            FROM public.relationships r
            WHERE r.person_b_id = v_duplicate_id AND r.deleted_at IS NULL
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.relationships r2
                WHERE r2.person_a_id = rel_row.person_a_id AND r2.person_b_id = v_claimed_id
                  AND r2.relationship_type = rel_row.relationship_type AND r2.deleted_at IS NULL
            ) THEN
                UPDATE public.relationships SET person_b_id = v_claimed_id, updated_at = now() WHERE id = rel_row.id;
            ELSE
                UPDATE public.relationships SET deleted_at = now(), updated_at = now() WHERE id = rel_row.id;
            END IF;
        END LOOP;

        INSERT INTO public.space_memberships (space_id, person_id, added_by)
        SELECT sm.space_id, v_claimed_id, sm.added_by
        FROM public.space_memberships sm WHERE sm.person_id = v_duplicate_id
        ON CONFLICT (space_id, person_id) DO NOTHING;

        DELETE FROM public.space_memberships WHERE person_id = v_duplicate_id;

        UPDATE public.family_spaces
        SET root_person_id = v_claimed_id, updated_at = now()
        WHERE root_person_id = v_duplicate_id;

        UPDATE public.persons
        SET status = 'merged', deleted_at = now(), updated_at = now()
        WHERE id = v_duplicate_id;

        RAISE NOTICE 'Fusión completada: % → %', v_duplicate_id, v_claimed_id;
    END LOOP;
END;
$$;
