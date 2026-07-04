-- ============================================================
-- CEIBA VIRAL LOOP — Paso 1: Schema de invitaciones
-- Se ejecuta DESPUÉS de todo el paquete ceiba-full.
-- ============================================================

-- Columna phone en persons (opcional, usada por sms-fallback)
alter table public.persons
  add column if not exists phone text;

-- ============================================================
-- Helper: get_family_ids_up_to(person_id, degree)
-- Devuelve los IDs alcanzables desde p_person hasta p_degree saltos.
-- Usada por invite-open-handler para construir el preview del árbol.
-- ============================================================

create or replace function public.get_family_ids_up_to(
  p_person uuid,
  p_degree int default 2
) returns table(person_id uuid)
language sql stable security definer set search_path = public as $$
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
  select id from net;
$$;

-- Enums nuevos
do $$
begin
  if not exists (select 1 from pg_type where typname = 'invitation_channel') then
    create type invitation_channel as enum
      ('whatsapp','sms','email','link','qr','in_app');
  end if;

  if not exists (select 1 from pg_type where typname = 'invitation_status') then
    create type invitation_status as enum
      ('created','sent','opened','installed','signed_up','activated','expired','revoked');
  end if;

  if not exists (select 1 from pg_type where typname = 'invitation_event_type') then
    create type invitation_event_type as enum
      ('created','link_generated','shared','opened','installed','signed_up','activated','reminded');
  end if;
end$$;


-- ============================================================
-- Tabla invitations: 1 fila por cada invitación enviada
-- ============================================================

create table if not exists public.invitations (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,     -- código corto para la URL (ej: 'A7X4M2')
  inviter_user_id     uuid not null references auth.users(id) on delete cascade,
  invited_person_id   uuid not null references public.persons(id) on delete cascade,
  channel             invitation_channel,
  status              invitation_status not null default 'created',
  template_id         text,                     -- 'v1_direct', 'v2_emotional', etc. (A/B test)
  first_opened_at     timestamptz,
  first_opened_from   text,                     -- ios/android/web
  installed_at        timestamptz,
  signed_up_at        timestamptz,
  activated_at        timestamptz,              -- cuando agregó ≥3 familiares
  signed_up_user_id   uuid references auth.users(id) on delete set null,
  reminders_sent      int not null default 0,
  last_reminded_at    timestamptz,
  expires_at          timestamptz not null default (now() + interval '90 days'),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_inv_inviter on public.invitations (inviter_user_id, created_at desc);
create index if not exists idx_inv_person  on public.invitations (invited_person_id);
create index if not exists idx_inv_status  on public.invitations (status);
create index if not exists idx_inv_pending on public.invitations (status, created_at)
  where status in ('created','sent','opened');


-- ============================================================
-- Tabla invitation_events: log completo de eventos del loop
-- Es la fuente para las métricas de K.
-- ============================================================

create table if not exists public.invitation_events (
  id             bigserial primary key,
  invitation_id  uuid not null references public.invitations(id) on delete cascade,
  event_type     invitation_event_type not null,
  metadata       jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists idx_inv_events_inv on public.invitation_events (invitation_id, created_at);
create index if not exists idx_inv_events_type on public.invitation_events (event_type, created_at desc);


-- ============================================================
-- Trigger: al confirmarse conversión, marcar la invitation
-- ============================================================

create or replace function public.mark_invitation_activated()
returns trigger language plpgsql as $$
begin
  -- Cuando un person previamente unclaimed pasa a tener linked_user_id
  if old.linked_user_id is null
     and new.linked_user_id is not null then

    update public.invitations
       set status = 'signed_up',
           signed_up_at = coalesce(signed_up_at, now()),
           signed_up_user_id = new.linked_user_id,
           updated_at = now()
     where invited_person_id = new.id
       and status in ('created','sent','opened','installed');

    insert into public.invitation_events (invitation_id, event_type, metadata)
    select id, 'signed_up'::invitation_event_type,
           jsonb_build_object('person_id', new.id, 'new_user_id', new.linked_user_id)
      from public.invitations
     where invited_person_id = new.id
       and signed_up_user_id = new.linked_user_id;
  end if;

  return new;
end $$;

drop trigger if exists trg_mark_invitation_activated on public.persons;
create trigger trg_mark_invitation_activated
after update on public.persons
for each row execute function public.mark_invitation_activated();


-- ============================================================
-- Función: create_invitation(person_id, channel, template_id)
-- Crea o reutiliza una invitación existente para ese person.
-- ============================================================

create or replace function public.create_invitation(
  p_person_id uuid,
  p_channel invitation_channel default null,
  p_template text default 'v1_direct'
) returns jsonb
language plpgsql security invoker as $$
declare
  inv record;
  new_code text;
begin
  -- ¿Ya hay una invitación activa para esta persona?
  select * into inv
  from public.invitations
  where invited_person_id = p_person_id
    and inviter_user_id = auth.uid()
    and status in ('created','sent','opened','installed')
    and expires_at > now()
  order by created_at desc limit 1;

  if inv.id is not null then
    return jsonb_build_object(
      'id', inv.id,
      'code', inv.code,
      'reused', true,
      'status', inv.status
    );
  end if;

  -- Generar código único legible (6 caracteres alfanuméricos)
  loop
    new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.invitations where code = new_code);
  end loop;

  -- Crear la invitación
  insert into public.invitations
    (code, inviter_user_id, invited_person_id, channel, template_id, status)
  values
    (new_code, auth.uid(), p_person_id, p_channel, p_template, 'created')
  returning * into inv;

  insert into public.invitation_events (invitation_id, event_type, metadata)
  values (inv.id, 'created',
          jsonb_build_object('channel', p_channel, 'template', p_template));

  return jsonb_build_object(
    'id', inv.id,
    'code', inv.code,
    'reused', false,
    'status', inv.status
  );
end $$;


-- ============================================================
-- Función: record_invitation_event(code, event, metadata)
-- Llamada por el Edge Function 'invite-open-handler'.
-- ============================================================

create or replace function public.record_invitation_event(
  p_code text,
  p_event invitation_event_type,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  inv record;
begin
  select * into inv from public.invitations where code = p_code;
  if inv.id is null then
    raise exception 'invitation code not found: %', p_code;
  end if;

  insert into public.invitation_events (invitation_id, event_type, metadata)
  values (inv.id, p_event, p_metadata);

  -- Actualizar campos derivados
  if p_event = 'opened' and inv.first_opened_at is null then
    update public.invitations
       set status = 'opened',
           first_opened_at = now(),
           first_opened_from = p_metadata->>'platform',
           updated_at = now()
     where id = inv.id;
  elsif p_event = 'installed' and inv.installed_at is null then
    update public.invitations
       set status = 'installed',
           installed_at = now(),
           updated_at = now()
     where id = inv.id;
  end if;
end $$;


-- ============================================================
-- Función: mark_invitation_shared(invitation_id, channel)
-- Llamar desde el cliente cuando el usuario efectivamente comparte.
-- ============================================================

create or replace function public.mark_invitation_shared(
  p_invitation uuid,
  p_channel invitation_channel
) returns void
language plpgsql security invoker as $$
begin
  update public.invitations
     set status = 'sent',
         channel = p_channel,
         updated_at = now()
   where id = p_invitation
     and inviter_user_id = auth.uid()
     and status = 'created';

  insert into public.invitation_events (invitation_id, event_type, metadata)
  values (p_invitation, 'shared',
          jsonb_build_object('channel', p_channel));
end $$;


-- ============================================================
-- Función: activation_check(user_id)
-- Se dispara cuando un usuario alcanza el "aha moment" (≥3 relaciones confirmadas).
-- ============================================================

create or replace function public.check_activation()
returns trigger language plpgsql as $$
declare
  n_rels int;
  me_person_id uuid;
begin
  -- ¿Cuántas relaciones confirmadas tiene el usuario?
  select p.id into me_person_id
  from public.persons p
  where p.linked_user_id = new.declared_by_user_id
  limit 1;

  if me_person_id is null then return new; end if;

  select count(*) into n_rels
  from public.relationships r
  where (r.person_a_id = me_person_id or r.person_b_id = me_person_id)
    and r.status = 'confirmed';

  if n_rels >= 3 then
    -- Marcar invitaciones que resultaron en este usuario como activated
    update public.invitations
       set status = 'activated',
           activated_at = coalesce(activated_at, now()),
           updated_at = now()
     where signed_up_user_id = new.declared_by_user_id
       and status = 'signed_up';

    insert into public.invitation_events (invitation_id, event_type, metadata)
    select id, 'activated'::invitation_event_type,
           jsonb_build_object('n_relatives', n_rels)
      from public.invitations
     where signed_up_user_id = new.declared_by_user_id
       and activated_at is not null
       and not exists (
         select 1 from public.invitation_events e
          where e.invitation_id = invitations.id and e.event_type = 'activated'
       );
  end if;

  return new;
end $$;

drop trigger if exists trg_check_activation on public.relationships;
create trigger trg_check_activation
after insert or update on public.relationships
for each row execute function public.check_activation();


-- ============================================================
-- RLS para invitations
-- ============================================================

alter table public.invitations enable row level security;
alter table public.invitation_events enable row level security;

drop policy if exists inv_read on public.invitations;
create policy inv_read on public.invitations
for select using (
  inviter_user_id = auth.uid()
  or signed_up_user_id = auth.uid()
);

drop policy if exists inv_insert on public.invitations;
create policy inv_insert on public.invitations
for insert with check (inviter_user_id = auth.uid());

drop policy if exists inv_update on public.invitations;
create policy inv_update on public.invitations
for update using (inviter_user_id = auth.uid());

drop policy if exists inv_events_read on public.invitation_events;
create policy inv_events_read on public.invitation_events
for select using (
  exists (
    select 1 from public.invitations i
    where i.id = invitation_events.invitation_id
      and (i.inviter_user_id = auth.uid() or i.signed_up_user_id = auth.uid())
  )
);

-- Verificar
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('invitations','invitation_events');
