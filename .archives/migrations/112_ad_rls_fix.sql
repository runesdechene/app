-- ============================================
-- MIGRATION 112 : Fix RLS pour ad_screens et ad_tips
-- ============================================
-- Le Hub est connecte en tant qu'authenticated (pas service role).
-- Il faut permettre INSERT/UPDATE/DELETE pour authenticated.
-- ============================================

-- ad_screens
CREATE POLICY "Authenticated can insert ad_screens" ON ad_screens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update ad_screens" ON ad_screens FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete ad_screens" ON ad_screens FOR DELETE TO authenticated USING (true);

-- ad_tips
CREATE POLICY "Authenticated can insert ad_tips" ON ad_tips FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update ad_tips" ON ad_tips FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete ad_tips" ON ad_tips FOR DELETE TO authenticated USING (true);
