-- ============================================================
-- CEIBA — Paso 7: FUNCIONES RPC (llamables desde el cliente)
-- Todas usan SECURITY INVOKER (respetan RLS del que llama).
-- ============================================================

-- ============================================================
-- 1) is_in_my_family(target_person, degree)
--    Devuelve true si target_person está en la red del auth.uid()
--    hasta `degree` grados de parentesco.
--    ⚠️ Usada dentro de las policies RLS. Mantener eficiente.
-- ============================================================

create or replace function public.is_in_my_family(target_person uuid, degree int default 4)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive me as (
    select id from public.persons where linked_user_id = auth.uid() limit 1
  ),
  net(id, depth) as (
    select id, 0 from me
    union
    select case when r.person_a_id = n.id then r.person_b_id else r.person_a_id end,
           n.depth + 1
    from net n
    join public.relationships r
      on (r.person_a_id = n.id or r.person_b_id = n.id)
     and r.status = 'confirmed'
    where n.depth < degree
  )
  select exists (select 1 from net where id = target_person);
$$;

-- Nota: SECURITY DEFINER es necesario aquí para que la función pueda
-- leer public.relationships sin que la RLS de esa tabla la bloquee.
-- Es segura porque solo devuelve true/false y no expone filas.


-- ============================================================
-- 2) find_person_matches(payload)
--    Motor anti-duplicados. Devuelve top-10 candidatos con score.
-- ============================================================

create or replace function public.find_person_matches(payload jsonb)
returns table(person_id uuid, score int, breakdown jsonb, matched_person jsonb)
language plpgsql
stable
security invoker
as $$
declare
  p_first  text  := payload->>'first_names';
  p_last   text  := payload->>'last_names';
  p_date   date  := nullif(payload->>'birth_date','')::date;
  p_city   text  := payload->>'birth_city';
  p_email  citext:= nullif(payload->>'email','')::citext;
  q_full   text  := lower(unaccent(coalesce(p_first,'') || ' ' || coalesce(p_last,'')));
begin
  return query
  select p.id,
         ((case when similarity(p.normalized_name, q_full) > 0.6 then 40 else 0 end)
        + (case when p.birth_date = p_date then 30 else 0 end)
        + (case when p.birth_city ilike coalesce(p_city, '__NULL__') then 10 else 0 end)
        + (case when p.email = p_email then 80 else 0 end)
         )::int as score,
         jsonb_build_object(
           'name_similarity', similarity(p.normalized_name, q_full),
           'birth_date_match', p.birth_date = p_date,
           'birth_city_match', p.birth_city ilike coalesce(p_city, '__NULL__'),
           'email_match', p.email = p_email
         ) as breakdown,
         to_jsonb(p) as matched_person
  from public.persons p
  where p.status = 'active'
    and (similarity(p.normalized_name, q_full) > 0.4
         or p.email = p_email
         or p.birth_date = p_date)
  order by 2 desc
  limit 10;
end $$;


-- ============================================================
-- 3) get_my_family_graph(depth)
--    Devuelve el árbol centrado en el usuario actual.
-- ============================================================

create or replace function public.get_my_family_graph(depth int default 3)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare me uuid;
begin
  select id into me from public.persons where linked_user_id = auth.uid() limit 1;
  if me is null then
    return jsonb_build_object('me', null, 'nodes','[]'::jsonb,'edges','[]'::jsonb);
  end if;

  return (
    with recursive net(id, d) as (
      select me, 0
      union
      select case when r.person_a_id = n.id then r.person_b_id else r.person_a_id end,
             n.d + 1
      from net n
      join public.relationships r
        on (r.person_a_id = n.id or r.person_b_id = n.id)
       and r.status = 'confirmed'
      where n.d < depth
    )
    select jsonb_build_object(
      'me', me,
      'nodes',
        coalesce((select jsonb_agg(distinct to_jsonb(p.*))
                  from net n join public.persons p on p.id = n.id), '[]'::jsonb),
      'edges',
        coalesce((select jsonb_agg(to_jsonb(r.*))
                  from public.relationships r
                  where r.status = 'confirmed'
                    and (r.person_a_id in (select id from net)
                      or r.person_b_id in (select id from net))), '[]'::jsonb)
    )
  );
end $$;


-- ============================================================
-- 4) trigger_sos(lat, lon, message, scope)
--    Dispara alerta con cooldown de 5 min.
-- ============================================================

create or replace function public.trigger_sos(
  p_lat double precision default null,
  p_lon double precision default null,
  p_message text default null,
  p_scope int default 2
) returns uuid
language plpgsql
security invoker
as $$
declare
  new_id uuid;
  last_cooldown timestamptz;
begin
  select cooldown_until into last_cooldown
  from public.sos_alerts
  where sender_user_id = auth.uid()
    and status = 'active'
  order by triggered_at desc limit 1;

  if last_cooldown is not null and last_cooldown > now() then
    raise exception 'SOS en cooldown hasta %', last_cooldown;
  end if;

  insert into public.sos_alerts
    (sender_user_id, lat, lon, message, scope_degree, cooldown_until)
  values
    (auth.uid(), p_lat, p_lon, p_message, p_scope, now() + interval '5 minutes')
  returning id into new_id;

  -- El Edge Function 'sos-dispatcher' escucha esta inserción via Realtime
  -- y despacha los push. No hay que hacer nada más aquí.

  return new_id;
end $$;


-- ============================================================
-- 5) respond_sos(sos_id, response, message)
-- ============================================================

create or replace function public.respond_sos(
  p_sos uuid,
  p_response text,
  p_message text default null
) returns void
language plpgsql
security invoker
as $$
begin
  insert into public.sos_responses (sos_id, responder_user_id, response, message)
  values (p_sos, auth.uid(), p_response, p_message)
  on conflict (sos_id, responder_user_id)
  do update set response = excluded.response,
                message  = excluded.message,
                responded_at = now();
end $$;


-- ============================================================
-- 6) cancel_sos(sos_id)
-- ============================================================

create or replace function public.cancel_sos(p_sos uuid)
returns void language plpgsql security invoker as $$
begin
  update public.sos_alerts
     set status = 'cancelled', resolved_at = now()
   where id = p_sos
     and sender_user_id = auth.uid();
end $$;


-- ============================================================
-- 7) upcoming_birthdays(days)
--    Cumpleaños próximos de toda la red familiar.
-- ============================================================

create or replace function public.upcoming_birthdays(days int default 7)
returns table(
  person_id uuid,
  full_name text,
  profile_photo_url text,
  birth_date date,
  next_birthday date,
  days_until int
)
language sql stable security definer set search_path = public as $$
  with net as (
    select p.id, p.first_names || ' ' || p.last_names as full_name,
           p.profile_photo_url, p.birth_date
    from public.persons p
    where p.is_living = true
      and p.birth_date is not null
      and public.is_in_my_family(p.id, 4)
  ), calc as (
    select id, full_name, profile_photo_url, birth_date,
           make_date(extract(year from current_date)::int,
                     extract(month from birth_date)::int,
                     extract(day from birth_date)::int) as this_year_bday
    from net
  )
  select id, full_name, profile_photo_url, birth_date,
         (case when this_year_bday < current_date
               then this_year_bday + interval '1 year'
               else this_year_bday end)::date as next_birthday,
         ((case when this_year_bday < current_date
                then this_year_bday + interval '1 year'
                else this_year_bday end)::date - current_date) as days_until
  from calc
  where ((case when this_year_bday < current_date
                then this_year_bday + interval '1 year'
                else this_year_bday end)::date - current_date) <= days
  order by days_until;
$$;


-- ============================================================
-- 8) confirm_match(candidate_id) y reject_match(candidate_id)
-- ============================================================

create or replace function public.confirm_match(p_candidate uuid)
returns uuid
language plpgsql security invoker as $$
declare
  cand public.match_candidates%rowtype;
  target_person_id uuid;
  rel_id uuid;
  rel_type relationship_type;
begin
  select * into cand from public.match_candidates
   where id = p_candidate and proposed_by_user_id = auth.uid()
   for update;

  if cand is null then
    raise exception 'candidato no encontrado';
  end if;
  if cand.status <> 'pending' then
    raise exception 'candidato ya resuelto';
  end if;

  target_person_id := (cand.proposed_relationship->>'target_person_id')::uuid;
  rel_type := (cand.proposed_relationship->>'type')::relationship_type;

  insert into public.relationships
    (person_a_id, person_b_id, relationship_type,
     source, declared_by_user_id, confidence_score, status)
  values
    (target_person_id, cand.matched_person_id, rel_type,
     'declared_via_match', auth.uid(), cand.score, 'confirmed')
  on conflict (pair_key) do nothing
  returning id into rel_id;

  update public.match_candidates
     set status = 'confirmed', resolved_at = now()
   where id = p_candidate;

  return rel_id;
end $$;


create or replace function public.reject_match(p_candidate uuid)
returns void language plpgsql security invoker as $$
begin
  update public.match_candidates
     set status = 'rejected', resolved_at = now()
   where id = p_candidate
     and proposed_by_user_id = auth.uid();
end $$;


-- ============================================================
-- 9) add_relative(payload, relationship_type)
--    Alta segura de familiar con matching previo.
-- ============================================================

create or replace function public.add_relative(
  p_payload jsonb,
  p_relationship relationship_type
) returns jsonb
language plpgsql security invoker as $$
declare
  me uuid;
  top_match record;
  new_person_id uuid;
  new_rel_id uuid;
  candidate_id uuid;
begin
  select id into me from public.persons where linked_user_id = auth.uid() limit 1;
  if me is null then
    raise exception 'primero debes tener tu propio perfil (persons.linked_user_id = auth.uid())';
  end if;

  -- Buscar coincidencias
  select * into top_match from public.find_person_matches(p_payload)
   order by score desc limit 1;

  if top_match is not null and top_match.score >= 100 then
    -- Coincidencia fuerte → crear match_candidate para confirmación manual
    insert into public.match_candidates
      (proposed_by_user_id, new_person_payload, matched_person_id,
       score, score_breakdown, proposed_relationship)
    values
      (auth.uid(), p_payload, top_match.person_id,
       top_match.score, top_match.breakdown,
       jsonb_build_object('type', p_relationship, 'target_person_id', me))
    returning id into candidate_id;

    return jsonb_build_object(
      'needs_confirmation', true,
      'candidate_id', candidate_id,
      'match', to_jsonb(top_match)
    );
  end if;

  -- Coincidencia baja o nula → crear persona nueva + relación
  insert into public.persons
    (first_names, last_names, email, birth_date, birth_city,
     profile_photo_url, is_living, death_date, gender,
     created_by_user_id, status, verification_level)
  values
    (p_payload->>'first_names',
     p_payload->>'last_names',
     nullif(p_payload->>'email','')::citext,
     nullif(p_payload->>'birth_date','')::date,
     p_payload->>'birth_city',
     p_payload->>'profile_photo_url',
     coalesce((p_payload->>'is_living')::boolean, true),
     nullif(p_payload->>'death_date','')::date,
     coalesce((p_payload->>'gender')::gender_enum, 'unknown'),
     auth.uid(),
     'active',
     'unverified')
  returning id into new_person_id;

  -- Dirección canónica
  if p_relationship = 'parent_of' then
    -- El nuevo es padre/madre del usuario actual
    insert into public.relationships
      (person_a_id, person_b_id, relationship_type,
       source, declared_by_user_id, status)
    values (new_person_id, me, p_relationship,
            'declared', auth.uid(), 'confirmed')
    returning id into new_rel_id;
  else
    -- Simétricas o descendencia declarada por el creador
    insert into public.relationships
      (person_a_id, person_b_id, relationship_type,
       source, declared_by_user_id, status)
    values (me, new_person_id, p_relationship,
            'declared', auth.uid(), 'confirmed')
    returning id into new_rel_id;
  end if;

  return jsonb_build_object(
    'needs_confirmation', false,
    'person_id', new_person_id,
    'relationship_id', new_rel_id
  );
end $$;


-- Verificar todas las funciones
select proname, provolatile, prosecdef
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'is_in_my_family','find_person_matches','get_my_family_graph',
    'trigger_sos','respond_sos','cancel_sos','upcoming_birthdays',
    'confirm_match','reject_match','add_relative'
  )
order by proname;
