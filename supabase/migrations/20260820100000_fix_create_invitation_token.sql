-- The invitations table was migrated to use token_hash (SHA-256 of a long token)
-- but create_invitation was never updated: it still generated a 6-char code and
-- inserted into columns that no longer exist (invited_person_id, inviter_user_id).
-- get_invitation_by_token immediately returns null for any token < 32 chars.
-- Result: every invite link was broken from day one.
--
-- Fix:
--   1. Add plain `token` column so we can return it to the frontend.
--   2. Recreate create_invitation to generate a 64-hex token (32 random bytes),
--      store its SHA-256 hash, and return the plain token.
--   3. Frontend uses data.token to build the link (separate commit).

-- ── 1. Add token column ────────────────────────────────────────────────────────
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS token text;

CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_key
  ON public.invitations (token)
  WHERE token IS NOT NULL;

-- ── 2. Recreate create_invitation ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_invitation(
  p_person_id  uuid,
  p_channel    text    DEFAULT NULL,
  p_template   text    DEFAULT 'v1_direct'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_inv    public.invitations%rowtype;
  v_space  uuid;
  v_token  text;
  v_hash   text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Reuse an existing valid invitation for the same person+inviter
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
      'id',     v_inv.id,
      'token',  v_inv.token,
      'reused', true,
      'status', v_inv.status
    );
  END IF;

  -- Derive the family space: pick the space the inviter owns that contains this person
  SELECT sm.space_id INTO v_space
  FROM public.space_memberships sm
  JOIN public.space_user_roles sur
    ON sur.space_id = sm.space_id AND sur.user_id = auth.uid()
  WHERE sm.person_id = p_person_id
  ORDER BY CASE sur.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END
  LIMIT 1;

  -- Generate a cryptographically secure 64-hex-char token (32 random bytes)
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash  := encode(extensions.digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.invitations (
    token, token_hash, invited_by, person_id, space_id,
    channel, template_id, status
  ) VALUES (
    v_token, v_hash, auth.uid(), p_person_id, v_space,
    p_channel, p_template, 'pending'
  )
  RETURNING * INTO v_inv;

  INSERT INTO public.invitation_events (invitation_id, event_type, metadata)
  VALUES (
    v_inv.id,
    'created',
    jsonb_build_object('channel', p_channel, 'template', p_template)
  );

  RETURN jsonb_build_object(
    'id',     v_inv.id,
    'token',  v_token,
    'reused', false,
    'status', v_inv.status
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
