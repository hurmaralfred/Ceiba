-- Emoji reactions on chat messages. One row per (message, user, emoji).
-- Toggle semantics: inserting the same (message, user, emoji) again removes it.

CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID        NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji       TEXT        NOT NULL CHECK (char_length(emoji) <= 8),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS chat_reactions_message_idx
  ON public.chat_message_reactions(message_id);

ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_reactions_select ON public.chat_message_reactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY chat_reactions_insert ON public.chat_message_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY chat_reactions_delete ON public.chat_message_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());
