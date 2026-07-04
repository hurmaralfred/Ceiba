-- ============================================================
-- CEIBA — Paso 8: ROW LEVEL SECURITY
-- ⚠️ ATENCIÓN: este script activa RLS. Si algo no carga en la app,
-- descomenta el bloque final "MODO DIAGNÓSTICO" para relajar temporalmente.
-- ============================================================

-- Activar RLS en todas las tablas
alter table public.persons              enable row level security;
alter table public.relationships        enable row level security;
alter table public.match_candidates     enable row level security;
alter table public.claim_requests       enable row level security;
alter table public.merge_history        enable row level security;
alter table public.audit_logs           enable row level security;

alter table public.person_locations     enable row level security;
alter table public.broadcasts           enable row level security;
alter table public.broadcast_recipients enable row level security;
alter table public.sos_alerts           enable row level security;
alter table public.sos_responses        enable row level security;
alter table public.chat_rooms           enable row level security;
alter table public.chat_room_members    enable row level security;
alter table public.chat_messages        enable row level security;
alter table public.family_events        enable row level security;
alter table public.photos               enable row level security;
alter table public.photo_tags           enable row level security;
alter table public.push_tokens          enable row level security;
alter table public.notification_preferences enable row level security;

-- ============================================================
-- PERSONS
-- ============================================================
drop policy if exists persons_read on public.persons;
create policy persons_read on public.persons
for select using (
  linked_user_id = auth.uid()
  or created_by_user_id = auth.uid()
  or public.is_in_my_family(id, 4)
);

drop policy if exists persons_insert on public.persons;
create policy persons_insert on public.persons
for insert with check (created_by_user_id = auth.uid());

drop policy if exists persons_update on public.persons;
create policy persons_update on public.persons
for update using (
  linked_user_id = auth.uid()
  or created_by_user_id = auth.uid()
);

drop policy if exists persons_delete on public.persons;
create policy persons_delete on public.persons
for delete using (false);  -- solo soft delete vía funciones

-- ============================================================
-- RELATIONSHIPS
-- ============================================================
drop policy if exists rel_read on public.relationships;
create policy rel_read on public.relationships
for select using (
  exists (
    select 1 from public.persons p
    where (p.id = relationships.person_a_id or p.id = relationships.person_b_id)
      and (p.linked_user_id = auth.uid()
           or p.created_by_user_id = auth.uid()
           or public.is_in_my_family(p.id, 4))
  )
);

drop policy if exists rel_insert on public.relationships;
create policy rel_insert on public.relationships
for insert with check (
  declared_by_user_id = auth.uid()
  and (
    -- El usuario es dueño de al menos una de las dos personas
    exists (select 1 from public.persons p
            where p.id = person_a_id
              and (p.linked_user_id = auth.uid() or p.created_by_user_id = auth.uid()))
    or exists (select 1 from public.persons p
               where p.id = person_b_id
                 and (p.linked_user_id = auth.uid() or p.created_by_user_id = auth.uid()))
  )
);

drop policy if exists rel_update on public.relationships;
create policy rel_update on public.relationships
for update using (declared_by_user_id = auth.uid());

-- ============================================================
-- MATCH_CANDIDATES
-- ============================================================
drop policy if exists match_read on public.match_candidates;
create policy match_read on public.match_candidates
for select using (proposed_by_user_id = auth.uid());

drop policy if exists match_insert on public.match_candidates;
create policy match_insert on public.match_candidates
for insert with check (proposed_by_user_id = auth.uid());

-- ============================================================
-- CLAIM_REQUESTS
-- ============================================================
drop policy if exists claim_read on public.claim_requests;
create policy claim_read on public.claim_requests
for select using (
  requesting_user_id = auth.uid()
  or public.is_in_my_family(claim_requests.person_id, 4)
);

drop policy if exists claim_insert on public.claim_requests;
create policy claim_insert on public.claim_requests
for insert with check (requesting_user_id = auth.uid());

-- ============================================================
-- SOS_ALERTS
-- ============================================================
drop policy if exists sos_read on public.sos_alerts;
create policy sos_read on public.sos_alerts
for select using (
  sender_user_id = auth.uid()
  or exists (
    select 1 from public.persons p
    where p.linked_user_id = sos_alerts.sender_user_id
      and public.is_in_my_family(p.id, sos_alerts.scope_degree)
  )
);

drop policy if exists sos_insert on public.sos_alerts;
create policy sos_insert on public.sos_alerts
for insert with check (sender_user_id = auth.uid());

drop policy if exists sos_update on public.sos_alerts;
create policy sos_update on public.sos_alerts
for update using (sender_user_id = auth.uid());

-- ============================================================
-- SOS_RESPONSES
-- ============================================================
drop policy if exists sos_resp_read on public.sos_responses;
create policy sos_resp_read on public.sos_responses
for select using (
  responder_user_id = auth.uid()
  or exists (
    select 1 from public.sos_alerts s
    where s.id = sos_responses.sos_id
      and s.sender_user_id = auth.uid()
  )
);

drop policy if exists sos_resp_insert on public.sos_responses;
create policy sos_resp_insert on public.sos_responses
for insert with check (responder_user_id = auth.uid());

-- ============================================================
-- BROADCASTS
-- ============================================================
drop policy if exists bc_read on public.broadcasts;
create policy bc_read on public.broadcasts
for select using (
  sender_user_id = auth.uid()
  or exists (
    select 1 from public.broadcast_recipients br
    join public.persons p on p.id = br.person_id
    where br.broadcast_id = broadcasts.id
      and p.linked_user_id = auth.uid()
  )
);

drop policy if exists bc_insert on public.broadcasts;
create policy bc_insert on public.broadcasts
for insert with check (sender_user_id = auth.uid());

drop policy if exists bcr_read on public.broadcast_recipients;
create policy bcr_read on public.broadcast_recipients
for select using (
  exists (select 1 from public.persons p
          where p.id = broadcast_recipients.person_id
            and p.linked_user_id = auth.uid())
  or exists (select 1 from public.broadcasts b
             where b.id = broadcast_recipients.broadcast_id
               and b.sender_user_id = auth.uid())
);

-- ============================================================
-- CHAT
-- ============================================================
drop policy if exists chat_room_read on public.chat_rooms;
create policy chat_room_read on public.chat_rooms
for select using (
  exists (select 1 from public.chat_room_members m
          join public.persons p on p.id = m.person_id
          where m.room_id = chat_rooms.id
            and p.linked_user_id = auth.uid())
);

drop policy if exists chat_members_read on public.chat_room_members;
create policy chat_members_read on public.chat_room_members
for select using (
  exists (select 1 from public.persons p
          where p.id = chat_room_members.person_id
            and p.linked_user_id = auth.uid())
  or exists (select 1 from public.chat_room_members m2
             join public.persons p2 on p2.id = m2.person_id
             where m2.room_id = chat_room_members.room_id
               and p2.linked_user_id = auth.uid())
);

drop policy if exists chat_msg_read on public.chat_messages;
create policy chat_msg_read on public.chat_messages
for select using (
  exists (
    select 1 from public.chat_room_members m
    join public.persons p on p.id = m.person_id
    where m.room_id = chat_messages.room_id
      and p.linked_user_id = auth.uid()
  )
);

drop policy if exists chat_msg_insert on public.chat_messages;
create policy chat_msg_insert on public.chat_messages
for insert with check (
  sender_user_id = auth.uid()
  and exists (
    select 1 from public.chat_room_members m
    join public.persons p on p.id = m.person_id
    where m.room_id = chat_messages.room_id
      and p.linked_user_id = auth.uid()
  )
);

-- ============================================================
-- OTRAS
-- ============================================================
drop policy if exists loc_read on public.person_locations;
create policy loc_read on public.person_locations
for select using (
  public.is_in_my_family(person_id, 4)
  or exists (select 1 from public.persons p
             where p.id = person_locations.person_id
               and p.linked_user_id = auth.uid())
);

drop policy if exists loc_write on public.person_locations;
create policy loc_write on public.person_locations
for all using (
  exists (select 1 from public.persons p
          where p.id = person_locations.person_id
            and p.linked_user_id = auth.uid())
);

drop policy if exists events_read on public.family_events;
create policy events_read on public.family_events
for select using (
  (person_id is null and related_person_id is null)
  or (person_id is not null and public.is_in_my_family(person_id, 4))
  or (related_person_id is not null and public.is_in_my_family(related_person_id, 4))
);

drop policy if exists prefs_all on public.notification_preferences;
create policy prefs_all on public.notification_preferences
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists tokens_all on public.push_tokens;
create policy tokens_all on public.push_tokens
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- audit_logs y merge_history: solo lectura via service_role
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs
for select using (actor_user_id = auth.uid());

-- ============================================================
-- MODO DIAGNÓSTICO (comentado)
-- Descomentar SOLO si algo no carga tras activar RLS.
-- Devuelve permisos amplios mientras depuras.
-- ============================================================
--
-- drop policy if exists persons_read on public.persons;
-- create policy persons_read on public.persons for select using (true);
--
-- drop policy if exists rel_read on public.relationships;
-- create policy rel_read on public.relationships for select using (true);

-- ============================================================
-- Verificar policies activas
-- ============================================================
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
