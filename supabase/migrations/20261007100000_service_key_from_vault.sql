-- La clave service_role deja de estar escrita en la base: se lee de Supabase Vault.
--
-- Hoy, 4 objetos de la base llevan el JWT service_role literal en su definición:
--   trigger sos_dispatcher (aviso de SOS)         -> functions/v1/sos-dispatcher
--   cron ceiba_birthdays_daily  (0 8 * * *)       -> functions/v1/cron-birthdays-daily
--   cron ceiba_chat_materializer (5 * * * *)      -> functions/v1/chat-room-materializer
--   cron ceiba_invite_reminder  (0 9,14,19 * * *) -> functions/v1/invite-reminder
-- Esa clave quedó pública en GitHub. Al rotarla, estos 4 dejarían de funcionar sin
-- avisar (SOS incluido) si siguen con la clave vieja escrita dentro.
--
-- ORDEN DE USO (no aplicar antes de los pasos 1 y 2):
--   1. Rotar la clave en Supabase.
--   2. Guardar la clave NUEVA en Vault, desde el SQL Editor (yo nunca la veo):
--        select vault.create_secret('<clave service_role nueva>', 'service_role_key');
--   3. Aplicar esta migración. Si el secreto no existe, ABORTA sin cambiar nada.

-- 0. Salvaguarda: sin el secreto en Vault no se toca nada.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'service_role_key') then
    raise exception 'Falta el secreto "service_role_key" en Vault. Créalo primero (ver cabecera).';
  end if;
end $$;

-- 1. Esquema privado (no expuesto por PostgREST) con la lectura de la clave.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.service_role_key()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1
$$;
revoke all on function private.service_role_key() from public, anon, authenticated;

-- 2. SOS: misma petición que hacía supabase_functions.http_request (mismo cuerpo,
--    mismo timeout de 5 s), pero con la clave leída de Vault. Si el envío falla,
--    el aviso SOS se guarda igual: crear la alerta nunca debe depender del despacho.
create or replace function private.dispatch_sos_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := private.service_role_key();
begin
  if v_key is null then
    raise warning 'dispatch_sos_alert: falta el secreto service_role_key en Vault';
    return new;
  end if;

  perform net.http_post(
    url := 'https://txxdzxdzetqlfecqhxkl.supabase.co/functions/v1/sos-dispatcher',
    body := jsonb_build_object(
      'old_record', null,
      'record', to_jsonb(new),
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  raise warning 'dispatch_sos_alert: % (%)', sqlerrm, sqlstate;
  return new;
end;
$$;
revoke all on function private.dispatch_sos_alert() from public, anon, authenticated;

drop trigger if exists sos_dispatcher on public.sos_alerts;
create trigger sos_dispatcher
  after insert on public.sos_alerts
  for each row execute function private.dispatch_sos_alert();

-- 3. Tareas programadas: misma URL, mismo horario, clave de Vault.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'ceiba_birthdays_daily'),
  command := $cmd$
    select net.http_post(
      url := 'https://txxdzxdzetqlfecqhxkl.supabase.co/functions/v1/cron-birthdays-daily',
      headers := jsonb_build_object('Authorization', 'Bearer ' || private.service_role_key()),
      body := '{}'::jsonb
    );
  $cmd$);

select cron.alter_job(
  (select jobid from cron.job where jobname = 'ceiba_chat_materializer'),
  command := $cmd$
    select net.http_post(
      url := 'https://txxdzxdzetqlfecqhxkl.supabase.co/functions/v1/chat-room-materializer',
      headers := jsonb_build_object('Authorization', 'Bearer ' || private.service_role_key()),
      body := '{}'::jsonb
    );
  $cmd$);

select cron.alter_job(
  (select jobid from cron.job where jobname = 'ceiba_invite_reminder'),
  command := $cmd$
    select net.http_post(
      url := 'https://txxdzxdzetqlfecqhxkl.supabase.co/functions/v1/invite-reminder',
      headers := jsonb_build_object('Authorization', 'Bearer ' || private.service_role_key(), 'Content-Type', 'application/json'),
      body := '{}'::jsonb
    );
  $cmd$);
