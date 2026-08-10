-- Scope gallery photos to a specific person in the family tree
ALTER TABLE public.family_memories
  ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES public.persons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS family_memories_person_id_idx
  ON public.family_memories (person_id);
