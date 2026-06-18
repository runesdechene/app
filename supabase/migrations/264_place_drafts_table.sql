-- 264_place_drafts_table.sql
-- WHY : feature "Marque GPS / brouillon de lieu". Jeton de présence privé posé
-- en un tap (GPS + horodatage), transformé plus tard en fiche de lieu avec bonus
-- visite GPS rétroactif. Aucune récompense à la pose (anti-farming par construction).
-- Spec : apps/explore-web/docs/superpowers/specs/2026-06-16-marque-gps-brouillon-design.md

BEGIN;

CREATE TABLE IF NOT EXISTS public.place_drafts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  latitude           real NOT NULL,
  longitude          real NOT NULL,
  accuracy_m         numeric,
  title              text,
  images             jsonb NOT NULL DEFAULT '[]'::jsonb,
  status             text NOT NULL DEFAULT 'open',          -- 'open' | 'published'
  published_place_id text REFERENCES public.places(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  published_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_place_drafts_user_open
  ON public.place_drafts (user_id) WHERE status = 'open';

ALTER TABLE public.place_drafts ENABLE ROW LEVEL SECURITY;

-- Owner-only : un joueur ne voit / ne touche QUE ses propres marques.
CREATE POLICY "drafts_select_own" ON public.place_drafts
  FOR SELECT USING ((auth.uid())::text = user_id);
CREATE POLICY "drafts_insert_own" ON public.place_drafts
  FOR INSERT TO authenticated WITH CHECK ((auth.uid())::text = user_id);
CREATE POLICY "drafts_update_own" ON public.place_drafts
  FOR UPDATE USING ((auth.uid())::text = user_id);
CREATE POLICY "drafts_delete_own" ON public.place_drafts
  FOR DELETE USING ((auth.uid())::text = user_id);

-- Réglages configurables (style app_settings existant : key text, value text).
INSERT INTO public.app_settings (key, value) VALUES
  ('place_draft_dedup_radius_m', '30'),   -- rayon "lieu déjà existant" (cf. 2 chapelles à 40 m)
  ('place_draft_freshness_days', '30')    -- fenêtre du privilège GPS rétroactif
ON CONFLICT (key) DO NOTHING;

COMMIT;
