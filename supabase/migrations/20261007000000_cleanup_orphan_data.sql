-- Limpieza de datos huérfanos / inconsistentes (PREPARADA, NO APLICADA).
-- Todo es borrado lógico (reversible); no se elimina ninguna fila.
-- Cada UPDATE lleva guardas: si la fila ya no cumple la condición, no se toca.
--
-- Reversión (si hiciera falta):
--   update public.persons set deleted_at = null, status = 'active' where id in (...);
--   update public.family_spaces set status = 'active' where id = 'b063c68b-ba1a-495a-8864-05169e887a78';

-- 1. Personas con status='deleted' pero sin deleted_at (inconsistente: el árbol
--    las trata como activas). Esperado: 1 fila ("VerifDeploy Final", prueba de despliegue).
update public.persons
   set deleted_at = now()
 where status = 'deleted'
   and deleted_at is null;

-- 2. Dos "Roberto García" duplicados creados el 2026-08-29 por la cuenta de
--    simulación (bb35e628…): sin cuenta, sin relaciones, sin espacio, sin invitaciones.
update public.persons p
   set status = 'deleted', deleted_at = now()
 where p.id in ('696628d3-0d72-4851-9075-2fb2326dccfa',
                '62ff12a5-be55-47b0-b287-2b7561042f1c')
   and p.deleted_at is null
   and not exists (select 1 from public.relationships r
                    where r.deleted_at is null and (r.person_a_id = p.id or r.person_b_id = p.id))
   and not exists (select 1 from public.person_claims c where c.person_id = p.id)
   and not exists (select 1 from public.space_memberships sm where sm.person_id = p.id)
   and not exists (select 1 from public.invitations i where i.person_id = p.id);

-- 3. Espacio activo sin ningún miembro ni rol (creado 2026-08-29 por la misma cuenta).
--    El cron de pregunta diaria genera preguntas para todo espacio 'active'
--    (ya acumula 39 para un espacio vacío). Se inactiva, no se borra.
update public.family_spaces fs
   set status = 'inactive'
 where fs.id = 'b063c68b-ba1a-495a-8864-05169e887a78'
   and fs.status = 'active'
   and not exists (select 1 from public.space_memberships sm where sm.space_id = fs.id)
   and not exists (select 1 from public.space_user_roles r where r.space_id = fs.id);

-- ─── REQUIERE DECISIÓN (no se ejecuta) ───────────────────────────────────────
-- Lisset (ff764cb9-30c8-49b8-93e0-8da2764b2664) tiene 3 padres/madres biológicos:
--   Jorge Mendoza     (8562f70c…, sin cuenta, 1 relación)
--   Maribel evelyn    (8ec0820c…, CON cuenta, 5 relaciones)
--   Maribel Zambrano  (a6a52c1e…, sin cuenta, 1 relación)  <- probable duplicado de la anterior
-- Si Maribel Zambrano es la misma persona que Maribel evelyn, sobra esta relación:
--
-- update public.relationships set deleted_at = now()
--  where id = 'fdea7ac3-9064-40c0-a6fc-63fc31a113d7' and deleted_at is null;
-- update public.persons set status = 'deleted', deleted_at = now()
--  where id = 'a6a52c1e-6429-4d98-9c91-7f7e4738632e' and deleted_at is null;
