-- story_views: tracks which users have seen each historia (is_story = true event).
-- One row per (story, viewer); used to show "visto por N personas" on each card.

CREATE TABLE IF NOT EXISTS public.story_views (
  story_id        UUID        NOT NULL REFERENCES public.family_events(id) ON DELETE CASCADE,
  viewer_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_user_id)
);

CREATE INDEX IF NOT EXISTS story_views_story_idx ON public.story_views(story_id);

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can record their own view
CREATE POLICY story_views_insert ON public.story_views
  FOR INSERT TO authenticated
  WITH CHECK (viewer_user_id = auth.uid());

-- A viewer can see their own rows; the story creator can see all views on their stories
CREATE POLICY story_views_select ON public.story_views
  FOR SELECT TO authenticated
  USING (
    viewer_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.family_events fe
      WHERE fe.id = story_views.story_id
        AND fe.created_by = auth.uid()
    )
  );
