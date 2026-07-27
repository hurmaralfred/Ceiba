-- ============================================================================
-- REPARACION DE DATOS — NO EJECUTAR SIN APROBACION EXPLICITA
--
-- Caso: la familia Hurtado quedo fragmentada en dos mitades por personas
-- duplicadas creadas desde add_relative. La prevencion general va en la
-- migracion 20260726000000_add_relative_duplicate_prevention.sql; este
-- script repara UNICAMENTE los datos ya danados de esta familia.
--
-- Individuos y sus registros (UUIDs completos, verificados en produccion
-- con SELECT de solo lectura el 2026-07-27):
--
--   Alfredo Hurtado Martinez (padre)
--     REAL      a76b1a46-dc38-4e94-9fa8-0a95dfe734aa   status=active  claim=SI
--     DUPLICADO ffb5fecc-1e71-4c87-b234-69f03e87cbe2   status=active  claim=NO
--                                                      (unica diferencia:
--                                                       "Martínez" con tilde)
--   Alfredo Hurtado Alarcon (hijo)
--     REAL      51d9086e-16be-4a21-b26b-a846e530b671   status=active  claim=SI
--     DUPLICADO c2d083fd-48ac-4238-ac95-10763e7514da   status=active  claim=NO
--
-- Relaciones implicadas (UUIDs completos, verificados):
--   a81dd50e-b675-432b-ad30-b8b806499493  a76b1a46 -> 51d9086e  parent
--                                         ELIMINADA  -> se REACTIVA
--   c54500a8-23aa-4bfa-b70f-64557af7104e  ffb5fecc -> 51d9086e  parent
--                                         ACTIVA     -> se RETIRA
--   c6e30e19-5920-4c0c-8381-62fe76732f80  a76b1a46 -> c2d083fd  parent
--                                         ACTIVA     -> se RETIRA
--   cdaae61a-69e0-4dce-a017-99084ec87242  6c37b372 (Claudia) -> 51d9086e
--                                         ACTIVA     -> SE PRESERVA (no se toca)
--   c5cc47b6-72bb-44a9-abd6-97f1da8566ea  51d9086e -> dc702aae (Valeria)
--                                         ACTIVA     -> SE PRESERVA (no se toca)
--
-- CRITERIO DE SUPERVIVIENTE: se conserva siempre el registro con
-- person_claim aprobado (identidad real de un usuario). Ambos duplicados
-- carecen de claim -> nadie pierde su cuenta.
--
-- ESTRATEGIA: soft-merge. No se borra fisicamente ninguna fila de persons:
-- las FKs desde relationships, person_claims y space_memberships son
-- ON DELETE CASCADE y un DELETE destruiria historia. Los duplicados se
-- marcan status='merged' + deleted_at, que es exactamente como los excluyen
-- get_my_family_graph, add_relative y complete_onboarding.
--
-- SEGURIDAD DE EJECUCION: todo ocurre en UNA transaccion. Cada precondicion
-- y cada post-condicion es un RAISE EXCEPTION: si algo no coincide con lo
-- verificado, la transaccion aborta entera y NO se altera ningun dato.
-- No hay que leer resultados a ojo.
--
-- IDEMPOTENCIA: una segunda ejecucion detecta que la reparacion ya se
-- aplico y ABORTA con un mensaje claro, sin alterar nada.
-- ============================================================================


-- ============================================================================
-- FKs QUE REFERENCIAN persons (verificadas en la base viva)
-- ----------------------------------------------------------------------------
--   relationships.person_a_id      CASCADE     <- afectada (soft-delete)
--   relationships.person_b_id      CASCADE     <- afectada (soft-delete)
--   person_claims.person_id        CASCADE     <- duplicados NO tienen claims
--   space_memberships.person_id    CASCADE     <- afectada (DELETE de fila)
--   match_candidates.*             CASCADE/NO  <- 0 filas para estas personas
--   invitations.person_id          SET NULL    <- 0 filas para estas personas
--   consents.person_id             SET NULL    <- 0 filas para estas personas
--   family_spaces.root_person_id   NO ACTION   <- ningun duplicado es raiz
--
-- Ninguna FK se toca, se elimina ni se debilita. No se introduce ningun
-- ON DELETE CASCADE nuevo.
-- ============================================================================


BEGIN;

DO $repair$
DECLARE
    -- Personas
    k_padre_real  CONSTANT uuid := 'a76b1a46-dc38-4e94-9fa8-0a95dfe734aa';
    k_padre_dup   CONSTANT uuid := 'ffb5fecc-1e71-4c87-b234-69f03e87cbe2';
    k_hijo_real   CONSTANT uuid := '51d9086e-16be-4a21-b26b-a846e530b671';
    k_hijo_dup    CONSTANT uuid := 'c2d083fd-48ac-4238-ac95-10763e7514da';
    -- Relaciones
    k_rel_correcta CONSTANT uuid := 'a81dd50e-b675-432b-ad30-b8b806499493';
    k_rel_mala_1   CONSTANT uuid := 'c54500a8-23aa-4bfa-b70f-64557af7104e';
    k_rel_mala_2   CONSTANT uuid := 'c6e30e19-5920-4c0c-8381-62fe76732f80';
    k_rel_claudia  CONSTANT uuid := 'cdaae61a-69e0-4dce-a017-99084ec87242';
    k_rel_valeria  CONSTANT uuid := 'c5cc47b6-72bb-44a9-abd6-97f1da8566ea';

    v_dups uuid[] := ARRAY[k_padre_dup, k_hijo_dup];
    v_n integer;
    v_afectadas integer;
BEGIN
    ------------------------------------------------------------------
    -- BLOQUEO: evita escrituras concurrentes durante la reparacion
    ------------------------------------------------------------------
    PERFORM 1 FROM public.persons
     WHERE id IN (k_padre_real, k_padre_dup, k_hijo_real, k_hijo_dup)
     FOR UPDATE;

    ------------------------------------------------------------------
    -- GUARDA 0 — IDEMPOTENCIA
    -- Si los duplicados ya estan fusionados, la reparacion ya corrio.
    ------------------------------------------------------------------
    SELECT count(*) INTO v_n
      FROM public.persons
     WHERE id = ANY(v_dups) AND status = 'merged';

    IF v_n > 0 THEN
        RAISE EXCEPTION
          'ABORTADO: la reparacion ya fue aplicada (% duplicado(s) ya estan merged). No se altero ningun dato.', v_n;
    END IF;

    ------------------------------------------------------------------
    -- GUARDA 1 — Las 4 personas existen y estan activas
    ------------------------------------------------------------------
    SELECT count(*) INTO v_n
      FROM public.persons
     WHERE id IN (k_padre_real, k_padre_dup, k_hijo_real, k_hijo_dup)
       AND status = 'active' AND deleted_at IS NULL;

    IF v_n <> 4 THEN
        RAISE EXCEPTION
          'ABORTADO: se esperaban 4 personas activas, se encontraron %.', v_n;
    END IF;

    ------------------------------------------------------------------
    -- GUARDA 2 — Solo las REALES tienen claim aprobado
    -- (protege contra fusionar por error a alguien con cuenta)
    ------------------------------------------------------------------
    SELECT count(*) INTO v_n
      FROM public.person_claims
     WHERE person_id IN (k_padre_real, k_hijo_real)
       AND claim_status = 'approved' AND revoked_at IS NULL;

    IF v_n <> 2 THEN
        RAISE EXCEPTION
          'ABORTADO: las personas REALES deberian tener 2 claims aprobados, hay %.', v_n;
    END IF;

    SELECT count(*) INTO v_n
      FROM public.person_claims
     WHERE person_id = ANY(v_dups)
       AND claim_status = 'approved' AND revoked_at IS NULL;

    IF v_n <> 0 THEN
        RAISE EXCEPTION
          'ABORTADO: un DUPLICADO tiene claim aprobado (%). Fusionarlo destruiria una cuenta real.', v_n;
    END IF;

    ------------------------------------------------------------------
    -- GUARDA 3 — Ningun duplicado es raiz de un espacio familiar
    ------------------------------------------------------------------
    SELECT count(*) INTO v_n
      FROM public.family_spaces
     WHERE root_person_id = ANY(v_dups);

    IF v_n <> 0 THEN
        RAISE EXCEPTION
          'ABORTADO: un duplicado es raiz de % espacio(s) familiar(es).', v_n;
    END IF;

    ------------------------------------------------------------------
    -- GUARDA 4 — Los duplicados no tienen invitaciones, consentimientos
    -- ni candidatos de matching que se perderian
    ------------------------------------------------------------------
    SELECT (SELECT count(*) FROM public.invitations WHERE person_id = ANY(v_dups))
         + (SELECT count(*) FROM public.consents    WHERE person_id = ANY(v_dups))
         + (SELECT count(*) FROM public.match_candidates
             WHERE source_person_id = ANY(v_dups)
                OR candidate_person_id = ANY(v_dups)
                OR related_to_person_id = ANY(v_dups))
      INTO v_n;

    IF v_n <> 0 THEN
        RAISE EXCEPTION
          'ABORTADO: los duplicados tienen % referencia(s) en invitations/consents/match_candidates.', v_n;
    END IF;

    ------------------------------------------------------------------
    -- GUARDA 5 — Las relaciones estan en el estado exacto esperado
    ------------------------------------------------------------------
    PERFORM 1 FROM public.relationships
     WHERE id = k_rel_correcta
       AND person_a_id = k_padre_real AND person_b_id = k_hijo_real
       AND relationship_type = 'parent' AND deleted_at IS NOT NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION
          'ABORTADO: la relacion correcta % no esta en el estado esperado (padre_real -> hijo_real, parent, ELIMINADA).', k_rel_correcta;
    END IF;

    PERFORM 1 FROM public.relationships
     WHERE id = k_rel_mala_1
       AND person_a_id = k_padre_dup AND person_b_id = k_hijo_real
       AND relationship_type = 'parent' AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION
          'ABORTADO: la relacion incorrecta % no esta activa como se esperaba.', k_rel_mala_1;
    END IF;

    PERFORM 1 FROM public.relationships
     WHERE id = k_rel_mala_2
       AND person_a_id = k_padre_real AND person_b_id = k_hijo_dup
       AND relationship_type = 'parent' AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION
          'ABORTADO: la relacion incorrecta % no esta activa como se esperaba.', k_rel_mala_2;
    END IF;

    ------------------------------------------------------------------
    -- GUARDA 6 — Las relaciones a preservar estan vivas ANTES
    ------------------------------------------------------------------
    SELECT count(*) INTO v_n
      FROM public.relationships
     WHERE id IN (k_rel_claudia, k_rel_valeria) AND deleted_at IS NULL;

    IF v_n <> 2 THEN
        RAISE EXCEPTION
          'ABORTADO: las relaciones de Claudia/Valeria deberian estar activas (esperado 2, hay %).', v_n;
    END IF;

    RAISE NOTICE 'Precondiciones OK. Aplicando reparacion...';

    ------------------------------------------------------------------
    -- PASO 1 — Retirar las relaciones INCORRECTAS de los duplicados
    -- Se hace ANTES de reactivar la correcta, para mantener en todo
    -- momento el invariante del indice unico
    -- idx_relationships_parent_guardian_unique.
    -- Soft-delete: la fila y su auditoria se conservan.
    ------------------------------------------------------------------
    UPDATE public.relationships
       SET deleted_at = now(), updated_at = now()
     WHERE id IN (k_rel_mala_1, k_rel_mala_2)
       AND deleted_at IS NULL;
    GET DIAGNOSTICS v_afectadas = ROW_COUNT;
    IF v_afectadas <> 2 THEN
        RAISE EXCEPTION 'ABORTADO: se esperaba retirar 2 relaciones, se retiraron %.', v_afectadas;
    END IF;

    -- Red de seguridad: cualquier OTRA relacion viva que toque un
    -- duplicado y no este enumerada arriba tambien se retira. Con los
    -- datos actuales afecta 0 filas; existe por si aparecieran nuevas
    -- entre la verificacion y la ejecucion.
    UPDATE public.relationships
       SET deleted_at = now(), updated_at = now()
     WHERE deleted_at IS NULL
       AND (person_a_id = ANY(v_dups) OR person_b_id = ANY(v_dups));

    ------------------------------------------------------------------
    -- PASO 2 — Reactivar la relacion REAL padre -> hijo
    -- Se REACTIVA la fila original (no se inserta una nueva): conserva
    -- su created_at (2026-07-23), su created_by y su historia.
    ------------------------------------------------------------------
    UPDATE public.relationships
       SET deleted_at = NULL, updated_at = now()
     WHERE id = k_rel_correcta
       AND person_a_id = k_padre_real
       AND person_b_id = k_hijo_real
       AND relationship_type = 'parent';
    GET DIAGNOSTICS v_afectadas = ROW_COUNT;
    IF v_afectadas <> 1 THEN
        RAISE EXCEPTION 'ABORTADO: se esperaba reactivar 1 relacion, se reactivaron %.', v_afectadas;
    END IF;

    ------------------------------------------------------------------
    -- PASO 3 — Retirar las membresias de espacio de los duplicados
    -- space_memberships no tiene borrado logico; se elimina la fila.
    -- Ninguna FK la referencia (verificado).
    ------------------------------------------------------------------
    DELETE FROM public.space_memberships
     WHERE person_id = ANY(v_dups);
    GET DIAGNOSTICS v_afectadas = ROW_COUNT;
    IF v_afectadas <> 2 THEN
        RAISE EXCEPTION 'ABORTADO: se esperaba eliminar 2 membresias, se eliminaron %.', v_afectadas;
    END IF;

    ------------------------------------------------------------------
    -- PASO 4 — Marcar los duplicados como fusionados
    -- 'merged' es un valor ya existente del enum person_status
    -- (active | merged | deleted | locked), pensado para esto.
    ------------------------------------------------------------------
    UPDATE public.persons
       SET status = 'merged', deleted_at = now(), updated_at = now()
     WHERE id = ANY(v_dups)
       AND status = 'active';
    GET DIAGNOSTICS v_afectadas = ROW_COUNT;
    IF v_afectadas <> 2 THEN
        RAISE EXCEPTION 'ABORTADO: se esperaba fusionar 2 personas, se fusionaron %.', v_afectadas;
    END IF;

    ------------------------------------------------------------------
    -- POST-CONDICIONES (si alguna falla, la transaccion aborta entera)
    ------------------------------------------------------------------

    -- P1: una sola persona activa por individuo
    SELECT count(*) INTO v_n FROM public.persons
     WHERE normalized_full_name = 'alfredo  hurtado martinez'
       AND deleted_at IS NULL AND status = 'active';
    IF v_n <> 1 THEN
        RAISE EXCEPTION 'POST FALLIDA: deberia quedar 1 "Alfredo Hurtado Martinez" activo, hay %.', v_n;
    END IF;

    SELECT count(*) INTO v_n FROM public.persons
     WHERE normalized_full_name = 'alfredo  hurtado alarcon'
       AND deleted_at IS NULL AND status = 'active';
    IF v_n <> 1 THEN
        RAISE EXCEPTION 'POST FALLIDA: deberia quedar 1 "Alfredo Hurtado Alarcon" activo, hay %.', v_n;
    END IF;

    -- P2: la relacion real esta viva
    PERFORM 1 FROM public.relationships
     WHERE person_a_id = k_padre_real AND person_b_id = k_hijo_real
       AND relationship_type = 'parent' AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'POST FALLIDA: la relacion padre->hijo no quedo activa.';
    END IF;

    -- P3: CERO relaciones activas apuntando a personas fusionadas
    --     (verificacion general, no solo de las dos enumeradas)
    SELECT count(*) INTO v_n
      FROM public.relationships r
      JOIN public.persons p
        ON p.id IN (r.person_a_id, r.person_b_id)
     WHERE r.deleted_at IS NULL
       AND p.status = 'merged';
    IF v_n <> 0 THEN
        RAISE EXCEPTION 'POST FALLIDA: quedan % relacion(es) activa(s) apuntando a personas merged.', v_n;
    END IF;

    -- P4: las relaciones de Claudia y Valeria siguen intactas
    SELECT count(*) INTO v_n FROM public.relationships
     WHERE id IN (k_rel_claudia, k_rel_valeria) AND deleted_at IS NULL;
    IF v_n <> 2 THEN
        RAISE EXCEPTION 'POST FALLIDA: se perdieron relaciones de Claudia/Valeria (quedan %).', v_n;
    END IF;

    -- P5: claims y membresias de las personas REALES intactos
    SELECT count(*) INTO v_n FROM public.person_claims
     WHERE person_id IN (k_padre_real, k_hijo_real)
       AND claim_status = 'approved' AND revoked_at IS NULL;
    IF v_n <> 2 THEN
        RAISE EXCEPTION 'POST FALLIDA: se perdieron claims reales (quedan %).', v_n;
    END IF;

    SELECT count(*) INTO v_n FROM public.space_memberships
     WHERE person_id IN (k_padre_real, k_hijo_real);
    IF v_n <> 2 THEN
        RAISE EXCEPTION 'POST FALLIDA: se perdieron membresias reales (quedan %).', v_n;
    END IF;

    -- P6: el hijo real alcanza al padre real por el grafo conectado
    PERFORM 1 FROM (
        WITH RECURSIVE connected AS (
            SELECT k_hijo_real AS person_id, 0 AS depth,
                   ARRAY[k_hijo_real] AS visited
            UNION ALL
            SELECT CASE WHEN r.person_a_id = c.person_id
                        THEN r.person_b_id ELSE r.person_a_id END,
                   c.depth + 1,
                   c.visited || CASE WHEN r.person_a_id = c.person_id
                                     THEN r.person_b_id ELSE r.person_a_id END
            FROM connected c
            JOIN public.relationships r
              ON r.person_a_id = c.person_id OR r.person_b_id = c.person_id
            WHERE c.depth < 3 AND r.deleted_at IS NULL
              AND r.relationship_status = 'active'
              AND NOT (CASE WHEN r.person_a_id = c.person_id
                            THEN r.person_b_id ELSE r.person_a_id END = ANY(c.visited))
        )
        SELECT 1 FROM connected WHERE person_id = k_padre_real LIMIT 1
    ) q;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'POST FALLIDA: el hijo real no alcanza al padre real en el grafo.';
    END IF;

    RAISE NOTICE 'Reparacion aplicada y verificada correctamente.';
END
$repair$;

-- Revisar los NOTICE anteriores y, solo si todo esta correcto:
COMMIT;
-- En caso de duda:
-- ROLLBACK;


-- ============================================================================
-- VERIFICACION INDEPENDIENTE (ejecutar DESPUES del COMMIT, solo lectura)
-- ============================================================================

-- V1: una sola persona activa por individuo (esperado: 1 y 1)
SELECT
  (SELECT count(*) FROM public.persons
    WHERE normalized_full_name = 'alfredo  hurtado martinez'
      AND deleted_at IS NULL AND status = 'active') AS padres_activos,
  (SELECT count(*) FROM public.persons
    WHERE normalized_full_name = 'alfredo  hurtado alarcon'
      AND deleted_at IS NULL AND status = 'active') AS hijos_activos;

-- V2: los duplicados quedaron merged (esperado: 2 filas, status='merged')
SELECT id, first_name, first_surname, second_surname, status, deleted_at
FROM public.persons
WHERE id IN ('ffb5fecc-1e71-4c87-b234-69f03e87cbe2',
             'c2d083fd-48ac-4238-ac95-10763e7514da');

-- V3: cero relaciones activas hacia personas fusionadas (esperado: 0)
SELECT count(*) AS relaciones_activas_a_merged
FROM public.relationships r
JOIN public.persons p ON p.id IN (r.person_a_id, r.person_b_id)
WHERE r.deleted_at IS NULL AND p.status = 'merged';

-- V4: la relacion real esta viva (esperado: 1 fila)
SELECT id, person_a_id, person_b_id, relationship_type, deleted_at
FROM public.relationships
WHERE id = 'a81dd50e-b675-432b-ad30-b8b806499493';

-- V5: Claudia y Valeria intactas (esperado: 2 filas activas)
SELECT id, person_a_id, person_b_id, relationship_type, deleted_at
FROM public.relationships
WHERE id IN ('cdaae61a-69e0-4dce-a017-99084ec87242',
             'c5cc47b6-72bb-44a9-abd6-97f1da8566ea')
  AND deleted_at IS NULL;


-- ============================================================================
-- ROLLBACK POSTERIOR AL COMMIT
--
-- Si la transaccion sigue abierta basta con ROLLBACK. Este bloque revierte
-- el estado exacto anterior cuando el COMMIT ya se hizo. Unico efecto no
-- reversible: los timestamps updated_at (inocuo).
-- ============================================================================

-- BEGIN;
--
-- -- R1: reactivar los duplicados
-- UPDATE public.persons
--    SET status = 'active', deleted_at = NULL, updated_at = now()
--  WHERE id IN ('ffb5fecc-1e71-4c87-b234-69f03e87cbe2',
--               'c2d083fd-48ac-4238-ac95-10763e7514da');
--
-- -- R2: restaurar sus membresias (mismos id/space/added_by originales)
-- INSERT INTO public.space_memberships (id, space_id, person_id, added_by, created_at)
-- VALUES
--   ('a41a4cc3-833e-4059-afbb-13d0f2f8118b',
--    'ed4d5fe1-4d45-421c-a873-784c753db440',
--    'ffb5fecc-1e71-4c87-b234-69f03e87cbe2',
--    '439c0be3-ff4a-41c7-9d49-022590e0b0ed',
--    '2026-07-25T16:58:17.55375+00'),
--   ('0d6ff5b9-b180-45dc-b738-d9d500dfd06a',
--    'ed4d5fe1-4d45-421c-a873-784c753db440',
--    'c2d083fd-48ac-4238-ac95-10763e7514da',
--    '47b808c5-ab25-43cd-84b9-5272f750c744',
--    '2026-07-25T17:56:53.102586+00')
-- ON CONFLICT (space_id, person_id) DO NOTHING;
--
-- -- R3: volver a retirar la relacion real (estado previo: eliminada)
-- UPDATE public.relationships
--    SET deleted_at = '2026-07-25T17:06:37.749017+00', updated_at = now()
--  WHERE id = 'a81dd50e-b675-432b-ad30-b8b806499493';
--
-- -- R4: reactivar las relaciones de los duplicados
-- UPDATE public.relationships
--    SET deleted_at = NULL, updated_at = now()
--  WHERE id IN ('c54500a8-23aa-4bfa-b70f-64557af7104e',
--               'c6e30e19-5920-4c0c-8381-62fe76732f80');
--
-- COMMIT;


-- ============================================================================
-- RESUMEN DE IMPACTO
--
-- Filas MOVIDAS (reasignadas de duplicado a real):  0
--   No hace falta reasignar nada: las unicas relaciones de los duplicados
--   son precisamente las incorrectas, que se retiran. La relacion correcta
--   ya existia y solo se reactiva.
--
-- Filas SOFT-DELETEADAS en relationships:  2
--   c54500a8 (ffb5fecc -> 51d9086e), c6e30e19 (a76b1a46 -> c2d083fd)
--
-- Filas REACTIVADAS en relationships:  1
--   a81dd50e (a76b1a46 -> 51d9086e)
--
-- Filas ELIMINADAS en space_memberships:  2  (las de los duplicados)
--
-- Filas MARCADAS 'merged' en persons:  2  (ffb5fecc, c2d083fd)
--
-- Filas BORRADAS FISICAMENTE de persons:  0
--
-- INTACTOS: claims (2), roles (2), membresias reales (2), audit_logs,
-- invitations (0 filas), consents (0 filas), match_candidates (0 filas), y
-- todas las demas relaciones del arbol — incluidas Claudia (cdaae61a) y
-- Valeria (c5cc47b6), que no aparecen en ningun UPDATE/DELETE.
-- ============================================================================
