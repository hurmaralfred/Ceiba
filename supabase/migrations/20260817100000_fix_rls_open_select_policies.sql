-- Fix dangerously open SELECT policies on three tables.
-- All three were using USING (true) which allowed any authenticated user
-- to read data from any family space. Replace with proper space-scoped checks.

-- ── 1. family_memories ────────────────────────────────────────────────────────
-- Only members of the same family space can read memories.

DROP POLICY IF EXISTS memories_select ON public.family_memories;

CREATE POLICY memories_select ON public.family_memories
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.space_memberships sm
      JOIN public.person_claims pc ON pc.person_id = sm.person_id
      WHERE sm.space_id = family_memories.family_space_id
        AND pc.user_id  = auth.uid()
        AND pc.claim_status = 'approved'
        AND pc.revoked_at IS NULL
    )
    OR
    -- Space creator who may not yet have a person claim
    EXISTS (
      SELECT 1 FROM public.family_spaces fs
      WHERE fs.id = family_memories.family_space_id
        AND fs.created_by = auth.uid()
    )
  );

-- ── 2. memory_reactions ───────────────────────────────────────────────────────
-- A user can only read reactions on memories that belong to their family space.

DROP POLICY IF EXISTS reactions_select ON public.memory_reactions;

CREATE POLICY reactions_select ON public.memory_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.family_memories fm
      JOIN public.space_memberships sm ON sm.space_id = fm.family_space_id
      JOIN public.person_claims pc     ON pc.person_id = sm.person_id
      WHERE fm.id           = memory_reactions.memory_id
        AND pc.user_id      = auth.uid()
        AND pc.claim_status = 'approved'
        AND pc.revoked_at IS NULL
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.family_memories fm
      JOIN public.family_spaces fs ON fs.id = fm.family_space_id
      WHERE fm.id     = memory_reactions.memory_id
        AND fs.created_by = auth.uid()
    )
  );

-- ── 3. chat_message_reactions ─────────────────────────────────────────────────
-- A user can only read reactions on messages in chat rooms they belong to.

DROP POLICY IF EXISTS chat_reactions_select ON public.chat_message_reactions;

CREATE POLICY chat_reactions_select ON public.chat_message_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_messages cm
      JOIN public.chat_room_members crm ON crm.room_id = cm.room_id
      WHERE cm.id         = chat_message_reactions.message_id
        AND crm.user_id   = auth.uid()
    )
  );
