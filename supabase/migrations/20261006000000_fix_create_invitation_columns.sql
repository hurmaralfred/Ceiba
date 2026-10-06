-- create_invitation has been failing in production with:
--   column "channel" of relation "invitations" does not exist
-- 20260820100000_fix_create_invitation_token.sql inserted into `channel` and
-- `template_id`, which do not exist (the table has `delivery_channel` and no
-- template column). Result: nobody could create an invitation after 2026-08-20.
--
-- Fix: write the channel to `delivery_channel`; the template is already stored
-- in the 'created' invitation_events row (metadata.template). Also fail fast
-- with a clear error when the caller has no role in a space containing the
-- person (v_space would be NULL), and drop EXECUTE from anon.
--
-- Verified in a rolled-back transaction: create -> share -> anon preview ->
-- anon 'opened' event -> accept by a brand-new user.

CREATE OR REPLACE FUNCTION public.create_invitation(
  p_person_id uuid,
  p_channel   text DEFAULT NULL,
  p_template  text DEFAULT 'v1_direct'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_inv   public.invitations%rowtype;
  v_space uuid;
  v_token text;
  v_hash  text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Reuse an existing valid invitation for the same person + inviter
  SELECT * INTO v_inv
  FROM public.invitations
  WHERE person_id  = p_person_id
    AND invited_by = auth.uid()
    AND status     = 'pending'
    AND expires_at > now()
    AND token      IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_inv.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'id', v_inv.id, 'token', v_inv.token, 'reused', true, 'status', v_inv.status
    );
  END IF;

  SELECT sm.space_id INTO v_space
  FROM public.space_memberships sm
  JOIN public.space_user_roles sur
    ON sur.space_id = sm.space_id AND sur.user_id = auth.uid()
  WHERE sm.person_id = p_person_id
  ORDER BY CASE sur.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END
  LIMIT 1;

  IF v_space IS NULL THEN
    RAISE EXCEPTION 'No tienes acceso a esta persona' USING ERRCODE = '42501';
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash  := encode(extensions.digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.invitations (
    token, token_hash, invited_by, person_id, space_id, delivery_channel, status
  ) VALUES (
    v_token, v_hash, auth.uid(), p_person_id, v_space, p_channel, 'pending'
  )
  RETURNING * INTO v_inv;

  INSERT INTO public.invitation_events (invitation_id, event_type, metadata)
  VALUES (
    v_inv.id, 'created',
    jsonb_build_object('channel', p_channel, 'template', p_template)
  );

  RETURN jsonb_build_object(
    'id', v_inv.id, 'token', v_token, 'reused', false, 'status', v_inv.status
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_invitation(uuid, text, text) FROM anon;

NOTIFY pgrst, 'reload schema';
