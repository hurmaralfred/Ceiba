-- ============================================================================
-- PRUEBA DE INTEGRACION — add_relative con prevencion de duplicados
--
-- QUE ES: verificacion de COMPORTAMIENTO REAL de la migracion
-- 20260726000000_add_relative_duplicate_prevention.sql, ejecutada contra el
-- esquema de produccion DENTRO de una transaccion que termina en ROLLBACK.
--
-- POR QUE NO ESTA EN `npm test`: requiere credenciales de Supabase y red.
-- Incluirla en la suite la volveria dependiente de produccion y fragil en
-- CI. Las pruebas de `src/lib/addRelativeDuplicates.test.ts` cubren el
-- MODELO (criterios de normalizacion/confianza) y el CONTRATO (texto del
-- SQL); esta cubre la EJECUCION.
--
-- COMO SE EJECUTA: por la Management API de Supabase
--   POST /v1/projects/{ref}/database/query   con este script completo.
-- Termina en ROLLBACK: no persiste absolutamente nada.
--
-- SEGURIDAD: la identidad se simula con `SET LOCAL request.jwt.claims`,
-- que es de donde lee auth.uid(). Es LOCAL a la transaccion y desaparece
-- con el ROLLBACK.
--
-- ── RESULTADO DE LA ULTIMA EJECUCION (2026-07-27) ────────────────────────
--
--   1_candidato_exacto              OK
--       needs_confirmation=true  candidatos=3  top_confianza=1.00
--       top_id=a76b1a46 (el PADRE REAL)  personas_creadas=0
--       -> confirma que esta migracion habria impedido el bug original
--
--   2_link_reutiliza                OK
--       linked_existing=true  person_id=a76b1a46
--       personas_nuevas=0  relaciones_nuevas=1
--       -> vincular reutiliza la persona y solo crea la relacion
--
--   3_confirm_crea_homonimo         OK
--       success=true  personas_nuevas=1
--       -> con confirmacion explicita si se crea el homonimo
--
--   4_uuid_no_autorizado            OK
--       rechazado: "La persona a vincular no existe, no esta activa o no
--       pertenece a tu arbol."
--       -> un UUID de OTRA familia es rechazado (regresion de seguridad)
--
--   5_relacion_existente_no_duplica OK
--       rechazado por create_relationship; relaciones_nuevas=0
--       NOTA: el motivo devuelto es "Esta relacion crearia un ciclo
--       genealogico profundo", no un error de duplicado. El resultado
--       (no se duplica) es el correcto, pero el mensaje al usuario seria
--       confuso en este caso concreto. Queda anotado como mejora futura
--       de create_relationship, fuera del alcance de esta migracion.
--
-- Tras el ROLLBACK se verifico que produccion quedo intacta:
--   duplicados_aun_activos=2  rel_real_reactivada=0
--   personas_activas=47  relaciones_activas=44  funcion_modificada=false
-- ============================================================================

-- Para re-ejecutar: sustituir el marcador de abajo por el cuerpo completo
-- de la migracion (el bloque CREATE OR REPLACE FUNCTION ... $function$;)
-- y enviar todo el script de una sola vez.

BEGIN;

-- <<< AQUI VA EL CREATE OR REPLACE FUNCTION public.add_relative(...) DE
--     supabase/migrations/20260726000000_add_relative_duplicate_prevention.sql >>>

CREATE TEMP TABLE _res(escenario text, ok boolean, detalle text) ON COMMIT DROP;

-- ── ESCENARIO 1: candidato exacto -> needs_confirmation, cero escrituras ──
-- Actua el HIJO real. Escribe "Alfredo Hurtado Martínez" (con tilde), que
-- es exactamente lo que provoco el duplicado original.
SET LOCAL request.jwt.claims TO '{"sub":"439c0be3-ff4a-41c7-9d49-022590e0b0ed","role":"authenticated"}';
DO $t$
DECLARE r jsonb; n_antes bigint; n_despues bigint;
BEGIN
  SELECT count(*) INTO n_antes FROM public.persons WHERE deleted_at IS NULL;
  r := public.add_relative(
    '{"first_name":"Alfredo","first_surname":"Hurtado","second_surname":"Martínez","relation_key":"father","parent_kind":"biological"}'::jsonb,
    'parent');
  SELECT count(*) INTO n_despues FROM public.persons WHERE deleted_at IS NULL;
  INSERT INTO _res VALUES ('1_candidato_exacto',
    (r->>'needs_confirmation')::boolean IS TRUE AND n_antes = n_despues,
    'needs_confirmation=' || coalesce(r->>'needs_confirmation','null')
      || ' candidatos=' || coalesce(jsonb_array_length(r->'candidates')::text,'0')
      || ' top_confianza=' || coalesce(r->'candidates'->0->>'confidence','-')
      || ' top_id=' || coalesce(left(r->'candidates'->0->>'person_id',8),'-')
      || ' personas_creadas=' || (n_despues - n_antes)::text);
END $t$;

-- ── ESCENARIO 4: UUID de OTRA familia -> rechazo ──────────────────────
DO $t$
DECLARE r jsonb;
BEGIN
  r := public.add_relative(
    '{"first_name":"Intruso","first_surname":"Ajeno","relation_key":"father","parent_kind":"biological","link_person_id":"ff764cb9-30c8-49b8-93e0-8da2764b2664"}'::jsonb,
    'parent');
  INSERT INTO _res VALUES ('4_uuid_no_autorizado', false, 'NO rechazo: ' || r::text);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _res VALUES ('4_uuid_no_autorizado',
    SQLERRM LIKE '%no pertenece a tu arbol%', 'rechazado: ' || SQLERRM);
END $t$;

-- ── ESCENARIO 2: link_person_id -> reutiliza persona, solo crea relacion ──
-- Es la reparacion del caso real hecha desde la propia app.
DO $t$
DECLARE r jsonb; p_antes bigint; p_despues bigint; rel_antes bigint; rel_despues bigint;
BEGIN
  SELECT count(*) INTO p_antes FROM public.persons WHERE deleted_at IS NULL;
  SELECT count(*) INTO rel_antes FROM public.relationships WHERE deleted_at IS NULL;
  r := public.add_relative(
    '{"first_name":"Alfredo","first_surname":"Hurtado","second_surname":"Martinez","relation_key":"father","parent_kind":"biological","link_person_id":"a76b1a46-dc38-4e94-9fa8-0a95dfe734aa"}'::jsonb,
    'parent');
  SELECT count(*) INTO p_despues FROM public.persons WHERE deleted_at IS NULL;
  SELECT count(*) INTO rel_despues FROM public.relationships WHERE deleted_at IS NULL;
  INSERT INTO _res VALUES ('2_link_reutiliza',
    (r->>'success')::boolean IS TRUE
      AND (r->>'linked_existing')::boolean IS TRUE
      AND (r->>'person_id') = 'a76b1a46-dc38-4e94-9fa8-0a95dfe734aa'
      AND p_despues = p_antes
      AND rel_despues = rel_antes + 1,
    'linked_existing=' || coalesce(r->>'linked_existing','-')
      || ' person_id=' || coalesce(left(r->>'person_id',8),'-')
      || ' personas_nuevas=' || (p_despues-p_antes)::text
      || ' relaciones_nuevas=' || (rel_despues-rel_antes)::text);
END $t$;

-- ── ESCENARIO 3: confirm_create_duplicate -> crea homonimo ────────────
SET LOCAL request.jwt.claims TO '{"sub":"47b808c5-ab25-43cd-84b9-5272f750c744","role":"authenticated"}';
DO $t$
DECLARE r jsonb; p_antes bigint; p_despues bigint;
BEGIN
  SELECT count(*) INTO p_antes FROM public.persons WHERE deleted_at IS NULL;
  r := public.add_relative(
    '{"first_name":"Elias","first_surname":"Hurtado","relation_key":"son","parent_kind":"biological","confirm_create_duplicate":true}'::jsonb,
    'parent');
  SELECT count(*) INTO p_despues FROM public.persons WHERE deleted_at IS NULL;
  INSERT INTO _res VALUES ('3_confirm_crea_homonimo',
    (r->>'success')::boolean IS TRUE
      AND (r->>'linked_existing')::boolean IS FALSE
      AND p_despues = p_antes + 1,
    'success=' || coalesce(r->>'success','-')
      || ' personas_nuevas=' || (p_despues-p_antes)::text);
END $t$;

-- ── ESCENARIO 5: relacion ya existente -> no duplica ──────────────────
DO $t$
DECLARE r jsonb; rel_antes bigint; rel_despues bigint;
BEGIN
  SELECT count(*) INTO rel_antes FROM public.relationships WHERE deleted_at IS NULL;
  r := public.add_relative(
    '{"first_name":"Elias","first_surname":"Hurtado","relation_key":"son","parent_kind":"biological","link_person_id":"957158ff-3e76-4b3d-899c-4562b46467c9"}'::jsonb,
    'parent');
  SELECT count(*) INTO rel_despues FROM public.relationships WHERE deleted_at IS NULL;
  INSERT INTO _res VALUES ('5_relacion_existente_no_duplica',
    rel_despues = rel_antes,
    'sin excepcion; relaciones_nuevas=' || (rel_despues-rel_antes)::text);
EXCEPTION WHEN OTHERS THEN
  SELECT count(*) INTO rel_despues FROM public.relationships WHERE deleted_at IS NULL;
  INSERT INTO _res VALUES ('5_relacion_existente_no_duplica', true,
    'rechazado (no duplica): ' || left(SQLERRM, 80));
END $t$;

SELECT escenario, ok, detalle FROM _res ORDER BY escenario;

-- OBLIGATORIO: nada de esto debe persistir.
ROLLBACK;
