-- ============================================================
-- Raíces AI — tablas de sugerencias, uso y función apply
-- ============================================================

-- ── ai_suggestions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_suggestions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id        uuid NOT NULL REFERENCES public.family_spaces(id) ON DELETE CASCADE,
  -- Persona sobre la que se hace la sugerencia (puede ser null si es persona nueva)
  person_id       uuid REFERENCES public.persons(id) ON DELETE SET NULL,
  suggestion_type text NOT NULL CHECK (suggestion_type IN (
    'add_parent', 'add_child', 'add_partner', 'add_sibling',
    'add_person', 'correct_data', 'merge_duplicate'
  )),
  -- 0.0 – 1.0
  confidence      numeric(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  -- Array de evidencias: [{type, detail, weight}]
  sources         jsonb NOT NULL DEFAULT '[]',
  -- Datos sugeridos: nombre, fechas, relaciones, etc.
  suggested_data  jsonb NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'discarded')),
  -- Prompt + respuesta completa del modelo (para auditoría)
  ai_raw_response text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  applied_at      timestamptz
);

ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;

-- Solo el dueño puede ver y gestionar sus sugerencias
CREATE POLICY "owner_select" ON public.ai_suggestions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "owner_update_status" ON public.ai_suggestions
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Inserción solo desde la edge function (service role) — no desde el cliente
CREATE POLICY "service_insert" ON public.ai_suggestions
  FOR INSERT WITH CHECK (false);  -- service role bypasses RLS

-- ── ai_usage ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day            date NOT NULL DEFAULT CURRENT_DATE,
  requests_count int  NOT NULL DEFAULT 1,
  tokens_used    int  NOT NULL DEFAULT 0,
  UNIQUE (user_id, day)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- El usuario solo ve su propio contador
CREATE POLICY "owner_select" ON public.ai_usage
  FOR SELECT USING (user_id = auth.uid());

-- Solo la edge function (service role) escribe
CREATE POLICY "service_insert" ON public.ai_usage
  FOR INSERT WITH CHECK (false);

CREATE POLICY "service_update" ON public.ai_usage
  FOR UPDATE USING (false);

-- ── apply_ai_suggestion() ─────────────────────────────────────
-- El usuario llama esta función para aplicar una sugerencia aprobada.
-- Crea la persona y/o relación y marca la sugerencia como applied.
CREATE OR REPLACE FUNCTION public.apply_ai_suggestion(
  p_suggestion_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suggestion  public.ai_suggestions;
  v_data        jsonb;
  v_new_person_id uuid;
  v_space_id    uuid;
BEGIN
  -- Validar que la sugerencia existe y pertenece al caller
  SELECT * INTO v_suggestion
  FROM public.ai_suggestions
  WHERE id = p_suggestion_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sugerencia no encontrada o sin permiso.';
  END IF;

  IF v_suggestion.status <> 'pending' THEN
    RAISE EXCEPTION 'Esta sugerencia ya fue % .', v_suggestion.status;
  END IF;

  v_data     := v_suggestion.suggested_data;
  v_space_id := v_suggestion.space_id;

  -- Verificar permiso de edición sobre el espacio
  IF NOT public.can_edit_space(v_space_id) THEN
    RAISE EXCEPTION 'No tienes permiso para editar este árbol.';
  END IF;

  -- ── add_person / add_parent / add_child / add_sibling / add_partner ──
  IF v_suggestion.suggestion_type IN (
       'add_person', 'add_parent', 'add_child', 'add_sibling', 'add_partner'
     )
  THEN
    -- Crear la persona nueva si no viene con person_id
    IF v_suggestion.person_id IS NULL OR
       v_data->>'target_person_id' IS NULL
    THEN
      INSERT INTO public.persons (
        first_name, middle_name, first_surname, second_surname,
        birth_date, birth_city, birth_country,
        gender, is_deceased, death_date, created_by
      )
      VALUES (
        v_data->>'first_name',
        NULLIF(v_data->>'middle_name', ''),
        v_data->>'first_surname',
        NULLIF(v_data->>'second_surname', ''),
        (v_data->>'birth_date')::date,
        NULLIF(v_data->>'birth_city', ''),
        NULLIF(v_data->>'birth_country', ''),
        NULLIF(v_data->>'gender', ''),
        COALESCE((v_data->>'is_deceased')::boolean, false),
        (NULLIF(v_data->>'death_date', ''))::date,
        auth.uid()
      )
      RETURNING id INTO v_new_person_id;

      -- Agregar al espacio
      INSERT INTO public.space_memberships (space_id, person_id)
      VALUES (v_space_id, v_new_person_id)
      ON CONFLICT DO NOTHING;
    ELSE
      v_new_person_id := (v_data->>'target_person_id')::uuid;
    END IF;

    -- Crear relación si hay un anchor_person_id
    IF v_data->>'anchor_person_id' IS NOT NULL THEN
      DECLARE
        v_anchor uuid := (v_data->>'anchor_person_id')::uuid;
        v_rel_type public.relationship_type;
        v_person_a uuid;
        v_person_b uuid;
      BEGIN
        CASE v_suggestion.suggestion_type
          WHEN 'add_parent' THEN
            -- person_a = padre/madre, person_b = hijo/a
            v_person_a  := v_new_person_id;
            v_person_b  := v_anchor;
            v_rel_type  := 'parent';
          WHEN 'add_child' THEN
            v_person_a  := v_anchor;
            v_person_b  := v_new_person_id;
            v_rel_type  := 'parent';
          WHEN 'add_partner' THEN
            v_person_a  := v_anchor;
            v_person_b  := v_new_person_id;
            v_rel_type  := 'partner';
          ELSE  -- add_sibling, add_person sin relación específica
            v_person_a  := NULL;
            v_person_b  := NULL;
        END CASE;

        IF v_person_a IS NOT NULL THEN
          INSERT INTO public.relationships (
            person_a_id, person_b_id, relationship_type,
            relationship_status, created_by
          )
          VALUES (
            v_person_a, v_person_b, v_rel_type,
            'confirmed', auth.uid()
          )
          ON CONFLICT DO NOTHING;
        END IF;
      END;
    END IF;
  END IF;

  -- Marcar como aplicada
  UPDATE public.ai_suggestions
  SET status = 'approved', applied_at = now()
  WHERE id = p_suggestion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'new_person_id', v_new_person_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_ai_suggestion(uuid) TO authenticated;

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ai_suggestions_user_id_idx
  ON public.ai_suggestions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_usage_user_day_idx
  ON public.ai_usage (user_id, day);
