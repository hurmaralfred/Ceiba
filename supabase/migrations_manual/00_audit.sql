-- ============================================================
-- CEIBA — Paso 1: AUDITORÍA
-- Ejecutar TODO este archivo en el SQL Editor de Supabase
-- y guardar los resultados. Los necesitas para el backfill.
-- ============================================================

-- 1) ¿Qué tablas tienes hoy en public?
select table_name,
       (select count(*) from information_schema.columns c
        where c.table_schema='public' and c.table_name=t.table_name) as n_columns
from information_schema.tables t
where table_schema = 'public'
order by table_name;

-- 2) ¿Cuántas filas hay en cada tabla? (aproximado, rápido)
select schemaname, relname as table_name, n_live_tup as approx_rows
from pg_stat_user_tables
where schemaname = 'public'
order by n_live_tup desc;

-- 3) ¿Qué columnas tiene cada tabla de public?
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 4) ¿Qué FKs existen?
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as references_table,
  ccu.column_name as references_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
order by tc.table_name;

-- 5) ¿Qué RLS ya tienes activas?
select schemaname, tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 6) ¿Cuántos usuarios reales tienes en auth.users?
select count(*) as total_users from auth.users;

-- 7) Extensiones actualmente instaladas
select extname, extversion from pg_extension order by extname;

-- 8) Si tienes tablas de perfil, imprimir muestra (ajusta el nombre)
-- select * from public.profiles limit 3;
-- select * from public.users limit 3;
-- select * from public.family limit 3;
-- select * from public.family_members limit 3;

-- ============================================================
-- Copia los resultados de las consultas 1, 3 y 4 en un archivo.
-- Los usarás en 05_backfill_template.sql
-- ============================================================
