-- ============================================
-- MIGRATION 013 : Tags — UPDATE policy + Storage bucket
-- ============================================

-- Permettre la mise à jour des tags (icônes, couleurs, etc.)
DROP POLICY IF EXISTS "Authenticated users can update tags" ON tags;
CREATE POLICY "Authenticated users can update tags"
  ON tags
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Bucket pour les icônes PNG des tags
INSERT INTO storage.buckets (id, name, public)
VALUES ('tag-icons', 'tag-icons', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique
DROP POLICY IF EXISTS "Public read tag-icons" ON storage.objects;
CREATE POLICY "Public read tag-icons"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tag-icons');

-- Upload par les utilisateurs authentifiés
DROP POLICY IF EXISTS "Authenticated upload tag-icons" ON storage.objects;
CREATE POLICY "Authenticated upload tag-icons"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'tag-icons');

-- Remplacement (upsert) par les utilisateurs authentifiés
DROP POLICY IF EXISTS "Authenticated update tag-icons" ON storage.objects;
CREATE POLICY "Authenticated update tag-icons"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'tag-icons');

-- Suppression par les utilisateurs authentifiés
DROP POLICY IF EXISTS "Authenticated delete tag-icons" ON storage.objects;
CREATE POLICY "Authenticated delete tag-icons"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'tag-icons');
