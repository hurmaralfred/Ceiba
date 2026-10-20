-- ============================================================
-- Cerrar acceso anónimo a find_person_matches
-- La función devuelve nombres de personas de todas las familias
-- y era ejecutable por el rol anon con la anon key pública.
-- ============================================================

-- Revocar de anon y authenticator (el rol de conexión de Supabase)
REVOKE EXECUTE ON FUNCTION public.find_person_matches(
  text, text, text, date, text, text,
  uuid[], uuid[], uuid[]
) FROM anon, authenticator;

-- Confirmar que solo authenticated puede ejecutarla
GRANT EXECUTE ON FUNCTION public.find_person_matches(
  text, text, text, date, text, text,
  uuid[], uuid[], uuid[]
) TO authenticated;

-- También proteger complete_onboarding: ya es SECURITY DEFINER
-- (corre como el dueño de la función, no como el caller),
-- así que find_person_matches dentro de ella sigue funcionando.
-- No hay que tocarla.
