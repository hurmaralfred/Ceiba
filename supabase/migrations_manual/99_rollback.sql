-- ============================================================
-- CEIBA — Rollback de emergencia
-- ⚠️ Solo úsalo si necesitas revertir la migración.
-- No restaura datos borrados: usa el backup del Paso 0.
-- ============================================================

-- Desactivar cron jobs
select cron.unschedule(jobname) from cron.job where jobname like 'ceiba_%';

-- Quitar tablas de Realtime
do $$
begin
  begin alter publication supabase_realtime drop table public.chat_messages; exception when others then null; end;
  begin alter publication supabase_realtime drop table public.sos_alerts;    exception when others then null; end;
  begin alter publication supabase_realtime drop table public.sos_responses; exception when others then null; end;
  begin alter publication supabase_realtime drop table public.broadcasts;    exception when others then null; end;
  begin alter publication supabase_realtime drop table public.broadcast_recipients; exception when others then null; end;
  begin alter publication supabase_realtime drop table public.relationships; exception when others then null; end;
end$$;

-- Drop de policies y RLS (no borra datos)
do $$
declare pol record;
begin
  for pol in
    select schemaname, tablename, policyname
      from pg_policies where schemaname = 'public'
       and tablename in (
        'persons','relationships','match_candidates','claim_requests',
        'merge_history','audit_logs','person_locations','broadcasts',
        'broadcast_recipients','sos_alerts','sos_responses','chat_rooms',
        'chat_room_members','chat_messages','family_events','photos','photo_tags',
        'push_tokens','notification_preferences'
       )
  loop
    execute format('drop policy if exists %I on %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end$$;

-- Drop de funciones
drop function if exists public.is_in_my_family(uuid,int) cascade;
drop function if exists public.find_person_matches(jsonb) cascade;
drop function if exists public.get_my_family_graph(int) cascade;
drop function if exists public.trigger_sos(double precision, double precision, text, int) cascade;
drop function if exists public.respond_sos(uuid, text, text) cascade;
drop function if exists public.cancel_sos(uuid) cascade;
drop function if exists public.upcoming_birthdays(int) cascade;
drop function if exists public.confirm_match(uuid) cascade;
drop function if exists public.reject_match(uuid) cascade;
drop function if exists public.add_relative(jsonb, relationship_type) cascade;

-- Drop de triggers
drop trigger if exists persons_updated_at on public.persons;
drop trigger if exists relationships_updated_at on public.relationships;
drop trigger if exists trg_no_cycle on public.relationships;
drop trigger if exists trg_parent_birth on public.relationships;
drop trigger if exists trg_normalize_sym on public.relationships;
drop trigger if exists trg_audit_rel on public.relationships;
drop trigger if exists trg_audit_person on public.persons;

-- Drop de tablas nuevas (⚠️ borra datos migrados)
-- Descomentar solo si estás 100% seguro:
--
-- drop table if exists public.sos_responses cascade;
-- drop table if exists public.sos_alerts cascade;
-- drop table if exists public.chat_messages cascade;
-- drop table if exists public.chat_room_members cascade;
-- drop table if exists public.chat_rooms cascade;
-- drop table if exists public.broadcast_recipients cascade;
-- drop table if exists public.broadcasts cascade;
-- drop table if exists public.person_locations cascade;
-- drop table if exists public.family_events cascade;
-- drop table if exists public.photo_tags cascade;
-- drop table if exists public.photos cascade;
-- drop table if exists public.push_tokens cascade;
-- drop table if exists public.notification_preferences cascade;
-- drop table if exists public.claim_requests cascade;
-- drop table if exists public.match_candidates cascade;
-- drop table if exists public.merge_history cascade;
-- drop table if exists public.audit_logs cascade;
-- drop table if exists public.relationships cascade;
-- drop table if exists public.persons cascade;

-- Enums (mismo criterio)
-- drop type if exists person_status cascade;
-- drop type if exists verification_level cascade;
-- drop type if exists relationship_type cascade;
-- drop type if exists relationship_status cascade;
-- drop type if exists match_status cascade;
-- drop type if exists claim_status cascade;
-- drop type if exists sos_status cascade;
-- drop type if exists broadcast_scope cascade;
-- drop type if exists gender_enum cascade;
