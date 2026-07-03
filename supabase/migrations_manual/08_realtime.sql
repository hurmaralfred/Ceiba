-- ============================================================
-- CEIBA — Paso 9: REALTIME
-- Activa Realtime en las tablas donde el cliente necesita
-- suscribirse a cambios en vivo.
-- ============================================================

-- Verificar publicación existe (Supabase la crea por defecto)
select pubname from pg_publication where pubname = 'supabase_realtime';

-- Agregar tablas (idempotente-ish: si ya está, PG tira warning)
do $$
begin
  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception when duplicate_object then null; end;

  begin
    alter publication supabase_realtime add table public.sos_alerts;
  exception when duplicate_object then null; end;

  begin
    alter publication supabase_realtime add table public.sos_responses;
  exception when duplicate_object then null; end;

  begin
    alter publication supabase_realtime add table public.broadcasts;
  exception when duplicate_object then null; end;

  begin
    alter publication supabase_realtime add table public.broadcast_recipients;
  exception when duplicate_object then null; end;

  begin
    alter publication supabase_realtime add table public.relationships;
  exception when duplicate_object then null; end;
end$$;

-- Verificar
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
order by tablename;
