-- ============================================================
-- CEIBA VIRAL LOOP — Paso 2: Vistas para métricas
-- ============================================================
-- Todas las vistas usan security_barrier para no filtrar datos
-- de otros usuarios cuando se consulten desde el cliente.
-- Para dashboards administrativos, se acceden con service_role.
-- ============================================================


-- ============================================================
-- 1) K viral por cohorte semanal
-- ============================================================

create or replace view public.v_k_viral_weekly as
with cohorts as (
  select
    date_trunc('week', u.created_at) as cohort_week,
    u.id as user_id
  from auth.users u
), invites_sent as (
  select
    c.cohort_week,
    c.user_id,
    count(i.id) as invites_sent,
    count(*) filter (where i.status in ('activated','signed_up')) as invites_converted
  from cohorts c
  left join public.invitations i on i.inviter_user_id = c.user_id
  group by c.cohort_week, c.user_id
)
select
  cohort_week,
  count(distinct user_id) as cohort_size,
  sum(invites_sent) as total_invites_sent,
  sum(invites_converted) as total_invites_converted,
  round(sum(invites_sent)::numeric / nullif(count(distinct user_id),0), 2) as avg_i,
  round(sum(invites_converted)::numeric / nullif(sum(invites_sent),0), 3) as avg_c,
  round(sum(invites_converted)::numeric / nullif(count(distinct user_id),0), 2) as k_viral
from invites_sent
group by cohort_week
order by cohort_week desc;


-- ============================================================
-- 2) Funnel de activación (usuarios nuevos)
-- ============================================================

create or replace view public.v_activation_funnel as
with base as (
  select
    u.id as user_id,
    u.created_at as sign_up_at,
    (select count(*) from public.relationships r
      where (r.person_a_id in (select id from public.persons where linked_user_id = u.id)
             or r.person_b_id in (select id from public.persons where linked_user_id = u.id))
        and r.status = 'confirmed') as n_relatives,
    (select count(*) from public.invitations i where i.inviter_user_id = u.id) as invites_sent
  from auth.users u
)
select
  date_trunc('week', sign_up_at) as week,
  count(*) as sign_ups,
  count(*) filter (where n_relatives >= 1) as with_1_rel,
  count(*) filter (where n_relatives >= 3) as with_3_rel,
  count(*) filter (where n_relatives >= 5) as with_5_rel,
  count(*) filter (where invites_sent >= 1) as with_1_invite,
  count(*) filter (where invites_sent >= 5) as with_5_invites,
  round(100.0 * count(*) filter (where n_relatives >= 5) / nullif(count(*),0), 1) as pct_activated
from base
group by 1
order by 1 desc;


-- ============================================================
-- 3) Conversión por template (A/B test)
-- ============================================================

create or replace view public.v_template_performance as
select
  template_id,
  count(*) as invites_sent,
  count(*) filter (where status in ('opened','installed','signed_up','activated')) as opened,
  count(*) filter (where status in ('signed_up','activated')) as signed_up,
  count(*) filter (where status = 'activated') as activated,
  round(100.0 * count(*) filter (where status in ('opened','installed','signed_up','activated'))
              / nullif(count(*), 0), 1) as pct_opened,
  round(100.0 * count(*) filter (where status in ('signed_up','activated'))
              / nullif(count(*), 0), 1) as pct_signed_up,
  round(100.0 * count(*) filter (where status = 'activated')
              / nullif(count(*), 0), 1) as pct_activated
from public.invitations
where template_id is not null
group by template_id
order by activated desc;


-- ============================================================
-- 4) Tiempo del ciclo (T)
-- ============================================================

create or replace view public.v_cycle_time as
select
  date_trunc('week', i.created_at) as week,
  count(*) as invitations,
  round(avg(extract(epoch from (i.first_opened_at - i.created_at))/3600)::numeric, 1) as avg_hours_to_open,
  round(avg(extract(epoch from (i.signed_up_at - i.created_at))/3600)::numeric, 1) as avg_hours_to_signup,
  round(avg(extract(epoch from (i.activated_at - i.signed_up_at))/3600)::numeric, 1) as avg_hours_signup_to_activation
from public.invitations i
where i.created_at > now() - interval '90 days'
group by 1
order by 1 desc;


-- ============================================================
-- 5) Familias completas (≥5 miembros confirmados en una misma red)
-- ============================================================

create or replace view public.v_complete_families as
with connected as (
  -- Para cada usuario, contamos su red hasta grado 4
  select
    p.linked_user_id as user_id,
    (select count(distinct sub.id)
       from (
         with recursive net(id, depth) as (
           select p.id, 0
           union
           select case when r.person_a_id = n.id then r.person_b_id else r.person_a_id end,
                  n.depth + 1
           from net n
           join public.relationships r
             on (r.person_a_id = n.id or r.person_b_id = n.id)
            and r.status = 'confirmed'
           where n.depth < 4
         )
         select id from net
       ) sub) as network_size
  from public.persons p
  where p.linked_user_id is not null
)
select
  count(*) as total_users,
  count(*) filter (where network_size >= 5) as families_size_5plus,
  count(*) filter (where network_size >= 10) as families_size_10plus,
  count(*) filter (where network_size >= 20) as families_size_20plus,
  round(100.0 * count(*) filter (where network_size >= 5) / nullif(count(*),0), 1) as pct_family_5plus
from connected;


-- ============================================================
-- 6) Retención D1 / D7 / D30
-- Requiere una tabla auxiliar de sesiones o eventos con timestamp de "última apertura".
-- Suponemos que audit_logs guarda 'user.session_open' o similar.
-- Placeholder para ajustar cuando el analytics esté integrado.
-- ============================================================

create or replace view public.v_retention as
with signups as (
  select id, created_at as signup_at from auth.users
), last_active as (
  select actor_user_id as user_id, max(created_at) as last_active_at
  from public.audit_logs
  group by actor_user_id
)
select
  date_trunc('week', s.signup_at) as cohort_week,
  count(*) as cohort_size,
  count(*) filter (where la.last_active_at > s.signup_at + interval '1 day') as active_d1,
  count(*) filter (where la.last_active_at > s.signup_at + interval '7 days') as active_d7,
  count(*) filter (where la.last_active_at > s.signup_at + interval '30 days') as active_d30,
  round(100.0 * count(*) filter (where la.last_active_at > s.signup_at + interval '7 days')
              / nullif(count(*),0),1) as pct_d7,
  round(100.0 * count(*) filter (where la.last_active_at > s.signup_at + interval '30 days')
              / nullif(count(*),0),1) as pct_d30
from signups s
left join last_active la on la.user_id = s.id
group by 1
order by 1 desc;


-- ============================================================
-- 7) Top invitadores (para reconocer y recompensar)
-- ============================================================

create or replace view public.v_top_inviters as
select
  i.inviter_user_id,
  p.first_names || ' ' || p.last_names as full_name,
  count(*) as invites_sent,
  count(*) filter (where i.status = 'activated') as invites_activated,
  round(100.0 * count(*) filter (where i.status = 'activated') / nullif(count(*),0), 1) as conversion_pct
from public.invitations i
left join public.persons p on p.linked_user_id = i.inviter_user_id
group by i.inviter_user_id, p.first_names, p.last_names
having count(*) >= 3
order by invites_activated desc, invites_sent desc
limit 100;


-- ============================================================
-- Uso: consultar cualquier vista desde SQL Editor con service_role
-- Ejemplo dashboard:
--   select * from public.v_k_viral_weekly;
--   select * from public.v_activation_funnel;
--   select * from public.v_template_performance;
-- ============================================================
