-- ============================================
-- MIGRATION : NOUVEAU SYSTEME STATUTS + TAGS
-- ============================================
-- Statuts : pending, approved, archived (remplace pending/approved_great/approved_average/rejected)
-- Tags : systeme libre many-to-many pour classer les photos

-- ============================================
-- 1. MIGRATION DES STATUTS
-- ============================================

-- Supprimer l'ancien CHECK d'abord (avant de modifier les valeurs)
ALTER TABLE hub_photo_submissions DROP CONSTRAINT IF EXISTS hub_photo_submissions_status_check;

-- Convertir les anciens statuts vers les nouveaux
UPDATE hub_photo_submissions SET status = 'approved' WHERE status IN ('approved_great', 'approved_average');
UPDATE hub_photo_submissions SET status = 'archived' WHERE status = 'rejected';

-- Creer le nouveau CHECK
ALTER TABLE hub_photo_submissions ADD CONSTRAINT hub_photo_submissions_status_check 
  CHECK (status IN ('pending', 'approved', 'archived'));

-- Supprimer la colonne rejection_reason (plus utile avec le nouveau systeme)
ALTER TABLE hub_photo_submissions DROP COLUMN IF EXISTS rejection_reason;

-- ============================================
-- 2. TABLES TAGS
-- ============================================

-- Table des tags disponibles
CREATE TABLE IF NOT EXISTS hub_photo_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table de liaison many-to-many
CREATE TABLE IF NOT EXISTS hub_photo_submission_tags (
  submission_id UUID NOT NULL REFERENCES hub_photo_submissions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES hub_photo_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (submission_id, tag_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_photo_tags_name ON hub_photo_tags(name);
CREATE INDEX IF NOT EXISTS idx_photo_submission_tags_sub ON hub_photo_submission_tags(submission_id);
CREATE INDEX IF NOT EXISTS idx_photo_submission_tags_tag ON hub_photo_submission_tags(tag_id);

-- ============================================
-- 3. RLS POLICIES
-- ============================================

ALTER TABLE hub_photo_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_photo_submission_tags ENABLE ROW LEVEL SECURITY;

-- Tags visibles par tous (necessaire pour l'API publique Shopify)
CREATE POLICY "Tags are publicly readable" ON hub_photo_tags
  FOR SELECT USING (true);

-- Seuls les admins/moderateurs peuvent creer/supprimer des tags
CREATE POLICY "Moderators can manage tags" ON hub_photo_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::text 
      AND role IN ('admin', 'moderator')
    )
  );

-- Liaison tags-photos visible par tous (pour l'API publique)
CREATE POLICY "Tag assignments are publicly readable" ON hub_photo_submission_tags
  FOR SELECT USING (true);

-- Seuls les admins/moderateurs peuvent assigner des tags
CREATE POLICY "Moderators can manage tag assignments" ON hub_photo_submission_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::text 
      AND role IN ('admin', 'moderator')
    )
  );

-- ============================================
-- 4. FONCTIONS RPC - GESTION DES TAGS
-- ============================================

-- Creer un tag
CREATE OR REPLACE FUNCTION public.create_photo_tag(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO hub_photo_tags (name)
  VALUES (lower(trim(p_name)))
  ON CONFLICT (name) DO UPDATE SET name = hub_photo_tags.name
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Supprimer un tag
CREATE OR REPLACE FUNCTION public.delete_photo_tag(p_tag_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM hub_photo_tags WHERE id = p_tag_id;
END;
$$;

-- Lister tous les tags
CREATE OR REPLACE FUNCTION public.get_photo_tags()
RETURNS SETOF hub_photo_tags
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT * FROM hub_photo_tags ORDER BY name;
END;
$$;

-- Assigner un tag a une photo
CREATE OR REPLACE FUNCTION public.add_tag_to_submission(p_submission_id UUID, p_tag_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO hub_photo_submission_tags (submission_id, tag_id)
  VALUES (p_submission_id, p_tag_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Retirer un tag d'une photo
CREATE OR REPLACE FUNCTION public.remove_tag_from_submission(p_submission_id UUID, p_tag_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM hub_photo_submission_tags 
  WHERE submission_id = p_submission_id AND tag_id = p_tag_id;
END;
$$;

-- Recuperer les tags d'une photo
CREATE OR REPLACE FUNCTION public.get_submission_tags(p_submission_id UUID)
RETURNS SETOF hub_photo_tags
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY 
    SELECT t.* FROM hub_photo_tags t
    INNER JOIN hub_photo_submission_tags st ON st.tag_id = t.id
    WHERE st.submission_id = p_submission_id
    ORDER BY t.name;
END;
$$;

-- ============================================
-- 5. API PUBLIQUE - PHOTOS PAR TAG (pour Shopify)
-- ============================================

-- Recuperer les photos approuvees avec un tag specifique
-- Retourne les photos + leurs images + infos soumetteur
CREATE OR REPLACE FUNCTION public.get_approved_photos_by_tag(p_tag_name TEXT)
RETURNS TABLE (
  id UUID,
  submitter_name TEXT,
  submitter_instagram TEXT,
  product_size TEXT,
  model_height_cm NUMERIC,
  message TEXT,
  created_at TIMESTAMPTZ,
  image_url TEXT,
  image_sort_order INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT 
      ps.id,
      ps.submitter_name,
      ps.submitter_instagram,
      ps.product_size,
      ps.model_height_cm,
      ps.message,
      ps.created_at,
      si.image_url,
      si.sort_order AS image_sort_order
    FROM hub_photo_submissions ps
    INNER JOIN hub_photo_submission_tags pst ON pst.submission_id = ps.id
    INNER JOIN hub_photo_tags pt ON pt.id = pst.tag_id
    LEFT JOIN hub_submission_images si ON si.submission_id = ps.id
    WHERE ps.status = 'approved'
      AND lower(trim(pt.name)) = lower(trim(p_tag_name))
    ORDER BY ps.created_at DESC, si.sort_order;
END;
$$;

-- ============================================
-- 6. MISE A JOUR moderate_submission
-- ============================================

-- Mettre a jour avec les nouveaux statuts
DROP FUNCTION IF EXISTS public.moderate_submission(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.moderate_submission(
  p_submission_id UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE hub_photo_submissions
  SET status = p_status,
      moderated_at = NOW()
  WHERE id = p_submission_id;
END;
$$;

-- ============================================
-- 7. MISE A JOUR get_photo_submissions (avec tags)
-- ============================================

DROP FUNCTION IF EXISTS public.get_photo_submissions(TEXT);
CREATE OR REPLACE FUNCTION public.get_photo_submissions(p_status TEXT DEFAULT NULL)
RETURNS SETOF hub_photo_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status IS NULL THEN
    RETURN QUERY SELECT * FROM hub_photo_submissions ORDER BY created_at DESC LIMIT 100;
  ELSE
    RETURN QUERY SELECT * FROM hub_photo_submissions WHERE status = p_status ORDER BY created_at DESC LIMIT 100;
  END IF;
END;
$$;

-- Recuperer les tags de plusieurs soumissions en batch
CREATE OR REPLACE FUNCTION public.get_submission_tags_batch(p_submission_ids UUID[])
RETURNS TABLE (
  submission_id UUID,
  tag_id UUID,
  tag_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT pst.submission_id, t.id AS tag_id, t.name AS tag_name
    FROM hub_photo_submission_tags pst
    INNER JOIN hub_photo_tags t ON t.id = pst.tag_id
    WHERE pst.submission_id = ANY(p_submission_ids)
    ORDER BY t.name;
END;
$$;

-- Mettre a jour la policy pour les photos approuvees
DROP POLICY IF EXISTS "Approved submissions are public" ON hub_photo_submissions;
CREATE POLICY "Approved submissions are public" ON hub_photo_submissions
  FOR SELECT USING (status = 'approved');

-- ============================================
-- 8. PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION public.create_photo_tag TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_photo_tag TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_photo_tags TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_tag_to_submission TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_tag_from_submission TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_submission_tags TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_submission_tags_batch TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_approved_photos_by_tag TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_submission TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_photo_submissions TO authenticated;
