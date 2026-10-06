-- Give the invitee a concrete reason to accept.
--
-- get_invitation_by_token (public, token-gated) only returned names, so the
-- invite landing could show nothing but a generic benefit list. Add a `hook`
-- object with aggregate, non-identifying facts about the family the invitee
-- is being invited into:
--   family_count          persons in the space
--   joined_count          of those, with an approved account
--   memories_about_person memories written about the invited person
--   photos_of_person      photos the invited person is tagged in
--   next_birthday         nearest birthday (<= 30 days) of another living
--                         family member: first name + days only
-- Everything else in the response is unchanged. Expiry handling is identical.

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_token_hash text;
  v_invitation public.invitations%rowtype;
  v_result jsonb;
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_family_count int;
  v_joined_count int;
  v_memories int;
  v_photos int;
  v_next_bday jsonb;
begin
  if p_token is null or length(trim(p_token)) < 32 then
    return null;
  end if;

  v_token_hash := encode(extensions.digest(trim(p_token), 'sha256'), 'hex');

  select * into v_invitation
  from public.invitations
  where token_hash = v_token_hash
  limit 1;

  if v_invitation.id is null then
    return null;
  end if;

  if v_invitation.status = 'pending' and v_invitation.expires_at <= now() then
    update public.invitations set status = 'expired' where id = v_invitation.id;
    insert into public.invitation_events (invitation_id, event_type, metadata)
    values (v_invitation.id, 'expired', '{}'::jsonb);
    v_invitation.status := 'expired';
  end if;

  -- hook: aggregate facts about the family
  select count(*) into v_family_count
  from public.space_memberships sm
  join public.persons p on p.id = sm.person_id and p.deleted_at is null
  where sm.space_id = v_invitation.space_id;

  select count(distinct sm.person_id) into v_joined_count
  from public.space_memberships sm
  join public.person_claims pc on pc.person_id = sm.person_id
    and pc.claim_status = 'approved' and pc.revoked_at is null
  where sm.space_id = v_invitation.space_id;

  select count(*) into v_memories
  from public.family_memories m
  where m.family_space_id = v_invitation.space_id
    and m.person_id = v_invitation.person_id;

  select count(distinct pt.photo_id) into v_photos
  from public.photo_tags pt
  where pt.person_id = v_invitation.person_id;

  select jsonb_build_object('first_name', b.first_name, 'days_until', b.days_until)
  into v_next_bday
  from (
    select p.first_name,
           (n.next_date - v_today) as days_until
    from public.space_memberships sm
    join public.persons p on p.id = sm.person_id
      and p.deleted_at is null
      and p.birth_date is not null
      and coalesce(p.is_deceased, false) = false
      and p.death_date is null
      and p.id <> v_invitation.person_id
    cross join lateral (
      select case
        when (p.birth_date + ((extract(year from v_today) - extract(year from p.birth_date))::int * interval '1 year'))::date >= v_today
          then (p.birth_date + ((extract(year from v_today) - extract(year from p.birth_date))::int * interval '1 year'))::date
        else (p.birth_date + ((extract(year from v_today) - extract(year from p.birth_date) + 1)::int * interval '1 year'))::date
      end as next_date
    ) n
    where sm.space_id = v_invitation.space_id
    order by days_until, p.first_name
    limit 1
  ) b
  where b.days_until <= 30;

  select jsonb_build_object(
    'id', i.id,
    'status', i.status,
    'expires_at', i.expires_at,

    'person', jsonb_build_object(
      'id', person.id,
      'first_name', person.first_name,
      'middle_name', person.middle_name,
      'first_surname', person.first_surname,
      'second_surname', person.second_surname,
      'photo_path', person.photo_path
    ),

    'inviter', jsonb_build_object(
      'display_name', coalesce(profile.display_name, 'Tu familiar'),
      'avatar_path', profile.avatar_path
    ),

    'space', jsonb_build_object(
      'id', space.id,
      'name', space.name
    ),

    'hook', jsonb_build_object(
      'family_count', v_family_count,
      'joined_count', v_joined_count,
      'memories_about_person', v_memories,
      'photos_of_person', v_photos,
      'next_birthday', v_next_bday
    )
  )
  into v_result
  from public.invitations i
  join public.persons person on person.id = i.person_id
  join public.family_spaces space on space.id = i.space_id
  left join public.profiles profile on profile.user_id = i.invited_by
  where i.id = v_invitation.id;

  return v_result;
end;
$function$;

NOTIFY pgrst, 'reload schema';
