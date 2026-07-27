-- Contador global de crecimiento de Ceiba.
--
-- Devuelve UNICAMENTE conteos agregados para la cabecera de /tree. Nunca
-- expone nombres, UUIDs, correos ni ningun otro dato personal.
--
-- Por que SECURITY DEFINER: `persons` y `person_claims` tienen RLS activo
-- (verificado en produccion), asi que una funcion normal contaria solo lo
-- que el usuario puede ver — cada usuario veria un "total" distinto y
-- falso. SECURITY DEFINER permite el conteo global; a cambio la funcion
-- no acepta NINGUN parametro y solo devuelve numeros, de modo que no hay
-- superficie para filtrar informacion ni para inyeccion.
--
-- Definiciones canonicas:
--
--   total_active_persons     Personas reales en Ceiba.
--                            status = 'active' AND deleted_at IS NULL.
--                            Incluye a quienes NO tienen cuenta (agregadas
--                            por un familiar). Excluye 'merged', 'deleted',
--                            'locked' y cualquier fila con deleted_at.
--
--                            Las DOS condiciones son necesarias: hoy existe
--                            en produccion una fila con status='deleted' y
--                            deleted_at IS NULL, que quedaria mal contada
--                            si solo se filtrara por deleted_at.
--
--   total_registered_users   Personas con cuenta activa.
--                            COUNT(DISTINCT person_id) sobre claims
--                            'approved' y no revocados, exigiendo ademas
--                            que la persona siga activa. DISTINCT evita
--                            contar dos veces a alguien con varias filas
--                            de claim. Excluye pending, rejected, revoked,
--                            y claims que apunten a personas merged o
--                            eliminadas. No cuenta profiles sin persona.
--
--   total_unclaimed_persons  Personas activas todavia sin cuenta
--                            (= total_active_persons - total_registered_users).
--                            Se calcula de forma independiente para que sea
--                            correcto aunque las otras dos cambien.
--
-- Permisos: EXECUTE solo para `authenticated`. Se revoca de PUBLIC y anon.

CREATE OR REPLACE FUNCTION public.get_ceiba_growth_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_active_persons     bigint;
    v_registered_users   bigint;
    v_unclaimed_persons  bigint;
BEGIN
    -- Defensa en profundidad: el control real es el GRANT de abajo, pero
    -- si los permisos derivaran, una llamada anonima no debe pasar.
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    SELECT count(*)
    INTO v_active_persons
    FROM public.persons p
    WHERE p.status = 'active'
      AND p.deleted_at IS NULL;

    SELECT count(DISTINCT pc.person_id)
    INTO v_registered_users
    FROM public.person_claims pc
    JOIN public.persons p
      ON p.id = pc.person_id
    WHERE pc.claim_status = 'approved'
      AND pc.revoked_at IS NULL
      AND p.status = 'active'
      AND p.deleted_at IS NULL;

    SELECT count(*)
    INTO v_unclaimed_persons
    FROM public.persons p
    WHERE p.status = 'active'
      AND p.deleted_at IS NULL
      AND NOT EXISTS (
          SELECT 1
          FROM public.person_claims pc
          WHERE pc.person_id = p.id
            AND pc.claim_status = 'approved'
            AND pc.revoked_at IS NULL
      );

    RETURN jsonb_build_object(
        'total_active_persons', v_active_persons,
        'total_registered_users', v_registered_users,
        'total_unclaimed_persons', v_unclaimed_persons
    );
END;
$function$;

-- Solo usuarios autenticados. Nadie mas puede ejecutarla.
REVOKE ALL ON FUNCTION public.get_ceiba_growth_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_ceiba_growth_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_ceiba_growth_stats() TO authenticated;
