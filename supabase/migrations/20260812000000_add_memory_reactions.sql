-- Reacciones a recuerdos familiares
-- Un usuario puede reaccionar con exactamente un emoji por recuerdo.
-- Si vuelve a reaccionar con el mismo emoji, se elimina (toggle).
-- Si cambia de emoji, se actualiza.

CREATE TABLE IF NOT EXISTS public.memory_reactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id   UUID        NOT NULL REFERENCES public.family_memories(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji       TEXT        NOT NULL CHECK (emoji IN ('❤️','😭','✨','😄')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (memory_id, user_id)
);

CREATE INDEX IF NOT EXISTS memory_reactions_memory_idx
  ON public.memory_reactions (memory_id);

ALTER TABLE public.memory_reactions ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden leer reacciones de su family space
CREATE POLICY reactions_select ON public.memory_reactions
  FOR SELECT TO authenticated USING (true);

-- Solo el propio usuario puede insertar/actualizar/borrar su reacción
CREATE POLICY reactions_insert ON public.memory_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY reactions_update ON public.memory_reactions
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY reactions_delete ON public.memory_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());
