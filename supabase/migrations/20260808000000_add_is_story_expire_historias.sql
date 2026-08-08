-- Distinguish ephemeral historias (24h stories) from permanent recuerdos
-- in the family_events table.
--
-- Historias have always been created with event_type = 'other' from the
-- /historias page. We backfill that discriminator, then immediately purge
-- any that have already exceeded the 24-hour window.

ALTER TABLE public.family_events
  ADD COLUMN IF NOT EXISTS is_story BOOLEAN NOT NULL DEFAULT false;

-- Backfill: tag existing "other" events as stories.
-- The historias page has always set event_type = 'other'.
UPDATE public.family_events
SET    is_story = true
WHERE  event_type = 'other';

-- Immediate cleanup: delete stories already past their 24-hour window.
DELETE FROM public.family_events
WHERE  is_story = true
  AND  created_at < now() - interval '24 hours';

-- Index to make the cron DELETE fast.
CREATE INDEX IF NOT EXISTS family_events_is_story_created_idx
  ON public.family_events (is_story, created_at)
  WHERE is_story = true;
