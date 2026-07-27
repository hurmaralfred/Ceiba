-- family_events tenía políticas de SELECT (todos), INSERT (propio) y DELETE
-- (propio), pero ninguna de UPDATE — "editar evento" era imposible sin
-- bypass de RLS. Política mínima: solo quien creó el evento puede editarlo.
create policy "Usuarios editan sus eventos" on public.family_events
  for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
