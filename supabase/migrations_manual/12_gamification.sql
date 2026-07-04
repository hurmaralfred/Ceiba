-- ============================================================
-- CEIBA VIRAL LOOP — Paso 3: Gamificación (insignias)
-- ============================================================

-- Catálogo de insignias
create table if not exists public.badges (
  code          text primary key,
  title         text not null,
  description   text not null,
  icon          text not null,
  category      text not null,      -- 'starter','connector','completer','emotional'
  criteria      jsonb not null      -- para lógica declarativa
);

-- Insignias del usuario
create table if not exists public.user_badges (
  user_id     uuid references auth.users(id) on delete cascade,
  badge_code  text references public.badges(code) on delete cascade,
  earned_at   timestamptz not null default now(),
  primary key (user_id, badge_code)
);

create index if not exists idx_user_badges_user on public.user_badges (user_id);


-- Seed del catálogo
insert into public.badges (code, title, description, icon, category, criteria)
values
  ('starter', 'Sembrador de raíces',
   'Fuiste el primero de tu rama en unirse a Ceiba.',
   '🌱', 'starter', '{}'::jsonb),

  ('first_five', 'Primeros cinco',
   'Agregaste tus primeros 5 familiares.',
   '👨‍👩‍👧', 'starter',
   '{"min_confirmed_relatives": 5}'::jsonb),

  ('connector', 'Conector',
   'Invitaste a 5 familiares que ya se unieron.',
   '🔗', 'connector',
   '{"min_activated_invites": 5}'::jsonb),

  ('super_connector', 'Súper conector',
   'Invitaste a 10 familiares que ya se unieron.',
   '🌟', 'connector',
   '{"min_activated_invites": 10}'::jsonb),

  ('complete_core', 'Núcleo completo',
   'Tu núcleo (padres, hermanos, hijos y pareja) está 100% en Ceiba.',
   '🎯', 'completer', '{}'::jsonb),

  ('birthday_hero', 'Guardián de cumpleaños',
   'Felicitaste a 10 familiares por su cumpleaños desde Ceiba.',
   '🎂', 'emotional',
   '{"min_birthday_greetings": 10}'::jsonb),

  ('sos_responder', 'Presente en el momento',
   'Respondiste a un SOS de un familiar en menos de 15 minutos.',
   '🚨', 'emotional', '{}'::jsonb),

  ('storyteller', 'Cronista familiar',
   'Compartiste 20 fotos o eventos con la familia.',
   '📸', 'emotional',
   '{"min_photos_or_events": 20}'::jsonb),

  ('reencuentro', 'Puente familiar',
   'Reconectaste con un familiar que no sabías que existía.',
   '🌉', 'emotional', '{}'::jsonb)
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  criteria = excluded.criteria;


-- ============================================================
-- Función central para otorgar insignias
-- ============================================================

create or replace function public.award_badge(p_user uuid, p_badge text)
returns boolean language plpgsql security definer set search_path = public as $$
declare inserted boolean := false;
begin
  insert into public.user_badges (user_id, badge_code)
  values (p_user, p_badge)
  on conflict (user_id, badge_code) do nothing
  returning true into inserted;

  if inserted then
    insert into public.audit_logs (actor_user_id, action, target_type, target_id, diff)
    values (p_user, 'badge.earned', 'badge', null,
            jsonb_build_object('badge_code', p_badge));
    -- Aquí también se puede enviar push desde una Edge Function.
  end if;

  return coalesce(inserted, false);
end $$;


-- ============================================================
-- Trigger: al agregarse una relación confirmada, evaluar insignias
-- ============================================================

create or replace function public.evaluate_relationship_badges()
returns trigger language plpgsql as $$
declare
  n_rels int;
  me uuid;
begin
  select p.id into me
  from public.persons p
  where p.linked_user_id = new.declared_by_user_id
  limit 1;

  if me is null then return new; end if;

  select count(*) into n_rels
  from public.relationships r
  where (r.person_a_id = me or r.person_b_id = me)
    and r.status = 'confirmed';

  -- 5 familiares → insignia "primeros cinco"
  if n_rels >= 5 then
    perform public.award_badge(new.declared_by_user_id, 'first_five');
  end if;

  return new;
end $$;

drop trigger if exists trg_eval_rel_badges on public.relationships;
create trigger trg_eval_rel_badges
after insert or update on public.relationships
for each row execute function public.evaluate_relationship_badges();


-- ============================================================
-- Trigger: al activarse una invitación (invitee agregó 3+), evaluar Connector
-- ============================================================

create or replace function public.evaluate_invitation_badges()
returns trigger language plpgsql as $$
declare n_activated int;
begin
  if new.status = 'activated' and (old.status is distinct from 'activated') then
    select count(*) into n_activated
    from public.invitations
    where inviter_user_id = new.inviter_user_id
      and status = 'activated';

    if n_activated >= 5 then
      perform public.award_badge(new.inviter_user_id, 'connector');
    end if;
    if n_activated >= 10 then
      perform public.award_badge(new.inviter_user_id, 'super_connector');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_eval_inv_badges on public.invitations;
create trigger trg_eval_inv_badges
after update on public.invitations
for each row execute function public.evaluate_invitation_badges();


-- ============================================================
-- RLS
-- ============================================================

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

drop policy if exists badges_read on public.badges;
create policy badges_read on public.badges
for select using (true);   -- catálogo público

drop policy if exists user_badges_read on public.user_badges;
create policy user_badges_read on public.user_badges
for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.persons p
    where p.linked_user_id = user_badges.user_id
      and public.is_in_my_family(p.id, 4)
  )
);

-- Verificar
select code, title, category from public.badges order by category, code;
