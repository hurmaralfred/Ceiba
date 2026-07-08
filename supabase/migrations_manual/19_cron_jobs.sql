-- ============================================================
-- CEIBA — Paso 10: JOBS DE PROGRAMACIÓN (pg_cron)
-- ============================================================
-- ⚠️ ANTES DE EJECUTAR (una sola vez, a mano, en el SQL Editor —
-- NUNCA pegues la key en este archivo ni la commitees a git):
--
--   1) Rota tu service_role key si la anterior alguna vez estuvo
--      en un commit (Dashboard → Settings → API → Reset).
--   2) Guarda la key nueva en Supabase Vault (una sola vez):
--        select vault.create_secret(
--          '<pega-aquí-tu-service-role-key-nueva>',
--          'ceiba_service_role_key',
--          'Service role key para cron jobs (pg_net) — no versionar'
--        );
--   3) Los jobs de abajo la leen de Vault por nombre, nunca por
--      valor — este archivo es seguro de commitear.
-- ============================================================

-- Habilitar extensiones necesarias
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

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
    url := 'https://txxdzxdzetqlfecqhxkl.functions.supabase.co/cron-birthdays-daily',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'ceiba_service_role_key'
      ),
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
    url := 'https://txxdzxdzetqlfecqhxkl.functions.supabase.co/chat-room-materializer',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'ceiba_service_role_key'
      ),
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
