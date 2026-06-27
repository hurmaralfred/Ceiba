-- ============================================================
-- CEIBA - Family Connection App
-- Supabase Schema
-- ============================================================

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "postgis"; -- for location queries

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  avatar_url text,
  bio text,
  birth_year int,
  gender text check (gender in ('male', 'female', 'other', 'prefer_not_to_say')),
  -- Location (opt-in)
  location_enabled boolean default false,
  latitude double precision,
  longitude double precision,
  location_updated_at timestamptz,
  city text,
  country text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles" on public.profiles
  for select using (true);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- ============================================================
-- FAMILY MEMBERS (pre-registered people added during onboarding)
-- Can become real users later when they accept an invitation
-- ============================================================
create table public.family_members (
  id uuid primary key default uuid_generate_v4(),
  added_by uuid references public.profiles(id) on delete cascade not null,
  -- If they joined the app, link to their profile
  profile_id uuid references public.profiles(id) on delete set null,
  -- Basic info (filled by the person who added them)
  first_name text not null,
  last_name text,
  email text,
  phone text,
  -- Relationship from added_by's perspective
  relation_type text not null check (relation_type in (
    'father', 'mother', 'son', 'daughter',
    'brother', 'sister',
    'spouse', 'partner',
    'grandfather_paternal', 'grandmother_paternal',
    'grandfather_maternal', 'grandmother_maternal',
    'grandson', 'granddaughter',
    'uncle', 'aunt', 'cousin',
    'father_in_law', 'mother_in_law',
    'brother_in_law', 'sister_in_law',
    'stepfather', 'stepmother', 'stepchild',
    'other'
  )),
  -- Is this a blood relation or by marriage/affinity?
  relation_kind text not null default 'blood' check (relation_kind in ('blood', 'affinity', 'other')),
  birth_date date,
  invitation_sent boolean default false,
  invitation_token text unique,
  invitation_sent_at timestamptz,
  created_at timestamptz default now()
);

-- Run this if birth_date column doesn't exist yet:
-- alter table public.family_members add column if not exists birth_date date;

alter table public.family_members enable row level security;

create policy "Users can view family members they added or that reference them" on public.family_members
  for select using (
    added_by = auth.uid() or profile_id = auth.uid()
  );

create policy "Users can insert family members" on public.family_members
  for insert with check (added_by = auth.uid());

create policy "Users can update family members they added" on public.family_members
  for update using (added_by = auth.uid());

-- ============================================================
-- RELATIONSHIPS (confirmed links between two profiles)
-- ============================================================
create table public.relationships (
  id uuid primary key default uuid_generate_v4(),
  profile_a uuid references public.profiles(id) on delete cascade not null,
  profile_b uuid references public.profiles(id) on delete cascade not null,
  -- Relation from profile_a's perspective
  relation_from_a text not null,
  -- Relation from profile_b's perspective (inverse)
  relation_from_b text not null,
  relation_kind text not null default 'blood' check (relation_kind in ('blood', 'affinity', 'other')),
  confirmed boolean default false,
  created_at timestamptz default now(),
  unique (profile_a, profile_b)
);

alter table public.relationships enable row level security;

create policy "Users can view their relationships" on public.relationships
  for select using (profile_a = auth.uid() or profile_b = auth.uid());

create policy "Users can create relationships" on public.relationships
  for insert with check (profile_a = auth.uid() or profile_b = auth.uid());

create policy "Users can update their relationships" on public.relationships
  for update using (profile_a = auth.uid() or profile_b = auth.uid());

-- ============================================================
-- INVITATIONS
-- ============================================================
create table public.invitations (
  id uuid primary key default uuid_generate_v4(),
  token text unique not null default encode(gen_random_bytes(32), 'hex'),
  invited_by uuid references public.profiles(id) on delete cascade not null,
  family_member_id uuid references public.family_members(id) on delete cascade,
  email text,
  phone text,
  status text default 'pending' check (status in ('pending', 'accepted', 'expired')),
  relation_type text not null,
  accepted_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz default (now() + interval '30 days'),
  created_at timestamptz default now()
);

alter table public.invitations enable row level security;

create policy "Users can view invitations they sent or received" on public.invitations
  for select using (invited_by = auth.uid() or accepted_by = auth.uid());

create policy "Anyone can view invitation by token" on public.invitations
  for select using (true);

create policy "Users can create invitations" on public.invitations
  for insert with check (invited_by = auth.uid());

create policy "Users can update invitations" on public.invitations
  for update using (invited_by = auth.uid() or accepted_by = auth.uid());

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Update updated_at timestamp
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at();

-- ============================================================
-- RECURSIVE FAMILY TREE QUERY (example)
-- Find all relatives up to N degrees of separation
-- ============================================================
-- Usage: select * from get_family_tree('user-uuid', 5);
create or replace function get_family_tree(start_profile_id uuid, max_depth int default 5)
returns table(
  profile_id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  relation_path text[],
  depth int,
  location_enabled boolean,
  latitude double precision,
  longitude double precision,
  city text,
  country text
) language sql security definer as $$
  with recursive family_graph as (
    -- Base case: the starting user
    select
      p.id as profile_id,
      p.first_name,
      p.last_name,
      p.avatar_url,
      array[]::text[] as relation_path,
      0 as depth,
      p.location_enabled,
      p.latitude,
      p.longitude,
      p.city,
      p.country,
      array[p.id] as visited
    from public.profiles p
    where p.id = start_profile_id

    union all

    -- Recursive case: expand relationships
    select
      p.id,
      p.first_name,
      p.last_name,
      p.avatar_url,
      fg.relation_path || r.relation_from_a,
      fg.depth + 1,
      p.location_enabled,
      p.latitude,
      p.longitude,
      p.city,
      p.country,
      fg.visited || p.id
    from family_graph fg
    join public.relationships r on (
      (r.profile_a = fg.profile_id and not (r.profile_b = any(fg.visited)))
      or (r.profile_b = fg.profile_id and not (r.profile_a = any(fg.visited)))
    )
    join public.profiles p on (
      case when r.profile_a = fg.profile_id then p.id = r.profile_b
           else p.id = r.profile_a end
    )
    where fg.depth < max_depth
  )
  select profile_id, first_name, last_name, avatar_url, relation_path, depth,
         location_enabled, latitude, longitude, city, country
  from family_graph
  where profile_id != start_profile_id;
$$;
