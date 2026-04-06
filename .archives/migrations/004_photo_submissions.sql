-- ============================================
-- TABLE SOUMISSIONS PHOTOS COMMUNAUTAIRES
-- ============================================
-- Remplace hub_community_photos par un modele plus riche
-- qui stocke les infos du formulaire public d'upload.

-- Ajouter colonnes au profil utilisateur
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_zip TEXT;

-- Table des soumissions photos
CREATE TABLE IF NOT EXISTS hub_photo_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Lien vers le compte (cree automatiquement si besoin)
  user_id VARCHAR(255) REFERENCES users(id),
  
  -- Infos soumises via le formulaire public
  submitter_name TEXT NOT NULL,
  submitter_email TEXT NOT NULL,
  submitter_instagram TEXT,
  submitter_role TEXT DEFAULT 'client' CHECK (submitter_role IN ('client', 'ambassadeur', 'partenaire')),
  location_name TEXT,
  location_zip TEXT,
  message TEXT CHECK (char_length(message) <= 500),
  
  -- Consentements
  consent_brand_usage BOOLEAN NOT NULL DEFAULT FALSE,
  consent_account_creation BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Moderation
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved_great', 'approved_average', 'rejected')),
  moderated_by VARCHAR(255) REFERENCES users(id),
  moderated_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des images liees a une soumission (multi-photos)
CREATE TABLE IF NOT EXISTS hub_submission_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES hub_photo_submissions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  image_url TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_photo_submissions_user ON hub_photo_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_submissions_status ON hub_photo_submissions(status);
CREATE INDEX IF NOT EXISTS idx_photo_submissions_email ON hub_photo_submissions(submitter_email);
CREATE INDEX IF NOT EXISTS idx_photo_submissions_created ON hub_photo_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submission_images_sub ON hub_submission_images(submission_id);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE hub_photo_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_submission_images ENABLE ROW LEVEL SECURITY;

-- Insertion publique (anon) pour le formulaire
CREATE POLICY "Anyone can submit photos" ON hub_photo_submissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can add submission images" ON hub_submission_images
  FOR INSERT WITH CHECK (true);

-- Les utilisateurs voient leurs propres soumissions
CREATE POLICY "Users can view own submissions" ON hub_photo_submissions
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view own submission images" ON hub_submission_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM hub_photo_submissions
      WHERE id = hub_submission_images.submission_id
      AND user_id = auth.uid()::text
    )
  );

-- Admins/moderateurs voient et moderent tout
CREATE POLICY "Moderators can view all submissions" ON hub_photo_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::text 
      AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Moderators can update submissions" ON hub_photo_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::text 
      AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Moderators can view all submission images" ON hub_submission_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::text 
      AND role IN ('admin', 'moderator')
    )
  );

-- Photos approuvees visibles publiquement
CREATE POLICY "Approved submissions are public" ON hub_photo_submissions
  FOR SELECT USING (status = 'approved');

CREATE POLICY "Approved submission images are public" ON hub_submission_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM hub_photo_submissions
      WHERE id = hub_submission_images.submission_id
      AND status = 'approved'
    )
  );

-- ============================================
-- RLS Policies pour la table USERS
-- (necessaire pour le formulaire public)
-- ============================================

CREATE POLICY "Public can lookup users by email" ON users
  FOR SELECT USING (true);

CREATE POLICY "Public can update user instagram" ON users
  FOR UPDATE USING (true);

-- ============================================
-- FONCTIONS SECURITY DEFINER
-- (bypass RLS pour les operations publiques)
-- ============================================

-- Creer un compte utilisateur depuis le formulaire public
DROP FUNCTION IF EXISTS public.create_user_from_submission(VARCHAR, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.create_user_from_submission(
  p_id VARCHAR(255),
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_instagram TEXT,
  p_location_name TEXT DEFAULT NULL,
  p_location_zip TEXT DEFAULT NULL
)
RETURNS VARCHAR(255)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO users (id, email_address, first_name, last_name, instagram, location_name, location_zip, role, is_active, rank, biography)
  VALUES (p_id, p_email, p_first_name, p_last_name, p_instagram, p_location_name, p_location_zip, 'user', true, 0, '');
  RETURN p_id;
END;
$$;

-- Creer une soumission photo
DROP FUNCTION IF EXISTS public.create_photo_submission(VARCHAR, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT);
CREATE OR REPLACE FUNCTION public.create_photo_submission(
  p_user_id VARCHAR(255),
  p_submitter_name TEXT,
  p_submitter_email TEXT,
  p_submitter_instagram TEXT,
  p_location_name TEXT DEFAULT NULL,
  p_location_zip TEXT DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_consent_brand BOOLEAN DEFAULT FALSE,
  p_consent_account BOOLEAN DEFAULT FALSE,
  p_submitter_role TEXT DEFAULT 'client'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO hub_photo_submissions (
    user_id, submitter_name, submitter_email, submitter_instagram,
    location_name, location_zip,
    message, consent_brand_usage, consent_account_creation, status, submitter_role
  ) VALUES (
    p_user_id, p_submitter_name, p_submitter_email, p_submitter_instagram,
    p_location_name, p_location_zip,
    p_message, p_consent_brand, p_consent_account, 'pending', p_submitter_role
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Ajouter une image a une soumission
CREATE OR REPLACE FUNCTION public.add_submission_image(
  p_submission_id UUID,
  p_storage_path TEXT,
  p_image_url TEXT,
  p_sort_order INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO hub_submission_images (
    submission_id, storage_path, image_url, sort_order
  ) VALUES (
    p_submission_id, p_storage_path, p_image_url, p_sort_order
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Lister les soumissions (pour le HUB admin)
CREATE OR REPLACE FUNCTION public.get_photo_submissions(p_status TEXT DEFAULT NULL)
RETURNS SETOF hub_photo_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status IS NULL THEN
    RETURN QUERY SELECT * FROM hub_photo_submissions ORDER BY created_at DESC LIMIT 50;
  ELSE
    RETURN QUERY SELECT * FROM hub_photo_submissions WHERE status = p_status ORDER BY created_at DESC LIMIT 50;
  END IF;
END;
$$;

-- Lister les images par lot de soumissions
CREATE OR REPLACE FUNCTION public.get_submission_images_batch(p_submission_ids UUID[])
RETURNS SETOF hub_submission_images
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT * FROM hub_submission_images WHERE submission_id = ANY(p_submission_ids) ORDER BY sort_order;
END;
$$;

-- Moderer une soumission
CREATE OR REPLACE FUNCTION public.moderate_submission(
  p_submission_id UUID,
  p_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE hub_photo_submissions
  SET status = p_status,
      moderated_at = NOW(),
      rejection_reason = p_rejection_reason
  WHERE id = p_submission_id;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.create_user_from_submission TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_photo_submission TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_submission_image TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_photo_submissions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_submission_images_batch TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_submission TO authenticated;

-- ============================================
-- STORAGE : bucket community-photos
-- ============================================

INSERT INTO storage.buckets (id, name, public)
  VALUES ('community-photos', 'community-photos', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload community photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'community-photos');

CREATE POLICY "Public read community photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'community-photos');
