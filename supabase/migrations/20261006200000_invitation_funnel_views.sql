-- Invitation funnel: record link opens / CTA clicks and expose service-role-only
-- views the admin metrics page can read.
--
-- Before this, invitation_events only ever contained created/shared/accepted/
-- expired: the invite landing never called record_invitation_event, so nobody
-- could tell how many links were even opened. The old /admin/metrics page read
-- views (v_k_viral_weekly, v_activation_funnel, ...) that do not exist in the
-- database, so it showed nothing.

-- 1. Allow the public landing to record a CTA click ("Crear cuenta" / "Ya tengo cuenta").
CREATE OR REPLACE FUNCTION public.record_invitation_event(
  p_token    text,
  p_event    text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_invitation_id uuid;
  v_status public.invitation_status;
  v_expires_at timestamptz;
  v_token_hash text;
begin
  if p_token is null or length(trim(p_token)) < 32 then
    return;
  end if;

  if p_event not in ('opened', 'viewed', 'cta_clicked') then
    raise exception 'Unsupported public invitation event';
  end if;

  v_token_hash := encode(extensions.digest(trim(p_token), 'sha256'), 'hex');

  select id, status, expires_at
    into v_invitation_id, v_status, v_expires_at
  from public.invitations
  where token_hash = v_token_hash
  limit 1;

  if v_invitation_id is null then
    return;
  end if;

  if v_status = 'pending' and v_expires_at <= now() then
    update public.invitations set status = 'expired' where id = v_invitation_id;
    insert into public.invitation_events (invitation_id, event_type, metadata)
    values (v_invitation_id, 'expired', '{}'::jsonb);
    return;
  end if;

  insert into public.invitation_events (invitation_id, event_type, metadata)
  values (v_invitation_id, p_event, coalesce(p_metadata, '{}'::jsonb));
end;
$function$;

-- 2. Per-invitation funnel flags (one row per invitation).
CREATE OR REPLACE VIEW public.v_invitation_funnel AS
SELECT
  i.id,
  i.invited_by,
  i.created_at,
  date_trunc('week', i.created_at)::date                         AS week,
  coalesce(
    (SELECT e.metadata->>'template' FROM public.invitation_events e
      WHERE e.invitation_id = i.id AND e.event_type = 'created'
      ORDER BY e.id LIMIT 1), 'unknown')                         AS template,
  i.status,
  min(e.created_at) FILTER (WHERE e.event_type = 'shared')       AS shared_at,
  min(e.created_at) FILTER (WHERE e.event_type = 'opened')       AS opened_at,
  min(e.created_at) FILTER (WHERE e.event_type = 'cta_clicked')  AS cta_clicked_at,
  min(e.created_at) FILTER (WHERE e.event_type = 'accepted')     AS accepted_at
FROM public.invitations i
LEFT JOIN public.invitation_events e ON e.invitation_id = i.id
GROUP BY i.id;

-- 3. Weekly funnel.
CREATE OR REPLACE VIEW public.v_invitation_funnel_weekly AS
SELECT
  week,
  count(*)                                   AS created,
  count(shared_at)                           AS shared,
  count(opened_at)                           AS opened,
  count(cta_clicked_at)                      AS cta_clicked,
  count(accepted_at)                         AS accepted,
  round(100.0 * count(opened_at)  / nullif(count(shared_at), 0), 1)   AS pct_opened_of_shared,
  round(100.0 * count(accepted_at) / nullif(count(opened_at), 0), 1)  AS pct_accepted_of_opened,
  round(100.0 * count(accepted_at) / nullif(count(shared_at), 0), 1)  AS pct_accepted_of_shared,
  round((avg(extract(epoch FROM (opened_at   - shared_at)) / 3600)
        FILTER (WHERE opened_at IS NOT NULL AND shared_at IS NOT NULL))::numeric, 1)   AS avg_hours_to_open,
  round((avg(extract(epoch FROM (accepted_at - shared_at)) / 3600)
        FILTER (WHERE accepted_at IS NOT NULL AND shared_at IS NOT NULL))::numeric, 1) AS avg_hours_to_accept
FROM public.v_invitation_funnel
GROUP BY week
ORDER BY week DESC;

-- 4. Message template performance.
CREATE OR REPLACE VIEW public.v_invitation_template_performance AS
SELECT
  template,
  count(shared_at)     AS shared,
  count(opened_at)     AS opened,
  count(accepted_at)   AS accepted,
  round(100.0 * count(opened_at)   / nullif(count(shared_at), 0), 1) AS pct_opened,
  round(100.0 * count(accepted_at) / nullif(count(shared_at), 0), 1) AS pct_accepted
FROM public.v_invitation_funnel
GROUP BY template
ORDER BY shared DESC;

-- 5. Who invites, and who converts.
CREATE OR REPLACE VIEW public.v_invitation_top_inviters AS
SELECT
  invited_by,
  count(shared_at)   AS shared,
  count(opened_at)   AS opened,
  count(accepted_at) AS accepted
FROM public.v_invitation_funnel
GROUP BY invited_by
ORDER BY shared DESC, accepted DESC;

-- 6. Opened but not accepted for 48h+ (candidates for a nudge).
CREATE OR REPLACE VIEW public.v_invitation_stuck AS
SELECT id, invited_by, template, opened_at, cta_clicked_at
FROM public.v_invitation_funnel
WHERE opened_at IS NOT NULL
  AND accepted_at IS NULL
  AND status = 'pending'
  AND opened_at < now() - interval '48 hours';

-- Service role only: these views aggregate per-user data and must never be
-- reachable through PostgREST with the anon/authenticated keys.
REVOKE ALL ON public.v_invitation_funnel,
              public.v_invitation_funnel_weekly,
              public.v_invitation_template_performance,
              public.v_invitation_top_inviters,
              public.v_invitation_stuck
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_invitation_funnel,
                public.v_invitation_funnel_weekly,
                public.v_invitation_template_performance,
                public.v_invitation_top_inviters,
                public.v_invitation_stuck
  TO service_role;

NOTIFY pgrst, 'reload schema';
