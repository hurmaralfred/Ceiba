-- sos_alerts tiene RLS habilitado pero nunca tuvo una política SELECT.
-- trigger_sos() hace `INSERT ... RETURNING id INTO new_id`, y ese RETURNING
-- exige poder leer la fila recién insertada. Sin política SELECT, RLS deniega
-- esa lectura implícita y Postgres reporta "new row violates row-level
-- security policy for table sos_alerts" — atribuido al INSERT aunque la causa
-- real es la ausencia de SELECT. Confirmado en producción: el mismo INSERT
-- sin RETURNING pasa sin error.
--
-- Política mínima, consistente con sos_update ya existente: cada usuario ve
-- únicamente las alertas que él mismo generó.
create policy "sos_select" on public.sos_alerts
  for select
  using (sender_user_id = auth.uid());
