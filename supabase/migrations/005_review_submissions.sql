-- ============================================
-- 005 : Soumissions d'avis texte
-- ============================================

CREATE TABLE IF NOT EXISTS hub_review_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lien vers le compte (cree automatiquement si besoin)
  user_id VARCHAR(255) REFERENCES users(id),

  -- Infos soumises via le formulaire public
  submitter_name TEXT NOT NULL,
  submitter_email TEXT NOT NULL,
  location_name TEXT NOT NULL,
  location_zip TEXT NOT NULL,
  review_text TEXT NOT NULL CHECK (char_length(review_text) <= 2000),
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  purchase_status TEXT DEFAULT 'owner' CHECK (purchase_status IN ('owner', 'planning', 'no')),

  -- Consentements
  consent_account BOOLEAN NOT NULL DEFAULT FALSE,
  consent_republish BOOLEAN NOT NULL DEFAULT FALSE,

  -- Image optionnelle
  image_url TEXT,
  storage_path TEXT,

  -- Moderation
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'archived')),
  moderated_by VARCHAR(255) REFERENCES users(id),
  moderated_at TIMESTAMPTZ,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_review_submissions_status ON hub_review_submissions(status);
CREATE INDEX IF NOT EXISTS idx_review_submissions_user ON hub_review_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_review_submissions_rating ON hub_review_submissions(rating);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE hub_review_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert reviews" ON hub_review_submissions;
CREATE POLICY "Public can insert reviews" ON hub_review_submissions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Moderators can view all reviews" ON hub_review_submissions;
CREATE POLICY "Moderators can view all reviews" ON hub_review_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::text
      AND role IN ('admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS "Moderators can update reviews" ON hub_review_submissions;
CREATE POLICY "Moderators can update reviews" ON hub_review_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::text
      AND role IN ('admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS "Approved reviews are public" ON hub_review_submissions;
CREATE POLICY "Approved reviews are public" ON hub_review_submissions
  FOR SELECT USING (status = 'approved');

-- ============================================
-- FONCTIONS SECURITY DEFINER
-- ============================================

-- Creer une soumission d'avis
CREATE OR REPLACE FUNCTION public.create_review_submission(
  p_user_id VARCHAR(255),
  p_submitter_name TEXT,
  p_submitter_email TEXT,
  p_location_name TEXT,
  p_location_zip TEXT,
  p_review_text TEXT,
  p_rating INT,
  p_purchase_status TEXT DEFAULT 'owner',
  p_consent_account BOOLEAN DEFAULT FALSE,
  p_consent_republish BOOLEAN DEFAULT FALSE,
  p_image_url TEXT DEFAULT NULL,
  p_storage_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO hub_review_submissions (
    user_id, submitter_name, submitter_email,
    location_name, location_zip, review_text, rating,
    purchase_status, consent_account, consent_republish,
    image_url, storage_path, status
  ) VALUES (
    p_user_id, p_submitter_name, p_submitter_email,
    p_location_name, p_location_zip, p_review_text, p_rating,
    p_purchase_status, p_consent_account, p_consent_republish,
    p_image_url, p_storage_path, 'pending'
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Lister les avis (pour le HUB admin)
CREATE OR REPLACE FUNCTION public.get_review_submissions(p_status TEXT DEFAULT NULL)
RETURNS SETOF hub_review_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status IS NULL THEN
    RETURN QUERY SELECT * FROM hub_review_submissions ORDER BY created_at DESC LIMIT 50;
  ELSE
    RETURN QUERY SELECT * FROM hub_review_submissions WHERE status = p_status ORDER BY created_at DESC LIMIT 50;
  END IF;
END;
$$;

-- Moderer un avis
CREATE OR REPLACE FUNCTION public.moderate_review(
  p_review_id UUID,
  p_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE hub_review_submissions
  SET status = p_status,
      moderated_at = NOW(),
      rejection_reason = p_rejection_reason
  WHERE id = p_review_id;
END;
$$;

-- Supprimer definitivement un avis
CREATE OR REPLACE FUNCTION public.delete_review_submission(p_review_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM hub_review_submissions WHERE id = p_review_id;
END;
$$;

-- Supprimer definitivement une soumission photo (images + soumission)
CREATE OR REPLACE FUNCTION public.delete_photo_submission(p_submission_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM hub_submission_images WHERE submission_id = p_submission_id;
  DELETE FROM hub_photo_submissions WHERE id = p_submission_id;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.create_review_submission TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_review_submissions TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_review TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_review_submission TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_photo_submission TO authenticated;
