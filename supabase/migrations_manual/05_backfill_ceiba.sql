-- ============================================================
-- CEIBA — Backfill REAL (adaptado al esquema actual de Ceiba)
-- Fuentes: public.profiles  → persons (usuarios registrados)
--          public.family_members → persons (personas no registradas)
--          public.family_members → relationships (relaciones declaradas)
--          public.relationships_legacy → relationships (confirmadas entre perfiles)
--
-- ⚠️ Ejecutar DESPUÉS de 04_triggers.sql
-- ⚠️ Ejecutar ANTES de 06_rpc_functions.sql
-- Idempotente: usa INSERT ... WHERE NOT EXISTS y ON CONFLICT DO NOTHING
-- ============================================================

-- ============================================================
-- BLOQUE A: profiles → persons (usuarios registrados)
-- Cada fila de profiles corresponde a un auth.users real.
-- linked_user_id = profiles.id = auth.users.id
-- ============================================================

INSERT INTO public.persons (
  id,
  first_names,
  last_names,
  email,
  profile_photo_url,
  is_living,
  created_by_user_id,
  linked_user_id,
  status,
  verification_level,
  bio
)
SELECT
  p.id,                              -- reutilizamos el mismo UUID
  COALESCE(NULLIF(TRIM(p.first_name), ''), 'Sin nombre') AS first_names,
  COALESCE(NULLIF(TRIM(p.last_name),  ''), '')           AS last_names,
  p.email::citext,
  p.avatar_url,
  TRUE,                              -- perfil activo = living
  p.id,                              -- se creó a sí mismo
  p.id,                              -- es el usuario autenticado
  'active'::person_status,
  'self_verified'::verification_level,
  p.bio
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.persons pp WHERE pp.id = p.id
);

-- Verificar
SELECT COUNT(*) AS persons_from_profiles FROM public.persons
WHERE linked_user_id IS NOT NULL;


-- ============================================================
-- BLOQUE B: family_members SIN profile_id → persons (no registrados)
-- Agrupa por person_id (un mismo person_id puede aparecer en varios
-- árboles si diferentes personas lo añadieron).
-- Toma el registro más completo: preferimos el que tiene last_name
-- y la fecha más reciente.
-- ============================================================

INSERT INTO public.persons (
  id,
  first_names,
  last_names,
  birth_date,
  is_living,
  created_by_user_id,
  status,
  verification_level,
  gender
)
SELECT DISTINCT ON (fm.person_id)
  fm.person_id                     AS id,
  COALESCE(NULLIF(TRIM(fm.first_name), ''), 'Sin nombre') AS first_names,
  COALESCE(NULLIF(TRIM(fm.last_name),  ''), '')           AS last_names,
  fm.birth_date,
  TRUE,
  fm.added_by,
  'unverified'::person_status,
  'unverified'::verification_level,
  CASE
    WHEN fm.relation_type IN ('father','brother','half_brother','son','uncle',
      'grandfather_paternal','grandfather_maternal','nephew','grandson',
      'stepfather','father_in_law','brother_in_law') THEN 'M'::gender_enum
    WHEN fm.relation_type IN ('mother','sister','half_sister','daughter','aunt',
      'grandmother_paternal','grandmother_maternal','niece','granddaughter',
      'stepmother','mother_in_law','sister_in_law') THEN 'F'::gender_enum
    ELSE 'unknown'::gender_enum
  END AS gender
FROM public.family_members fm
WHERE fm.profile_id IS NULL
  AND fm.person_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.persons pp WHERE pp.id = fm.person_id
  )
ORDER BY fm.person_id,
         (fm.last_name IS NOT NULL AND fm.last_name <> '') DESC,
         fm.created_at DESC NULLS LAST;

-- Verificar
SELECT COUNT(*) AS persons_unregistered FROM public.persons
WHERE linked_user_id IS NULL AND created_by_user_id IS NOT NULL;


-- ============================================================
-- BLOQUE C: family_members → relationships
-- Solo migramos relaciones BASE (padre, madre, hijo, hija,
-- hermano, hermana, medio hermano/a, pareja, tutor).
-- Las relaciones derivadas (abuelo, tío, primo, cuñado…)
-- se infieren automáticamente desde el grafo.
--
-- Dirección canónica de parent_of: person_a = PADRE, person_b = HIJO
-- ============================================================

INSERT INTO public.relationships (
  person_a_id,
  person_b_id,
  relationship_type,
  source,
  declared_by_user_id,
  confidence_score,
  status
)
SELECT
  -- person_a = el PADRE/MADRE (siempre)
  CASE
    WHEN fm.relation_type IN ('son', 'daughter', 'stepchild')
      THEN adder_p.id       -- adder dice "este es MI hijo" → adder = padre
    WHEN fm.relation_type IN ('father', 'mother', 'stepfather', 'stepmother')
      THEN member_p.id      -- adder dice "este es MI padre" → member = padre
    ELSE                    -- simétricas: el trigger normaliza a menor UUID
      LEAST(adder_p.id, member_p.id)
  END AS person_a_id,

  -- person_b = el HIJO (o el otro en simétricas)
  CASE
    WHEN fm.relation_type IN ('son', 'daughter', 'stepchild')
      THEN member_p.id
    WHEN fm.relation_type IN ('father', 'mother', 'stepfather', 'stepmother')
      THEN adder_p.id
    ELSE
      GREATEST(adder_p.id, member_p.id)
  END AS person_b_id,

  -- Tipo semántico
  CASE
    WHEN fm.relation_type IN ('father', 'mother', 'son', 'daughter')
      THEN 'parent_of'::relationship_type
    WHEN fm.relation_type IN ('stepfather', 'stepmother', 'stepchild')
      THEN 'guardian_of'::relationship_type
    WHEN fm.relation_type IN ('spouse', 'partner')
      THEN 'partner_of'::relationship_type
    WHEN fm.relation_type IN ('brother', 'sister')
      THEN 'sibling_of'::relationship_type
    WHEN fm.relation_type IN ('half_brother', 'half_sister')
      THEN 'half_sibling_of'::relationship_type
  END AS relationship_type,

  'legacy_backfill'       AS source,
  fm.added_by             AS declared_by_user_id,
  90                      AS confidence_score,
  'confirmed'::relationship_status AS status

FROM public.family_members fm

-- El que agregó (siempre tiene profile en auth)
JOIN public.persons adder_p ON adder_p.linked_user_id = fm.added_by

-- La persona agregada: primero busca si es un usuario registrado,
-- si no, usa el person_id creado en el Bloque B
JOIN public.persons member_p ON member_p.id = COALESCE(
  (SELECT pp.id FROM public.persons pp
   WHERE pp.linked_user_id = fm.profile_id LIMIT 1),
  fm.person_id
)

-- Solo relaciones BASE (las derivadas se infieren del grafo)
WHERE fm.relation_type IN (
  'father', 'mother', 'son', 'daughter',
  'stepfather', 'stepmother', 'stepchild',
  'spouse', 'partner',
  'brother', 'sister',
  'half_brother', 'half_sister'
)
AND adder_p.id <> member_p.id   -- sin auto-relaciones

ON CONFLICT (pair_key) DO NOTHING;


-- ============================================================
-- BLOQUE D: relationships_legacy → relationships
-- La tabla relationships_legacy (antigua relationships)
-- tenía vínculos confirmados entre perfiles registrados.
-- ============================================================

INSERT INTO public.relationships (
  person_a_id,
  person_b_id,
  relationship_type,
  source,
  declared_by_user_id,
  confidence_score,
  status
)
SELECT
  CASE
    WHEN rl.relation_from_a IN ('son', 'daughter', 'stepchild')
      THEN p_a.id    -- a dice "b es mi hijo" → a = padre
    WHEN rl.relation_from_a IN ('father', 'mother', 'stepfather', 'stepmother')
      THEN p_b.id    -- a dice "b es mi padre" → b = padre
    ELSE
      LEAST(p_a.id, p_b.id)
  END AS person_a_id,

  CASE
    WHEN rl.relation_from_a IN ('son', 'daughter', 'stepchild')
      THEN p_b.id
    WHEN rl.relation_from_a IN ('father', 'mother', 'stepfather', 'stepmother')
      THEN p_a.id
    ELSE
      GREATEST(p_a.id, p_b.id)
  END AS person_b_id,

  CASE
    WHEN rl.relation_from_a IN ('father','mother','son','daughter')
      THEN 'parent_of'::relationship_type
    WHEN rl.relation_from_a IN ('stepfather','stepmother','stepchild')
      THEN 'guardian_of'::relationship_type
    WHEN rl.relation_from_a IN ('spouse','partner')
      THEN 'partner_of'::relationship_type
    WHEN rl.relation_from_a IN ('brother','sister')
      THEN 'sibling_of'::relationship_type
    WHEN rl.relation_from_a IN ('half_brother','half_sister')
      THEN 'half_sibling_of'::relationship_type
  END AS relationship_type,

  'legacy_confirmed'      AS source,
  rl.profile_a            AS declared_by_user_id,
  100                     AS confidence_score,
  CASE WHEN rl.confirmed THEN 'confirmed' ELSE 'pending' END::relationship_status AS status

FROM public.relationships_legacy rl
JOIN public.persons p_a ON p_a.linked_user_id = rl.profile_a
JOIN public.persons p_b ON p_b.linked_user_id = rl.profile_b

WHERE rl.relation_from_a IN (
  'father','mother','son','daughter',
  'stepfather','stepmother','stepchild',
  'spouse','partner',
  'brother','sister','half_brother','half_sister'
)
AND p_a.id <> p_b.id

ON CONFLICT (pair_key) DO NOTHING;


-- ============================================================
-- VALIDACIÓN FINAL
-- ============================================================

-- ¿Cuántos usuarios sin persona?
SELECT COUNT(*) AS users_sin_person
FROM auth.users u
LEFT JOIN public.persons p ON p.linked_user_id = u.id
WHERE p.id IS NULL;

-- Distribución de tipos de relación migrados
SELECT relationship_type::text, source, COUNT(*) AS n
FROM public.relationships
GROUP BY relationship_type, source
ORDER BY n DESC;

-- Muestra de personas
SELECT id, first_names, last_names, linked_user_id IS NOT NULL AS is_registered,
       status, verification_level
FROM public.persons
ORDER BY created_at DESC
LIMIT 20;
