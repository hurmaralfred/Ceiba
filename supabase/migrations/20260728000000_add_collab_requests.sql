-- ============================================================
-- Collaborative member editing: solicitudes de edición/transferencia
-- Se usa audit_logs (ya existe) para auditoría.
-- No duplica person_claims: ese tabla es para reclamos de identidad.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.collab_requests (
    id          uuid    DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    person_id   uuid    NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
    -- quién solicita
    requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- quién administra actualmente la persona
    owner_user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- 'edit'     → el solicitante quiere co-editar
    -- 'transfer' → el solicitante quiere ser el nuevo administrador
    request_type text NOT NULL CHECK (request_type IN ('edit', 'transfer')),
    status       text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected')),
    message      text,
    created_at   timestamptz DEFAULT now(),
    resolved_at  timestamptz,
    resolved_by  uuid REFERENCES auth.users(id)
);

ALTER TABLE ONLY public.collab_requests FORCE ROW LEVEL SECURITY;

-- El solicitante y el dueño pueden ver la solicitud
CREATE POLICY "collab_requests_participants_select"
    ON public.collab_requests FOR SELECT
    USING (requester_user_id = auth.uid() OR owner_user_id = auth.uid());

-- Solo el solicitante puede crear una solicitud
CREATE POLICY "collab_requests_insert"
    ON public.collab_requests FOR INSERT
    WITH CHECK (requester_user_id = auth.uid());

-- El dueño puede actualizar el status (approve/reject) — restringido en la API
CREATE POLICY "collab_requests_owner_update"
    ON public.collab_requests FOR UPDATE
    USING (owner_user_id = auth.uid());
