-- ============================================================
-- CEIBA — Paso 3: TABLAS NÚCLEO DEL GRAFO FAMILIAR
-- Idempotente. No modifica tablas existentes.
-- ============================================================

-- Tabla persons: nodo del grafo. Puede o no tener auth.users vinculado.
create table if not exists public.persons (
  id                  uuid primary key default gen_random_uuid(),
  first_names         text not null,
  last_names          text not null,
  normalized_name     text generated always as (
                        lower(unaccent(first_names || ' ' || last_names))
                      ) stored,
  email               citext,
  birth_date          date,
  birth_city          text,
  birth_country       char(2),
  profile_photo_url   text,
  photo_hash          text,
  is_living           boolean not null default true,
  death_date          date,
  gender              gender_enum default 'unknown',
  created_by_user_id  uuid references auth.users(id) on delete set null,
  linked_user_id      uuid unique references auth.users(id) on delete set null,
  status              person_status not null default 'active',
  verification_level  verification_level not null default 'unverified',
  bio                 text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,

  constraint death_after_birth
    check (death_date is null or birth_date is null or death_date >= birth_date)
);

-- Índices persons
create index if not exists idx_persons_normalized_name on public.persons
  using gin (normalized_name gin_trgm_ops);
create index if not exists idx_persons_birth_date  on public.persons (birth_date);
create index if not exists idx_persons_birth_month_day on public.persons
  ((extract(month from birth_date)::int * 100 + extract(day from birth_date)::int));
create index if not exists idx_persons_email       on public.persons (email);
create index if not exists idx_persons_linked_user on public.persons (linked_user_id);
create index if not exists idx_persons_status      on public.persons (status);


-- Tabla relationships: aristas del grafo
create table if not exists public.relationships (
  id                    uuid primary key default gen_random_uuid(),
  person_a_id           uuid not null references public.persons(id) on delete cascade,
  person_b_id           uuid not null references public.persons(id) on delete cascade,
  relationship_type     relationship_type not null,
  pair_key              text generated always as (
                          least(person_a_id::text, person_b_id::text)
                          || '__' ||
                          greatest(person_a_id::text, person_b_id::text)
                          || '::' || relationship_type::text
                        ) stored unique,
  source                text default 'declared',
  declared_by_user_id   uuid references auth.users(id) on delete set null,
  confidence_score      int  default 100,
  status                relationship_status not null default 'pending',
  system_inferred       boolean not null default false,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint no_self_relationship check (person_a_id <> person_b_id)
);

create index if not exists idx_rel_person_a on public.relationships (person_a_id, relationship_type, status);
create index if not exists idx_rel_person_b on public.relationships (person_b_id, relationship_type, status);
create index if not exists idx_rel_status   on public.relationships (status);
create index if not exists idx_rel_confirmed_type on public.relationships (relationship_type)
  where status = 'confirmed';


-- Tabla match_candidates
create table if not exists public.match_candidates (
  id                     uuid primary key default gen_random_uuid(),
  proposed_by_user_id    uuid not null references auth.users(id) on delete cascade,
  new_person_payload     jsonb not null,
  matched_person_id      uuid not null references public.persons(id) on delete cascade,
  score                  int  not null,
  score_breakdown        jsonb,
  proposed_relationship  jsonb not null,
  status                 match_status not null default 'pending',
  resolved_at            timestamptz,
  created_at             timestamptz not null default now()
);
create index if not exists idx_match_proposed on public.match_candidates
  (proposed_by_user_id, status, score desc);


-- Tabla claim_requests
create table if not exists public.claim_requests (
  id                     uuid primary key default gen_random_uuid(),
  person_id              uuid not null references public.persons(id) on delete cascade,
  requesting_user_id     uuid not null references auth.users(id) on delete cascade,
  evidence               jsonb,
  status                 claim_status not null default 'pending_family_confirmation',
  confirmations_needed   int not null default 1,
  confirmations_received uuid[] default array[]::uuid[],
  created_at             timestamptz not null default now(),
  resolved_at            timestamptz
);


-- Tabla merge_history
create table if not exists public.merge_history (
  id                uuid primary key default gen_random_uuid(),
  source_person_id  uuid not null,
  target_person_id  uuid not null references public.persons(id),
  reason            text,
  performed_by      uuid references auth.users(id),
  snapshot          jsonb,
  created_at        timestamptz not null default now()
);


-- Tabla audit_logs
create table if not exists public.audit_logs (
  id             bigserial primary key,
  actor_user_id  uuid references auth.users(id) on delete set null,
  action         text not null,
  target_type    text not null,
  target_id      uuid,
  diff           jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists idx_audit_created_at on public.audit_logs (created_at desc);

-- Verificar
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('persons','relationships','match_candidates','claim_requests','merge_history','audit_logs')
order by tablename;
