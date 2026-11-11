-- Corrige el job pg_cron ceiba_cleanup_expired_sos.
--
-- Cada 15 minutos marca como expired las alertas SOS activas de más de 4 horas.
-- El comando filtraba por created_at, columna que no existe en public.sos_alerts
-- (el error en producción es: column "created_at" does not exist).
--
-- El inicio de la alerta es triggered_at (timestamptz NOT NULL DEFAULT now()).
-- trigger_sos() no escribe otra marca de tiempo: ordena por triggered_at y deja
-- el default. El índice idx_sos_triggered y los tipos de la app usan esa columna.
-- No se agrega created_at.
--
-- Solo cambia el comando de este job, buscado por nombre. No se toca el horario
-- */15 * * * *, ni active, ni ningún otro cron (ceiba_birthdays_daily,
-- ceiba_chat_materializer, ceiba_invite_reminder, etc.).
-- Si el job todavía no existe, se crea con ese mismo nombre y horario.
-- Si el horario en la base no es */15 * * * *, la migración aborta sin cambios.
--
-- Revisar antes de aplicar. No ejecutar contra producción hasta aprobar este cambio.

do $migration$
declare
  v_jobid bigint;
  v_count integer;
  v_schedule text;
  v_command text;
  v_database text;
  v_username text;
  v_active boolean;
  v_jobid_before bigint;
  v_schedule_before text;
  v_database_before text;
  v_username_before text;
  v_active_before boolean;
  v_new_command text := $cmd$update public.sos_alerts
set status = 'expired'
where status = 'active'
  and triggered_at < now() - interval '4 hours';$cmd$;
begin
  if to_regclass('cron.job') is null then
    raise exception 'pg_cron no está disponible (cron.job no existe). No se modificó ningún job.';
  end if;

  if to_regclass('public.sos_alerts') is null
     or not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'sos_alerts'
         and column_name = 'triggered_at'
     ) then
    raise exception 'public.sos_alerts.triggered_at no existe. No se modificó ningún job.';
  end if;

  create temp table _ceiba_cron_others on commit drop as
  select jobid, jobname, schedule, command, active, database, username
  from cron.job
  where jobname is distinct from 'ceiba_cleanup_expired_sos';

  select count(*) into v_count
  from cron.job
  where jobname = 'ceiba_cleanup_expired_sos';

  if v_count > 1 then
    raise exception 'hay % jobs llamados ceiba_cleanup_expired_sos. No se modificó ninguno.', v_count;
  elsif v_count = 0 then
    perform cron.schedule(
      'ceiba_cleanup_expired_sos',
      '*/15 * * * *',
      v_new_command
    );
  else
    select jobid, schedule, database, username, active
      into v_jobid_before, v_schedule_before, v_database_before, v_username_before, v_active_before
    from cron.job
    where jobname = 'ceiba_cleanup_expired_sos';

    if v_schedule_before is distinct from '*/15 * * * *' then
      raise exception
        'el horario de ceiba_cleanup_expired_sos es %, se esperaba */15 * * * *. No se modificó el job.',
        v_schedule_before;
    end if;

    perform cron.alter_job(
      job_id := v_jobid_before,
      command := v_new_command
    );
  end if;

  select jobid, schedule, command, database, username, active
    into v_jobid, v_schedule, v_command, v_database, v_username, v_active
  from cron.job
  where jobname = 'ceiba_cleanup_expired_sos';

  if v_count = 1 and v_jobid is distinct from v_jobid_before then
    raise exception 'alter_job cambió el jobid de ceiba_cleanup_expired_sos';
  end if;

  if v_count = 1 and (
       v_schedule is distinct from v_schedule_before
    or v_database is distinct from v_database_before
    or v_username is distinct from v_username_before
    or v_active is distinct from v_active_before
  ) then
    raise exception 'alter_job modificó horario, base, usuario o estado del job';
  end if;

  if v_schedule is distinct from '*/15 * * * *' then
    raise exception 'el horario de ceiba_cleanup_expired_sos quedó en %', v_schedule;
  end if;

  if v_active is distinct from true then
    raise exception 'ceiba_cleanup_expired_sos no quedó activo';
  end if;

  if btrim(v_command) is distinct from btrim(v_new_command)
     or position('created_at' in v_command) > 0
     or position('triggered_at' in v_command) = 0 then
    raise exception 'el comando de ceiba_cleanup_expired_sos no quedó corregido: %', v_command;
  end if;

  if (select count(*) from cron.job where jobname is distinct from 'ceiba_cleanup_expired_sos')
     is distinct from (select count(*) from _ceiba_cron_others) then
    raise exception 'cambió el número de cron jobs distintos de ceiba_cleanup_expired_sos';
  end if;

  if exists (
    select 1
    from _ceiba_cron_others o
    where not exists (
      select 1
      from cron.job j
      where j.jobid = o.jobid
        and j.jobname is not distinct from o.jobname
        and j.schedule is not distinct from o.schedule
        and j.command is not distinct from o.command
        and j.active is not distinct from o.active
        and j.database is not distinct from o.database
        and j.username is not distinct from o.username
    )
  ) then
    raise exception 'se modificó un cron job distinto de ceiba_cleanup_expired_sos';
  end if;
end
$migration$;
