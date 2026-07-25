-- Fix: claim_existing_person debe informar si la persona reclamada ya
-- tiene un árbol construido, y unificar la selección del espacio activo.
--
-- Problema real (producción): José Humberto fue agregado por Alfredo como
-- su padre (7 relaciones activas ya existentes). Al registrarse y confirmar
-- "sí soy yo", el frontend lo mandaba igual a "Construye tu árbol", una
-- pantalla que exigía agregar 5 familiares sin poder salir con 0/5. Esta
-- función no tenía forma de comunicarle al cliente que esa persona ya tenía
-- relaciones — por eso el cliente no podía decidir saltar ese paso.
--
-- Cambios (aditivos, misma firma — no crea una sobrecarga nueva):
--   1. `has_relationships`: EXISTS sobre relationships activas de la
--      persona reclamada. El cliente usa este campo para saltar
--      "Construye tu árbol" y llevar directo a /tree.
--   2. Selección de espacio activo — estrategia única y determinista:
--        a) Prioriza un espacio donde el USUARIO que reclama ya tenga un
--           rol propio (owner > admin > editor > cualquier otro),
--           empatando por el más antiguo. Cubre a alguien invitado como
--           editor/admin que luego reclama su propia identidad ahí.
--        b) Si no tiene ningún rol propio: usa la membresía MÁS ANTIGUA
--           de la persona reclamada (comportamiento previo, ahora también
--           filtrado por espacios activos).
--        c) Solo si ninguna de las dos existe se crea un espacio nuevo —
--           nunca se crea uno si la persona ya pertenece a alguno.
--   3. Garantiza (idempotente, ON CONFLICT DO NOTHING) la membresía de la
--      persona en el espacio elegido, incluso si se eligió por (a) y la
--      persona aún no tenía membresía ahí.
--   4. El rol del usuario en el espacio ya NO se sobrescribe con 'owner'
--      si ya tenía un rol distinto (antes un editor invitado podía quedar
--      escalado a owner solo por reclamar su identidad ahí). Ahora es
--      ON CONFLICT DO NOTHING: solo asigna 'owner' cuando no existía
--      ningún rol previo.
--
-- Se conserva sin cambios: autenticación, validación de persona activa,
-- las dos comprobaciones de exclusividad de claim, y el upsert de
-- person_claims.

CREATE OR REPLACE FUNCTION public.claim_existing_person(p_person_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid;
  v_space_id uuid;
  v_public_id text;
  v_has_relationships boolean;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select public_id
  into v_public_id
  from public.persons
  where id = p_person_id
    and status = 'active'
    and deleted_at is null;

  if v_public_id is null then
    raise exception 'La persona no existe o no está activa.';
  end if;

  if exists (
    select 1
    from public.person_claims
    where user_id = v_user_id
      and person_id <> p_person_id
      and claim_status = 'approved'
  ) then
    raise exception 'Este usuario ya está vinculado a otra persona.';
  end if;

  if exists (
    select 1
    from public.person_claims
    where person_id = p_person_id
      and user_id <> v_user_id
      and claim_status = 'approved'
  ) then
    raise exception 'Esta persona ya está vinculada a otro usuario.';
  end if;

  insert into public.person_claims (
    person_id,
    user_id,
    claim_status,
    verification_method,
    approved_at
  )
  values (
    p_person_id,
    v_user_id,
    'approved',
    'existing_person_claim',
    now()
  )
  on conflict (person_id, user_id)
  do update set
    claim_status = 'approved',
    verification_method = 'existing_person_claim',
    approved_at = coalesce(
      public.person_claims.approved_at,
      now()
    ),
    revoked_at = null;

  -- ¿La persona reclamada ya tiene relaciones familiares reales? Si las
  -- tiene, el onboarding NO debe pedirle construir un árbol desde cero
  -- (el cliente usa este campo para saltar directo a /tree).
  select exists (
    select 1
    from public.relationships
    where deleted_at is null
      and (
        person_a_id = p_person_id
        or person_b_id = p_person_id
      )
  )
  into v_has_relationships;

  -- Selección de espacio activo — estrategia única y determinista:
  --   1) Prioriza un espacio donde el USUARIO que reclama ya tenga un rol
  --      propio (owner > admin > editor > cualquier otro), empatando por
  --      el más antiguo. Cubre el caso de alguien invitado como editor/
  --      admin a un espacio que luego reclama su propia identidad.
  --   2) Si el usuario no tiene ningún rol propio: usa la membresía más
  --      antigua de la PERSONA reclamada (comportamiento previo).
  --   3) Solo si ninguna de las dos existe se crea un espacio nuevo — la
  --      persona nunca "pierde" un espacio al que ya pertenece.
  select sur.space_id
  into v_space_id
  from public.space_user_roles sur
  join public.family_spaces fs on fs.id = sur.space_id
  where sur.user_id = v_user_id
    and coalesce(fs.status, 'active') = 'active'
  order by
    case sur.role
      when 'owner' then 1
      when 'admin' then 2
      when 'editor' then 3
      else 4
    end,
    sur.created_at asc
  limit 1;

  if v_space_id is null then
    select sm.space_id
    into v_space_id
    from public.space_memberships sm
    join public.family_spaces fs on fs.id = sm.space_id
    where sm.person_id = p_person_id
      and coalesce(fs.status, 'active') = 'active'
    order by sm.created_at asc
    limit 1;
  end if;

  if v_space_id is null then
    insert into public.family_spaces (
      name,
      root_person_id,
      created_by,
      visibility,
      status
    )
    select
      'Familia de ' ||
        concat_ws(
          ' ',
          first_name,
          first_surname,
          second_surname
        ),
      id,
      v_user_id,
      'private',
      'active'
    from public.persons
    where id = p_person_id
    returning id into v_space_id;
  end if;

  -- Garantiza la membresía de la PERSONA en el espacio elegido — puede
  -- faltar si el espacio se seleccionó por el rol propio del usuario
  -- (punto 1) en vez de por una membresía preexistente de la persona.
  -- Idempotente: no duplica si ya existe.
  insert into public.space_memberships (
    space_id,
    person_id,
    added_by
  )
  values (
    v_space_id,
    p_person_id,
    v_user_id
  )
  on conflict (space_id, person_id)
  do nothing;

  -- Garantiza el rol del usuario en el espacio SIN degradar ni escalar un
  -- rol ya existente (p. ej. no convierte a un editor invitado en owner
  -- solo porque reclamó su identidad ahí). Solo asigna 'owner' cuando no
  -- existía ningún rol previo para este usuario en este espacio.
  insert into public.space_user_roles (
    space_id,
    user_id,
    role
  )
  values (
    v_space_id,
    v_user_id,
    'owner'
  )
  on conflict (space_id, user_id)
  do nothing;

  return jsonb_build_object(
    'person_id', p_person_id,
    'public_id', v_public_id,
    'space_id', v_space_id,
    'claim_status', 'approved',
    'has_relationships', v_has_relationships
  );
end;
$function$
