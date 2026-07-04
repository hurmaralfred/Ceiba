-- ============================================================
-- CEIBA — Funciones helper que usan las Edge Functions
-- Ejecutar DESPUÉS de 06_rpc_functions.sql
-- ============================================================

-- Devuelve todos los person_id de la red familiar de un person dado
-- hasta N grados de parentesco. Usada por sos-dispatcher.
create or replace function public.get_family_ids_up_to(
  p_person uuid,
  p_degree int default 2
) returns table(person_id uuid, depth int)
language sql
stable
security definer
set search_path = public
as $$
  with recursive net(id, depth) as (
    select p_person, 0
    union
    select case when r.person_a_id = n.id then r.person_b_id else r.person_a_id end,
           n.depth + 1
    from net n
    join public.relationships r
      on (r.person_a_id = n.id or r.person_b_id = n.id)
     and r.status = 'confirmed'
    where n.depth < p_degree
  )
  select id as person_id, min(depth) as depth
  from net
  group by id;
$$;

-- Devuelve cumpleaños próximos para un person dado
-- (usada por cron-birthdays-daily con service_role).
create or replace function public._admin_birthdays_for_person(
  p_person uuid,
  p_days int default 7
) returns table(
  person_id uuid,
  full_name text,
  profile_photo_url text,
  birth_date date,
  next_birthday date,
  days_until int
)
language sql stable security definer set search_path = public as $$
  with net as (
    select distinct p.id, p.first_names || ' ' || p.last_names as full_name,
           p.profile_photo_url, p.birth_date
    from public.get_family_ids_up_to(p_person, 4) g
    join public.persons p on p.id = g.person_id
    where p.is_living = true and p.birth_date is not null
      and p.id <> p_person
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
                else this_year_bday end)::date - current_date) <= p_days
  order by days_until;
$$;

-- Verificar
select proname from pg_proc
where proname in ('get_family_ids_up_to','_admin_birthdays_for_person')
  and pronamespace = 'public'::regnamespace;
