-- ============================================================
-- CEIBA — Paso 4: TABLAS SOCIALES
-- Cumpleaños, SOS, broadcast, chat, mapa, galería, historia.
-- ============================================================

create table if not exists public.person_locations (
  person_id     uuid primary key references public.persons(id) on delete cascade,
  city          text not null,
  country       char(2) not null,
  lat_city      double precision,
  lon_city      double precision,
  updated_at    timestamptz not null default now()
);

create table if not exists public.broadcasts (
  id             uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  message        text not null,
  scope          broadcast_scope not null default 'direct_family',
  branch_root_id uuid references public.persons(id),
  created_at     timestamptz not null default now()
);
create index if not exists idx_broadcasts_sender on public.broadcasts
  (sender_user_id, created_at desc);

create table if not exists public.broadcast_recipients (
  broadcast_id  uuid references public.broadcasts(id) on delete cascade,
  person_id     uuid references public.persons(id) on delete cascade,
  delivered_at  timestamptz,
  read_at       timestamptz,
  primary key (broadcast_id, person_id)
);

create table if not exists public.sos_alerts (
  id              uuid primary key default gen_random_uuid(),
  sender_user_id  uuid not null references auth.users(id) on delete cascade,
  lat             double precision,
  lon             double precision,
  message         text,
  status          sos_status not null default 'active',
  scope_degree    int not null default 2,
  triggered_at    timestamptz not null default now(),
  resolved_at     timestamptz,
  cooldown_until  timestamptz
);
create index if not exists idx_sos_active on public.sos_alerts (sender_user_id, status);
create index if not exists idx_sos_triggered on public.sos_alerts (triggered_at desc);

-- Respuestas a SOS
create table if not exists public.sos_responses (
  sos_id       uuid references public.sos_alerts(id) on delete cascade,
  responder_user_id uuid references auth.users(id) on delete cascade,
  response     text not null,   -- 'coming','called','safe','other'
  message      text,
  responded_at timestamptz not null default now(),
  primary key (sos_id, responder_user_id)
);

create table if not exists public.chat_rooms (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null,          -- 'siblings','parents_children','all_family','custom_branch'
  title          text not null,
  root_person_id uuid references public.persons(id),
  created_at     timestamptz not null default now()
);

create table if not exists public.chat_room_members (
  room_id    uuid references public.chat_rooms(id) on delete cascade,
  person_id  uuid references public.persons(id) on delete cascade,
  muted      boolean not null default false,
  joined_at  timestamptz not null default now(),
  primary key (room_id, person_id)
);

create table if not exists public.chat_messages (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.chat_rooms(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body           text not null,
  media_url      text,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index if not exists idx_chat_messages_room on public.chat_messages (room_id, created_at desc);

create table if not exists public.family_events (
  id                uuid primary key default gen_random_uuid(),
  event_type        text not null,   -- birth, marriage, death, graduation, custom
  person_id         uuid references public.persons(id),
  related_person_id uuid references public.persons(id),
  event_date        date not null,
  description       text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_events_date on public.family_events (event_date desc);

create table if not exists public.photos (
  id                uuid primary key default gen_random_uuid(),
  uploader_user_id  uuid not null references auth.users(id) on delete cascade,
  storage_path      text not null,
  caption           text,
  taken_at          date,
  scope             broadcast_scope not null default 'direct_family',
  created_at        timestamptz not null default now()
);

create table if not exists public.photo_tags (
  photo_id  uuid references public.photos(id) on delete cascade,
  person_id uuid references public.persons(id) on delete cascade,
  primary key (photo_id, person_id)
);

create table if not exists public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null unique,
  platform   text not null,     -- ios / android / web
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  birthdays          boolean default true,
  sos                boolean default true,
  broadcasts         boolean default true,
  new_family_members boolean default true,
  chat               boolean default true
);

-- Verificar
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('sos_alerts','chat_rooms','chat_messages','broadcasts','family_events','photos')
order by tablename;
