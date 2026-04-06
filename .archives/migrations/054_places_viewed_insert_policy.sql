-- ============================================
-- 054 : Policy INSERT sur places_viewed
-- ============================================
-- Permet aux utilisateurs authentifiés d'enregistrer une vue.

CREATE POLICY "Auth users can insert views"
  ON places_viewed FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
