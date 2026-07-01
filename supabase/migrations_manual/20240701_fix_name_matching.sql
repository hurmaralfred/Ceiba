-- ═══════════════════════════════════════════════════════════════════════════════
-- CEIBA — Mejoras al matching de nombres para evitar duplicados
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- Asegura que la extensión unaccent esté habilitada (para ignorar tildes)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. find_name_matches: busca registros donde alguien añadió al nuevo usuario
--    antes de que se registrara. Usa matching fuzzy para nombres compuestos,
--    acentos, y casos donde sólo hay nombre sin apellido.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION find_name_matches(
  p_first_name TEXT,
  p_last_name  TEXT,
  p_user_id    UUID
)
RETURNS TABLE(
  family_member_id UUID,
  adder_id         UUID,
  adder_first_name TEXT,
  adder_last_name  TEXT,
  relation_type    TEXT,
  relation_kind    TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  norm_fn   TEXT := lower(unaccent(trim(coalesce(p_first_name, ''))));
  norm_ln   TEXT := lower(unaccent(trim(coalesce(p_last_name,  ''))));
  fn_word1  TEXT := split_part(norm_fn, ' ', 1);  -- primera palabra del nombre
  ln_word1  TEXT := split_part(norm_ln, ' ', 1);  -- primera palabra del apellido
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (fm.id)
    fm.id               AS family_member_id,
    p.id                AS adder_id,
    p.first_name        AS adder_first_name,
    p.last_name         AS adder_last_name,
    fm.relation_type,
    fm.relation_kind
  FROM family_members fm
  JOIN profiles p ON p.id = fm.added_by
  WHERE
    -- Sólo registros no vinculados todavía (sin profile_id)
    fm.profile_id IS NULL
    -- No fue añadido por el propio usuario
    AND fm.added_by <> p_user_id
    -- El añadidor no es el usuario
    AND p.id <> p_user_id
    AND (
      -- A. Nombre completo exacto (normalizado sin tildes)
      lower(unaccent(trim(fm.first_name))) = norm_fn

      OR (
        -- B. Primera palabra del nombre coincide
        split_part(lower(unaccent(trim(fm.first_name))), ' ', 1) = fn_word1
        AND fn_word1 <> ''
        AND length(fn_word1) >= 3
        AND (
          -- B1. Primera palabra del apellido también coincide
          (
            ln_word1 <> ''
            AND split_part(lower(unaccent(trim(coalesce(fm.last_name,'')))), ' ', 1) = ln_word1
          )
          OR
          -- B2. El registro no tiene apellido guardado (lo añadieron sólo por nombre)
          (coalesce(trim(fm.last_name), '') = '' AND length(fn_word1) >= 4)
          OR
          -- B3. El usuario no tiene apellido registrado y el nombre es largo
          (norm_ln = '' AND length(fn_word1) >= 5)
        )
      )
    )
  ORDER BY fm.id;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. confirm_name_match: vincula al usuario con el registro de family_member,
--    propaga person_id a otros registros del mismo nombre sin vincular,
--    y crea el registro recíproco en el árbol del añadidor si no existe.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION confirm_name_match(
  p_family_member_id UUID,
  p_user_id          UUID
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_person_id    UUID;
  v_adder_id     UUID;
  v_fm_fn        TEXT;
  v_fm_ln        TEXT;
  v_fm_rel       TEXT;
  v_fm_kind      TEXT;
  v_user_fn      TEXT;
  v_user_ln      TEXT;
BEGIN
  -- Obtener datos del registro a vincular
  SELECT
    coalesce(person_id, p_user_id),
    added_by,
    first_name,
    last_name,
    relation_type,
    relation_kind
  INTO v_person_id, v_adder_id, v_fm_fn, v_fm_ln, v_fm_rel, v_fm_kind
  FROM family_members
  WHERE id = p_family_member_id;

  -- Obtener nombre del usuario que está confirmando
  SELECT first_name, last_name
  INTO v_user_fn, v_user_ln
  FROM profiles WHERE id = p_user_id;

  -- 1. Vincular este registro al perfil del usuario
  UPDATE family_members
  SET profile_id = p_user_id,
      person_id  = v_person_id,
      -- Actualizar el nombre con el nombre real del perfil registrado
      first_name = coalesce(v_user_fn, first_name),
      last_name  = coalesce(v_user_ln, last_name)
  WHERE id = p_family_member_id;

  -- 2. Propagar person_id a TODOS los registros no vinculados con el mismo nombre
  --    (en otros árboles que también lo añadieron antes de que se registrara)
  UPDATE family_members fm
  SET person_id = v_person_id
  FROM family_members src
  WHERE src.id = p_family_member_id
    AND fm.profile_id IS NULL
    AND fm.id <> p_family_member_id
    AND (
      lower(unaccent(trim(fm.first_name))) = lower(unaccent(trim(src.first_name)))
      AND (
        -- mismo apellido (primera palabra)
        split_part(lower(unaccent(trim(coalesce(fm.last_name,'')))),  ' ', 1)
          = split_part(lower(unaccent(trim(coalesce(src.last_name,'')))), ' ', 1)
        -- o alguno de los dos no tiene apellido
        OR coalesce(trim(fm.last_name),  '') = ''
        OR coalesce(trim(src.last_name), '') = ''
      )
    );

  -- 3. Si el añadidor NO me tiene en su árbol todavía, crear el registro recíproco
  --    (así el añadidor me ve en su árbol sin tener que añadirme manualmente)
  IF NOT EXISTS (
    SELECT 1 FROM family_members
    WHERE added_by = v_adder_id AND profile_id = p_user_id
  ) THEN
    -- La relación inversa: si el añadidor me añadió como su "hijo",
    -- yo soy su "padre" desde mi perspectiva.
    -- Usamos la función link_persons para compartir person_id más tarde si aplica.
    INSERT INTO family_members (
      added_by, profile_id, first_name, last_name,
      relation_type, relation_kind, person_id
    )
    SELECT
      v_adder_id,
      p_user_id,
      coalesce(v_user_fn, v_fm_fn),
      coalesce(v_user_ln, v_fm_ln),
      -- Aquí deberíamos usar la relación inversa. La manejamos en el cliente
      -- y este INSERT sólo se hace si no existe ya el registro recíproco.
      -- Usamos la misma relation_type temporalmente; el cliente debe actualizar.
      v_fm_rel,
      v_fm_kind,
      v_person_id
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. link_persons: comparte un mismo person_id entre dos registros
--    (ya existía; se incluye aquí por completitud)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION link_persons(member_id_a UUID, member_id_b UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE shared_pid UUID;
BEGIN
  SELECT COALESCE(
    (SELECT person_id FROM family_members WHERE id = member_id_a LIMIT 1),
    (SELECT person_id FROM family_members WHERE id = member_id_b LIMIT 1),
    member_id_a
  ) INTO shared_pid;
  UPDATE family_members SET person_id = shared_pid WHERE id IN (member_id_a, member_id_b);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Migración de datos: asignar person_id a registros existentes sin él
--    (sólo afecta filas ya existentes; los nuevos se generan con crypto.randomUUID())
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS person_id UUID;
CREATE INDEX IF NOT EXISTS idx_family_members_person_id ON family_members(person_id);

-- Registros con profile_id → person_id = profile_id (la persona ya está en Ceiba)
UPDATE family_members
SET person_id = profile_id
WHERE profile_id IS NOT NULL AND person_id IS NULL;

-- Resto → person_id = id (UUID único por registro)
UPDATE family_members
SET person_id = id
WHERE person_id IS NULL;
