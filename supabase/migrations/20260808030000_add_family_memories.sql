-- Recuerdos familiares "Un día como hoy"
-- memory_date es la fecha en que ocurrió el evento (puede ser de hace décadas).
-- La consulta filtra por MONTH + DAY == hoy para mostrar aniversarios.

CREATE TABLE IF NOT EXISTS public.family_memories (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_space_id UUID        NOT NULL REFERENCES public.family_spaces(id) ON DELETE CASCADE,
  body            TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  memory_date     DATE        NOT NULL,
  photo_path      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS family_memories_date_idx
  ON public.family_memories (family_space_id, EXTRACT(MONTH FROM memory_date), EXTRACT(DAY FROM memory_date));

ALTER TABLE public.family_memories ENABLE ROW LEVEL SECURITY;

-- Todos los miembros del space pueden leer
CREATE POLICY memories_select ON public.family_memories
  FOR SELECT TO authenticated USING (true);

-- Solo el autor puede insertar
CREATE POLICY memories_insert ON public.family_memories
  FOR INSERT TO authenticated WITH CHECK (author_user_id = auth.uid());

-- Solo el autor puede borrar
CREATE POLICY memories_delete ON public.family_memories
  FOR DELETE TO authenticated USING (author_user_id = auth.uid());
