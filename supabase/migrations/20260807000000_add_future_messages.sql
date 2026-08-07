-- Cápsulas del tiempo (future messages)
-- Users write messages to family members with a future unlock date.
-- All family can see WHO sent to WHOM and WHEN it unlocks,
-- but ONLY the recipient can read the content, and only after unlock_date.

CREATE TABLE public.future_messages (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- recipient identified by their person in the family tree
  recipient_person_id UUID   NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  unlock_date    DATE        NOT NULL,
  content        TEXT        NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at      TIMESTAMPTZ
);

-- All access is through the service-role API (server-side).
-- Block direct client queries entirely.
ALTER TABLE public.future_messages ENABLE ROW LEVEL SECURITY;
-- No policies → all authenticated direct queries are denied.
-- Service role bypasses RLS by default.

CREATE INDEX future_messages_sender_idx     ON public.future_messages(sender_user_id);
CREATE INDEX future_messages_recipient_idx  ON public.future_messages(recipient_person_id);
CREATE INDEX future_messages_unlock_idx     ON public.future_messages(unlock_date);
