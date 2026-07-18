


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "auth";


ALTER SCHEMA "auth" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "auth"."aal_level" AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE "auth"."aal_level" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."code_challenge_method" AS ENUM (
    's256',
    'plain'
);


ALTER TYPE "auth"."code_challenge_method" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_status" AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE "auth"."factor_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_type" AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE "auth"."factor_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_authorization_status" AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE "auth"."oauth_authorization_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_client_type" AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE "auth"."oauth_client_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_registration_type" AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE "auth"."oauth_registration_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_response_type" AS ENUM (
    'code'
);


ALTER TYPE "auth"."oauth_response_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."one_time_token_type" AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE "auth"."one_time_token_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "public"."broadcast_scope" AS ENUM (
    'direct_family',
    'extended_family',
    'specific_branch',
    'all'
);


ALTER TYPE "public"."broadcast_scope" OWNER TO "postgres";


CREATE TYPE "public"."claim_status" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'revoked'
);


ALTER TYPE "public"."claim_status" OWNER TO "postgres";


CREATE TYPE "public"."gender_enum" AS ENUM (
    'M',
    'F',
    'X',
    'unknown'
);


ALTER TYPE "public"."gender_enum" OWNER TO "postgres";


CREATE TYPE "public"."invitation_status" AS ENUM (
    'pending',
    'accepted',
    'revoked',
    'expired'
);


ALTER TYPE "public"."invitation_status" OWNER TO "postgres";


CREATE TYPE "public"."match_status" AS ENUM (
    'pending',
    'confirmed_same',
    'confirmed_different',
    'needs_second_confirmation',
    'expired'
);


ALTER TYPE "public"."match_status" OWNER TO "postgres";


CREATE TYPE "public"."person_status" AS ENUM (
    'active',
    'merged',
    'deleted',
    'locked'
);


ALTER TYPE "public"."person_status" OWNER TO "postgres";


CREATE TYPE "public"."relationship_status" AS ENUM (
    'pending',
    'confirmed',
    'rejected',
    'system_inferred'
);


ALTER TYPE "public"."relationship_status" OWNER TO "postgres";


CREATE TYPE "public"."relationship_type" AS ENUM (
    'parent',
    'partner',
    'guardian'
);


ALTER TYPE "public"."relationship_type" OWNER TO "postgres";


CREATE TYPE "public"."sos_status" AS ENUM (
    'active',
    'resolved',
    'cancelled',
    'expired'
);


ALTER TYPE "public"."sos_status" OWNER TO "postgres";


CREATE TYPE "public"."verification_level" AS ENUM (
    'unverified',
    'family_verified',
    'self_verified'
);


ALTER TYPE "public"."verification_level" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "auth"."email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION "auth"."email"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."email"() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';



CREATE OR REPLACE FUNCTION "auth"."jwt"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION "auth"."jwt"() OWNER TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "auth"."role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION "auth"."role"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."role"() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';



CREATE OR REPLACE FUNCTION "auth"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION "auth"."uid"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."uid"() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';



CREATE OR REPLACE FUNCTION "public"."_admin_birthdays_for_person"("p_person" "uuid", "p_days" integer DEFAULT 7) RETURNS TABLE("person_id" "uuid", "full_name" "text", "profile_photo_url" "text", "birth_date" "date", "next_birthday" "date", "days_until" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with net as (
    select distinct p.id, p.first_names || ' ' || p.last_names as full_name,
           p.profile_photo_url, p.birth_date
    from public.get_family_ids_up_to(p_person, 4) g
    join public.persons p on p.id = g.person_id
    where p.is_living = true and p.birth_date is not null
      and p.id <> p_person
  ), calc as (
    select id, full_name, profile_photo_url, birth_date,
           make_date(extract(year from current_date)::int,
                     extract(month from birth_date)::int,
                     extract(day from birth_date)::int) as this_year_bday
    from net
  )
  select id, full_name, profile_photo_url, birth_date,
         (case when this_year_bday < current_date
               then this_year_bday + interval '1 year'
               else this_year_bday end)::date as next_birthday,
         ((case when this_year_bday < current_date
                then this_year_bday + interval '1 year'
                else this_year_bday end)::date - current_date) as days_until
  from calc
  where ((case when this_year_bday < current_date
                then this_year_bday + interval '1 year'
                else this_year_bday end)::date - current_date) <= p_days
  order by days_until;
$$;


ALTER FUNCTION "public"."_admin_birthdays_for_person"("p_person" "uuid", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_badge"("p_user" "uuid", "p_badge" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ DECLARE inserted boolean := false; BEGIN INSERT INTO public.user_badges (user_id, badge_code) VALUES (p_user, p_badge) ON CONFLICT (user_id, badge_code) DO NOTHING RETURNING true INTO inserted; RETURN coalesce(inserted, false); END $$;


ALTER FUNCTION "public"."award_badge"("p_user" "uuid", "p_badge" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_edit_space"("p_space_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
    SELECT EXISTS(
        SELECT 1 FROM space_user_roles
        WHERE space_id = p_space_id AND user_id = auth.uid()
          AND role IN ('owner','admin','editor')
    );
$$;


ALTER FUNCTION "public"."can_edit_space"("p_space_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_space"("p_space_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
    SELECT EXISTS(
        SELECT 1 FROM space_user_roles
        WHERE space_id = p_space_id AND user_id = auth.uid()
          AND role IN ('owner','admin')
    );
$$;


ALTER FUNCTION "public"."can_manage_space"("p_space_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_relationship"("p_relationship_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.space_memberships sm
        JOIN public.relationships r ON r.id = p_relationship_id
        WHERE (sm.person_id = r.person_a_id OR sm.person_id = r.person_b_id)
          AND public.can_view_space(sm.space_id)
    );
$$;


ALTER FUNCTION "public"."can_view_relationship"("p_relationship_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_space"("p_space_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
    SELECT EXISTS(
        SELECT 1 FROM space_user_roles WHERE space_id = p_space_id AND user_id = auth.uid()
    ) OR EXISTS(
        SELECT 1 FROM space_memberships sm
        JOIN person_claims pc ON pc.person_id = sm.person_id
        WHERE sm.space_id = p_space_id AND pc.user_id = auth.uid() AND pc.claim_status = 'approved'
    );
$$;


ALTER FUNCTION "public"."can_view_space"("p_space_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_sos"("p_sos" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  update public.sos_alerts
     set status = 'cancelled', resolved_at = now()
   where id = p_sos
     and sender_user_id = auth.uid();
end $$;


ALTER FUNCTION "public"."cancel_sos"("p_sos" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_no_parent_cycle"("p_parent_id" "uuid", "p_child_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    max_depth int := 100;
BEGIN
    IF p_parent_id = p_child_id THEN
        RAISE EXCEPTION 'Una persona no puede ser su propio progenitor.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM relationships
        WHERE person_a_id = p_child_id
          AND person_b_id = p_parent_id
          AND relationship_type = 'parent'
          AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Ya existe la relación inversa.';
    END IF;

    IF EXISTS (
        WITH RECURSIVE ancestors AS (
            SELECT person_a_id AS ancestor_id, 1 AS depth
            FROM relationships
            WHERE person_b_id = p_child_id
              AND relationship_type = 'parent'
              AND deleted_at IS NULL
            UNION
            SELECT r.person_a_id, a.depth + 1
            FROM relationships r
            JOIN ancestors a ON r.person_b_id = a.ancestor_id
            WHERE r.relationship_type = 'parent'
              AND r.deleted_at IS NULL
              AND a.depth < max_depth
        )
        SELECT 1 FROM ancestors WHERE ancestor_id = p_parent_id
    ) THEN
        RAISE EXCEPTION 'Esta relación crearía un ciclo genealógico profundo.';
    END IF;

    RETURN true;
END;
$$;


ALTER FUNCTION "public"."check_no_parent_cycle"("p_parent_id" "uuid", "p_child_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_person"("p_person_id" "uuid", "p_verification_method" "text" DEFAULT 'invitation'::"text", "p_invitation_token" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    claim_id uuid;
    valid_claim boolean := false;
BEGIN
    -- Verificar que no esté ya reclamada
    IF EXISTS(SELECT 1 FROM person_claims WHERE person_id = p_person_id AND claim_status = 'approved') THEN
        RAISE EXCEPTION 'Esta persona ya fue reclamada.';
    END IF;

    -- Verificar según método
    IF p_verification_method = 'invitation' AND p_invitation_token IS NOT NULL THEN
        -- Verificar que el token pertenece a la persona
        SELECT EXISTS(
            SELECT 1 FROM invitations
            WHERE token_hash = crypt(p_invitation_token, token_hash)
              AND person_id = p_person_id
              AND status = 'pending'
              AND expires_at > now()
        ) INTO valid_claim;
    ELSIF p_verification_method = 'match_approved' THEN
        -- Verificar que existe un match_candidate aprobado para este usuario
        SELECT EXISTS(
            SELECT 1 FROM match_candidates
            WHERE candidate_person_id = p_person_id
              AND created_by = auth.uid()
              AND status = 'confirmed_same'
        ) INTO valid_claim;
    END IF;

    IF NOT valid_claim THEN
        RAISE EXCEPTION 'No tienes autorización para reclamar esta persona.';
    END IF;

    INSERT INTO public.person_claims (person_id, user_id, claim_status, verification_method)
    VALUES (p_person_id, auth.uid(), 'approved', p_verification_method)
    RETURNING id INTO claim_id;

    -- Auditoría
    INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'claim_person', 'persons', p_person_id, jsonb_build_object('method', p_verification_method));

    RETURN jsonb_build_object('claim_id', claim_id, 'status', 'approved');
END;
$$;


ALTER FUNCTION "public"."claim_person"("p_person_id" "uuid", "p_verification_method" "text", "p_invitation_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_name_match"("p_family_member_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_person_id UUID;
  v_adder_id  UUID;
  v_fm_fn     TEXT;
  v_fm_ln     TEXT;
  v_fm_rel    TEXT;
  v_fm_kind   TEXT;
  v_user_fn   TEXT;
  v_user_ln   TEXT;
BEGIN
  SELECT coalesce(person_id, p_user_id), added_by, first_name, last_name, relation_type, relation_kind
  INTO v_person_id, v_adder_id, v_fm_fn, v_fm_ln, v_fm_rel, v_fm_kind
  FROM family_members WHERE id = p_family_member_id;

  SELECT first_name, last_name INTO v_user_fn, v_user_ln FROM profiles WHERE id = p_user_id;

  UPDATE family_members
  SET profile_id = p_user_id, person_id = v_person_id,
      first_name = coalesce(v_user_fn, first_name),
      last_name  = coalesce(v_user_ln, last_name)
  WHERE id = p_family_member_id;

  UPDATE family_members fm
  SET person_id = v_person_id
  FROM family_members src
  WHERE src.id = p_family_member_id
    AND fm.profile_id IS NULL
    AND fm.id <> p_family_member_id
    AND lower(unaccent(trim(fm.first_name))) = lower(unaccent(trim(src.first_name)))
    AND (
      split_part(lower(unaccent(trim(coalesce(fm.last_name,'')))), ' ', 1)
        = split_part(lower(unaccent(trim(coalesce(src.last_name,'')))), ' ', 1)
      OR coalesce(trim(fm.last_name), '') = ''
      OR coalesce(trim(src.last_name), '') = ''
    );

  IF NOT EXISTS (SELECT 1 FROM family_members WHERE added_by = v_adder_id AND profile_id = p_user_id) THEN
    INSERT INTO family_members (added_by, profile_id, first_name, last_name, relation_type, relation_kind, person_id)
    VALUES (v_adder_id, p_user_id, coalesce(v_user_fn, v_fm_fn), coalesce(v_user_ln, v_fm_ln), v_fm_rel, v_fm_kind, v_person_id)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;


ALTER FUNCTION "public"."confirm_name_match"("p_family_member_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_invitation"("p_person_id" "uuid", "p_channel" "text" DEFAULT NULL::"text", "p_template" "text" DEFAULT 'v1_direct'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$ DECLARE inv record; new_code text; BEGIN SELECT * INTO inv FROM public.invitations WHERE invited_person_id = p_person_id AND inviter_user_id = auth.uid() AND status IN ('created','sent','opened','installed') AND expires_at > now() ORDER BY created_at DESC LIMIT 1; IF inv.id IS NOT NULL THEN RETURN jsonb_build_object('id', inv.id, 'code', inv.code, 'reused', true, 'status', inv.status); END IF; LOOP new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)); EXIT WHEN NOT EXISTS (SELECT 1 FROM public.invitations WHERE code = new_code); END LOOP; INSERT INTO public.invitations (code, inviter_user_id, invited_person_id, channel, template_id, status) VALUES (new_code, auth.uid(), p_person_id, p_channel, p_template, 'created') RETURNING * INTO inv; INSERT INTO public.invitation_events (invitation_id, event_type, metadata) VALUES (inv.id, 'created', jsonb_build_object('channel', p_channel, 'template', p_template)); RETURN jsonb_build_object('id', inv.id, 'code', inv.code, 'reused', false, 'status', inv.status); END $$;


ALTER FUNCTION "public"."create_invitation"("p_person_id" "uuid", "p_channel" "text", "p_template" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_person"("p_data" "jsonb", "p_created_by" "uuid" DEFAULT "auth"."uid"()) RETURNS TABLE("person_id" "uuid", "public_id" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_id uuid;
    v_public_id text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    PERFORM validate_person_data(p_data);

    INSERT INTO persons (
        first_name, middle_name, first_surname, second_surname,
        birth_date, birth_year, birth_date_precision,
        birth_city, birth_country, is_deceased, death_date,
        gender, photo_path, created_by, status
    ) VALUES (
        trim(p_data->>'first_name'),
        nullif(trim(p_data->>'middle_name'), ''),
        trim(p_data->>'first_surname'),
        nullif(trim(p_data->>'second_surname'), ''),
        nullif(p_data->>'birth_date','')::date,
        nullif(p_data->>'birth_year','')::smallint,
        p_data->>'birth_date_precision',
        nullif(trim(p_data->>'birth_city'), ''),
        nullif(trim(p_data->>'birth_country'), ''),
        COALESCE((p_data->>'is_deceased')::boolean, false),
        nullif(p_data->>'death_date','')::date,
        COALESCE(p_data->>'gender', 'unknown'),
        p_data->>'photo_path',
        p_created_by,
        'active'
    ) RETURNING id, persons.public_id INTO v_id, v_public_id;

    PERFORM log_audit_critical(auth.uid(), 'create_person', 'persons', v_id,
        jsonb_build_object('public_id', v_public_id));

    person_id := v_id;
    public_id := v_public_id;
    RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."create_person"("p_data" "jsonb", "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_relationship"("p_person_a_id" "uuid", "p_person_b_id" "uuid", "p_relationship" "public"."relationship_type", "p_parent_kind" "text" DEFAULT NULL::"text", "p_is_current" boolean DEFAULT NULL::boolean, "p_source" "text" DEFAULT 'user_declared'::"text", "p_created_by" "uuid" DEFAULT "auth"."uid"(), "p_close_previous_partners" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    new_rel_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM persons WHERE id = p_person_a_id AND status = 'active') THEN
        RAISE EXCEPTION 'La persona A no existe o no está activa.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM persons WHERE id = p_person_b_id AND status = 'active') THEN
        RAISE EXCEPTION 'La persona B no existe o no está activa.';
    END IF;

    IF p_person_a_id = p_person_b_id THEN
        RAISE EXCEPTION 'Una persona no puede relacionarse consigo misma.';
    END IF;

    -- Validaciones específicas según tipo
    IF p_relationship = 'parent' THEN
        IF p_parent_kind IS NULL OR p_parent_kind NOT IN ('biological', 'adoptive', 'unknown') THEN
            RAISE EXCEPTION 'parent_kind es obligatorio y debe ser biological, adoptive o unknown.';
        END IF;
        PERFORM validate_parent_rules(p_person_a_id, p_person_b_id, p_parent_kind);
        PERFORM check_no_parent_cycle(p_person_a_id, p_person_b_id);
    ELSE
        IF p_parent_kind IS NOT NULL THEN
            RAISE EXCEPTION 'parent_kind solo aplica a relaciones parent.';
        END IF;
    END IF;

    IF p_relationship = 'guardian' THEN
        PERFORM validate_guardian_rules(p_person_b_id);
    END IF;

    IF p_relationship = 'partner' THEN
        p_is_current := COALESCE(p_is_current, true);
        PERFORM validate_partner_rules(p_person_a_id, p_person_b_id, p_is_current, p_close_previous_partners);
        IF p_close_previous_partners THEN
            UPDATE relationships
            SET is_current = false
            WHERE deleted_at IS NULL
              AND relationship_type = 'partner'
              AND is_current = true
              AND (person_a_id = p_person_a_id OR person_b_id = p_person_a_id
                   OR person_a_id = p_person_b_id OR person_b_id = p_person_b_id);
        END IF;
    ELSE
        p_is_current := NULL;
    END IF;

    BEGIN
        INSERT INTO relationships (
            person_a_id, person_b_id, relationship_type,
            parent_kind, is_current,
            source, created_by
        ) VALUES (
            p_person_a_id, p_person_b_id, p_relationship,
            p_parent_kind, p_is_current,
            p_source, p_created_by
        )
        RETURNING id INTO new_rel_id;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'Esta relación ya existe.';
    END;

    PERFORM log_audit_critical(auth.uid(), 'create_relationship', 'relationships', new_rel_id,
        jsonb_build_object('person_a', p_person_a_id, 'person_b', p_person_b_id, 'type', p_relationship::text));

    RETURN new_rel_id;
END;
$$;


ALTER FUNCTION "public"."create_relationship"("p_person_a_id" "uuid", "p_person_b_id" "uuid", "p_relationship" "public"."relationship_type", "p_parent_kind" "text", "p_is_current" boolean, "p_source" "text", "p_created_by" "uuid", "p_close_previous_partners" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_name_matches"("p_first_name" "text", "p_last_name" "text", "p_user_id" "uuid") RETURNS TABLE("family_member_id" "uuid", "adder_id" "uuid", "adder_first_name" "text", "adder_last_name" "text", "relation_type" "text", "relation_kind" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  norm_fn   TEXT := lower(unaccent(trim(coalesce(p_first_name, ''))));
  norm_ln   TEXT := lower(unaccent(trim(coalesce(p_last_name,  ''))));
  fn_word1  TEXT := split_part(norm_fn, ' ', 1);
  ln_word1  TEXT := split_part(norm_ln, ' ', 1);
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
    fm.profile_id IS NULL
    AND fm.added_by <> p_user_id
    AND p.id <> p_user_id
    AND (
      lower(unaccent(trim(fm.first_name))) = norm_fn
      OR (
        split_part(lower(unaccent(trim(fm.first_name))), ' ', 1) = fn_word1
        AND fn_word1 <> ''
        AND length(fn_word1) >= 3
        AND (
          (ln_word1 <> '' AND split_part(lower(unaccent(trim(coalesce(fm.last_name,'')))), ' ', 1) = ln_word1)
          OR (coalesce(trim(fm.last_name), '') = '' AND length(fn_word1) >= 4)
          OR (norm_ln = '' AND length(fn_word1) >= 5)
        )
      )
    )
  ORDER BY fm.id;
END;
$$;


ALTER FUNCTION "public"."find_name_matches"("p_first_name" "text", "p_last_name" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_person_matches"("p_first_name" "text", "p_first_surname" "text", "p_second_surname" "text" DEFAULT NULL::"text", "p_birth_date" "date" DEFAULT NULL::"date", "p_birth_city" "text" DEFAULT NULL::"text", "p_birth_country" "text" DEFAULT NULL::"text", "p_known_parent_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_known_partner_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_known_child_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("person_id" "uuid", "first_name" "text", "first_surname" "text", "match_score" integer, "match_reasons" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
    WITH weights AS (
        SELECT
            COALESCE(MAX(CASE WHEN weight_name = 'name' THEN weight_value END), 30) AS w_name,
            COALESCE(MAX(CASE WHEN weight_name = 'birth_date' THEN weight_value END), 20) AS w_birth,
            COALESCE(MAX(CASE WHEN weight_name = 'city' THEN weight_value END), 10) AS w_city,
            COALESCE(MAX(CASE WHEN weight_name = 'country' THEN weight_value END), 5) AS w_country,
            COALESCE(MAX(CASE WHEN weight_name = 'shared_relatives' THEN weight_value END), 35) AS w_shared,
            COALESCE(MAX(CASE WHEN weight_name = 'min_score' THEN weight_value END), 40) AS min_score
        FROM matching_config
    ),
    full_name AS (
        SELECT normalize_text(coalesce($1,'') || ' ' || coalesce($2,'') || ' ' || coalesce($3,'')) AS q_full
    ),
    known_related AS (
        SELECT related_id FROM unnest(COALESCE($7, ARRAY[]::uuid[])) AS related_id
        UNION
        SELECT related_id FROM unnest(COALESCE($8, ARRAY[]::uuid[])) AS related_id
        UNION
        SELECT related_id FROM unnest(COALESCE($9, ARRAY[]::uuid[])) AS related_id
    ),
    candidate_list AS (
        SELECT p.id, p.first_name, p.first_surname, p.birth_date,
               p.birth_city, p.birth_country,
               similarity(p.normalized_full_name, f.q_full) AS name_sim
        FROM persons p, full_name f
        WHERE p.deleted_at IS NULL
          AND p.status = 'active'
          AND similarity(p.normalized_full_name, f.q_full) > 0.4
        ORDER BY name_sim DESC
        LIMIT 20
    ),
    candidate_shared_count AS (
        SELECT c.id, COUNT(kr.related_id) AS shared_count
        FROM candidate_list c
        LEFT JOIN relationships r ON (r.person_a_id = c.id OR r.person_b_id = c.id)
            AND r.deleted_at IS NULL
            AND r.relationship_type IN ('parent', 'partner')
        LEFT JOIN known_related kr ON (r.person_a_id = kr.related_id OR r.person_b_id = kr.related_id)
        WHERE kr.related_id IS NOT NULL
        GROUP BY c.id
    ),
    candidate_scores AS (
        SELECT c.id, c.first_name, c.first_surname,
            (CASE WHEN c.name_sim > 0.6 THEN w.w_name ELSE 0 END)
            + (CASE WHEN c.birth_date = $4 THEN w.w_birth ELSE 0 END)
            + (CASE WHEN c.birth_city ILIKE coalesce($5, '__NULL__') THEN w.w_city ELSE 0 END)
            + (CASE WHEN c.birth_country ILIKE coalesce($6, '__NULL__') THEN w.w_country ELSE 0 END)
            + LEAST(w.w_shared,
                    COALESCE(csc.shared_count, 0) * w.w_shared / GREATEST(1,
                        array_length(COALESCE($7, ARRAY[]::uuid[]), 1) +
                        array_length(COALESCE($8, ARRAY[]::uuid[]), 1) +
                        array_length(COALESCE($9, ARRAY[]::uuid[]), 1)
                    )) AS score,
            jsonb_build_object(
                'name_similarity', c.name_sim,
                'birth_date_match', c.birth_date = $4,
                'birth_city_match', c.birth_city ILIKE coalesce($5, '__NULL__'),
                'birth_country_match', c.birth_country ILIKE coalesce($6, '__NULL__'),
                'shared_relatives', COALESCE(csc.shared_count, 0)
            ) AS reasons
        FROM candidate_list c
        CROSS JOIN weights w
        LEFT JOIN candidate_shared_count csc ON c.id = csc.id
    )
    SELECT id, first_name, first_surname, score::int, reasons
    FROM candidate_scores, weights
    WHERE score >= weights.min_score
    ORDER BY score DESC
    LIMIT 5;
$_$;


ALTER FUNCTION "public"."find_person_matches"("p_first_name" "text", "p_first_surname" "text", "p_second_surname" "text", "p_birth_date" "date", "p_birth_city" "text", "p_birth_country" "text", "p_known_parent_ids" "uuid"[], "p_known_partner_ids" "uuid"[], "p_known_child_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_family_suggestions"("p_adder_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_relation_type" "text", "p_family_member_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_connected_profile uuid;
  v_connected_relation text;
  v_inferred_relation text;
begin
  -- Para cada familiar de p_adder_id que está en Ceiba
  for v_connected_profile, v_connected_relation in
    select profile_id, relation_type
    from family_members
    where added_by = p_adder_id
      and profile_id is not null
      and profile_id != p_adder_id
  loop
    -- Calcular relación inferida basada en el grafo familiar
    v_inferred_relation := infer_relation(v_connected_relation, p_relation_type);
    
    if v_inferred_relation is not null then
      -- Crear sugerencia para el familiar conectado
      insert into relationship_suggestions
        (suggested_to, suggested_by, first_name, last_name, relation_type, relation_kind,
         suggested_by_profile_id, status)
      values
        (v_connected_profile, p_adder_id, p_first_name, p_last_name,
         v_inferred_relation,
         case when v_inferred_relation in ('father','mother','son','daughter','brother','sister',
           'grandfather','grandmother','grandson','granddaughter','uncle','aunt','nephew','niece')
           then 'blood' else 'affinity' end,
         p_adder_id, 'pending')
      on conflict do nothing;
    end if;
  end loop;
end;
$$;


ALTER FUNCTION "public"."generate_family_suggestions"("p_adder_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_relation_type" "text", "p_family_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_person_public_id"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_public_id text;
BEGIN
    LOOP
        v_public_id := 'CBA-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.persons WHERE public_id = v_public_id);
    END LOOP;
    RETURN v_public_id;
END;
$$;


ALTER FUNCTION "public"."generate_person_public_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_reverse_suggestions"("p_new_user_id" "uuid", "p_connector_id" "uuid", "p_my_relation" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_fm record;
  v_suggested_relation text;
  v_suggested_kind text;
  blood_types text[] := array['father','mother','son','daughter','brother','sister','nephew','niece',
    'grandfather_paternal','grandfather_maternal','grandmother_paternal','grandmother_maternal',
    'grandson','granddaughter','uncle','aunt','cousin'];
begin
  for v_fm in
    select fm.*
    from public.family_members fm
    where fm.added_by = p_connector_id
      and coalesce(fm.profile_id, gen_random_uuid()) != p_new_user_id
      and not exists (
        select 1 from public.relationship_suggestions
        where suggested_to = p_new_user_id
          and family_member_id = fm.id
          and status = 'pending'
      )
  loop
    v_suggested_relation := case
      when p_my_relation in ('brother','sister') then
        case v_fm.relation_type
          when 'son'       then 'nephew'
          when 'daughter'  then 'niece'
          when 'spouse'    then 'sister_in_law'
          when 'partner'   then 'partner'
          when 'father'    then 'father'
          when 'mother'    then 'mother'
          when 'brother'   then 'brother'
          when 'sister'    then 'sister'
          when 'grandfather_paternal' then 'grandfather_paternal'
          when 'grandfather_maternal' then 'grandfather_maternal'
          when 'grandmother_paternal' then 'grandmother_paternal'
          when 'grandmother_maternal' then 'grandmother_maternal'
          else null
        end
      when p_my_relation in ('son','daughter') then
        case v_fm.relation_type
          when 'son'      then 'brother'
          when 'daughter' then 'sister'
          when 'spouse'   then 'mother'
          when 'father'   then 'grandfather_paternal'
          when 'mother'   then 'grandmother_paternal'
          when 'brother'  then 'uncle'
          when 'sister'   then 'aunt'
          else null
        end
      when p_my_relation in ('father','mother') then
        case v_fm.relation_type
          when 'son'      then 'grandson'
          when 'daughter' then 'granddaughter'
          when 'brother'  then 'son'
          when 'sister'   then 'daughter'
          when 'spouse'   then 'other'
          else null
        end
      when p_my_relation in ('spouse','partner') then
        case v_fm.relation_type
          when 'son'       then 'son'
          when 'daughter'  then 'daughter'
          when 'stepchild' then 'stepchild'
          when 'father'    then 'father_in_law'
          when 'mother'    then 'mother_in_law'
          when 'brother'   then 'brother_in_law'
          when 'sister'    then 'sister_in_law'
          else null
        end
      when p_my_relation in ('grandfather_paternal','grandfather_maternal',
                              'grandmother_paternal','grandmother_maternal') then
        case v_fm.relation_type
          when 'son'      then 'uncle'
          when 'daughter' then 'aunt'
          when 'brother'  then 'other'
          when 'sister'   then 'other'
          else null
        end
      when p_my_relation in ('uncle','aunt') then
        case v_fm.relation_type
          when 'son'      then 'cousin'
          when 'daughter' then 'cousin'
          else null
        end
      else null
    end;

    if v_suggested_relation is not null and v_suggested_relation != 'other' then
      v_suggested_kind := case when v_suggested_relation = any(blood_types) then 'blood' else 'affinity' end;
      insert into public.relationship_suggestions (
        suggested_to, first_name, last_name,
        suggested_relation, suggested_relation_kind,
        suggested_by_profile_id, suggested_by_name,
        family_member_id, status
      ) values (
        p_new_user_id,
        v_fm.first_name, v_fm.last_name,
        v_suggested_relation, v_suggested_kind,
        p_connector_id,
        (select first_name || ' ' || coalesce(last_name,'') from public.profiles where id = p_connector_id),
        v_fm.id,
        'pending'
      )
      on conflict do nothing;
    end if;
  end loop;
end;
$$;


ALTER FUNCTION "public"."generate_reverse_suggestions"("p_new_user_id" "uuid", "p_connector_id" "uuid", "p_my_relation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_family_ids_up_to"("p_person" "uuid", "p_degree" integer DEFAULT 2) RETURNS TABLE("person_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ WITH RECURSIVE net(id, depth) AS (SELECT p_person, 0 UNION SELECT CASE WHEN r.person_a_id = n.id THEN r.person_b_id ELSE r.person_a_id END, n.depth + 1 FROM net n JOIN public.relationships r ON (r.person_a_id = n.id OR r.person_b_id = n.id) AND r.status = 'confirmed' WHERE n.depth < p_degree) SELECT id FROM net; $$;


ALTER FUNCTION "public"."get_family_ids_up_to"("p_person" "uuid", "p_degree" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_family_tree"("start_profile_id" "uuid", "max_depth" integer DEFAULT 5) RETURNS TABLE("profile_id" "uuid", "first_name" "text", "last_name" "text", "avatar_url" "text", "relation_path" "text"[], "depth" integer, "location_enabled" boolean, "latitude" double precision, "longitude" double precision, "city" "text", "country" "text")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  with recursive family_graph as (
    -- Base case: the starting user
    select
      p.id as profile_id,
      p.first_name,
      p.last_name,
      p.avatar_url,
      array[]::text[] as relation_path,
      0 as depth,
      p.location_enabled,
      p.latitude,
      p.longitude,
      p.city,
      p.country,
      array[p.id] as visited
    from public.profiles p
    where p.id = start_profile_id

    union all

    -- Recursive case: expand relationships
    select
      p.id,
      p.first_name,
      p.last_name,
      p.avatar_url,
      fg.relation_path || r.relation_from_a,
      fg.depth + 1,
      p.location_enabled,
      p.latitude,
      p.longitude,
      p.city,
      p.country,
      fg.visited || p.id
    from family_graph fg
    join public.relationships r on (
      (r.profile_a = fg.profile_id and not (r.profile_b = any(fg.visited)))
      or (r.profile_b = fg.profile_id and not (r.profile_a = any(fg.visited)))
    )
    join public.profiles p on (
      case when r.profile_a = fg.profile_id then p.id = r.profile_b
           else p.id = r.profile_a end
    )
    where fg.depth < max_depth
  )
  select profile_id, first_name, last_name, avatar_url, relation_path, depth,
         location_enabled, latitude, longitude, city, country
  from family_graph
  where profile_id != start_profile_id;
$$;


ALTER FUNCTION "public"."get_family_tree"("start_profile_id" "uuid", "max_depth" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_family_graph"("depth" integer DEFAULT 3) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare me uuid;
begin
  select id into me from public.persons where linked_user_id = auth.uid() limit 1;
  if me is null then
    return jsonb_build_object('me', null, 'nodes','[]'::jsonb,'edges','[]'::jsonb);
  end if;
  return (
    with recursive net(id, d) as (
      select me, 0
      union
      select case when r.person_a_id = n.id then r.person_b_id else r.person_a_id end, n.d + 1
      from net n
      join public.relationships r on (r.person_a_id = n.id or r.person_b_id = n.id) and r.status = 'confirmed'
      where n.d < depth
    )
    select jsonb_build_object(
      'me', me,
      'nodes', coalesce((select jsonb_agg(distinct to_jsonb(p.*)) from net n join public.persons p on p.id = n.id), '[]'::jsonb),
      'edges', coalesce((select jsonb_agg(to_jsonb(r.*)) from public.relationships r
                         where r.status = 'confirmed'
                           and r.person_a_id in (select id from net)
                           and r.person_b_id in (select id from net)), '[]'::jsonb)
    )
  );
end $$;


ALTER FUNCTION "public"."get_my_family_graph"("depth" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shared_tree"("p_token" "text") RETURNS TABLE("owner_id" "uuid", "owner_first_name" "text", "owner_last_name" "text", "owner_avatar_url" "text", "owner_city" "text", "owner_country" "text", "member_first_name" "text", "member_last_name" "text", "member_relation_type" "text", "member_has_profile" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select
    p.id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.city,
    p.country,
    fm.first_name,
    fm.last_name,
    fm.relation_type::text,
    (fm.profile_id is not null)
  from public.shared_trees st
  join public.profiles p on p.id = st.profile_id
  left join public.family_members fm on fm.added_by = st.profile_id
  where st.token = p_token;
$$;


ALTER FUNCTION "public"."get_shared_tree"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."immutable_unaccent"("text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $_$ SELECT lower(unaccent($1)) $_$;


ALTER FUNCTION "public"."immutable_unaccent"("text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."infer_relation"("connector_relation" "text", "new_relation" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- Tío -> hermano = tío
  if connector_relation in ('uncle','aunt') and new_relation in ('brother','sister') then
    return new_relation;
  end if;
  -- Tío -> padre = abuelo
  if connector_relation in ('uncle','aunt') and new_relation in ('father','mother') then
    return new_relation;
  end if;
  -- Hermano -> padre = padre
  if connector_relation in ('brother','sister') and new_relation in ('father','mother') then
    return new_relation;
  end if;
  -- Hermano -> hijo = sobrino
  if connector_relation in ('brother','sister') and new_relation in ('son','daughter') then
    return case when new_relation = 'son' then 'nephew' else 'niece' end;
  end if;
  -- Padre -> hermano = tío
  if connector_relation in ('father','mother') and new_relation in ('brother','sister') then
    return case when new_relation = 'brother' then 'uncle' else 'aunt' end;
  end if;
  -- Padre -> padre = abuelo
  if connector_relation in ('father','mother') and new_relation in ('father','mother') then
    return case when new_relation = 'father' then 'grandfather' else 'grandmother' end;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."infer_relation"("connector_relation" "text", "new_relation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_in_my_family"("target_person" "uuid", "degree" integer DEFAULT 4) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with recursive me as (
    select id from public.persons where linked_user_id = auth.uid() limit 1
  ),
  net(id, depth) as (
    select id, 0 from me
    union
    select case when r.person_a_id = n.id then r.person_b_id else r.person_a_id end,
           n.depth + 1
    from net n
    join public.relationships r
      on (r.person_a_id = n.id or r.person_b_id = n.id)
     and r.status = 'confirmed'
    where n.depth < degree
  )
  select exists (select 1 from net where id = target_person);
$$;


ALTER FUNCTION "public"."is_in_my_family"("target_person" "uuid", "degree" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_persons"("member_id_a" "uuid", "member_id_b" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."link_persons"("member_id_a" "uuid", "member_id_b" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_audit_critical"("p_actor_user_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    VALUES (p_actor_user_id, p_action, p_entity_type, p_entity_id, p_metadata);
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error crítico de auditoría. Operación revertida.';
END;
$$;


ALTER FUNCTION "public"."log_audit_critical"("p_actor_user_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_family_space_event"("p_space_id" "uuid", "p_actor_user_id" "uuid", "p_event_type" "text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    INSERT INTO public.family_space_events (space_id, actor_user_id, event_type, payload)
    VALUES (p_space_id, p_actor_user_id, p_event_type, p_payload);
END;
$$;


ALTER FUNCTION "public"."log_family_space_event"("p_space_id" "uuid", "p_actor_user_id" "uuid", "p_event_type" "text", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_invitation_activated"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN IF old.linked_user_id IS NULL AND new.linked_user_id IS NOT NULL THEN UPDATE public.invitations SET status = 'signed_up', signed_up_at = coalesce(signed_up_at, now()), signed_up_user_id = new.linked_user_id, updated_at = now() WHERE invited_person_id = new.id AND status IN ('created','sent','opened','installed'); END IF; RETURN new; END $$;


ALTER FUNCTION "public"."mark_invitation_activated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_invitation_shared"("p_invitation" "uuid", "p_channel" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$ BEGIN UPDATE public.invitations SET status = 'sent', channel = p_channel, updated_at = now() WHERE id = p_invitation AND inviter_user_id = auth.uid() AND status = 'created'; INSERT INTO public.invitation_events (invitation_id, event_type, metadata) VALUES (p_invitation, 'shared', jsonb_build_object('channel', p_channel)); END $$;


ALTER FUNCTION "public"."mark_invitation_shared"("p_invitation" "uuid", "p_channel" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_person_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.normalized_full_name := immutable_unaccent(
        coalesce(NEW.first_name,'') || ' ' ||
        coalesce(NEW.middle_name,'') || ' ' ||
        coalesce(NEW.first_surname,'') || ' ' ||
        coalesce(NEW.second_surname,'')
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."normalize_person_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_text"("p_text" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
    SELECT lower(public.immutable_unaccent(p_text))
$$;


ALTER FUNCTION "public"."normalize_text"("p_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_invitation_event"("p_code" "text", "p_event" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ DECLARE inv record; BEGIN SELECT * INTO inv FROM public.invitations WHERE code = p_code; IF inv.id IS NULL THEN RAISE EXCEPTION 'invitation code not found: %', p_code; END IF; INSERT INTO public.invitation_events (invitation_id, event_type, metadata) VALUES (inv.id, p_event, p_metadata); IF p_event = 'opened' AND inv.first_opened_at IS NULL THEN UPDATE public.invitations SET status = 'opened', first_opened_at = now(), first_opened_from = p_metadata->>'platform', updated_at = now() WHERE id = inv.id; ELSIF p_event = 'installed' AND inv.installed_at IS NULL THEN UPDATE public.invitations SET status = 'installed', installed_at = now(), updated_at = now() WHERE id = inv.id; END IF; END $$;


ALTER FUNCTION "public"."record_invitation_event"("p_code" "text", "p_event" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_match"("p_candidate" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  update public.match_candidates
     set status = 'rejected', resolved_at = now()
   where id = p_candidate
     and proposed_by_user_id = auth.uid();
end $$;


ALTER FUNCTION "public"."reject_match"("p_candidate" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."respond_sos"("p_sos" "uuid", "p_response" "text", "p_message" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into public.sos_responses (sos_id, responder_user_id, response, message)
  values (p_sos, auth.uid(), p_response, p_message)
  on conflict (sos_id, responder_user_id)
  do update set response = excluded.response,
                message  = excluded.message,
                responded_at = now();
end $$;


ALTER FUNCTION "public"."respond_sos"("p_sos" "uuid", "p_response" "text", "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at := now(); return new; end $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_sos"("p_lat" double precision DEFAULT NULL::double precision, "p_lon" double precision DEFAULT NULL::double precision, "p_message" "text" DEFAULT NULL::"text", "p_scope" integer DEFAULT 2) RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
declare
  new_id uuid;
  last_cooldown timestamptz;
begin
  select cooldown_until into last_cooldown
  from public.sos_alerts
  where sender_user_id = auth.uid()
    and status = 'active'
  order by triggered_at desc limit 1;

  if last_cooldown is not null and last_cooldown > now() then
    raise exception 'SOS en cooldown hasta %', last_cooldown;
  end if;

  insert into public.sos_alerts
    (sender_user_id, lat, lon, message, scope_degree, cooldown_until)
  values
    (auth.uid(), p_lat, p_lon, p_message, p_scope, now() + interval '5 minutes')
  returning id into new_id;

  -- El Edge Function 'sos-dispatcher' escucha esta inserción via Realtime
  -- y despacha los push. No hay que hacer nada más aquí.

  return new_id;
end $$;


ALTER FUNCTION "public"."trigger_sos"("p_lat" double precision, "p_lon" double precision, "p_message" "text", "p_scope" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upcoming_birthdays"("days" integer DEFAULT 7) RETURNS TABLE("person_id" "uuid", "full_name" "text", "profile_photo_url" "text", "birth_date" "date", "next_birthday" "date", "days_until" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with net as (
    select p.id, p.first_names || ' ' || p.last_names as full_name,
           p.profile_photo_url, p.birth_date
    from public.persons p
    where p.is_living = true
      and p.birth_date is not null
      and public.is_in_my_family(p.id, 4)
  ), calc as (
    select id, full_name, profile_photo_url, birth_date,
           make_date(extract(year from current_date)::int,
                     extract(month from birth_date)::int,
                     extract(day from birth_date)::int) as this_year_bday
    from net
  )
  select id, full_name, profile_photo_url, birth_date,
         (case when this_year_bday < current_date
               then this_year_bday + interval '1 year'
               else this_year_bday end)::date as next_birthday,
         ((case when this_year_bday < current_date
                then this_year_bday + interval '1 year'
                else this_year_bday end)::date - current_date) as days_until
  from calc
  where ((case when this_year_bday < current_date
                then this_year_bday + interval '1 year'
                else this_year_bday end)::date - current_date) <= days
  order by days_until;
$$;


ALTER FUNCTION "public"."upcoming_birthdays"("days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_normalized_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.normalized_name := LOWER(
        REGEXP_REPLACE(
            NEW.first_names || ' ' || NEW.last_names,
            '[áàâãä]', 'a', 'g'
        )
    );
    NEW.normalized_name := REGEXP_REPLACE(NEW.normalized_name, '[éèêë]', 'e', 'g');
    NEW.normalized_name := REGEXP_REPLACE(NEW.normalized_name, '[íìîï]', 'i', 'g');
    NEW.normalized_name := REGEXP_REPLACE(NEW.normalized_name, '[óòôõö]', 'o', 'g');
    NEW.normalized_name := REGEXP_REPLACE(NEW.normalized_name, '[úùûü]', 'u', 'g');
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_normalized_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_person_data"("p_data" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_first_name text;
    v_first_surname text;
    v_birth_date date;
    v_death_date date;
    v_birth_year smallint;
    v_gender text;
    v_precision text;
BEGIN
    v_first_name := nullif(trim(p_data->>'first_name'), '');
    IF v_first_name IS NULL OR length(v_first_name) > 100 THEN
        RAISE EXCEPTION 'El nombre es obligatorio y no puede superar 100 caracteres.';
    END IF;
    IF v_first_name ~ '[\x00-\x1F\x7F0-9]' THEN
        RAISE EXCEPTION 'El nombre contiene caracteres no permitidos.';
    END IF;

    v_first_surname := nullif(trim(p_data->>'first_surname'), '');
    IF v_first_surname IS NULL OR length(v_first_surname) > 100 THEN
        RAISE EXCEPTION 'El primer apellido es obligatorio y no puede superar 100 caracteres.';
    END IF;
    IF v_first_surname ~ '[\x00-\x1F\x7F0-9]' THEN
        RAISE EXCEPTION 'El primer apellido contiene caracteres no permitidos.';
    END IF;

    v_birth_year := nullif(p_data->>'birth_year', '')::smallint;
    IF v_birth_year IS NOT NULL AND (v_birth_year < 1000 OR v_birth_year > EXTRACT(YEAR FROM CURRENT_DATE)) THEN
        RAISE EXCEPTION 'El año de nacimiento no es válido.';
    END IF;

    v_birth_date := nullif(p_data->>'birth_date', '')::date;
    v_death_date := nullif(p_data->>'death_date', '')::date;
    IF v_birth_date IS NOT NULL AND v_death_date IS NOT NULL AND v_death_date < v_birth_date THEN
        RAISE EXCEPTION 'La fecha de fallecimiento no puede ser anterior a la de nacimiento.';
    END IF;

    v_gender := p_data->>'gender';
    IF v_gender IS NOT NULL AND v_gender NOT IN ('male', 'female', 'non_binary', 'unknown') THEN
        RAISE EXCEPTION 'El valor de género no es válido.';
    END IF;

    v_precision := p_data->>'birth_date_precision';
    IF v_precision IS NOT NULL AND v_precision NOT IN ('exact', 'month_year', 'year', 'approximate', 'unknown') THEN
        RAISE EXCEPTION 'La precisión de la fecha de nacimiento no es válida.';
    END IF;
END;
$$;


ALTER FUNCTION "public"."validate_person_data"("p_data" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "auth"."audit_log_entries" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "payload" json,
    "created_at" timestamp with time zone,
    "ip_address" character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE "auth"."audit_log_entries" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."audit_log_entries" IS 'Auth: Audit trail for user actions.';



CREATE TABLE IF NOT EXISTS "auth"."custom_oauth_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_type" "text" NOT NULL,
    "identifier" "text" NOT NULL,
    "name" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "client_secret" "text" NOT NULL,
    "acceptable_client_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "scopes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "pkce_enabled" boolean DEFAULT true NOT NULL,
    "attribute_mapping" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "authorization_params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "email_optional" boolean DEFAULT false NOT NULL,
    "issuer" "text",
    "discovery_url" "text",
    "skip_nonce_check" boolean DEFAULT false NOT NULL,
    "cached_discovery" "jsonb",
    "discovery_cached_at" timestamp with time zone,
    "authorization_url" "text",
    "token_url" "text",
    "userinfo_url" "text",
    "jwks_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "custom_claims_allowlist" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "custom_oauth_providers_authorization_url_https" CHECK ((("authorization_url" IS NULL) OR ("authorization_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_authorization_url_length" CHECK ((("authorization_url" IS NULL) OR ("char_length"("authorization_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_client_id_length" CHECK ((("char_length"("client_id") >= 1) AND ("char_length"("client_id") <= 512))),
    CONSTRAINT "custom_oauth_providers_discovery_url_length" CHECK ((("discovery_url" IS NULL) OR ("char_length"("discovery_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_identifier_format" CHECK (("identifier" ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::"text")),
    CONSTRAINT "custom_oauth_providers_issuer_length" CHECK ((("issuer" IS NULL) OR (("char_length"("issuer") >= 1) AND ("char_length"("issuer") <= 2048)))),
    CONSTRAINT "custom_oauth_providers_jwks_uri_https" CHECK ((("jwks_uri" IS NULL) OR ("jwks_uri" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_jwks_uri_length" CHECK ((("jwks_uri" IS NULL) OR ("char_length"("jwks_uri") <= 2048))),
    CONSTRAINT "custom_oauth_providers_name_length" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 100))),
    CONSTRAINT "custom_oauth_providers_oauth2_requires_endpoints" CHECK ((("provider_type" <> 'oauth2'::"text") OR (("authorization_url" IS NOT NULL) AND ("token_url" IS NOT NULL) AND ("userinfo_url" IS NOT NULL)))),
    CONSTRAINT "custom_oauth_providers_oidc_discovery_url_https" CHECK ((("provider_type" <> 'oidc'::"text") OR ("discovery_url" IS NULL) OR ("discovery_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_oidc_issuer_https" CHECK ((("provider_type" <> 'oidc'::"text") OR ("issuer" IS NULL) OR ("issuer" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_oidc_requires_issuer" CHECK ((("provider_type" <> 'oidc'::"text") OR ("issuer" IS NOT NULL))),
    CONSTRAINT "custom_oauth_providers_provider_type_check" CHECK (("provider_type" = ANY (ARRAY['oauth2'::"text", 'oidc'::"text"]))),
    CONSTRAINT "custom_oauth_providers_token_url_https" CHECK ((("token_url" IS NULL) OR ("token_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_token_url_length" CHECK ((("token_url" IS NULL) OR ("char_length"("token_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_userinfo_url_https" CHECK ((("userinfo_url" IS NULL) OR ("userinfo_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_userinfo_url_length" CHECK ((("userinfo_url" IS NULL) OR ("char_length"("userinfo_url") <= 2048)))
);


ALTER TABLE "auth"."custom_oauth_providers" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."flow_state" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "auth_code" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "code_challenge" "text",
    "provider_type" "text" NOT NULL,
    "provider_access_token" "text",
    "provider_refresh_token" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "authentication_method" "text" NOT NULL,
    "auth_code_issued_at" timestamp with time zone,
    "invite_token" "text",
    "referrer" "text",
    "oauth_client_state_id" "uuid",
    "linking_target_id" "uuid",
    "email_optional" boolean DEFAULT false NOT NULL
);


ALTER TABLE "auth"."flow_state" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."flow_state" IS 'Stores metadata for all OAuth/SSO login flows';



CREATE TABLE IF NOT EXISTS "auth"."identities" (
    "provider_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identity_data" "jsonb" NOT NULL,
    "provider" "text" NOT NULL,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" "text" GENERATED ALWAYS AS ("lower"(("identity_data" ->> 'email'::"text"))) STORED,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "auth"."identities" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."identities" IS 'Auth: Stores identities associated to a user.';



COMMENT ON COLUMN "auth"."identities"."email" IS 'Auth: Email is a generated column that references the optional email property in the identity_data';



CREATE TABLE IF NOT EXISTS "auth"."instances" (
    "id" "uuid" NOT NULL,
    "uuid" "uuid",
    "raw_base_config" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "auth"."instances" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."instances" IS 'Auth: Manages users across multiple sites.';



CREATE TABLE IF NOT EXISTS "auth"."mfa_amr_claims" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "authentication_method" "text" NOT NULL,
    "id" "uuid" NOT NULL
);


ALTER TABLE "auth"."mfa_amr_claims" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_amr_claims" IS 'auth: stores authenticator method reference claims for multi factor authentication';



CREATE TABLE IF NOT EXISTS "auth"."mfa_challenges" (
    "id" "uuid" NOT NULL,
    "factor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "ip_address" "inet" NOT NULL,
    "otp_code" "text",
    "web_authn_session_data" "jsonb"
);


ALTER TABLE "auth"."mfa_challenges" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_challenges" IS 'auth: stores metadata about challenge requests made';



CREATE TABLE IF NOT EXISTS "auth"."mfa_factors" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friendly_name" "text",
    "factor_type" "auth"."factor_type" NOT NULL,
    "status" "auth"."factor_status" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "secret" "text",
    "phone" "text",
    "last_challenged_at" timestamp with time zone,
    "web_authn_credential" "jsonb",
    "web_authn_aaguid" "uuid",
    "last_webauthn_challenge_data" "jsonb"
);


ALTER TABLE "auth"."mfa_factors" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_factors" IS 'auth: stores metadata about factors';



COMMENT ON COLUMN "auth"."mfa_factors"."last_webauthn_challenge_data" IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';



CREATE TABLE IF NOT EXISTS "auth"."oauth_authorizations" (
    "id" "uuid" NOT NULL,
    "authorization_id" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "redirect_uri" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "state" "text",
    "resource" "text",
    "code_challenge" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "response_type" "auth"."oauth_response_type" DEFAULT 'code'::"auth"."oauth_response_type" NOT NULL,
    "status" "auth"."oauth_authorization_status" DEFAULT 'pending'::"auth"."oauth_authorization_status" NOT NULL,
    "authorization_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:03:00'::interval) NOT NULL,
    "approved_at" timestamp with time zone,
    "nonce" "text",
    CONSTRAINT "oauth_authorizations_authorization_code_length" CHECK (("char_length"("authorization_code") <= 255)),
    CONSTRAINT "oauth_authorizations_code_challenge_length" CHECK (("char_length"("code_challenge") <= 128)),
    CONSTRAINT "oauth_authorizations_expires_at_future" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "oauth_authorizations_nonce_length" CHECK (("char_length"("nonce") <= 255)),
    CONSTRAINT "oauth_authorizations_redirect_uri_length" CHECK (("char_length"("redirect_uri") <= 2048)),
    CONSTRAINT "oauth_authorizations_resource_length" CHECK (("char_length"("resource") <= 2048)),
    CONSTRAINT "oauth_authorizations_scope_length" CHECK (("char_length"("scope") <= 4096)),
    CONSTRAINT "oauth_authorizations_state_length" CHECK (("char_length"("state") <= 4096))
);


ALTER TABLE "auth"."oauth_authorizations" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_client_states" (
    "id" "uuid" NOT NULL,
    "provider_type" "text" NOT NULL,
    "code_verifier" "text",
    "created_at" timestamp with time zone NOT NULL
);


ALTER TABLE "auth"."oauth_client_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."oauth_client_states" IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';



CREATE TABLE IF NOT EXISTS "auth"."oauth_clients" (
    "id" "uuid" NOT NULL,
    "client_secret_hash" "text",
    "registration_type" "auth"."oauth_registration_type" NOT NULL,
    "redirect_uris" "text" NOT NULL,
    "grant_types" "text" NOT NULL,
    "client_name" "text",
    "client_uri" "text",
    "logo_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "client_type" "auth"."oauth_client_type" DEFAULT 'confidential'::"auth"."oauth_client_type" NOT NULL,
    "token_endpoint_auth_method" "text" NOT NULL,
    CONSTRAINT "oauth_clients_client_name_length" CHECK (("char_length"("client_name") <= 1024)),
    CONSTRAINT "oauth_clients_client_uri_length" CHECK (("char_length"("client_uri") <= 2048)),
    CONSTRAINT "oauth_clients_logo_uri_length" CHECK (("char_length"("logo_uri") <= 2048)),
    CONSTRAINT "oauth_clients_token_endpoint_auth_method_check" CHECK (("token_endpoint_auth_method" = ANY (ARRAY['client_secret_basic'::"text", 'client_secret_post'::"text", 'none'::"text"])))
);


ALTER TABLE "auth"."oauth_clients" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_consents" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "scopes" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "oauth_consents_revoked_after_granted" CHECK ((("revoked_at" IS NULL) OR ("revoked_at" >= "granted_at"))),
    CONSTRAINT "oauth_consents_scopes_length" CHECK (("char_length"("scopes") <= 2048)),
    CONSTRAINT "oauth_consents_scopes_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "scopes")) > 0))
);


ALTER TABLE "auth"."oauth_consents" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."one_time_tokens" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_type" "auth"."one_time_token_type" NOT NULL,
    "token_hash" "text" NOT NULL,
    "relates_to" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "one_time_tokens_token_hash_check" CHECK (("char_length"("token_hash") > 0))
);


ALTER TABLE "auth"."one_time_tokens" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."refresh_tokens" (
    "instance_id" "uuid",
    "id" bigint NOT NULL,
    "token" character varying(255),
    "user_id" character varying(255),
    "revoked" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "parent" character varying(255),
    "session_id" "uuid"
);


ALTER TABLE "auth"."refresh_tokens" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."refresh_tokens" IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';



CREATE SEQUENCE IF NOT EXISTS "auth"."refresh_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNER TO "supabase_auth_admin";


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNED BY "auth"."refresh_tokens"."id";



CREATE TABLE IF NOT EXISTS "auth"."saml_providers" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "metadata_xml" "text" NOT NULL,
    "metadata_url" "text",
    "attribute_mapping" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "name_id_format" "text",
    CONSTRAINT "entity_id not empty" CHECK (("char_length"("entity_id") > 0)),
    CONSTRAINT "metadata_url not empty" CHECK ((("metadata_url" = NULL::"text") OR ("char_length"("metadata_url") > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK (("char_length"("metadata_xml") > 0))
);


ALTER TABLE "auth"."saml_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_providers" IS 'Auth: Manages SAML Identity Provider connections.';



CREATE TABLE IF NOT EXISTS "auth"."saml_relay_states" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "for_email" "text",
    "redirect_to" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "flow_state_id" "uuid",
    CONSTRAINT "request_id not empty" CHECK (("char_length"("request_id") > 0))
);


ALTER TABLE "auth"."saml_relay_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_relay_states" IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';



CREATE TABLE IF NOT EXISTS "auth"."schema_migrations" (
    "version" character varying(255) NOT NULL
);


ALTER TABLE "auth"."schema_migrations" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."schema_migrations" IS 'Auth: Manages updates to the auth system.';



CREATE TABLE IF NOT EXISTS "auth"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "factor_id" "uuid",
    "aal" "auth"."aal_level",
    "not_after" timestamp with time zone,
    "refreshed_at" timestamp without time zone,
    "user_agent" "text",
    "ip" "inet",
    "tag" "text",
    "oauth_client_id" "uuid",
    "refresh_token_hmac_key" "text",
    "refresh_token_counter" bigint,
    "scopes" "text",
    CONSTRAINT "sessions_scopes_length" CHECK (("char_length"("scopes") <= 4096))
);


ALTER TABLE "auth"."sessions" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sessions" IS 'Auth: Stores session data associated to a user.';



COMMENT ON COLUMN "auth"."sessions"."not_after" IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_hmac_key" IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_counter" IS 'Holds the ID (counter) of the last issued refresh token.';



CREATE TABLE IF NOT EXISTS "auth"."sso_domains" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK (("char_length"("domain") > 0))
);


ALTER TABLE "auth"."sso_domains" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_domains" IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';



CREATE TABLE IF NOT EXISTS "auth"."sso_providers" (
    "id" "uuid" NOT NULL,
    "resource_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "disabled" boolean,
    CONSTRAINT "resource_id not empty" CHECK ((("resource_id" = NULL::"text") OR ("char_length"("resource_id") > 0)))
);


ALTER TABLE "auth"."sso_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_providers" IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';



COMMENT ON COLUMN "auth"."sso_providers"."resource_id" IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';



CREATE TABLE IF NOT EXISTS "auth"."users" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "aud" character varying(255),
    "role" character varying(255),
    "email" character varying(255),
    "encrypted_password" character varying(255),
    "email_confirmed_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "confirmation_token" character varying(255),
    "confirmation_sent_at" timestamp with time zone,
    "recovery_token" character varying(255),
    "recovery_sent_at" timestamp with time zone,
    "email_change_token_new" character varying(255),
    "email_change" character varying(255),
    "email_change_sent_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    "raw_app_meta_data" "jsonb",
    "raw_user_meta_data" "jsonb",
    "is_super_admin" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "phone" "text" DEFAULT NULL::character varying,
    "phone_confirmed_at" timestamp with time zone,
    "phone_change" "text" DEFAULT ''::character varying,
    "phone_change_token" character varying(255) DEFAULT ''::character varying,
    "phone_change_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone GENERATED ALWAYS AS (LEAST("email_confirmed_at", "phone_confirmed_at")) STORED,
    "email_change_token_current" character varying(255) DEFAULT ''::character varying,
    "email_change_confirm_status" smallint DEFAULT 0,
    "banned_until" timestamp with time zone,
    "reauthentication_token" character varying(255) DEFAULT ''::character varying,
    "reauthentication_sent_at" timestamp with time zone,
    "is_sso_user" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_email_change_confirm_status_check" CHECK ((("email_change_confirm_status" >= 0) AND ("email_change_confirm_status" <= 2)))
);


ALTER TABLE "auth"."users" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."users" IS 'Auth: Stores user login data within a secure schema.';



COMMENT ON COLUMN "auth"."users"."is_sso_user" IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';



CREATE TABLE IF NOT EXISTS "auth"."webauthn_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "challenge_type" "text" NOT NULL,
    "session_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "webauthn_challenges_challenge_type_check" CHECK (("challenge_type" = ANY (ARRAY['signup'::"text", 'registration'::"text", 'authentication'::"text"])))
);


ALTER TABLE "auth"."webauthn_challenges" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."webauthn_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credential_id" "bytea" NOT NULL,
    "public_key" "bytea" NOT NULL,
    "attestation_type" "text" DEFAULT ''::"text" NOT NULL,
    "aaguid" "uuid",
    "sign_count" bigint DEFAULT 0 NOT NULL,
    "transports" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "backup_eligible" boolean DEFAULT false NOT NULL,
    "backed_up" boolean DEFAULT false NOT NULL,
    "friendly_name" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone
);


ALTER TABLE "auth"."webauthn_credentials" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text",
    "entity_id" "uuid",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."badges" (
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "icon" "text" NOT NULL,
    "category" "text" NOT NULL,
    "criteria" "jsonb" NOT NULL
);


ALTER TABLE "public"."badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."broadcast_recipients" (
    "broadcast_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "delivered_at" timestamp with time zone,
    "read_at" timestamp with time zone
);


ALTER TABLE "public"."broadcast_recipients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_user_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "scope" "public"."broadcast_scope" DEFAULT 'direct_family'::"public"."broadcast_scope" NOT NULL,
    "branch_root_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."broadcasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "sender_user_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "media_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_room_members" (
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_room_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "name" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_rooms_type_check" CHECK (("type" = ANY (ARRAY['group'::"text", 'direct'::"text"])))
);


ALTER TABLE "public"."chat_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."claim_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "person_id" "uuid" NOT NULL,
    "requesting_user_id" "uuid" NOT NULL,
    "evidence" "jsonb",
    "confirmations_needed" integer DEFAULT 1 NOT NULL,
    "confirmations_received" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone
);


ALTER TABLE "public"."claim_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "person_id" "uuid",
    "consent_type" "text" NOT NULL,
    "policy_version" "text" NOT NULL,
    "granted" boolean DEFAULT true,
    "ip_hash" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "revoked_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."consents" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deletion_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "request_type" "text" DEFAULT 'full'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    "processing_notes" "text"
);

ALTER TABLE ONLY "public"."deletion_requests" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."deletion_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_date" "date" NOT NULL,
    "description" "text",
    "location" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "family_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['birth'::"text", 'marriage'::"text", 'death'::"text", 'graduation'::"text", 'reunion'::"text", 'anniversary'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."family_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "room_id" "uuid"
);


ALTER TABLE "public"."family_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_space_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_id" "uuid" NOT NULL,
    "actor_user_id" "uuid",
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."family_space_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_spaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "root_person_id" "uuid",
    "created_by" "uuid",
    "visibility" "text" DEFAULT 'private'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "family_trees_visibility_check" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'shared'::"text", 'public'::"text"])))
);

ALTER TABLE ONLY "public"."family_spaces" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_spaces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitation_events" (
    "id" bigint NOT NULL,
    "invitation_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invitation_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."invitation_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."invitation_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."invitation_events_id_seq" OWNED BY "public"."invitation_events"."id";



CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_id" "uuid",
    "person_id" "uuid",
    "invited_by" "uuid",
    "token_hash" "text" NOT NULL,
    "delivery_channel" "text" DEFAULT 'whatsapp'::"text",
    "recipient_email" "text",
    "recipient_phone_hash" "text",
    "status" "public"."invitation_status" DEFAULT 'pending'::"public"."invitation_status",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '90 days'::interval),
    "accepted_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."invitations" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_person_id" "uuid" NOT NULL,
    "candidate_person_id" "uuid" NOT NULL,
    "match_score" integer,
    "match_reasons" "jsonb",
    "status" "public"."match_status" DEFAULT 'pending'::"public"."match_status",
    "created_by" "uuid",
    "reviewed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    "space_id" "uuid",
    "requested_by" "uuid",
    "proposed_person_data" "jsonb",
    "requested_relationship" "public"."relationship_type",
    "related_to_person_id" "uuid",
    CONSTRAINT "different_persons_match" CHECK (("source_person_id" <> "candidate_person_id")),
    CONSTRAINT "match_candidates_match_score_check" CHECK ((("match_score" >= 0) AND ("match_score" <= 100)))
);

ALTER TABLE ONLY "public"."match_candidates" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_candidates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matching_config" (
    "weight_name" "text" NOT NULL,
    "weight_value" integer NOT NULL
);


ALTER TABLE "public"."matching_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."merge_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_person_id" "uuid" NOT NULL,
    "target_person_id" "uuid" NOT NULL,
    "reason" "text",
    "performed_by" "uuid",
    "snapshot" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."merge_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "user_id" "uuid" NOT NULL,
    "birthdays" boolean DEFAULT true,
    "sos" boolean DEFAULT true,
    "broadcasts" boolean DEFAULT true,
    "new_family_members" boolean DEFAULT true,
    "chat" boolean DEFAULT true
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "person_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "claim_status" "public"."claim_status" DEFAULT 'pending'::"public"."claim_status",
    "verification_method" "text",
    "claimed_at" timestamp with time zone DEFAULT "now"(),
    "approved_at" timestamp with time zone,
    "revoked_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."person_claims" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."person_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_locations" (
    "person_id" "uuid" NOT NULL,
    "city" "text" NOT NULL,
    "country" character(2) NOT NULL,
    "lat_city" double precision,
    "lon_city" double precision,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."person_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."persons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "middle_name" "text",
    "first_surname" "text" NOT NULL,
    "second_surname" "text",
    "normalized_full_name" "text",
    "birth_date" "date",
    "birth_year" smallint,
    "birth_date_precision" "text",
    "birth_city" "text",
    "birth_country" "text",
    "is_deceased" boolean DEFAULT false,
    "death_date" "date",
    "gender" "text",
    "photo_path" "text",
    "created_by" "uuid",
    "status" "public"."person_status" DEFAULT 'active'::"public"."person_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "public_id" "text" DEFAULT "public"."generate_person_public_id"() NOT NULL,
    CONSTRAINT "persons_birth_date_precision_check" CHECK (("birth_date_precision" = ANY (ARRAY['exact'::"text", 'month_year'::"text", 'year'::"text", 'approximate'::"text", 'unknown'::"text"]))),
    CONSTRAINT "persons_gender_check" CHECK (("gender" = ANY (ARRAY['male'::"text", 'female'::"text", 'non_binary'::"text", 'unknown'::"text"])))
);

ALTER TABLE ONLY "public"."persons" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."persons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."photo_tags" (
    "photo_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL
);


ALTER TABLE "public"."photo_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "uploader_user_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "caption" "text",
    "taken_at" "date",
    "scope" "public"."broadcast_scope" DEFAULT 'direct_family'::"public"."broadcast_scope" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_path" "text",
    "locale" "text" DEFAULT 'es'::"text",
    "timezone" "text" DEFAULT 'America/Bogota'::"text",
    "account_status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."profiles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."relaciones_rotas_backup" (
    "id" "uuid",
    "person_a_id" "uuid",
    "person_b_id" "uuid",
    "pair_key" "text",
    "source" "text",
    "declared_by_user_id" "uuid",
    "confidence_score" integer,
    "status" "public"."relationship_status",
    "system_inferred" boolean,
    "notes" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."relaciones_rotas_backup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "person_a_id" "uuid" NOT NULL,
    "person_b_id" "uuid" NOT NULL,
    "relationship_status" "text" DEFAULT 'active'::"text",
    "source" "text" DEFAULT 'user_declared'::"text",
    "created_by" "uuid",
    "confirmed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "relationship_type" "public"."relationship_type" NOT NULL,
    "parent_kind" "text",
    "is_current" boolean,
    CONSTRAINT "different_persons" CHECK (("person_a_id" <> "person_b_id")),
    CONSTRAINT "relationships_parent_kind_check" CHECK ((("relationship_type" <> 'parent'::"public"."relationship_type") OR (("parent_kind" IS NOT NULL) AND ("parent_kind" = ANY (ARRAY['biological'::"text", 'adoptive'::"text", 'unknown'::"text"])))))
);

ALTER TABLE ONLY "public"."relationships" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."relationships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."relationships_legacy" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "profile_a" "uuid" NOT NULL,
    "profile_b" "uuid" NOT NULL,
    "relation_from_a" "text" NOT NULL,
    "relation_from_b" "text" NOT NULL,
    "relation_kind" "text" DEFAULT 'blood'::"text" NOT NULL,
    "confirmed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "relationships_relation_kind_check" CHECK (("relation_kind" = ANY (ARRAY['blood'::"text", 'affinity'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."relationships_legacy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shared_trees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(16), 'hex'::"text") NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shared_trees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sos_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_user_id" "uuid" NOT NULL,
    "lat" double precision,
    "lon" double precision,
    "message" "text",
    "status" "public"."sos_status" DEFAULT 'active'::"public"."sos_status" NOT NULL,
    "scope_degree" integer DEFAULT 2 NOT NULL,
    "triggered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "cooldown_until" timestamp with time zone
);


ALTER TABLE "public"."sos_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sos_responses" (
    "sos_id" "uuid" NOT NULL,
    "responder_user_id" "uuid" NOT NULL,
    "response" "text" NOT NULL,
    "message" "text",
    "responded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sos_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."space_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "added_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."space_memberships" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."space_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."space_user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tree_user_roles_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'editor'::"text", 'viewer'::"text"])))
);

ALTER TABLE ONLY "public"."space_user_roles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."space_user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."system_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "user_id" "uuid" NOT NULL,
    "badge_code" "text" NOT NULL,
    "earned_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


ALTER TABLE ONLY "auth"."refresh_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"auth"."refresh_tokens_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."invitation_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."invitation_events_id_seq"'::"regclass");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "amr_id_pk" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."audit_log_entries"
    ADD CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."custom_oauth_providers"
    ADD CONSTRAINT "custom_oauth_providers_identifier_key" UNIQUE ("identifier");



ALTER TABLE ONLY "auth"."custom_oauth_providers"
    ADD CONSTRAINT "custom_oauth_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."flow_state"
    ADD CONSTRAINT "flow_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_provider_id_provider_unique" UNIQUE ("provider_id", "provider");



ALTER TABLE ONLY "auth"."instances"
    ADD CONSTRAINT "instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_authentication_method_pkey" UNIQUE ("session_id", "authentication_method");



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_last_challenged_at_key" UNIQUE ("last_challenged_at");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_code_key" UNIQUE ("authorization_code");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_id_key" UNIQUE ("authorization_id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_client_states"
    ADD CONSTRAINT "oauth_client_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_clients"
    ADD CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_client_unique" UNIQUE ("user_id", "client_id");



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_token_unique" UNIQUE ("token");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_entity_id_key" UNIQUE ("entity_id");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_providers"
    ADD CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."webauthn_challenges"
    ADD CONSTRAINT "webauthn_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."broadcast_recipients"
    ADD CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("broadcast_id", "person_id");



ALTER TABLE ONLY "public"."broadcasts"
    ADD CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_room_members"
    ADD CONSTRAINT "chat_room_members_pkey" PRIMARY KEY ("room_id", "user_id");



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."persons"
    ADD CONSTRAINT "chk_birth_date_precision_valid" CHECK (("birth_date_precision" = ANY (ARRAY['exact'::"text", 'month_year'::"text", 'year'::"text", 'approximate'::"text", 'unknown'::"text"]))) NOT VALID;



ALTER TABLE "public"."persons"
    ADD CONSTRAINT "chk_death_after_birth" CHECK ((("death_date" IS NULL) OR ("birth_date" IS NULL) OR ("death_date" >= "birth_date"))) NOT VALID;



ALTER TABLE "public"."persons"
    ADD CONSTRAINT "chk_gender_valid" CHECK (("gender" = ANY (ARRAY['male'::"text", 'female'::"text", 'non_binary'::"text", 'unknown'::"text"]))) NOT VALID;



ALTER TABLE "public"."relationships"
    ADD CONSTRAINT "chk_parent_kind_required" CHECK ((("relationship_type" <> 'parent'::"public"."relationship_type") OR ("parent_kind" = ANY (ARRAY['biological'::"text", 'adoptive'::"text", 'unknown'::"text"])))) NOT VALID;



ALTER TABLE ONLY "public"."claim_requests"
    ADD CONSTRAINT "claim_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consents"
    ADD CONSTRAINT "consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_events"
    ADD CONSTRAINT "family_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_messages"
    ADD CONSTRAINT "family_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_space_events"
    ADD CONSTRAINT "family_space_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_spaces"
    ADD CONSTRAINT "family_trees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitation_events"
    ADD CONSTRAINT "invitation_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."match_candidates"
    ADD CONSTRAINT "match_candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matching_config"
    ADD CONSTRAINT "matching_config_pkey" PRIMARY KEY ("weight_name");



ALTER TABLE ONLY "public"."merge_history"
    ADD CONSTRAINT "merge_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."person_claims"
    ADD CONSTRAINT "person_claims_person_id_user_id_key" UNIQUE ("person_id", "user_id");



ALTER TABLE ONLY "public"."person_claims"
    ADD CONSTRAINT "person_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_locations"
    ADD CONSTRAINT "person_locations_pkey" PRIMARY KEY ("person_id");



ALTER TABLE ONLY "public"."persons"
    ADD CONSTRAINT "persons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."persons"
    ADD CONSTRAINT "persons_public_id_unique" UNIQUE ("public_id");



ALTER TABLE ONLY "public"."photo_tags"
    ADD CONSTRAINT "photo_tags_pkey1" PRIMARY KEY ("photo_id", "person_id");



ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."relationships_legacy"
    ADD CONSTRAINT "relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relationships_legacy"
    ADD CONSTRAINT "relationships_profile_a_profile_b_key" UNIQUE ("profile_a", "profile_b");



ALTER TABLE ONLY "public"."shared_trees"
    ADD CONSTRAINT "shared_trees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shared_trees"
    ADD CONSTRAINT "shared_trees_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."shared_trees"
    ADD CONSTRAINT "shared_trees_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."sos_alerts"
    ADD CONSTRAINT "sos_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sos_responses"
    ADD CONSTRAINT "sos_responses_pkey" PRIMARY KEY ("sos_id", "responder_user_id");



ALTER TABLE ONLY "public"."system_events"
    ADD CONSTRAINT "system_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."space_memberships"
    ADD CONSTRAINT "tree_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."space_memberships"
    ADD CONSTRAINT "tree_memberships_tree_id_person_id_key" UNIQUE ("space_id", "person_id");



ALTER TABLE ONLY "public"."space_user_roles"
    ADD CONSTRAINT "tree_user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."space_user_roles"
    ADD CONSTRAINT "tree_user_roles_tree_id_user_id_key" UNIQUE ("space_id", "user_id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("user_id", "badge_code");



CREATE INDEX "audit_logs_instance_id_idx" ON "auth"."audit_log_entries" USING "btree" ("instance_id");



CREATE UNIQUE INDEX "confirmation_token_idx" ON "auth"."users" USING "btree" ("confirmation_token") WHERE (("confirmation_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "custom_oauth_providers_created_at_idx" ON "auth"."custom_oauth_providers" USING "btree" ("created_at");



CREATE INDEX "custom_oauth_providers_enabled_idx" ON "auth"."custom_oauth_providers" USING "btree" ("enabled");



CREATE INDEX "custom_oauth_providers_identifier_idx" ON "auth"."custom_oauth_providers" USING "btree" ("identifier");



CREATE INDEX "custom_oauth_providers_provider_type_idx" ON "auth"."custom_oauth_providers" USING "btree" ("provider_type");



CREATE UNIQUE INDEX "email_change_token_current_idx" ON "auth"."users" USING "btree" ("email_change_token_current") WHERE (("email_change_token_current")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_new_idx" ON "auth"."users" USING "btree" ("email_change_token_new") WHERE (("email_change_token_new")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "factor_id_created_at_idx" ON "auth"."mfa_factors" USING "btree" ("user_id", "created_at");



CREATE INDEX "flow_state_created_at_idx" ON "auth"."flow_state" USING "btree" ("created_at" DESC);



CREATE INDEX "identities_email_idx" ON "auth"."identities" USING "btree" ("email" "text_pattern_ops");



COMMENT ON INDEX "auth"."identities_email_idx" IS 'Auth: Ensures indexed queries on the email column';



CREATE INDEX "identities_user_id_idx" ON "auth"."identities" USING "btree" ("user_id");



CREATE INDEX "idx_auth_code" ON "auth"."flow_state" USING "btree" ("auth_code");



CREATE INDEX "idx_oauth_client_states_created_at" ON "auth"."oauth_client_states" USING "btree" ("created_at");



CREATE INDEX "idx_user_id_auth_method" ON "auth"."flow_state" USING "btree" ("user_id", "authentication_method");



CREATE INDEX "idx_users_created_at_desc" ON "auth"."users" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_users_email" ON "auth"."users" USING "btree" ("email");



CREATE INDEX "idx_users_last_sign_in_at_desc" ON "auth"."users" USING "btree" ("last_sign_in_at" DESC);



CREATE INDEX "idx_users_name" ON "auth"."users" USING "btree" ((("raw_user_meta_data" ->> 'name'::"text"))) WHERE (("raw_user_meta_data" ->> 'name'::"text") IS NOT NULL);



CREATE INDEX "mfa_challenge_created_at_idx" ON "auth"."mfa_challenges" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "mfa_factors_user_friendly_name_unique" ON "auth"."mfa_factors" USING "btree" ("friendly_name", "user_id") WHERE (TRIM(BOTH FROM "friendly_name") <> ''::"text");



CREATE INDEX "mfa_factors_user_id_idx" ON "auth"."mfa_factors" USING "btree" ("user_id");



CREATE INDEX "oauth_auth_pending_exp_idx" ON "auth"."oauth_authorizations" USING "btree" ("expires_at") WHERE ("status" = 'pending'::"auth"."oauth_authorization_status");



CREATE INDEX "oauth_clients_deleted_at_idx" ON "auth"."oauth_clients" USING "btree" ("deleted_at");



CREATE INDEX "oauth_consents_active_client_idx" ON "auth"."oauth_consents" USING "btree" ("client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_active_user_client_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_user_order_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "granted_at" DESC);



CREATE INDEX "one_time_tokens_relates_to_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("relates_to");



CREATE INDEX "one_time_tokens_token_hash_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("token_hash");



CREATE UNIQUE INDEX "one_time_tokens_user_id_token_type_key" ON "auth"."one_time_tokens" USING "btree" ("user_id", "token_type");



CREATE UNIQUE INDEX "reauthentication_token_idx" ON "auth"."users" USING "btree" ("reauthentication_token") WHERE (("reauthentication_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "recovery_token_idx" ON "auth"."users" USING "btree" ("recovery_token") WHERE (("recovery_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "refresh_tokens_instance_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id");



CREATE INDEX "refresh_tokens_instance_id_user_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id", "user_id");



CREATE INDEX "refresh_tokens_parent_idx" ON "auth"."refresh_tokens" USING "btree" ("parent");



CREATE INDEX "refresh_tokens_session_id_revoked_idx" ON "auth"."refresh_tokens" USING "btree" ("session_id", "revoked");



CREATE INDEX "refresh_tokens_updated_at_idx" ON "auth"."refresh_tokens" USING "btree" ("updated_at" DESC);



CREATE INDEX "saml_providers_sso_provider_id_idx" ON "auth"."saml_providers" USING "btree" ("sso_provider_id");



CREATE INDEX "saml_relay_states_created_at_idx" ON "auth"."saml_relay_states" USING "btree" ("created_at" DESC);



CREATE INDEX "saml_relay_states_for_email_idx" ON "auth"."saml_relay_states" USING "btree" ("for_email");



CREATE INDEX "saml_relay_states_sso_provider_id_idx" ON "auth"."saml_relay_states" USING "btree" ("sso_provider_id");



CREATE INDEX "sessions_not_after_idx" ON "auth"."sessions" USING "btree" ("not_after" DESC);



CREATE INDEX "sessions_oauth_client_id_idx" ON "auth"."sessions" USING "btree" ("oauth_client_id");



CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "sso_domains_domain_idx" ON "auth"."sso_domains" USING "btree" ("lower"("domain"));



CREATE INDEX "sso_domains_sso_provider_id_idx" ON "auth"."sso_domains" USING "btree" ("sso_provider_id");



CREATE UNIQUE INDEX "sso_providers_resource_id_idx" ON "auth"."sso_providers" USING "btree" ("lower"("resource_id"));



CREATE INDEX "sso_providers_resource_id_pattern_idx" ON "auth"."sso_providers" USING "btree" ("resource_id" "text_pattern_ops");



CREATE UNIQUE INDEX "unique_phone_factor_per_user" ON "auth"."mfa_factors" USING "btree" ("user_id", "phone");



CREATE INDEX "user_id_created_at_idx" ON "auth"."sessions" USING "btree" ("user_id", "created_at");



CREATE UNIQUE INDEX "users_email_partial_key" ON "auth"."users" USING "btree" ("email") WHERE ("is_sso_user" = false);



COMMENT ON INDEX "auth"."users_email_partial_key" IS 'Auth: A partial unique index that applies only when is_sso_user is false';



CREATE INDEX "users_instance_id_email_idx" ON "auth"."users" USING "btree" ("instance_id", "lower"(("email")::"text"));



CREATE INDEX "users_instance_id_idx" ON "auth"."users" USING "btree" ("instance_id");



CREATE INDEX "users_is_anonymous_idx" ON "auth"."users" USING "btree" ("is_anonymous");



CREATE INDEX "webauthn_challenges_expires_at_idx" ON "auth"."webauthn_challenges" USING "btree" ("expires_at");



CREATE INDEX "webauthn_challenges_user_id_idx" ON "auth"."webauthn_challenges" USING "btree" ("user_id");



CREATE UNIQUE INDEX "webauthn_credentials_credential_id_key" ON "auth"."webauthn_credentials" USING "btree" ("credential_id");



CREATE INDEX "webauthn_credentials_user_id_idx" ON "auth"."webauthn_credentials" USING "btree" ("user_id");



CREATE INDEX "idx_broadcasts_sender" ON "public"."broadcasts" USING "btree" ("sender_user_id", "created_at" DESC);



CREATE INDEX "idx_chat_messages_room" ON "public"."chat_messages" USING "btree" ("room_id", "created_at" DESC);



CREATE INDEX "idx_events_date" ON "public"."family_events" USING "btree" ("event_date" DESC);



CREATE INDEX "idx_family_space_events_space_created" ON "public"."family_space_events" USING "btree" ("space_id", "created_at" DESC);



CREATE INDEX "idx_invitations_token_hash" ON "public"."invitations" USING "btree" ("token_hash");



CREATE INDEX "idx_match_candidates_status" ON "public"."match_candidates" USING "btree" ("status");



CREATE INDEX "idx_person_claims_person" ON "public"."person_claims" USING "btree" ("person_id");



CREATE INDEX "idx_person_claims_person_id" ON "public"."person_claims" USING "btree" ("person_id");



CREATE INDEX "idx_person_claims_user" ON "public"."person_claims" USING "btree" ("user_id");



CREATE INDEX "idx_persons_birth_date" ON "public"."persons" USING "btree" ("birth_date");



CREATE INDEX "idx_persons_normalized_full_name" ON "public"."persons" USING "gin" ("normalized_full_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_persons_status" ON "public"."persons" USING "btree" ("status") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_persons_status_active" ON "public"."persons" USING "btree" ("id") WHERE (("deleted_at" IS NULL) AND ("status" = 'active'::"public"."person_status"));



CREATE INDEX "idx_profiles_user_id" ON "public"."profiles" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_relationships_parent_guardian_unique" ON "public"."relationships" USING "btree" ("person_a_id", "person_b_id", "relationship_type") WHERE (("deleted_at" IS NULL) AND ("relationship_type" = ANY (ARRAY['parent'::"public"."relationship_type", 'guardian'::"public"."relationship_type"])));



CREATE UNIQUE INDEX "idx_relationships_partner_canonical" ON "public"."relationships" USING "btree" (LEAST("person_a_id", "person_b_id"), GREATEST("person_a_id", "person_b_id")) WHERE (("deleted_at" IS NULL) AND ("relationship_type" = 'partner'::"public"."relationship_type"));



CREATE INDEX "idx_relationships_person_a" ON "public"."relationships" USING "btree" ("person_a_id");



CREATE INDEX "idx_relationships_person_a_type" ON "public"."relationships" USING "btree" ("person_a_id", "relationship_type") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_relationships_person_b" ON "public"."relationships" USING "btree" ("person_b_id");



CREATE INDEX "idx_relationships_person_b_type" ON "public"."relationships" USING "btree" ("person_b_id", "relationship_type") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_sos_active" ON "public"."sos_alerts" USING "btree" ("sender_user_id", "status");



CREATE INDEX "idx_sos_triggered" ON "public"."sos_alerts" USING "btree" ("triggered_at" DESC);



CREATE INDEX "idx_space_memberships_person_id" ON "public"."space_memberships" USING "btree" ("person_id");



CREATE INDEX "idx_system_events_created" ON "public"."system_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_tree_memberships_person" ON "public"."space_memberships" USING "btree" ("person_id");



CREATE INDEX "idx_tree_memberships_tree" ON "public"."space_memberships" USING "btree" ("space_id");



CREATE INDEX "idx_tree_user_roles_tree" ON "public"."space_user_roles" USING "btree" ("space_id");



CREATE INDEX "idx_tree_user_roles_user" ON "public"."space_user_roles" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



CREATE OR REPLACE TRIGGER "sos_dispatcher" AFTER INSERT ON "public"."sos_alerts" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://txxdzxdzetqlfecqhxkl.supabase.co/functions/v1/sos-dispatcher', 'POST', '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4eGR6eGR6ZXRxbGZlY3FoeGtsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjQ0MjE1OCwiZXhwIjoyMDk4MDE4MTU4fQ.0ymRFVpmkUHdxb0yQHCbSh8Tsa0REYdqOYnQ5ehLF4s"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "trg_family_spaces_updated_at" BEFORE UPDATE ON "public"."family_spaces" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_normalize_person_name" BEFORE INSERT OR UPDATE OF "first_name", "middle_name", "first_surname", "second_surname" ON "public"."persons" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_person_name"();



CREATE OR REPLACE TRIGGER "trg_persons_updated_at" BEFORE UPDATE ON "public"."persons" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_relationships_updated_at" BEFORE UPDATE ON "public"."relationships" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_auth_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "auth"."mfa_factors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_flow_state_id_fkey" FOREIGN KEY ("flow_state_id") REFERENCES "auth"."flow_state"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_oauth_client_id_fkey" FOREIGN KEY ("oauth_client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."webauthn_challenges"
    ADD CONSTRAINT "webauthn_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."broadcast_recipients"
    ADD CONSTRAINT "broadcast_recipients_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."broadcasts"
    ADD CONSTRAINT "broadcasts_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_room_members"
    ADD CONSTRAINT "chat_room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."claim_requests"
    ADD CONSTRAINT "claim_requests_requesting_user_id_fkey" FOREIGN KEY ("requesting_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consents"
    ADD CONSTRAINT "consents_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."consents"
    ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_messages"
    ADD CONSTRAINT "family_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_space_events"
    ADD CONSTRAINT "family_space_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."family_space_events"
    ADD CONSTRAINT "family_space_events_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."family_spaces"("id");



ALTER TABLE ONLY "public"."family_spaces"
    ADD CONSTRAINT "family_trees_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."family_spaces"
    ADD CONSTRAINT "family_trees_root_person_id_fkey" FOREIGN KEY ("root_person_id") REFERENCES "public"."persons"("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_tree_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."family_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_candidates"
    ADD CONSTRAINT "match_candidates_candidate_person_id_fkey" FOREIGN KEY ("candidate_person_id") REFERENCES "public"."persons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_candidates"
    ADD CONSTRAINT "match_candidates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."match_candidates"
    ADD CONSTRAINT "match_candidates_related_to_person_id_fkey" FOREIGN KEY ("related_to_person_id") REFERENCES "public"."persons"("id");



ALTER TABLE ONLY "public"."match_candidates"
    ADD CONSTRAINT "match_candidates_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."match_candidates"
    ADD CONSTRAINT "match_candidates_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."match_candidates"
    ADD CONSTRAINT "match_candidates_source_person_id_fkey" FOREIGN KEY ("source_person_id") REFERENCES "public"."persons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_candidates"
    ADD CONSTRAINT "match_candidates_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."family_spaces"("id");



ALTER TABLE ONLY "public"."merge_history"
    ADD CONSTRAINT "merge_history_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_claims"
    ADD CONSTRAINT "person_claims_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_claims"
    ADD CONSTRAINT "person_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."persons"
    ADD CONSTRAINT "persons_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."photo_tags"
    ADD CONSTRAINT "photo_tags_photo_id_fkey1" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_uploader_user_id_fkey" FOREIGN KEY ("uploader_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_person_a_id_fkey" FOREIGN KEY ("person_a_id") REFERENCES "public"."persons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_person_b_id_fkey" FOREIGN KEY ("person_b_id") REFERENCES "public"."persons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sos_alerts"
    ADD CONSTRAINT "sos_alerts_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sos_responses"
    ADD CONSTRAINT "sos_responses_responder_user_id_fkey" FOREIGN KEY ("responder_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sos_responses"
    ADD CONSTRAINT "sos_responses_sos_id_fkey" FOREIGN KEY ("sos_id") REFERENCES "public"."sos_alerts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_events"
    ADD CONSTRAINT "system_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."space_memberships"
    ADD CONSTRAINT "tree_memberships_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."space_memberships"
    ADD CONSTRAINT "tree_memberships_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."space_memberships"
    ADD CONSTRAINT "tree_memberships_tree_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."family_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."space_user_roles"
    ADD CONSTRAINT "tree_user_roles_tree_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."family_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."space_user_roles"
    ADD CONSTRAINT "tree_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_badge_code_fkey" FOREIGN KEY ("badge_code") REFERENCES "public"."badges"("code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "auth"."audit_log_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."flow_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_amr_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."one_time_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."refresh_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_relay_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."schema_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Actualizar last_read" ON "public"."chat_room_members" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Authenticated insert members" ON "public"."chat_room_members" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated insert rooms" ON "public"."chat_rooms" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Authenticated read rooms" ON "public"."chat_rooms" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Crear salas" ON "public"."chat_rooms" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Cualquiera puede ver tokens" ON "public"."shared_trees" FOR SELECT USING (true);



CREATE POLICY "Familia envía mensajes" ON "public"."family_messages" FOR INSERT WITH CHECK (("sender_id" = "auth"."uid"()));



CREATE POLICY "Familia ve mensajes" ON "public"."family_messages" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Members read their rooms" ON "public"."chat_room_members" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Unirse a sala" ON "public"."chat_room_members" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can create relationships" ON "public"."relationships_legacy" FOR INSERT WITH CHECK ((("profile_a" = "auth"."uid"()) OR ("profile_b" = "auth"."uid"())));



CREATE POLICY "Users can update their relationships" ON "public"."relationships_legacy" FOR UPDATE USING ((("profile_a" = "auth"."uid"()) OR ("profile_b" = "auth"."uid"())));



CREATE POLICY "Users can view their relationships" ON "public"."relationships_legacy" FOR SELECT USING ((("profile_a" = "auth"."uid"()) OR ("profile_b" = "auth"."uid"())));



CREATE POLICY "Users manage own subscriptions" ON "public"."push_subscriptions" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Usuarios autenticados ven eventos" ON "public"."family_events" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios crean eventos" ON "public"."family_events" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Usuarios eliminan sus eventos" ON "public"."family_events" FOR DELETE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Usuarios gestionan su propio token" ON "public"."shared_trees" FOR INSERT WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "Ver miembros" ON "public"."chat_room_members" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Ver salas propias" ON "public"."chat_rooms" FOR SELECT USING ((("type" = 'group'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."chat_room_members"
  WHERE (("chat_room_members"."room_id" = "chat_rooms"."id") AND ("chat_room_members"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_select" ON "public"."audit_logs" FOR SELECT USING (("actor_user_id" = "auth"."uid"()));



ALTER TABLE "public"."badges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "badges_read" ON "public"."badges" FOR SELECT USING (true);



CREATE POLICY "bc_insert" ON "public"."broadcasts" FOR INSERT WITH CHECK (("sender_user_id" = "auth"."uid"()));



ALTER TABLE "public"."broadcast_recipients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."broadcasts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_room_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_rooms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "claim_insert" ON "public"."claim_requests" FOR INSERT WITH CHECK (("requesting_user_id" = "auth"."uid"()));



CREATE POLICY "claim_read" ON "public"."claim_requests" FOR SELECT USING ((("requesting_user_id" = "auth"."uid"()) OR "public"."is_in_my_family"("person_id", 4)));



ALTER TABLE "public"."claim_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "consents_delete" ON "public"."consents" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "consents_insert" ON "public"."consents" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "consents_select" ON "public"."consents" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "consents_update" ON "public"."consents" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."deletion_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deletion_requests_delete" ON "public"."deletion_requests" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "deletion_requests_insert" ON "public"."deletion_requests" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "deletion_requests_select" ON "public"."deletion_requests" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "deletion_requests_update" ON "public"."deletion_requests" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."family_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_space_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "family_space_events_select" ON "public"."family_space_events" FOR SELECT USING ("public"."can_view_space"("space_id"));



ALTER TABLE "public"."family_spaces" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "family_spaces_delete" ON "public"."family_spaces" FOR DELETE USING ("public"."can_manage_space"("id"));



CREATE POLICY "family_spaces_insert" ON "public"."family_spaces" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "family_spaces_select" ON "public"."family_spaces" FOR SELECT USING ("public"."can_view_space"("id"));



CREATE POLICY "family_spaces_update" ON "public"."family_spaces" FOR UPDATE USING ("public"."can_manage_space"("id")) WITH CHECK ("public"."can_manage_space"("id"));



ALTER TABLE "public"."invitation_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invitations_insert" ON "public"."invitations" FOR INSERT WITH CHECK (("invited_by" = "auth"."uid"()));



CREATE POLICY "invitations_select" ON "public"."invitations" FOR SELECT USING ((("invited_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."person_claims"
  WHERE (("person_claims"."person_id" = "invitations"."person_id") AND ("person_claims"."user_id" = "auth"."uid"()) AND ("person_claims"."claim_status" = 'approved'::"public"."claim_status"))))));



CREATE POLICY "invitations_update" ON "public"."invitations" FOR UPDATE USING (("invited_by" = "auth"."uid"())) WITH CHECK (("invited_by" = "auth"."uid"()));



ALTER TABLE "public"."match_candidates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_candidates_insert" ON "public"."match_candidates" FOR INSERT WITH CHECK (("requested_by" = "auth"."uid"()));



CREATE POLICY "match_candidates_select" ON "public"."match_candidates" FOR SELECT USING (("requested_by" = "auth"."uid"()));



CREATE POLICY "match_candidates_update" ON "public"."match_candidates" FOR UPDATE USING (("requested_by" = "auth"."uid"())) WITH CHECK (("requested_by" = "auth"."uid"()));



ALTER TABLE "public"."matching_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."merge_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."person_claims" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_claims_delete" ON "public"."person_claims" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "person_claims_insert" ON "public"."person_claims" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "person_claims_select" ON "public"."person_claims" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "person_claims_update" ON "public"."person_claims" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."person_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."persons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "persons_insert" ON "public"."persons" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "persons_select" ON "public"."persons" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."space_memberships" "sm"
  WHERE (("sm"."person_id" = "persons"."id") AND "public"."can_view_space"("sm"."space_id")))) OR ("created_by" = "auth"."uid"())));



CREATE POLICY "persons_update" ON "public"."persons" FOR UPDATE USING (("created_by" = "auth"."uid"())) WITH CHECK (("created_by" = "auth"."uid"()));



ALTER TABLE "public"."photo_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prefs_all" ON "public"."notification_preferences" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_delete" ON "public"."profiles" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "profiles_insert" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."relaciones_rotas_backup" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."relationships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "relationships_delete" ON "public"."relationships" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."space_memberships" "sm"
  WHERE ((("sm"."person_id" = "relationships"."person_a_id") OR ("sm"."person_id" = "relationships"."person_b_id")) AND "public"."can_edit_space"("sm"."space_id")))));



CREATE POLICY "relationships_insert" ON "public"."relationships" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."space_memberships" "sm"
  WHERE ((("sm"."person_id" = "relationships"."person_a_id") OR ("sm"."person_id" = "relationships"."person_b_id")) AND "public"."can_edit_space"("sm"."space_id")))));



ALTER TABLE "public"."relationships_legacy" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "relationships_select" ON "public"."relationships" FOR SELECT USING ("public"."can_view_relationship"("id"));



CREATE POLICY "relationships_update" ON "public"."relationships" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."space_memberships" "sm"
  WHERE ((("sm"."person_id" = "relationships"."person_a_id") OR ("sm"."person_id" = "relationships"."person_b_id")) AND "public"."can_edit_space"("sm"."space_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."space_memberships" "sm"
  WHERE ((("sm"."person_id" = "relationships"."person_a_id") OR ("sm"."person_id" = "relationships"."person_b_id")) AND "public"."can_edit_space"("sm"."space_id")))));



ALTER TABLE "public"."shared_trees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sos_alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sos_insert" ON "public"."sos_alerts" FOR INSERT WITH CHECK (("sender_user_id" = "auth"."uid"()));



CREATE POLICY "sos_resp_insert" ON "public"."sos_responses" FOR INSERT WITH CHECK (("responder_user_id" = "auth"."uid"()));



CREATE POLICY "sos_resp_read" ON "public"."sos_responses" FOR SELECT USING ((("responder_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."sos_alerts" "s"
  WHERE (("s"."id" = "sos_responses"."sos_id") AND ("s"."sender_user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."sos_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sos_update" ON "public"."sos_alerts" FOR UPDATE USING (("sender_user_id" = "auth"."uid"()));



ALTER TABLE "public"."space_memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "space_memberships_delete" ON "public"."space_memberships" FOR DELETE USING ("public"."can_edit_space"("space_id"));



CREATE POLICY "space_memberships_insert" ON "public"."space_memberships" FOR INSERT WITH CHECK ("public"."can_edit_space"("space_id"));



CREATE POLICY "space_memberships_select" ON "public"."space_memberships" FOR SELECT USING ("public"."can_view_space"("space_id"));



ALTER TABLE "public"."space_user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "space_user_roles_delete" ON "public"."space_user_roles" FOR DELETE USING ("public"."can_manage_space"("space_id"));



CREATE POLICY "space_user_roles_insert" ON "public"."space_user_roles" FOR INSERT WITH CHECK ("public"."can_manage_space"("space_id"));



CREATE POLICY "space_user_roles_select" ON "public"."space_user_roles" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."can_manage_space"("space_id")));



CREATE POLICY "space_user_roles_update" ON "public"."space_user_roles" FOR UPDATE USING ("public"."can_manage_space"("space_id")) WITH CHECK ("public"."can_manage_space"("space_id"));



ALTER TABLE "public"."system_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_events_select" ON "public"."system_events" FOR SELECT USING (false);



CREATE POLICY "tokens_all" ON "public"."push_tokens" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_badges_read" ON "public"."user_badges" FOR SELECT USING (("user_id" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "auth" TO "anon";
GRANT USAGE ON SCHEMA "auth" TO "authenticated";
GRANT USAGE ON SCHEMA "auth" TO "service_role";
GRANT ALL ON SCHEMA "auth" TO "supabase_auth_admin";
GRANT ALL ON SCHEMA "auth" TO "dashboard_user";
GRANT USAGE ON SCHEMA "auth" TO "postgres";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "auth"."email"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."jwt"() TO "postgres";
GRANT ALL ON FUNCTION "auth"."jwt"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."role"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."uid"() TO "dashboard_user";



GRANT ALL ON FUNCTION "public"."_admin_birthdays_for_person"("p_person" "uuid", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_admin_birthdays_for_person"("p_person" "uuid", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_admin_birthdays_for_person"("p_person" "uuid", "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."award_badge"("p_user" "uuid", "p_badge" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."award_badge"("p_user" "uuid", "p_badge" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_badge"("p_user" "uuid", "p_badge" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_edit_space"("p_space_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_edit_space"("p_space_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_edit_space"("p_space_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_edit_space"("p_space_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_space"("p_space_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_space"("p_space_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_space"("p_space_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_space"("p_space_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_view_relationship"("p_relationship_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_relationship"("p_relationship_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_relationship"("p_relationship_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_relationship"("p_relationship_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_view_space"("p_space_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_space"("p_space_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_space"("p_space_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_space"("p_space_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_sos"("p_sos" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_sos"("p_sos" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_sos"("p_sos" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_no_parent_cycle"("p_parent_id" "uuid", "p_child_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_no_parent_cycle"("p_parent_id" "uuid", "p_child_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_no_parent_cycle"("p_parent_id" "uuid", "p_child_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_no_parent_cycle"("p_parent_id" "uuid", "p_child_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_person"("p_person_id" "uuid", "p_verification_method" "text", "p_invitation_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_person"("p_person_id" "uuid", "p_verification_method" "text", "p_invitation_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_person"("p_person_id" "uuid", "p_verification_method" "text", "p_invitation_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_person"("p_person_id" "uuid", "p_verification_method" "text", "p_invitation_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_name_match"("p_family_member_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_name_match"("p_family_member_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_name_match"("p_family_member_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_invitation"("p_person_id" "uuid", "p_channel" "text", "p_template" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_invitation"("p_person_id" "uuid", "p_channel" "text", "p_template" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_invitation"("p_person_id" "uuid", "p_channel" "text", "p_template" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_person"("p_data" "jsonb", "p_created_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_person"("p_data" "jsonb", "p_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_person"("p_data" "jsonb", "p_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_person"("p_data" "jsonb", "p_created_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_relationship"("p_person_a_id" "uuid", "p_person_b_id" "uuid", "p_relationship" "public"."relationship_type", "p_parent_kind" "text", "p_is_current" boolean, "p_source" "text", "p_created_by" "uuid", "p_close_previous_partners" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_relationship"("p_person_a_id" "uuid", "p_person_b_id" "uuid", "p_relationship" "public"."relationship_type", "p_parent_kind" "text", "p_is_current" boolean, "p_source" "text", "p_created_by" "uuid", "p_close_previous_partners" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_relationship"("p_person_a_id" "uuid", "p_person_b_id" "uuid", "p_relationship" "public"."relationship_type", "p_parent_kind" "text", "p_is_current" boolean, "p_source" "text", "p_created_by" "uuid", "p_close_previous_partners" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_relationship"("p_person_a_id" "uuid", "p_person_b_id" "uuid", "p_relationship" "public"."relationship_type", "p_parent_kind" "text", "p_is_current" boolean, "p_source" "text", "p_created_by" "uuid", "p_close_previous_partners" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_name_matches"("p_first_name" "text", "p_last_name" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."find_name_matches"("p_first_name" "text", "p_last_name" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_name_matches"("p_first_name" "text", "p_last_name" "text", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."find_person_matches"("p_first_name" "text", "p_first_surname" "text", "p_second_surname" "text", "p_birth_date" "date", "p_birth_city" "text", "p_birth_country" "text", "p_known_parent_ids" "uuid"[], "p_known_partner_ids" "uuid"[], "p_known_child_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."find_person_matches"("p_first_name" "text", "p_first_surname" "text", "p_second_surname" "text", "p_birth_date" "date", "p_birth_city" "text", "p_birth_country" "text", "p_known_parent_ids" "uuid"[], "p_known_partner_ids" "uuid"[], "p_known_child_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."find_person_matches"("p_first_name" "text", "p_first_surname" "text", "p_second_surname" "text", "p_birth_date" "date", "p_birth_city" "text", "p_birth_country" "text", "p_known_parent_ids" "uuid"[], "p_known_partner_ids" "uuid"[], "p_known_child_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_person_matches"("p_first_name" "text", "p_first_surname" "text", "p_second_surname" "text", "p_birth_date" "date", "p_birth_city" "text", "p_birth_country" "text", "p_known_parent_ids" "uuid"[], "p_known_partner_ids" "uuid"[], "p_known_child_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_family_suggestions"("p_adder_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_relation_type" "text", "p_family_member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_family_suggestions"("p_adder_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_relation_type" "text", "p_family_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_family_suggestions"("p_adder_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_relation_type" "text", "p_family_member_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_person_public_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_person_public_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_person_public_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_person_public_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_reverse_suggestions"("p_new_user_id" "uuid", "p_connector_id" "uuid", "p_my_relation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_reverse_suggestions"("p_new_user_id" "uuid", "p_connector_id" "uuid", "p_my_relation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_reverse_suggestions"("p_new_user_id" "uuid", "p_connector_id" "uuid", "p_my_relation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_family_ids_up_to"("p_person" "uuid", "p_degree" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_family_ids_up_to"("p_person" "uuid", "p_degree" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_family_ids_up_to"("p_person" "uuid", "p_degree" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_family_tree"("start_profile_id" "uuid", "max_depth" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_family_tree"("start_profile_id" "uuid", "max_depth" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_family_tree"("start_profile_id" "uuid", "max_depth" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_family_graph"("depth" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_family_graph"("depth" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_family_graph"("depth" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shared_tree"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_shared_tree"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shared_tree"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."immutable_unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."immutable_unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."immutable_unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."infer_relation"("connector_relation" "text", "new_relation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."infer_relation"("connector_relation" "text", "new_relation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."infer_relation"("connector_relation" "text", "new_relation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_in_my_family"("target_person" "uuid", "degree" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."is_in_my_family"("target_person" "uuid", "degree" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_in_my_family"("target_person" "uuid", "degree" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."link_persons"("member_id_a" "uuid", "member_id_b" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."link_persons"("member_id_a" "uuid", "member_id_b" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_persons"("member_id_a" "uuid", "member_id_b" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_audit_critical"("p_actor_user_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_audit_critical"("p_actor_user_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_audit_critical"("p_actor_user_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_audit_critical"("p_actor_user_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_family_space_event"("p_space_id" "uuid", "p_actor_user_id" "uuid", "p_event_type" "text", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_family_space_event"("p_space_id" "uuid", "p_actor_user_id" "uuid", "p_event_type" "text", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_family_space_event"("p_space_id" "uuid", "p_actor_user_id" "uuid", "p_event_type" "text", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_family_space_event"("p_space_id" "uuid", "p_actor_user_id" "uuid", "p_event_type" "text", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_invitation_activated"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_invitation_activated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_invitation_activated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_invitation_shared"("p_invitation" "uuid", "p_channel" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_invitation_shared"("p_invitation" "uuid", "p_channel" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_invitation_shared"("p_invitation" "uuid", "p_channel" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_person_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_person_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_person_name"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalize_text"("p_text" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_text"("p_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_text"("p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_text"("p_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_invitation_event"("p_code" "text", "p_event" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."record_invitation_event"("p_code" "text", "p_event" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_invitation_event"("p_code" "text", "p_event" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_match"("p_candidate" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_match"("p_candidate" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_match"("p_candidate" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."respond_sos"("p_sos" "uuid", "p_response" "text", "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."respond_sos"("p_sos" "uuid", "p_response" "text", "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."respond_sos"("p_sos" "uuid", "p_response" "text", "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_sos"("p_lat" double precision, "p_lon" double precision, "p_message" "text", "p_scope" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_sos"("p_lat" double precision, "p_lon" double precision, "p_message" "text", "p_scope" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_sos"("p_lat" double precision, "p_lon" double precision, "p_message" "text", "p_scope" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."upcoming_birthdays"("days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."upcoming_birthdays"("days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upcoming_birthdays"("days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_normalized_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_normalized_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_normalized_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_person_data"("p_data" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_person_data"("p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_person_data"("p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_person_data"("p_data" "jsonb") TO "service_role";



GRANT ALL ON TABLE "auth"."audit_log_entries" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."audit_log_entries" TO "postgres";
GRANT SELECT ON TABLE "auth"."audit_log_entries" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "auth"."custom_oauth_providers" TO "postgres";
GRANT ALL ON TABLE "auth"."custom_oauth_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."flow_state" TO "postgres";
GRANT SELECT ON TABLE "auth"."flow_state" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."flow_state" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."identities" TO "postgres";
GRANT SELECT ON TABLE "auth"."identities" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."identities" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."instances" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."instances" TO "postgres";
GRANT SELECT ON TABLE "auth"."instances" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_amr_claims" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_amr_claims" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_amr_claims" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_challenges" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_challenges" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_challenges" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_factors" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_factors" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_factors" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_client_states" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_client_states" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_clients" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_clients" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_consents" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_consents" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."one_time_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."one_time_tokens" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."one_time_tokens" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."refresh_tokens" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."refresh_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."refresh_tokens" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "dashboard_user";
GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "postgres";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_relay_states" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_relay_states" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_relay_states" TO "dashboard_user";



GRANT SELECT ON TABLE "auth"."schema_migrations" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sessions" TO "postgres";
GRANT SELECT ON TABLE "auth"."sessions" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sessions" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_domains" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_domains" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_domains" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_providers" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."users" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."users" TO "postgres";
GRANT SELECT ON TABLE "auth"."users" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "auth"."webauthn_challenges" TO "postgres";
GRANT ALL ON TABLE "auth"."webauthn_challenges" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."webauthn_credentials" TO "postgres";
GRANT ALL ON TABLE "auth"."webauthn_credentials" TO "dashboard_user";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."badges" TO "anon";
GRANT ALL ON TABLE "public"."badges" TO "authenticated";
GRANT ALL ON TABLE "public"."badges" TO "service_role";



GRANT ALL ON TABLE "public"."broadcast_recipients" TO "anon";
GRANT ALL ON TABLE "public"."broadcast_recipients" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcast_recipients" TO "service_role";



GRANT ALL ON TABLE "public"."broadcasts" TO "anon";
GRANT ALL ON TABLE "public"."broadcasts" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcasts" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."chat_room_members" TO "anon";
GRANT ALL ON TABLE "public"."chat_room_members" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_room_members" TO "service_role";



GRANT ALL ON TABLE "public"."chat_rooms" TO "anon";
GRANT ALL ON TABLE "public"."chat_rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_rooms" TO "service_role";



GRANT ALL ON TABLE "public"."claim_requests" TO "anon";
GRANT ALL ON TABLE "public"."claim_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."claim_requests" TO "service_role";



GRANT ALL ON TABLE "public"."consents" TO "anon";
GRANT ALL ON TABLE "public"."consents" TO "authenticated";
GRANT ALL ON TABLE "public"."consents" TO "service_role";



GRANT ALL ON TABLE "public"."deletion_requests" TO "anon";
GRANT ALL ON TABLE "public"."deletion_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."deletion_requests" TO "service_role";



GRANT ALL ON TABLE "public"."family_events" TO "anon";
GRANT ALL ON TABLE "public"."family_events" TO "authenticated";
GRANT ALL ON TABLE "public"."family_events" TO "service_role";



GRANT ALL ON TABLE "public"."family_messages" TO "anon";
GRANT ALL ON TABLE "public"."family_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."family_messages" TO "service_role";



GRANT ALL ON TABLE "public"."family_space_events" TO "anon";
GRANT ALL ON TABLE "public"."family_space_events" TO "authenticated";
GRANT ALL ON TABLE "public"."family_space_events" TO "service_role";



GRANT ALL ON TABLE "public"."family_spaces" TO "anon";
GRANT ALL ON TABLE "public"."family_spaces" TO "authenticated";
GRANT ALL ON TABLE "public"."family_spaces" TO "service_role";



GRANT ALL ON TABLE "public"."invitation_events" TO "anon";
GRANT ALL ON TABLE "public"."invitation_events" TO "authenticated";
GRANT ALL ON TABLE "public"."invitation_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."invitation_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."invitation_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."invitation_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."match_candidates" TO "anon";
GRANT ALL ON TABLE "public"."match_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."match_candidates" TO "service_role";



GRANT ALL ON TABLE "public"."matching_config" TO "service_role";



GRANT ALL ON TABLE "public"."merge_history" TO "anon";
GRANT ALL ON TABLE "public"."merge_history" TO "authenticated";
GRANT ALL ON TABLE "public"."merge_history" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."person_claims" TO "anon";
GRANT ALL ON TABLE "public"."person_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."person_claims" TO "service_role";



GRANT ALL ON TABLE "public"."person_locations" TO "anon";
GRANT ALL ON TABLE "public"."person_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."person_locations" TO "service_role";



GRANT ALL ON TABLE "public"."persons" TO "anon";
GRANT ALL ON TABLE "public"."persons" TO "authenticated";
GRANT ALL ON TABLE "public"."persons" TO "service_role";



GRANT ALL ON TABLE "public"."photo_tags" TO "anon";
GRANT ALL ON TABLE "public"."photo_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."photo_tags" TO "service_role";



GRANT ALL ON TABLE "public"."photos" TO "anon";
GRANT ALL ON TABLE "public"."photos" TO "authenticated";
GRANT ALL ON TABLE "public"."photos" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."relaciones_rotas_backup" TO "anon";
GRANT ALL ON TABLE "public"."relaciones_rotas_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."relaciones_rotas_backup" TO "service_role";



GRANT ALL ON TABLE "public"."relationships" TO "anon";
GRANT ALL ON TABLE "public"."relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."relationships" TO "service_role";



GRANT ALL ON TABLE "public"."relationships_legacy" TO "anon";
GRANT ALL ON TABLE "public"."relationships_legacy" TO "authenticated";
GRANT ALL ON TABLE "public"."relationships_legacy" TO "service_role";



GRANT ALL ON TABLE "public"."shared_trees" TO "anon";
GRANT ALL ON TABLE "public"."shared_trees" TO "authenticated";
GRANT ALL ON TABLE "public"."shared_trees" TO "service_role";



GRANT ALL ON TABLE "public"."sos_alerts" TO "anon";
GRANT ALL ON TABLE "public"."sos_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."sos_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."sos_responses" TO "anon";
GRANT ALL ON TABLE "public"."sos_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."sos_responses" TO "service_role";



GRANT ALL ON TABLE "public"."space_memberships" TO "anon";
GRANT ALL ON TABLE "public"."space_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."space_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."space_user_roles" TO "anon";
GRANT ALL ON TABLE "public"."space_user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."space_user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."system_events" TO "anon";
GRANT ALL ON TABLE "public"."system_events" TO "authenticated";
GRANT ALL ON TABLE "public"."system_events" TO "service_role";



GRANT ALL ON TABLE "public"."user_badges" TO "anon";
GRANT ALL ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







