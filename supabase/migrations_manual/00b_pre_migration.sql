-- ============================================================
-- CEIBA — PRE-MIGRACIÓN: renombrar tablas que colisionan
-- ⚠️ Ejecutar ANTES que 01_extensions_enums.sql
-- Idempotente: usa IF EXISTS + comprueba si ya existe el alias.
-- ============================================================

-- 1) La tabla `relationships` actual (profile_a/profile_b) pasa a
--    llamarse `relationships_legacy`. La nueva tendrá estructura de grafo.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'relationships'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'relationships_legacy'
  ) THEN
    ALTER TABLE public.relationships RENAME TO relationships_legacy;
    RAISE NOTICE 'relationships → relationships_legacy ✓';
  ELSE
    RAISE NOTICE 'relationships_legacy ya existe o relationships no existe — sin cambios';
  END IF;
END$$;

-- 2) La tabla `photo_tags` actual (member_id → family_members) pasa a
--    llamarse `photo_tags_legacy`. La nueva referenciará public.persons.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'photo_tags'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'photo_tags_legacy'
  ) THEN
    ALTER TABLE public.photo_tags RENAME TO photo_tags_legacy;
    RAISE NOTICE 'photo_tags → photo_tags_legacy ✓';
  ELSE
    RAISE NOTICE 'photo_tags_legacy ya existe o photo_tags no existe — sin cambios';
  END IF;
END$$;

-- Verificar
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'relationships', 'relationships_legacy',
    'photo_tags', 'photo_tags_legacy'
  )
ORDER BY table_name;
