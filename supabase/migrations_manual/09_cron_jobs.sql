-- ============================================================
-- CEIBA — Paso 10: JOBS DE PROGRAMACIÓN (pg_cron)
-- ============================================================
-- ⚠️ ANTES DE EJECUTAR:
--   1) Reemplaza <tu-project-ref> por tu referencia real
--   2) Reemplaza eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4eGR6eGR6ZXRxbGZlY3FoeGtsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjQ0MjE1OCwiZXhwIjoyMDk4MDE4MTU4fQ.0ymRFVpmkUHdxb0yQHCbSh8Tsa0REYdqOYnQ5ehLF4s por tu Service Role Key
--      (Supabase Dashboard → Settings → API → service_role)
--
-- Encuentras tu project-ref en la URL:
--   https://<project-ref>.supabase.co
-- ============================================================

-- Habilitar extensiones necesarias
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================
-- Job 1: Cumpleaños diarios
-- Corre todos los días a las 8:00 AM UTC.
-- Llama a la Edge Function 'cron-birthdays-daily' que envía los push.
-- ============================================================

select cron.unschedule('ceiba_birthdays_daily')
where exists (select 1 from cron.job where jobname = 'ceiba_birthdays_daily');

select cron.schedule(
  'ceiba_birthdays_daily',
  '0 8 * * *',
  $$
  select net.http_post(
    url := 'https://txxdzxdzetqlfecqhxkl.supabase.co/functions/v1/cron-birthdays-daily',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4eGR6eGR6ZXRxbGZlY3FoeGtsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjQ0MjE1OCwiZXhwIjoyMDk4MDE4MTU4fQ.0ymRFVpmkUHdxb0yQHCbSh8Tsa0REYdqOYnQ5ehLF4s',
      'Content-Type',  'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- Job 2: Limpieza de SOS expirados
-- Cada 15 minutos marca como 'expired' los SOS activos > 4 h.
-- ============================================================

select cron.unschedule('ceiba_cleanup_expired_sos')
where exists (select 1 from cron.job where jobname = 'ceiba_cleanup_expired_sos');

select cron.schedule(
  'ceiba_cleanup_expired_sos',
  '*/15 * * * *',
  $$
  update public.sos_alerts
     set status = 'expired', resolved_at = now()
   where status = 'active'
     and triggered_at < now() - interval '4 hours';
  $$
);

-- ============================================================
-- Job 3: Materializador de chats derivados
-- Cada hora refresca chat_rooms basados en el estado actual del grafo.
-- ============================================================

select cron.unschedule('ceiba_chat_materializer')
where exists (select 1 from cron.job where jobname = 'ceiba_chat_materializer');

select cron.schedule(
  'ceiba_chat_materializer',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://txxdzxdzetqlfecqhxkl.supabase.co/functions/v1/chat-room-materializer',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4eGR6eGR6ZXRxbGZlY3FoeGtsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjQ0MjE1OCwiZXhwIjoyMDk4MDE4MTU4fQ.0ymRFVpmkUHdxb0yQHCbSh8Tsa0REYdqOYnQ5ehLF4s',
      'Content-Type',  'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- Verificación
-- ============================================================
select jobid, jobname, schedule, active
from cron.job
where jobname like 'ceiba_%'
order by jobname;

-- Ver últimos runs:
-- select jobid, runid, job_pid, database, username, status, return_message, start_time, end_time
-- from cron.job_run_details
-- where jobid in (select jobid from cron.job where jobname like 'ceiba_%')
-- order by start_time desc
-- limit 20;
