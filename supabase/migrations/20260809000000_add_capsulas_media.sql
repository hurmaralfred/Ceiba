-- Adjuntos en cápsulas del tiempo (foto o video)
ALTER TABLE public.future_messages
  ADD COLUMN IF NOT EXISTS media_url TEXT;
