-- Allow room members to read messages in their rooms.
-- Required for postgres_changes Realtime subscriptions to deliver
-- chat_message INSERT events to authenticated clients.
CREATE POLICY "Members can read their room messages"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_room_members crm
      WHERE crm.room_id = chat_messages.room_id
        AND crm.user_id = auth.uid()
    )
  );

-- Allow members to insert messages in their rooms.
CREATE POLICY "Members can send messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_room_members crm
      WHERE crm.room_id = chat_messages.room_id
        AND crm.user_id = auth.uid()
    )
  );

-- NOTE: supabase_realtime publication already includes chat_messages,
-- so no ALTER PUBLICATION needed.
