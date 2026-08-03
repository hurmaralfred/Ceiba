-- Rastrear si la persona reclamante ya confirmó (o corrigió) los datos
-- que otro usuario ingresó al árbol antes de que ella se registrara.
-- NULL = nunca confirmado. TIMESTAMPTZ = fecha de confirmación.

ALTER TABLE person_claims
  ADD COLUMN IF NOT EXISTS data_confirmed_at TIMESTAMPTZ DEFAULT NULL;
