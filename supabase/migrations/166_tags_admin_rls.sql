-- ============================================
-- MIGRATION 166 : RLS admin sur la table tags
-- ============================================
-- Les admins doivent pouvoir INSERT/UPDATE/DELETE sur tags

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les authentifiés
CREATE POLICY "tags_select_authenticated" ON tags
  FOR SELECT TO authenticated USING (true);

-- Écriture pour les admins uniquement
CREATE POLICY "tags_admin_insert" ON tags
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin'));

CREATE POLICY "tags_admin_update" ON tags
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin'));

CREATE POLICY "tags_admin_delete" ON tags
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin'));
