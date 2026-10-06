-- Enable RLS on collab_requests and family_connection_requests.
--
-- Root cause: 20260728000000_add_collab_requests.sql and
-- 20260804010000_add_family_connection_requests.sql ran
--   ALTER TABLE ONLY ... FORCE ROW LEVEL SECURITY
-- and created policies, but never ENABLE ROW LEVEL SECURITY. FORCE only
-- applies once RLS is enabled, so in production both tables have had RLS
-- off: the policies below exist but are not evaluated, and anyone holding the
-- anon key can read/modify every row (Supabase advisors: rls_disabled_in_public,
-- policy_exists_rls_disabled).
--
-- No new policies are needed; the existing ones already cover every access path:
--   * Client reads in src/app/tree/page.tsx:
--       family_connection_requests  WHERE target_user_id = me  -> fcr_participants_select
--       collab_requests             WHERE person_id = mine     -> collab_requests_participants_select (owner)
--   * src/app/api/collab/** and src/lib/server/family.ts use the service role (bypasses RLS).
--   * SECURITY DEFINER functions request_family_connection / respond_to_family_request
--     always act on rows where requester_user_id or target_user_id = auth.uid(),
--     which is exactly what the participants policies allow, so they still work
--     with FORCE (owner subject to RLS).
--   * Neither table is ever DELETEd from app code, so the lack of DELETE policies is fine.

ALTER TABLE public.collab_requests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_connection_requests ENABLE ROW LEVEL SECURITY;

-- Defense in depth: anonymous (signed-out) clients have no legitimate access.
REVOKE ALL ON public.collab_requests            FROM anon;
REVOKE ALL ON public.family_connection_requests FROM anon;

-- Not covered here: public.spatial_ref_sys is owned by the PostGIS extension and
-- cannot be altered by the project role. Ignore that advisor finding (or move
-- PostGIS out of `public`).
