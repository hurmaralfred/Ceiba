-- ============================================================
-- CEIBA — Paso 2: EXTENSIONES Y ENUMS
-- Idempotente. Se puede correr varias veces sin efectos secundarios.
-- ============================================================

-- Extensiones necesarias
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "unaccent";   -- normalizar tildes
create extension if not exists "pg_trgm";    -- similitud de nombres
create extension if not exists "citext";     -- emails case-insensitive
-- create extension if not exists "postgis"; -- opcional, para mapa avanzado

-- Enums (envueltos en DO $$ para evitar error si ya existen)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'person_status') then
    create type person_status as enum
      ('active','pending_merge','merged','unverified','deleted');
  end if;

  if not exists (select 1 from pg_type where typname = 'verification_level') then
    create type verification_level as enum
      ('unverified','family_verified','self_verified');
  end if;

  if not exists (select 1 from pg_type where typname = 'relationship_type') then
    create type relationship_type as enum
      ('parent_of','partner_of','sibling_of',
       'half_sibling_of','guardian_of','adoptive_parent_of');
  end if;

  if not exists (select 1 from pg_type where typname = 'relationship_status') then
    create type relationship_status as enum
      ('pending','confirmed','rejected','system_inferred');
  end if;

  if not exists (select 1 from pg_type where typname = 'match_status') then
    create type match_status as enum
      ('pending','confirmed','rejected','auto_confirmed');
  end if;

  if not exists (select 1 from pg_type where typname = 'claim_status') then
    create type claim_status as enum
      ('pending_family_confirmation','approved','rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'sos_status') then
    create type sos_status as enum
      ('active','resolved','cancelled','expired');
  end if;

  if not exists (select 1 from pg_type where typname = 'broadcast_scope') then
    create type broadcast_scope as enum
      ('direct_family','extended_family','specific_branch','all');
  end if;

  if not exists (select 1 from pg_type where typname = 'gender_enum') then
    create type gender_enum as enum ('M','F','X','unknown');
  end if;
end$$;

-- Verificar
select typname from pg_type
where typname in ('person_status','relationship_type','sos_status','gender_enum')
order by typname;
