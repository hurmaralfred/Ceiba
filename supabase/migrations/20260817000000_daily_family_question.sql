create table if not exists daily_family_question (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references family_spaces(id) on delete cascade,
  question_date date not null,
  question_text text not null,
  context_summary text,
  created_at timestamptz not null default now(),
  unique(space_id, question_date)
);

create index if not exists idx_dfq_space_date on daily_family_question(space_id, question_date desc);

alter table daily_family_question enable row level security;

create policy "members can read their space questions"
  on daily_family_question for select
  using (
    exists (
      select 1 from space_memberships sm
      join person_claims pc on pc.person_id = sm.person_id
      where sm.space_id = daily_family_question.space_id
        and pc.user_id = auth.uid()
        and pc.claim_status = 'approved'
        and pc.revoked_at is null
    )
  );
