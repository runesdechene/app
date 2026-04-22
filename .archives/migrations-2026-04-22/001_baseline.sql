-- ============================================
-- HUB : Gestion des comptes Runes de Chene
-- ============================================
-- Le HUB gere les comptes utilisateurs, les roles,
-- et les photos communautaires.
-- PAS de gestion de commandes (Shopify/IVY gerent ca de leur cote).

-- Ajouter colonnes HUB a la table users existante
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' 
  CHECK (role IN ('user', 'ambassador', 'moderator', 'admin'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Index pour recherche par role
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================
-- TABLE PHOTOS COMMUNAUTAIRES
-- ============================================

CREATE TABLE IF NOT EXISTS hub_community_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) REFERENCES users(id),
  user_email TEXT,
  image_url TEXT NOT NULL,
  caption TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  moderated_by VARCHAR(255) REFERENCES users(id),
  moderated_at TIMESTAMPTZ,
  rejection_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_community_photos_user ON hub_community_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_hub_community_photos_status ON hub_community_photos(status);
CREATE INDEX IF NOT EXISTS idx_hub_community_photos_created ON hub_community_photos(created_at DESC);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE hub_community_photos ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs voient leurs propres photos
CREATE POLICY "Users can view own photos" ON hub_community_photos
  FOR SELECT USING (auth.uid()::text = user_id);

-- Les utilisateurs peuvent inserer leurs propres photos
CREATE POLICY "Users can insert own photos" ON hub_community_photos
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Les admins et moderateurs voient toutes les photos
CREATE POLICY "Moderators can view all photos" ON hub_community_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::text 
      AND role IN ('admin', 'moderator')
    )
  );

-- Les admins et moderateurs peuvent modifier les photos (moderation)
CREATE POLICY "Moderators can update photos" ON hub_community_photos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::text 
      AND role IN ('admin', 'moderator')
    )
  );
-- ============================================
-- NETTOYAGE : Suppression des anciennes tables Shopify/IVY
-- ============================================
-- A executer dans Supabase SQL Editor
-- Ces tables ne sont plus utilisees depuis la simplification du HUB.

-- Supprimer les policies d'abord
DROP POLICY IF EXISTS "Admin full access on hub_transactions" ON hub_transactions;
DROP POLICY IF EXISTS "Admin full access on hub_reward_rules" ON hub_reward_rules;
DROP POLICY IF EXISTS "Admin full access on hub_user_badges" ON hub_user_badges;
DROP POLICY IF EXISTS "Admin full access on hub_promo_codes" ON hub_promo_codes;
DROP POLICY IF EXISTS "Admin full access on hub_transaction_items" ON hub_transaction_items;

-- Supprimer les triggers
DROP TRIGGER IF EXISTS trigger_hub_transactions_updated_at ON hub_transactions;

-- Supprimer les fonctions
DROP FUNCTION IF EXISTS update_hub_transactions_updated_at();
DROP FUNCTION IF EXISTS generate_promo_code();
DROP FUNCTION IF EXISTS increment_user_purchases(VARCHAR);
DROP FUNCTION IF EXISTS find_badges_for_illustrations(TEXT[]);
DROP FUNCTION IF EXISTS assign_transaction_badges(VARCHAR, UUID, TEXT[]);
DROP FUNCTION IF EXISTS get_user_badges(VARCHAR);
DROP FUNCTION IF EXISTS get_user_order_history(VARCHAR);

-- Supprimer les tables (ordre important pour les FK)
DROP TABLE IF EXISTS hub_transaction_items CASCADE;
DROP TABLE IF EXISTS hub_promo_codes CASCADE;
DROP TABLE IF EXISTS hub_user_badges CASCADE;
DROP TABLE IF EXISTS hub_badge_mappings CASCADE;
DROP TABLE IF EXISTS hub_reward_rules CASCADE;
DROP TABLE IF EXISTS hub_transactions CASCADE;

-- Supprimer les colonnes Shopify/IVY de la table users
ALTER TABLE users DROP COLUMN IF EXISTS shopify_customer_id;
ALTER TABLE users DROP COLUMN IF EXISTS ivy_customer_id;
ALTER TABLE users DROP COLUMN IF EXISTS total_purchases;
ALTER TABLE users DROP COLUMN IF EXISTS total_spent;
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
-- ============================================
-- EXPLORE : Tables, RLS, Storage & RPC
-- Migration depuis explore-api (NestJS/DigitalOcean) vers Supabase
-- ============================================

-- ============================================
-- 1. TABLES
-- ============================================

-- La table "users" existe deja (001 + 002 + 003 + 004).
-- On ajoute les colonnes manquantes pour explore.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS rank VARCHAR(255) DEFAULT 'guest';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS website_url VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_access TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_device_os VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_device_version VARCHAR(255);

-- ============================================
-- IMAGE MEDIA
-- ============================================

CREATE TABLE IF NOT EXISTS image_media (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variants JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_image_media_user_id ON image_media(user_id);

-- Lien profil user -> image_media
-- (on ne cree pas de FK car profile_image_id peut pointer vers une image supprimee)

-- ============================================
-- PLACE TYPES
-- ============================================

CREATE TABLE IF NOT EXISTS place_types (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parent_id VARCHAR(255) REFERENCES place_types(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  form_description VARCHAR(255) NOT NULL DEFAULT '',
  long_description VARCHAR(255) NOT NULL DEFAULT '',
  images JSONB NOT NULL DEFAULT '{}',
  color VARCHAR(255) NOT NULL DEFAULT '#000000',
  background VARCHAR(255) NOT NULL DEFAULT '#FFFFFF',
  border VARCHAR(255) NOT NULL DEFAULT '#000000',
  faded_color VARCHAR(255) NOT NULL DEFAULT '#CCCCCC',
  "order" INT NOT NULL DEFAULT 0,
  hidden BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_place_types_parent_id ON place_types(parent_id);

-- ============================================
-- PLACES
-- ============================================

CREATE TABLE IF NOT EXISTS places (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  author_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_type_id VARCHAR(255) NOT NULL REFERENCES place_types(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  address VARCHAR(255) NOT NULL DEFAULT '',
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  private BOOLEAN NOT NULL DEFAULT FALSE,
  masked BOOLEAN NOT NULL DEFAULT FALSE,
  images JSONB NOT NULL DEFAULT '[]',
  accessibility VARCHAR(255),
  sensible BOOLEAN NOT NULL DEFAULT FALSE,
  begin_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_places_author_id ON places(author_id);
CREATE INDEX IF NOT EXISTS idx_places_place_type_id ON places(place_type_id);
CREATE INDEX IF NOT EXISTS idx_places_created_at ON places(created_at DESC);

-- ============================================
-- PLACES ACTIONS (viewed, liked, explored, bookmarked)
-- ============================================

CREATE TABLE IF NOT EXISTS places_viewed (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_places_viewed_user ON places_viewed(user_id);
CREATE INDEX IF NOT EXISTS idx_places_viewed_place ON places_viewed(place_id);

CREATE TABLE IF NOT EXISTS places_liked (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  UNIQUE(user_id, place_id)
);
CREATE INDEX IF NOT EXISTS idx_places_liked_user ON places_liked(user_id);
CREATE INDEX IF NOT EXISTS idx_places_liked_place ON places_liked(place_id);

CREATE TABLE IF NOT EXISTS places_explored (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  UNIQUE(user_id, place_id)
);
CREATE INDEX IF NOT EXISTS idx_places_explored_user ON places_explored(user_id);
CREATE INDEX IF NOT EXISTS idx_places_explored_place ON places_explored(place_id);

CREATE TABLE IF NOT EXISTS places_bookmarked (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  UNIQUE(user_id, place_id)
);
CREATE INDEX IF NOT EXISTS idx_places_bookmarked_user ON places_bookmarked(user_id);
CREATE INDEX IF NOT EXISTS idx_places_bookmarked_place ON places_bookmarked(place_id);

-- ============================================
-- REVIEWS
-- ============================================

CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT '',
  geocache BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_place ON reviews(place_id);

-- Table de jointure reviews <-> image_media (M2M)
CREATE TABLE IF NOT EXISTS reviews_images (
  review_id VARCHAR(255) NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  image_media_id VARCHAR(255) NOT NULL REFERENCES image_media(id) ON DELETE CASCADE,
  PRIMARY KEY (review_id, image_media_id)
);

-- ============================================
-- MEMBER CODES (systeme guest/member)
-- ============================================

CREATE TABLE IF NOT EXISTS member_codes (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id VARCHAR(255) UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  code VARCHAR(255) NOT NULL UNIQUE,
  is_consumed BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_member_codes_code ON member_codes(code);

-- ============================================
-- 2. ROW LEVEL SECURITY
-- ============================================

-- PLACES : tout le monde peut lire, seul l'auteur peut modifier
ALTER TABLE places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view places"
  ON places FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create places"
  ON places FOR INSERT
  WITH CHECK (auth.uid()::text = author_id);

CREATE POLICY "Authors can update their places"
  ON places FOR UPDATE
  USING (auth.uid()::text = author_id);

CREATE POLICY "Authors can delete their places"
  ON places FOR DELETE
  USING (auth.uid()::text = author_id);

-- PLACE TYPES : lecture publique, pas de modification client
ALTER TABLE place_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view place types"
  ON place_types FOR SELECT
  USING (true);

-- IMAGE MEDIA : lecture publique, creation par l'owner
ALTER TABLE image_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view image media"
  ON image_media FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own image media"
  ON image_media FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own image media"
  ON image_media FOR DELETE
  USING (auth.uid()::text = user_id);

-- REVIEWS : lecture publique, CRUD par l'auteur
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own reviews"
  ON reviews FOR DELETE
  USING (auth.uid()::text = user_id);

-- REVIEWS_IMAGES : lecture publique, insertion par l'auteur de la review
ALTER TABLE reviews_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view review images"
  ON reviews_images FOR SELECT
  USING (true);

CREATE POLICY "Review authors can manage review images"
  ON reviews_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.id = review_id
      AND reviews.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Review authors can delete review images"
  ON reviews_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.id = review_id
      AND reviews.user_id = auth.uid()::text
    )
  );

-- PLACES ACTIONS : chaque user gere ses propres actions
-- VIEWED
ALTER TABLE places_viewed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view place views"
  ON places_viewed FOR SELECT USING (true);

CREATE POLICY "Users can create their own views"
  ON places_viewed FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- LIKED
ALTER TABLE places_liked ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view place likes"
  ON places_liked FOR SELECT USING (true);

CREATE POLICY "Users can like places"
  ON places_liked FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can unlike places"
  ON places_liked FOR DELETE
  USING (auth.uid()::text = user_id);

-- EXPLORED
ALTER TABLE places_explored ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view explored places"
  ON places_explored FOR SELECT USING (true);

CREATE POLICY "Users can mark places as explored"
  ON places_explored FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can unmark explored places"
  ON places_explored FOR DELETE
  USING (auth.uid()::text = user_id);

-- BOOKMARKED
ALTER TABLE places_bookmarked ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bookmarked places"
  ON places_bookmarked FOR SELECT USING (true);

CREATE POLICY "Users can bookmark places"
  ON places_bookmarked FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can remove bookmarks"
  ON places_bookmarked FOR DELETE
  USING (auth.uid()::text = user_id);

-- MEMBER CODES : lecture par admin uniquement
ALTER TABLE member_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage member codes"
  ON member_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::text
      AND role = 'admin'
    )
  );

-- ============================================
-- 3. STORAGE BUCKET
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('place-images', 'place-images', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique
CREATE POLICY "Public read access on place-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'place-images');

-- Upload par les utilisateurs authentifies
CREATE POLICY "Authenticated users can upload place images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'place-images'
    AND auth.role() = 'authenticated'
  );

-- Suppression par l'owner (le path commence par user_id/)
CREATE POLICY "Users can delete their own place images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'place-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- 4. FONCTIONS RPC
-- ============================================

-- -----------------------------------------------
-- 4.1 get_map_places
-- Retourne les places pour la carte
-- Types: 'all' (viewport), 'latest', 'popular'
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_map_places(
  p_type TEXT DEFAULT 'all',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_latitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_longitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title,
          'color', pt.color,
          'background', pt.background,
          'border', pt.border,
          'fadedColor', pt.faded_color,
          'images', pt.images,
          'order', pt."order",
          'hidden', pt.hidden
        ),
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      WHERE pt.hidden IS FALSE
      GROUP BY p.id, pt.id
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'latest' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title,
          'color', pt.color,
          'background', pt.background,
          'border', pt.border,
          'fadedColor', pt.faded_color,
          'images', pt.images,
          'order', pt."order",
          'hidden', pt.hidden
        ),
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      WHERE pt.hidden IS FALSE
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;

  ELSE
    -- type = 'all' avec viewport optionnel
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title,
          'color', pt.color,
          'background', pt.background,
          'border', pt.border,
          'fadedColor', pt.faded_color,
          'images', pt.images,
          'order', pt."order",
          'hidden', pt.hidden
        ),
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      WHERE pt.hidden IS FALSE
        AND (
          p_latitude IS NULL
          OR (
            p.latitude >= (p_latitude - p_latitude_delta)
            AND p.latitude <= (p_latitude + p_latitude_delta)
            AND p.longitude >= (p_longitude - p_longitude_delta)
            AND p.longitude <= (p_longitude + p_longitude_delta)
          )
        )
      ORDER BY p.created_at
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- -----------------------------------------------
-- 4.2 get_map_banners
-- Places de type "hidden" (bannieres/evenements) dans le viewport
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_map_banners(
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_latitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_longitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', json_build_object(
        'id', pt.id,
        'title', pt.title,
        'color', pt.color,
        'background', pt.background,
        'border', pt.border,
        'fadedColor', pt.faded_color,
        'images', pt.images,
        'order', pt."order",
        'hidden', pt.hidden
      ),
      'location', json_build_object(
        'latitude', p.latitude,
        'longitude', p.longitude
      ),
      'requester', CASE
        WHEN p_user_id IS NOT NULL THEN json_build_object(
          'viewed', EXISTS(
            SELECT 1 FROM places_viewed pv
            WHERE pv.place_id = p.id AND pv.user_id = p_user_id
          )
        )
        ELSE NULL
      END
    ) AS row_data
    FROM places p
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE pt.hidden IS TRUE
      AND (
        p_latitude IS NULL
        OR (
          p.latitude >= (p_latitude - p_latitude_delta)
          AND p.latitude <= (p_latitude + p_latitude_delta)
          AND p.longitude >= (p_longitude - p_longitude_delta)
          AND p.longitude <= (p_longitude + p_longitude_delta)
        )
      )
    ORDER BY p.created_at
  ) sub;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- -----------------------------------------------
-- 4.3 get_regular_feed
-- Feed pagine : latest, closest (Haversine), popular
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_regular_feed(
  p_type TEXT DEFAULT 'latest',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_count INT DEFAULT 10,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INT;
  v_total INT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_count;

  SELECT COUNT(*) INTO v_total FROM places;

  IF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE
          WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
          THEN p.images->0->>'url'
          ELSE NULL
        END,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title,
          'color', pt.color,
          'background', pt.background,
          'border', pt.border,
          'fadedColor', pt.faded_color,
          'images', pt.images,
          'order', pt."order",
          'hidden', pt.hidden
        ),
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'avg_score', AVG(r.score),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_user_id),
            'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_user_id),
            'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_user_id)
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE pt.hidden IS FALSE
      GROUP BY p.id, pt.id
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSIF p_type = 'closest' AND p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE
          WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
          THEN p.images->0->>'url'
          ELSE NULL
        END,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title,
          'color', pt.color,
          'background', pt.background,
          'border', pt.border,
          'fadedColor', pt.faded_color,
          'images', pt.images,
          'order', pt."order",
          'hidden', pt.hidden
        ),
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'avg_score', AVG(r.score),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_user_id),
            'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_user_id),
            'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_user_id)
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE pt.hidden IS FALSE
      GROUP BY p.id, pt.id
      ORDER BY (
        6371 * acos(
          cos(radians(p_latitude)) * cos(radians(p.latitude))
          * cos(radians(p.longitude) - radians(p_longitude))
          + sin(radians(p_latitude)) * sin(radians(p.latitude))
        )
      ) ASC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSE
    -- type = 'latest'
    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE
          WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
          THEN p.images->0->>'url'
          ELSE NULL
        END,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title,
          'color', pt.color,
          'background', pt.background,
          'border', pt.border,
          'fadedColor', pt.faded_color,
          'images', pt.images,
          'order', pt."order",
          'hidden', pt.hidden
        ),
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'avg_score', AVG(r.score),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_user_id),
            'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_user_id),
            'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_user_id)
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE pt.hidden IS FALSE
      GROUP BY p.id, pt.id
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;
  END IF;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'meta', json_build_object(
      'page', p_page,
      'count', p_count,
      'total', v_total
    )
  );
END;
$$;

-- -----------------------------------------------
-- 4.4 get_banner_feed
-- Feed des bannieres (place_types hidden = true)
-- Types: 'all' (populaires), 'latest' (avec filtre date)
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_banner_feed(
  p_type TEXT DEFAULT 'latest',
  p_page INT DEFAULT 1,
  p_count INT DEFAULT 10,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INT;
  v_total INT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_count;

  SELECT COUNT(*) INTO v_total FROM places;

  IF p_type = 'all' THEN
    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE
          WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
          THEN p.images->0->>'url'
          ELSE NULL
        END,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title,
          'color', pt.color,
          'background', pt.background,
          'border', pt.border,
          'fadedColor', pt.faded_color,
          'images', pt.images,
          'order', pt."order",
          'hidden', pt.hidden
        ),
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'avg_score', AVG(r.score),
        'url', p.text,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_user_id),
            'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_user_id),
            'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_user_id)
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE pt.hidden IS TRUE
      GROUP BY p.id, pt.id
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSE
    -- type = 'latest' avec filtre date (7 jours avant begin_at jusqu'a end_at)
    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE
          WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
          THEN p.images->0->>'url'
          ELSE NULL
        END,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title,
          'color', pt.color,
          'background', pt.background,
          'border', pt.border,
          'fadedColor', pt.faded_color,
          'images', pt.images,
          'order', pt."order",
          'hidden', pt.hidden
        ),
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'avg_score', AVG(r.score),
        'url', p.text,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_user_id),
            'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_user_id),
            'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_user_id)
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE pt.hidden IS TRUE
        AND CURRENT_DATE >= p.begin_at - INTERVAL '7 days'
        AND CURRENT_DATE <= p.end_at
      GROUP BY p.id, pt.id
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;
  END IF;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'meta', json_build_object(
      'page', p_page,
      'count', p_count,
      'total', v_total
    )
  );
END;
$$;

-- -----------------------------------------------
-- 4.5 get_place_by_id
-- Detail complet d'une place avec metrics et requester state
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_place_by_id(
  p_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place RECORD;
  v_place_type RECORD;
  v_author RECORD;
  v_views_count INT;
  v_likes_count INT;
  v_explored_count INT;
  v_geocache_count INT;
  v_avg_score DOUBLE PRECISION;
  v_last_explorers JSON;
  v_requester JSON;
  v_author_profile_url TEXT;
BEGIN
  -- Recuperer la place
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Recuperer le type
  SELECT * INTO v_place_type FROM place_types WHERE id = v_place.place_type_id;

  -- Recuperer l'auteur
  SELECT * INTO v_author FROM users WHERE id = v_place.author_id;

  -- Photo de profil de l'auteur
  IF v_author IS NOT NULL AND v_author.profile_image_id IS NOT NULL THEN
    SELECT
      CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END INTO v_author_profile_url
    FROM image_media im
    WHERE im.id = v_author.profile_image_id;
  ELSE
    v_author_profile_url := NULL;
  END IF;

  -- Metrics
  SELECT COUNT(*) INTO v_views_count FROM places_viewed WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_likes_count FROM places_liked WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_explored_count FROM places_explored WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_geocache_count FROM reviews WHERE place_id = p_id AND geocache = true;
  SELECT AVG(score) INTO v_avg_score FROM reviews WHERE place_id = p_id;

  -- Derniers explorateurs (hors auteur)
  SELECT json_agg(explorer) INTO v_last_explorers
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'lastName', u.last_name,
      'profileImageUrl', CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
    WHERE pe.place_id = p_id AND pe.user_id != v_place.author_id
    ORDER BY pe.updated_at DESC
  ) sub;

  -- Requester state
  IF p_user_id IS NOT NULL THEN
    v_requester := json_build_object(
      'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked WHERE place_id = p_id AND user_id = p_user_id),
      'liked', EXISTS(SELECT 1 FROM places_liked WHERE place_id = p_id AND user_id = p_user_id),
      'explored', EXISTS(SELECT 1 FROM places_explored WHERE place_id = p_id AND user_id = p_user_id)
    );
  ELSE
    v_requester := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_place.id,
    'title', v_place.title,
    'text', v_place.text,
    'address', v_place.address,
    'accessibility', v_place.accessibility,
    'sensible', COALESCE(v_place.sensible, false),
    'geocaching', v_geocache_count > 0,
    'images', v_place.images,
    'author', json_build_object(
      'id', COALESCE(v_author.id, v_place.author_id),
      'lastName', COALESCE(v_author.last_name, 'Utilisateur inconnu'),
      'profileImageUrl', v_author_profile_url
    ),
    'type', json_build_object(
      'id', v_place_type.id,
      'title', v_place_type.title,
      'color', v_place_type.color,
      'background', v_place_type.background,
      'border', v_place_type.border,
      'fadedColor', v_place_type.faded_color,
      'images', v_place_type.images,
      'order', v_place_type."order",
      'hidden', v_place_type.hidden,
      'parent', v_place_type.parent_id
    ),
    'location', json_build_object(
      'latitude', v_place.latitude,
      'longitude', v_place.longitude
    ),
    'metrics', json_build_object(
      'views', v_views_count,
      'likes', v_likes_count,
      'explored', v_explored_count,
      'note', v_avg_score
    ),
    'requester', v_requester,
    'lastExplorers', COALESCE(v_last_explorers, '[]'::json),
    'beginAt', v_place.begin_at,
    'endAt', v_place.end_at
  );
END;
$$;

-- -----------------------------------------------
-- 4.6 get_place_reviews
-- Reviews paginées pour une place
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_place_reviews(
  p_place_id TEXT,
  p_page INT DEFAULT 1,
  p_count INT DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INT;
  v_total INT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_count;

  SELECT COUNT(*) INTO v_total FROM reviews WHERE place_id = p_place_id;

  SELECT json_agg(row_data) INTO v_data
  FROM (
    SELECT json_build_object(
      'id', r.id,
      'score', r.score,
      'message', r.message,
      'geocache', r.geocache,
      'createdAt', r.created_at,
      'user', json_build_object(
        'id', u.id,
        'lastName', u.last_name,
        'profileImageUrl', CASE
          WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
            COALESCE(
              (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
              (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
              (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
            )
          ELSE NULL
        END
      ),
      'images', COALESCE(
        (
          SELECT json_agg(json_build_object(
            'id', rim.id,
            'thumbnailUrl', COALESCE(
              (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
              (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
              (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'original' LIMIT 1)
            ),
            'largeUrl', COALESCE(
              (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'webp_large' LIMIT 1),
              (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'png_large' LIMIT 1),
              (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'original' LIMIT 1)
            )
          ))
          FROM reviews_images ri
          JOIN image_media rim ON rim.id = ri.image_media_id
          WHERE ri.review_id = r.id
        ),
        '[]'::json
      )
    ) AS row_data
    FROM reviews r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
    WHERE r.place_id = p_place_id
    ORDER BY r.created_at DESC
    LIMIT p_count OFFSET v_offset
  ) sub;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'meta', json_build_object(
      'page', p_page,
      'count', p_count,
      'total', v_total
    )
  );
END;
$$;

-- -----------------------------------------------
-- 4.7 get_review_by_id
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_review_by_id(
  p_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'id', r.id,
    'score', r.score,
    'message', r.message,
    'geocache', r.geocache,
    'createdAt', r.created_at,
    'user', json_build_object(
      'id', u.id,
      'lastName', u.last_name,
      'profileImageUrl', CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END
    ),
    'images', COALESCE(
      (
        SELECT json_agg(json_build_object(
          'id', rim.id,
          'thumbnailUrl', COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          ),
          'largeUrl', COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'webp_large' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'png_large' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ))
        FROM reviews_images ri
        JOIN image_media rim ON rim.id = ri.image_media_id
        WHERE ri.review_id = r.id
      ),
      '[]'::json
    )
  ) INTO v_result
  FROM reviews r
  JOIN users u ON u.id = r.user_id
  LEFT JOIN image_media im ON im.id = u.profile_image_id
  WHERE r.id = p_id;

  RETURN COALESCE(v_result, json_build_object('error', 'Review not found'));
END;
$$;

-- -----------------------------------------------
-- 4.8 get_user_places (liked, bookmarked, explored, added)
-- Fonction generique pour les listes de places d'un user
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_places(
  p_user_id TEXT,
  p_list_type TEXT DEFAULT 'added',
  p_page INT DEFAULT 1,
  p_count INT DEFAULT 10,
  p_requester_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INT;
  v_total INT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_count;

  IF p_list_type = 'liked' THEN
    SELECT COUNT(*) INTO v_total
    FROM places p
    JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.id IN (SELECT place_id FROM places_liked WHERE user_id = p_user_id)
      AND pt.hidden IS FALSE;

    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE WHEN jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
        'type', json_build_object('id', pt.id, 'title', pt.title, 'color', pt.color, 'background', pt.background, 'border', pt.border, 'fadedColor', pt.faded_color, 'images', pt.images, 'order', pt."order", 'hidden', pt.hidden),
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'requester', CASE WHEN p_requester_id IS NOT NULL THEN json_build_object(
          'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_requester_id),
          'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_requester_id),
          'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_requester_id)
        ) ELSE NULL END
      ) AS row_data
      FROM places p
      JOIN place_types pt ON pt.id = p.place_type_id
      WHERE p.id IN (SELECT place_id FROM places_liked WHERE user_id = p_user_id)
        AND pt.hidden IS FALSE
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSIF p_list_type = 'bookmarked' THEN
    SELECT COUNT(*) INTO v_total
    FROM places p
    JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.id IN (SELECT place_id FROM places_bookmarked WHERE user_id = p_user_id)
      AND pt.hidden IS FALSE;

    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE WHEN jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
        'type', json_build_object('id', pt.id, 'title', pt.title, 'color', pt.color, 'background', pt.background, 'border', pt.border, 'fadedColor', pt.faded_color, 'images', pt.images, 'order', pt."order", 'hidden', pt.hidden),
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'requester', CASE WHEN p_requester_id IS NOT NULL THEN json_build_object(
          'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_requester_id),
          'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_requester_id),
          'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_requester_id)
        ) ELSE NULL END
      ) AS row_data
      FROM places p
      JOIN place_types pt ON pt.id = p.place_type_id
      WHERE p.id IN (SELECT place_id FROM places_bookmarked WHERE user_id = p_user_id)
        AND pt.hidden IS FALSE
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSIF p_list_type = 'explored' THEN
    SELECT COUNT(*) INTO v_total
    FROM places p
    JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.id IN (SELECT place_id FROM places_explored WHERE user_id = p_user_id)
      AND pt.hidden IS FALSE;

    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE WHEN jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
        'type', json_build_object('id', pt.id, 'title', pt.title, 'color', pt.color, 'background', pt.background, 'border', pt.border, 'fadedColor', pt.faded_color, 'images', pt.images, 'order', pt."order", 'hidden', pt.hidden),
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'requester', CASE WHEN p_requester_id IS NOT NULL THEN json_build_object(
          'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_requester_id),
          'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_requester_id),
          'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_requester_id)
        ) ELSE NULL END
      ) AS row_data
      FROM places p
      JOIN place_types pt ON pt.id = p.place_type_id
      WHERE p.id IN (SELECT place_id FROM places_explored WHERE user_id = p_user_id)
        AND pt.hidden IS FALSE
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSE
    -- type = 'added' (places creees par l'utilisateur)
    SELECT COUNT(*) INTO v_total
    FROM places p
    JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.author_id = p_user_id AND pt.hidden IS FALSE;

    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE WHEN jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
        'type', json_build_object('id', pt.id, 'title', pt.title, 'color', pt.color, 'background', pt.background, 'border', pt.border, 'fadedColor', pt.faded_color, 'images', pt.images, 'order', pt."order", 'hidden', pt.hidden),
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'requester', CASE WHEN p_requester_id IS NOT NULL THEN json_build_object(
          'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_requester_id),
          'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_requester_id),
          'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_requester_id)
        ) ELSE NULL END
      ) AS row_data
      FROM places p
      JOIN place_types pt ON pt.id = p.place_type_id
      WHERE p.author_id = p_user_id AND pt.hidden IS FALSE
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;
  END IF;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'meta', json_build_object(
      'page', p_page,
      'count', p_count,
      'total', v_total
    )
  );
END;
$$;

-- -----------------------------------------------
-- 4.9 get_user_profile
-- Profil public d'un utilisateur avec metrics
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_profile(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_profile_url TEXT;
  v_places_added INT;
  v_places_explored INT;
BEGIN
  SELECT * INTO v_user FROM users WHERE id = p_user_id;
  IF v_user IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- Photo de profil
  SELECT
    CASE
      WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
        COALESCE(
          (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
          (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
        )
      ELSE NULL
    END INTO v_profile_url
  FROM image_media im
  WHERE im.id = v_user.profile_image_id;

  -- Nombre de places ajoutees (hors hidden)
  SELECT COUNT(*) INTO v_places_added
  FROM places p
  JOIN place_types pt ON pt.id = p.place_type_id
  WHERE p.author_id = p_user_id AND pt.hidden IS FALSE;

  -- Nombre de places explorees
  SELECT COUNT(*) INTO v_places_explored
  FROM places_explored WHERE user_id = p_user_id;

  RETURN json_build_object(
    'id', v_user.id,
    'lastName', v_user.last_name,
    'biography', COALESCE(v_user.bio, v_user.biography, ''),
    'profileImageUrl', v_profile_url,
    'instagramId', v_user.instagram_id,
    'websiteUrl', v_user.website_url,
    'metrics', json_build_object(
      'placesAdded', v_places_added,
      'placesExplored', v_places_explored
    )
  );
END;
$$;

-- -----------------------------------------------
-- 4.10 get_my_informations
-- Informations privees de l'utilisateur connecte
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_informations(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_profile_image JSON;
BEGIN
  SELECT * INTO v_user FROM users WHERE id = p_user_id;
  IF v_user IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- Photo de profil avec id + url
  IF v_user.profile_image_id IS NOT NULL THEN
    SELECT json_build_object(
      'id', im.id,
      'url', COALESCE(
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
      )
    ) INTO v_profile_image
    FROM image_media im
    WHERE im.id = v_user.profile_image_id;
  ELSE
    v_profile_image := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_user.id,
    'emailAddress', v_user.email_address,
    'role', COALESCE(v_user.role, 'user'),
    'rank', COALESCE(v_user.rank, 'guest'),
    'gender', v_user.gender,
    'lastName', v_user.last_name,
    'biography', COALESCE(v_user.bio, v_user.biography, ''),
    'instagramId', v_user.instagram_id,
    'websiteUrl', v_user.website_url,
    'profileImage', v_profile_image
  );
END;
$$;
-- ============================================
-- 007: Auto-create public.users row on auth signup
-- Trigger qui cree automatiquement une ligne dans public.users
-- quand un nouvel utilisateur s'inscrit via Supabase Auth (OTP)
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email_address,
    last_name,
    gender,
    rank,
    role,
    bio,
    created_at,
    updated_at
  ) VALUES (
    NEW.id::TEXT,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'Aventurier'),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'unknown'),
    'guest',
    'user',
    '',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email_address = COALESCE(EXCLUDED.email_address, public.users.email_address),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Supprime le trigger s'il existe deja
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Cree le trigger sur la table auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
-- ============================================
-- AJOUT CHAMPS TAILLE PRODUIT / MODELE
-- pour les soumissions photos communautaires
-- ============================================

-- Nouvelles colonnes sur hub_photo_submissions
ALTER TABLE hub_photo_submissions ADD COLUMN IF NOT EXISTS product_size TEXT;
ALTER TABLE hub_photo_submissions ADD COLUMN IF NOT EXISTS model_height_cm NUMERIC;
ALTER TABLE hub_photo_submissions ADD COLUMN IF NOT EXISTS model_shoulder_width_cm NUMERIC;

-- Mettre a jour la fonction create_photo_submission
DROP FUNCTION IF EXISTS public.create_photo_submission(VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT);
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
  p_submitter_role TEXT DEFAULT 'client',
  p_product_size TEXT DEFAULT NULL,
  p_model_height_cm NUMERIC DEFAULT NULL,
  p_model_shoulder_width_cm NUMERIC DEFAULT NULL
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
    message, consent_brand_usage, consent_account_creation, status, submitter_role,
    product_size, model_height_cm, model_shoulder_width_cm
  ) VALUES (
    p_user_id, p_submitter_name, p_submitter_email, p_submitter_instagram,
    p_location_name, p_location_zip,
    p_message, p_consent_brand, p_consent_account, 'pending', p_submitter_role,
    p_product_size, p_model_height_cm, p_model_shoulder_width_cm
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_photo_submission TO anon, authenticated;
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
-- ============================================
-- FONCTION : Modifier le message d'une soumission photo
-- ============================================

CREATE OR REPLACE FUNCTION public.update_submission_message(
  p_submission_id UUID,
  p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE hub_photo_submissions
  SET message = p_message
  WHERE id = p_submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_submission_message TO authenticated;
-- ============================================
-- 1. Ajouter colonne product_worn (produit porte - reference interne)
-- ============================================

ALTER TABLE hub_photo_submissions
ADD COLUMN IF NOT EXISTS product_worn TEXT;

-- ============================================
-- 2. RPC pour modifier le produit porte
-- ============================================

CREATE OR REPLACE FUNCTION public.update_submission_product_worn(
  p_submission_id UUID,
  p_product_worn TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE hub_photo_submissions
  SET product_worn = p_product_worn
  WHERE id = p_submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_submission_product_worn TO authenticated;

-- ============================================
-- 3. Mettre a jour get_approved_photos_by_tag pour inclure location_name + product_worn
-- ============================================

DROP FUNCTION IF EXISTS public.get_approved_photos_by_tag(TEXT);

CREATE OR REPLACE FUNCTION public.get_approved_photos_by_tag(p_tag_name TEXT)
RETURNS TABLE (
  id UUID,
  submitter_name TEXT,
  submitter_instagram TEXT,
  location_name TEXT,
  location_zip TEXT,
  product_size TEXT,
  model_height_cm NUMERIC,
  product_worn TEXT,
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
      ps.location_name,
      ps.location_zip,
      ps.product_size,
      ps.model_height_cm,
      ps.product_worn,
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

GRANT EXECUTE ON FUNCTION public.get_approved_photos_by_tag TO anon, authenticated;
-- ============================================
-- MIGRATION 012 : Système de Tags
-- ============================================
-- Migre les anciens place_types (catégories) vers des tags,
-- puis remplace place_types par 4 types structurels :
-- Lieu, Anecdote, Produit, Événement
--
-- ORDRE CRITIQUE : places.place_type_id a ON DELETE CASCADE.
-- On ne supprime les anciens types qu'APRÈS avoir migré les places.
-- ============================================


-- ============================================
-- 1. TABLES
-- ============================================

-- Table des tags (remplace les anciens place_types comme catégories)
CREATE TABLE IF NOT EXISTS tags (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title VARCHAR(255) NOT NULL,
  color VARCHAR(255) NOT NULL DEFAULT '#C19A6B',
  background VARCHAR(255) NOT NULL DEFAULT '#F5E6D3',
  icon VARCHAR(255),
  "order" INT NOT NULL DEFAULT 0
);

-- Table de jointure N:N entre places et tags
CREATE TABLE IF NOT EXISTS place_tags (
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  tag_id VARCHAR(255) NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (place_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_place_tags_tag_id ON place_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_place_tags_primary ON place_tags(place_id) WHERE is_primary = TRUE;


-- ============================================
-- 2. DATA MIGRATION
-- ============================================

-- 2a. Copier les anciens place_types → tags
INSERT INTO tags (id, title, color, background, "order", created_at, updated_at)
SELECT id, title, color, background, "order", created_at, updated_at
FROM place_types
ON CONFLICT (id) DO NOTHING;

-- 2b. Associer chaque lieu à son tag (= son ancien place_type), marqué comme primaire
INSERT INTO place_tags (place_id, tag_id, is_primary)
SELECT p.id, p.place_type_id, TRUE
FROM places p
ON CONFLICT (place_id, tag_id) DO NOTHING;

-- 2c. Insérer les 4 nouveaux types structurels dans place_types
-- (avant de modifier les places, pour que la FK soit valide)
-- On spécifie TOUTES les colonnes NOT NULL car Supabase n'applique pas les DEFAULT
INSERT INTO place_types (id, created_at, updated_at, parent_id, title, form_description, long_description, images, color, background, border, faded_color, "order", hidden)
VALUES
  ('lieu',       NOW(), NOW(), NULL, 'Lieu',        '', '', '{}'::jsonb, '#C19A6B', '#F5E6D3', '#000000', '#CCCCCC', 1, FALSE),
  ('anecdote',   NOW(), NOW(), NULL, 'Anecdote',    '', '', '{}'::jsonb, '#7D5A3C', '#F5E6D3', '#000000', '#CCCCCC', 2, FALSE),
  ('produit',    NOW(), NOW(), NULL, 'Produit',     '', '', '{}'::jsonb, '#A0784C', '#EDE0CE', '#000000', '#CCCCCC', 3, FALSE),
  ('evenement',  NOW(), NOW(), NULL, 'Événement',   '', '', '{}'::jsonb, '#4A3728', '#E8D5BE', '#000000', '#CCCCCC', 4, FALSE)
ON CONFLICT (id) DO NOTHING;

-- 2d. Basculer tous les lieux vers le type structurel "lieu"
UPDATE places SET place_type_id = 'lieu';

-- 2e. Supprimer les anciens types (plus aucune FK ne pointe dessus)
DELETE FROM place_types
WHERE id NOT IN ('lieu', 'anecdote', 'produit', 'evenement');


-- ============================================
-- 3. RLS
-- ============================================

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view tags" ON tags FOR SELECT USING (true);

ALTER TABLE place_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view place_tags" ON place_tags FOR SELECT USING (true);


-- ============================================
-- 4. RPC FUNCTIONS (mise à jour)
-- ============================================

-- -----------------------------------------------
-- 4.1 get_map_places — ajoute primaryTag
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_map_places(
  p_type TEXT DEFAULT 'all',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_latitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_longitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'latest' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;

  ELSE
    -- type = 'all' avec viewport optionnel
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      WHERE p.place_type_id = 'lieu'
        AND (
          p_latitude IS NULL
          OR (
            p.latitude >= (p_latitude - p_latitude_delta)
            AND p.latitude <= (p_latitude + p_latitude_delta)
            AND p.longitude >= (p_longitude - p_longitude_delta)
            AND p.longitude <= (p_longitude + p_longitude_delta)
          )
        )
      ORDER BY p.created_at
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- -----------------------------------------------
-- 4.2 get_map_banners — filtre par type structurel
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_map_banners(
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_latitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_longitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', json_build_object(
        'id', pt.id,
        'title', pt.title
      ),
      'primaryTag', CASE
        WHEN t.id IS NOT NULL THEN json_build_object(
          'id', t.id,
          'title', t.title,
          'color', t.color,
          'background', t.background
        )
        ELSE NULL
      END,
      'location', json_build_object(
        'latitude', p.latitude,
        'longitude', p.longitude
      ),
      'requester', CASE
        WHEN p_user_id IS NOT NULL THEN json_build_object(
          'viewed', EXISTS(
            SELECT 1 FROM places_viewed pv
            WHERE pv.place_id = p.id AND pv.user_id = p_user_id
          )
        )
        ELSE NULL
      END
    ) AS row_data
    FROM places p
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
    LEFT JOIN tags t ON t.id = ptag.tag_id
    WHERE p.place_type_id IN ('produit', 'evenement')
      AND (
        p_latitude IS NULL
        OR (
          p.latitude >= (p_latitude - p_latitude_delta)
          AND p.latitude <= (p_latitude + p_latitude_delta)
          AND p.longitude >= (p_longitude - p_longitude_delta)
          AND p.longitude <= (p_longitude + p_longitude_delta)
        )
      )
    ORDER BY p.created_at
  ) sub;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- -----------------------------------------------
-- 4.3 get_regular_feed — ajoute primaryTag
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_regular_feed(
  p_type TEXT DEFAULT 'latest',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_count INT DEFAULT 10,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INT;
  v_total INT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_count;

  SELECT COUNT(*) INTO v_total FROM places WHERE place_type_id = 'lieu';

  IF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE
          WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
          THEN p.images->0->>'url'
          ELSE NULL
        END,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'avg_score', AVG(r.score),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_user_id),
            'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_user_id),
            'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_user_id)
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSIF p_type = 'closest' AND p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE
          WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
          THEN p.images->0->>'url'
          ELSE NULL
        END,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'avg_score', AVG(r.score),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_user_id),
            'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_user_id),
            'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_user_id)
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id
      ORDER BY (
        6371 * acos(
          cos(radians(p_latitude)) * cos(radians(p.latitude))
          * cos(radians(p.longitude) - radians(p_longitude))
          + sin(radians(p_latitude)) * sin(radians(p.latitude))
        )
      ) ASC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSE
    -- type = 'latest'
    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE
          WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
          THEN p.images->0->>'url'
          ELSE NULL
        END,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'avg_score', AVG(r.score),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_user_id),
            'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_user_id),
            'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_user_id)
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;
  END IF;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'meta', json_build_object(
      'page', p_page,
      'count', p_count,
      'total', v_total
    )
  );
END;
$$;

-- -----------------------------------------------
-- 4.4 get_banner_feed — filtre par type structurel
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_banner_feed(
  p_type TEXT DEFAULT 'latest',
  p_page INT DEFAULT 1,
  p_count INT DEFAULT 10,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INT;
  v_total INT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_count;

  SELECT COUNT(*) INTO v_total
  FROM places
  WHERE place_type_id IN ('produit', 'evenement');

  IF p_type = 'all' THEN
    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE
          WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
          THEN p.images->0->>'url'
          ELSE NULL
        END,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'avg_score', AVG(r.score),
        'url', p.text,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_user_id),
            'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_user_id),
            'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_user_id)
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE p.place_type_id IN ('produit', 'evenement')
      GROUP BY p.id, pt.id, t.id
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSE
    -- type = 'latest' avec filtre date
    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE
          WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
          THEN p.images->0->>'url'
          ELSE NULL
        END,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'avg_score', AVG(r.score),
        'url', p.text,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_user_id),
            'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_user_id),
            'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_user_id)
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE p.place_type_id IN ('produit', 'evenement')
        AND CURRENT_DATE >= p.begin_at - INTERVAL '7 days'
        AND CURRENT_DATE <= p.end_at
      GROUP BY p.id, pt.id, t.id
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;
  END IF;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'meta', json_build_object(
      'page', p_page,
      'count', p_count,
      'total', v_total
    )
  );
END;
$$;

-- -----------------------------------------------
-- 4.5 get_place_by_id — ajoute tags + primaryTag
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_place_by_id(
  p_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place RECORD;
  v_place_type RECORD;
  v_author RECORD;
  v_views_count INT;
  v_likes_count INT;
  v_explored_count INT;
  v_geocache_count INT;
  v_avg_score DOUBLE PRECISION;
  v_last_explorers JSON;
  v_requester JSON;
  v_author_profile_url TEXT;
  v_primary_tag JSON;
  v_all_tags JSON;
BEGIN
  -- Recuperer la place
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Recuperer le type structurel
  SELECT * INTO v_place_type FROM place_types WHERE id = v_place.place_type_id;

  -- Recuperer l'auteur
  SELECT * INTO v_author FROM users WHERE id = v_place.author_id;

  -- Photo de profil de l'auteur
  IF v_author IS NOT NULL AND v_author.profile_image_id IS NOT NULL THEN
    SELECT
      CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END INTO v_author_profile_url
    FROM image_media im
    WHERE im.id = v_author.profile_image_id;
  ELSE
    v_author_profile_url := NULL;
  END IF;

  -- Metrics
  SELECT COUNT(*) INTO v_views_count FROM places_viewed WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_likes_count FROM places_liked WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_explored_count FROM places_explored WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_geocache_count FROM reviews WHERE place_id = p_id AND geocache = true;
  SELECT AVG(score) INTO v_avg_score FROM reviews WHERE place_id = p_id;

  -- Derniers explorateurs (hors auteur)
  SELECT json_agg(explorer) INTO v_last_explorers
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'lastName', u.last_name,
      'profileImageUrl', CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
    WHERE pe.place_id = p_id AND pe.user_id != v_place.author_id
    ORDER BY pe.updated_at DESC
  ) sub;

  -- Tag primaire
  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'color', t.color,
    'background', t.background
  ) INTO v_primary_tag
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_id AND ptag.is_primary = TRUE
  LIMIT 1;

  -- Tous les tags
  SELECT json_agg(tag_data) INTO v_all_tags
  FROM (
    SELECT json_build_object(
      'id', t.id,
      'title', t.title,
      'color', t.color,
      'background', t.background,
      'isPrimary', ptag.is_primary
    ) AS tag_data
    FROM place_tags ptag
    JOIN tags t ON t.id = ptag.tag_id
    WHERE ptag.place_id = p_id
    ORDER BY ptag.is_primary DESC, t."order"
  ) sub;

  -- Requester state
  IF p_user_id IS NOT NULL THEN
    v_requester := json_build_object(
      'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked WHERE place_id = p_id AND user_id = p_user_id),
      'liked', EXISTS(SELECT 1 FROM places_liked WHERE place_id = p_id AND user_id = p_user_id),
      'explored', EXISTS(SELECT 1 FROM places_explored WHERE place_id = p_id AND user_id = p_user_id)
    );
  ELSE
    v_requester := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_place.id,
    'title', v_place.title,
    'text', v_place.text,
    'address', v_place.address,
    'accessibility', v_place.accessibility,
    'sensible', COALESCE(v_place.sensible, false),
    'geocaching', v_geocache_count > 0,
    'images', v_place.images,
    'author', json_build_object(
      'id', COALESCE(v_author.id, v_place.author_id),
      'lastName', COALESCE(v_author.last_name, 'Utilisateur inconnu'),
      'profileImageUrl', v_author_profile_url
    ),
    'type', json_build_object(
      'id', v_place_type.id,
      'title', v_place_type.title
    ),
    'primaryTag', v_primary_tag,
    'tags', COALESCE(v_all_tags, '[]'::json),
    'location', json_build_object(
      'latitude', v_place.latitude,
      'longitude', v_place.longitude
    ),
    'metrics', json_build_object(
      'views', v_views_count,
      'likes', v_likes_count,
      'explored', v_explored_count,
      'note', v_avg_score
    ),
    'requester', v_requester,
    'lastExplorers', COALESCE(v_last_explorers, '[]'::json),
    'beginAt', v_place.begin_at,
    'endAt', v_place.end_at
  );
END;
$$;

-- -----------------------------------------------
-- 4.8 get_user_places — ajoute primaryTag
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_places(
  p_user_id TEXT,
  p_list_type TEXT DEFAULT 'added',
  p_page INT DEFAULT 1,
  p_count INT DEFAULT 10,
  p_requester_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INT;
  v_total INT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_count;

  IF p_list_type = 'liked' THEN
    SELECT COUNT(*) INTO v_total
    FROM places p
    WHERE p.id IN (SELECT place_id FROM places_liked WHERE user_id = p_user_id)
      AND p.place_type_id = 'lieu';

    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE WHEN jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE WHEN t.id IS NOT NULL THEN json_build_object('id', t.id, 'title', t.title, 'color', t.color, 'background', t.background) ELSE NULL END,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'requester', CASE WHEN p_requester_id IS NOT NULL THEN json_build_object(
          'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_requester_id),
          'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_requester_id),
          'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_requester_id)
        ) ELSE NULL END
      ) AS row_data
      FROM places p
      JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      WHERE p.id IN (SELECT place_id FROM places_liked WHERE user_id = p_user_id)
        AND p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSIF p_list_type = 'bookmarked' THEN
    SELECT COUNT(*) INTO v_total
    FROM places p
    WHERE p.id IN (SELECT place_id FROM places_bookmarked WHERE user_id = p_user_id)
      AND p.place_type_id = 'lieu';

    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE WHEN jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE WHEN t.id IS NOT NULL THEN json_build_object('id', t.id, 'title', t.title, 'color', t.color, 'background', t.background) ELSE NULL END,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'requester', CASE WHEN p_requester_id IS NOT NULL THEN json_build_object(
          'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_requester_id),
          'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_requester_id),
          'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_requester_id)
        ) ELSE NULL END
      ) AS row_data
      FROM places p
      JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      WHERE p.id IN (SELECT place_id FROM places_bookmarked WHERE user_id = p_user_id)
        AND p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSIF p_list_type = 'explored' THEN
    SELECT COUNT(*) INTO v_total
    FROM places p
    WHERE p.id IN (SELECT place_id FROM places_explored WHERE user_id = p_user_id)
      AND p.place_type_id = 'lieu';

    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE WHEN jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE WHEN t.id IS NOT NULL THEN json_build_object('id', t.id, 'title', t.title, 'color', t.color, 'background', t.background) ELSE NULL END,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'requester', CASE WHEN p_requester_id IS NOT NULL THEN json_build_object(
          'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_requester_id),
          'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_requester_id),
          'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_requester_id)
        ) ELSE NULL END
      ) AS row_data
      FROM places p
      JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      WHERE p.id IN (SELECT place_id FROM places_explored WHERE user_id = p_user_id)
        AND p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSE
    -- type = 'added'
    SELECT COUNT(*) INTO v_total
    FROM places p
    WHERE p.author_id = p_user_id AND p.place_type_id = 'lieu';

    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE WHEN jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE WHEN t.id IS NOT NULL THEN json_build_object('id', t.id, 'title', t.title, 'color', t.color, 'background', t.background) ELSE NULL END,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'requester', CASE WHEN p_requester_id IS NOT NULL THEN json_build_object(
          'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_requester_id),
          'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_requester_id),
          'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_requester_id)
        ) ELSE NULL END
      ) AS row_data
      FROM places p
      JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      WHERE p.author_id = p_user_id AND p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;
  END IF;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'meta', json_build_object(
      'page', p_page,
      'count', p_count,
      'total', v_total
    )
  );
END;
$$;

-- -----------------------------------------------
-- 4.9 get_user_profile — adapte filtre hidden → type
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_profile(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_profile_url TEXT;
  v_places_added INT;
  v_places_explored INT;
BEGIN
  SELECT * INTO v_user FROM users WHERE id = p_user_id;
  IF v_user IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- Photo de profil
  SELECT
    CASE
      WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
        COALESCE(
          (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
          (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
        )
      ELSE NULL
    END INTO v_profile_url
  FROM image_media im
  WHERE im.id = v_user.profile_image_id;

  -- Nombre de places ajoutees (type lieu uniquement)
  SELECT COUNT(*) INTO v_places_added
  FROM places p
  WHERE p.author_id = p_user_id AND p.place_type_id = 'lieu';

  -- Nombre de places explorees
  SELECT COUNT(*) INTO v_places_explored
  FROM places_explored WHERE user_id = p_user_id;

  RETURN json_build_object(
    'id', v_user.id,
    'lastName', v_user.last_name,
    'biography', COALESCE(v_user.bio, v_user.biography, ''),
    'profileImageUrl', v_profile_url,
    'instagramId', v_user.instagram_id,
    'websiteUrl', v_user.website_url,
    'metrics', json_build_object(
      'placesAdded', v_places_added,
      'placesExplored', v_places_explored
    )
  );
END;
$$;
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
-- ============================================
-- MIGRATION 014 : Zones d'influence — likes count dans get_map_places
-- ============================================
-- Ajoute le nombre de likes par lieu dans get_map_places
-- pour alimenter les zones d'influence sur la carte.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_map_places(
  p_type TEXT DEFAULT 'all',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_latitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_longitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id, lk.likes_count
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'latest' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;

  ELSE
    -- type = 'all' avec viewport optionnel
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      WHERE p.place_type_id = 'lieu'
        AND (
          p_latitude IS NULL
          OR (
            p.latitude >= (p_latitude - p_latitude_delta)
            AND p.latitude <= (p_latitude + p_latitude_delta)
            AND p.longitude >= (p_longitude - p_longitude_delta)
            AND p.longitude <= (p_longitude + p_longitude_delta)
          )
        )
      ORDER BY p.created_at
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
-- ============================================
-- MIGRATION 015 : Score composite pour zones d'influence
-- ============================================
-- Remplace "likes" par un "score" combinant toutes les interactions :
--   score = likes + vues*0.1 + explorations*2
-- Chaque interaction renforce le lieu, pas seulement les likes.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_map_places(
  p_type TEXT DEFAULT 'all',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_latitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_longitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id, lk.likes_count, vw.views_count, ex.explored_count
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'latest' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;

  ELSE
    -- type = 'all' avec viewport optionnel
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
        AND (
          p_latitude IS NULL
          OR (
            p.latitude >= (p_latitude - p_latitude_delta)
            AND p.latitude <= (p_latitude + p_latitude_delta)
            AND p.longitude >= (p_longitude - p_longitude_delta)
            AND p.longitude <= (p_longitude + p_longitude_delta)
          )
        )
      ORDER BY p.created_at
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
-- ============================================
-- MIGRATION 016 : Systeme de factions
-- ============================================
-- Les factions sont les equipes du jeu.
-- Un utilisateur s'associe a une faction et revendique des lieux pour elle.
-- Systeme separe des tags (categories de lieux).
-- ============================================

CREATE TABLE IF NOT EXISTS factions (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  color VARCHAR(255) NOT NULL DEFAULT '#C19A6B',
  pattern VARCHAR(255),
  "order" INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE factions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read factions"
  ON factions FOR SELECT
  USING (true);

CREATE POLICY "Auth manage factions"
  ON factions FOR ALL
  USING (auth.role() = 'authenticated');

-- Bucket storage pour les patterns SVG
INSERT INTO storage.buckets (id, name, public)
VALUES ('faction-patterns', 'faction-patterns', true)
ON CONFLICT DO NOTHING;

-- Policies storage
CREATE POLICY "Public read faction-patterns"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'faction-patterns');

CREATE POLICY "Auth upload faction-patterns"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'faction-patterns' AND auth.role() = 'authenticated');

CREATE POLICY "Auth update faction-patterns"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'faction-patterns' AND auth.role() = 'authenticated');

CREATE POLICY "Auth delete faction-patterns"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'faction-patterns' AND auth.role() = 'authenticated');
-- ============================================
-- MIGRATION 017 : Factions gameplay
-- ============================================
-- - faction_id sur users (l'utilisateur choisit sa faction)
-- - faction_id + claimed_by sur places (un lieu peut être revendiqué)
-- - place_claims : historique des revendications
-- - RPCs : set_user_faction, claim_place
-- - MAJ RPCs : get_my_informations, get_place_by_id, get_map_places
-- ============================================

-- ============================================
-- 1. COLONNES
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS faction_id VARCHAR(255) REFERENCES factions(id) ON DELETE SET NULL;
ALTER TABLE places ADD COLUMN IF NOT EXISTS faction_id VARCHAR(255) REFERENCES factions(id) ON DELETE SET NULL;
ALTER TABLE places ADD COLUMN IF NOT EXISTS claimed_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE places ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_faction_id ON users(faction_id);
CREATE INDEX IF NOT EXISTS idx_places_faction_id ON places(faction_id);

-- ============================================
-- 2. HISTORIQUE DES CLAIMS
-- ============================================

CREATE TABLE IF NOT EXISTS place_claims (
  id SERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  faction_id VARCHAR(255) NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_place_claims_place_id ON place_claims(place_id);
CREATE INDEX IF NOT EXISTS idx_place_claims_faction_id ON place_claims(faction_id);

-- RLS
ALTER TABLE place_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read place_claims" ON place_claims FOR SELECT USING (true);
CREATE POLICY "Auth insert place_claims" ON place_claims FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 3. RPC : set_user_faction
-- ============================================

CREATE OR REPLACE FUNCTION public.set_user_faction(
  p_user_id TEXT,
  p_faction_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifier que la faction existe (ou null pour quitter)
  IF p_faction_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM factions WHERE id = p_faction_id) THEN
      RETURN json_build_object('error', 'Faction not found');
    END IF;
  END IF;

  UPDATE users SET faction_id = p_faction_id, updated_at = NOW() WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;

-- ============================================
-- 4. RPC : claim_place
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
BEGIN
  -- Récupérer la faction du user
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;

  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Vérifier que le lieu existe
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Revendiquer le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Historique
  INSERT INTO place_claims (place_id, user_id, faction_id)
  VALUES (p_place_id, p_user_id, v_faction_id);

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id
  );
END;
$$;

-- ============================================
-- 5. MAJ get_my_informations — ajouter faction
-- ============================================

CREATE OR REPLACE FUNCTION public.get_my_informations(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_profile_image JSON;
  v_faction JSON;
BEGIN
  SELECT * INTO v_user FROM users WHERE id = p_user_id;
  IF v_user IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- Photo de profil avec id + url
  IF v_user.profile_image_id IS NOT NULL THEN
    SELECT json_build_object(
      'id', im.id,
      'url', COALESCE(
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
      )
    ) INTO v_profile_image
    FROM image_media im
    WHERE im.id = v_user.profile_image_id;
  ELSE
    v_profile_image := NULL;
  END IF;

  -- Faction
  IF v_user.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'id', f.id,
      'title', f.title,
      'color', f.color,
      'pattern', f.pattern
    ) INTO v_faction
    FROM factions f
    WHERE f.id = v_user.faction_id;
  ELSE
    v_faction := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_user.id,
    'emailAddress', v_user.email_address,
    'role', COALESCE(v_user.role, 'user'),
    'rank', COALESCE(v_user.rank, 'guest'),
    'gender', v_user.gender,
    'lastName', v_user.last_name,
    'biography', COALESCE(v_user.bio, v_user.biography, ''),
    'instagramId', v_user.instagram_id,
    'websiteUrl', v_user.website_url,
    'profileImage', v_profile_image,
    'faction', v_faction
  );
END;
$$;

-- ============================================
-- 6. MAJ get_place_by_id — ajouter claim info
-- ============================================

CREATE OR REPLACE FUNCTION public.get_place_by_id(
  p_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place RECORD;
  v_place_type RECORD;
  v_author RECORD;
  v_views_count INT;
  v_likes_count INT;
  v_explored_count INT;
  v_geocache_count INT;
  v_avg_score DOUBLE PRECISION;
  v_last_explorers JSON;
  v_requester JSON;
  v_author_profile_url TEXT;
  v_primary_tag JSON;
  v_all_tags JSON;
  v_claim JSON;
BEGIN
  -- Recuperer la place
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Recuperer le type structurel
  SELECT * INTO v_place_type FROM place_types WHERE id = v_place.place_type_id;

  -- Recuperer l'auteur
  SELECT * INTO v_author FROM users WHERE id = v_place.author_id;

  -- Photo de profil de l'auteur
  IF v_author IS NOT NULL AND v_author.profile_image_id IS NOT NULL THEN
    SELECT
      CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END INTO v_author_profile_url
    FROM image_media im
    WHERE im.id = v_author.profile_image_id;
  ELSE
    v_author_profile_url := NULL;
  END IF;

  -- Metrics
  SELECT COUNT(*) INTO v_views_count FROM places_viewed WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_likes_count FROM places_liked WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_explored_count FROM places_explored WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_geocache_count FROM reviews WHERE place_id = p_id AND geocache = true;
  SELECT AVG(score) INTO v_avg_score FROM reviews WHERE place_id = p_id;

  -- Derniers explorateurs (hors auteur)
  SELECT json_agg(explorer) INTO v_last_explorers
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'lastName', u.last_name,
      'profileImageUrl', CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
    WHERE pe.place_id = p_id AND pe.user_id != v_place.author_id
    ORDER BY pe.updated_at DESC
  ) sub;

  -- Tag primaire
  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'color', t.color,
    'background', t.background
  ) INTO v_primary_tag
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_id AND ptag.is_primary = TRUE
  LIMIT 1;

  -- Tous les tags
  SELECT json_agg(tag_data) INTO v_all_tags
  FROM (
    SELECT json_build_object(
      'id', t.id,
      'title', t.title,
      'color', t.color,
      'background', t.background,
      'isPrimary', ptag.is_primary
    ) AS tag_data
    FROM place_tags ptag
    JOIN tags t ON t.id = ptag.tag_id
    WHERE ptag.place_id = p_id
    ORDER BY ptag.is_primary DESC, t."order"
  ) sub;

  -- Requester state
  IF p_user_id IS NOT NULL THEN
    v_requester := json_build_object(
      'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked WHERE place_id = p_id AND user_id = p_user_id),
      'liked', EXISTS(SELECT 1 FROM places_liked WHERE place_id = p_id AND user_id = p_user_id),
      'explored', EXISTS(SELECT 1 FROM places_explored WHERE place_id = p_id AND user_id = p_user_id)
    );
  ELSE
    v_requester := NULL;
  END IF;

  -- Claim info
  IF v_place.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'factionId', f.id,
      'factionTitle', f.title,
      'factionColor', f.color,
      'claimedBy', v_place.claimed_by,
      'claimedAt', v_place.claimed_at
    ) INTO v_claim
    FROM factions f
    WHERE f.id = v_place.faction_id;
  ELSE
    v_claim := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_place.id,
    'title', v_place.title,
    'text', v_place.text,
    'address', v_place.address,
    'accessibility', v_place.accessibility,
    'sensible', COALESCE(v_place.sensible, false),
    'geocaching', v_geocache_count > 0,
    'images', v_place.images,
    'author', json_build_object(
      'id', COALESCE(v_author.id, v_place.author_id),
      'lastName', COALESCE(v_author.last_name, 'Utilisateur inconnu'),
      'profileImageUrl', v_author_profile_url
    ),
    'type', json_build_object(
      'id', v_place_type.id,
      'title', v_place_type.title
    ),
    'primaryTag', v_primary_tag,
    'tags', COALESCE(v_all_tags, '[]'::json),
    'location', json_build_object(
      'latitude', v_place.latitude,
      'longitude', v_place.longitude
    ),
    'metrics', json_build_object(
      'views', v_views_count,
      'likes', v_likes_count,
      'explored', v_explored_count,
      'note', v_avg_score
    ),
    'claim', v_claim,
    'requester', v_requester,
    'lastExplorers', COALESCE(v_last_explorers, '[]'::json),
    'beginAt', v_place.begin_at,
    'endAt', v_place.end_at
  );
END;
$$;

-- ============================================
-- 7. MAJ get_map_places — faction color quand revendiqué
-- ============================================

CREATE OR REPLACE FUNCTION public.get_map_places(
  p_type TEXT DEFAULT 'all',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_latitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_longitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id, f.id, lk.likes_count, vw.views_count, ex.explored_count
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'latest' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;

  ELSE
    -- type = 'all' avec viewport optionnel
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
        AND (
          p_latitude IS NULL
          OR (
            p.latitude >= (p_latitude - p_latitude_delta)
            AND p.latitude <= (p_latitude + p_latitude_delta)
            AND p.longitude >= (p_longitude - p_longitude_delta)
            AND p.longitude <= (p_longitude + p_longitude_delta)
          )
        )
      ORDER BY p.created_at
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
-- ============================================
-- Fix : ajouter faction.pattern dans get_map_places
-- (La migration 017 a été poussée avant cet ajout)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_map_places(
  p_type TEXT DEFAULT 'all',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_latitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_longitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id, f.id, lk.likes_count, vw.views_count, ex.explored_count
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'latest' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;

  ELSE
    -- type = 'all' avec viewport optionnel
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
        AND (
          p_latitude IS NULL
          OR (
            p.latitude >= (p_latitude - p_latitude_delta)
            AND p.latitude <= (p_latitude + p_latitude_delta)
            AND p.longitude >= (p_longitude - p_longitude_delta)
            AND p.longitude <= (p_longitude + p_longitude_delta)
          )
        )
      ORDER BY p.created_at
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
-- ============================================
-- MIGRATION 019 : Brouillard de guerre V1
-- ============================================
-- - places_discovered : lieux découverts par utilisateur
-- - energy_points + energy_reset_at sur users
-- - RPCs : get_user_discoveries, discover_place, get_user_energy
-- ============================================

-- ============================================
-- 1. TABLE : places_discovered
-- ============================================

CREATE TABLE IF NOT EXISTS places_discovered (
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  method VARCHAR(20) NOT NULL DEFAULT 'remote',  -- 'remote' | 'gps'
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_places_discovered_user ON places_discovered(user_id);
CREATE INDEX IF NOT EXISTS idx_places_discovered_place ON places_discovered(place_id);

-- RLS
ALTER TABLE places_discovered ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own discoveries"
  ON places_discovered FOR SELECT
  USING (true);

CREATE POLICY "Auth insert discoveries"
  ON places_discovered FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 2. COLONNES ÉNERGIE SUR USERS
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS energy_points INT NOT NULL DEFAULT 5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS energy_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================
-- 3. RPC : get_user_discoveries
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_discoveries(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(place_id) INTO v_result
  FROM places_discovered
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- ============================================
-- 4. RPC : get_user_energy
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy INT;
  v_reset_at TIMESTAMPTZ;
BEGIN
  SELECT energy_points, energy_reset_at INTO v_energy, v_reset_at
  FROM users WHERE id = p_user_id;

  -- Auto-reset si le dernier reset date d'avant aujourd'hui
  IF v_reset_at < date_trunc('day', NOW()) THEN
    UPDATE users
    SET energy_points = 5, energy_reset_at = NOW()
    WHERE id = p_user_id;
    v_energy := 5;
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', 5
  );
END;
$$;

-- ============================================
-- 5. RPC : discover_place
-- ============================================

CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote'  -- 'remote' | 'gps'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy INT;
  v_reset_at TIMESTAMPTZ;
  v_already BOOLEAN;
BEGIN
  -- Vérifier que le lieu existe
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Vérifier si déjà découvert (idempotent)
  SELECT EXISTS(
    SELECT 1 FROM places_discovered
    WHERE user_id = p_user_id AND place_id = p_place_id
  ) INTO v_already;

  IF v_already THEN
    SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
    RETURN json_build_object('success', true, 'already', true, 'energy', v_energy);
  END IF;

  -- Si méthode = remote, vérifier/reset l'énergie
  IF p_method = 'remote' THEN
    SELECT energy_points, energy_reset_at INTO v_energy, v_reset_at
    FROM users WHERE id = p_user_id;

    -- Auto-reset si le dernier reset date d'avant aujourd'hui
    IF v_reset_at < date_trunc('day', NOW()) THEN
      UPDATE users
      SET energy_points = 5, energy_reset_at = NOW()
      WHERE id = p_user_id;
      v_energy := 5;
    END IF;

    IF v_energy < 1 THEN
      RETURN json_build_object('error', 'Not enough energy', 'energy', 0);
    END IF;

    -- Déduire 1 point
    UPDATE users
    SET energy_points = energy_points - 1
    WHERE id = p_user_id;
  END IF;

  -- Insérer la découverte
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Retourner l'énergie restante
  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'energy', v_energy
  );
END;
$$;
-- ============================================================
-- 020 : Table app_settings + bucket app-assets
-- ============================================================

-- Table clé/valeur pour les paramètres globaux de l'app
create table if not exists public.app_settings (
  key   text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- RLS : lecture publique, écriture authentifiée
alter table public.app_settings enable row level security;

create policy "app_settings_read"
  on public.app_settings for select
  to anon, authenticated
  using (true);

create policy "app_settings_write"
  on public.app_settings for all
  to authenticated
  using (true)
  with check (true);

-- Valeur par défaut : icône des lieux non découverts (vide = pas d'icône custom)
insert into public.app_settings (key, value)
values ('unknown_place_icon', '')
on conflict (key) do nothing;

-- Bucket storage pour les assets globaux (icônes, images de config)
insert into storage.buckets (id, name, public)
values ('app-assets', 'app-assets', true)
on conflict (id) do nothing;

-- Policies storage : lecture publique, upload/delete authentifié
create policy "app_assets_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'app-assets');

create policy "app_assets_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'app-assets');

create policy "app_assets_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'app-assets');
-- Migration 020 : ajouter le nom du conquérant à get_map_places
-- Permet d'afficher les noms des joueurs sur les territoires de la carte

CREATE OR REPLACE FUNCTION public.get_map_places(
  p_type TEXT DEFAULT 'all',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_latitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_longitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', claimer.last_name,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id, f.id, claimer.last_name, lk.likes_count, vw.views_count, ex.explored_count
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'latest' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', claimer.last_name,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;

  ELSE
    -- type = 'all' avec viewport optionnel
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', claimer.last_name,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
        AND (
          p_latitude IS NULL
          OR (
            p.latitude >= (p_latitude - p_latitude_delta)
            AND p.latitude <= (p_latitude + p_latitude_delta)
            AND p.longitude >= (p_longitude - p_longitude_delta)
            AND p.longitude <= (p_longitude + p_longitude_delta)
          )
        )
      ORDER BY p.created_at
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
-- Migration 022 : RPC pour recharger l'énergie d'un joueur

CREATE OR REPLACE FUNCTION public.reset_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy INT;
BEGIN
  UPDATE users
  SET energy_points = 5, energy_reset_at = NOW()
  WHERE id = p_user_id
  RETURNING energy_points INTO v_energy;

  RETURN json_build_object('energy', COALESCE(v_energy, 5));
END;
$$;
-- Migration 023 : Fix découvertes lors du changement de faction
--
-- 1. claim_place : auto-découvrir le lieu revendiqué
-- 2. set_user_faction : solidifier les découvertes de l'ancienne faction avant de changer

-- ============================================
-- 1. claim_place — ajouter INSERT places_discovered
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
BEGIN
  -- Récupérer la faction du user
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;

  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Vérifier que le lieu existe
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Revendiquer le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Historique
  INSERT INTO place_claims (place_id, user_id, faction_id)
  VALUES (p_place_id, p_user_id, v_faction_id);

  -- Auto-découvrir le lieu (idempotent)
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, 'remote')
  ON CONFLICT (user_id, place_id) DO NOTHING;

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id
  );
END;
$$;

-- ============================================
-- 2. set_user_faction — solidifier les découvertes
-- ============================================

CREATE OR REPLACE FUNCTION public.set_user_faction(
  p_user_id TEXT,
  p_faction_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_faction_id TEXT;
BEGIN
  -- Vérifier que la faction existe (ou null pour quitter)
  IF p_faction_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM factions WHERE id = p_faction_id) THEN
      RETURN json_build_object('error', 'Faction not found');
    END IF;
  END IF;

  -- Récupérer l'ancienne faction
  SELECT faction_id INTO v_old_faction_id FROM users WHERE id = p_user_id;

  -- Solidifier : tous les lieux de l'ancienne faction deviennent des découvertes explicites
  IF v_old_faction_id IS NOT NULL THEN
    INSERT INTO places_discovered (user_id, place_id, method)
    SELECT p_user_id, p.id, 'remote'
    FROM places p
    WHERE p.faction_id = v_old_faction_id
    ON CONFLICT (user_id, place_id) DO NOTHING;
  END IF;

  UPDATE users SET faction_id = p_faction_id, updated_at = NOW() WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;
-- ============================================
-- MIGRATION 024 : Regen d'energie progressive
-- ============================================
-- Remplace le reset quotidien par une regeneration
-- continue. Plus on possede de lieux, plus c'est rapide.
-- Cycle : 4h. Points/cycle = 1 + floor(claimed_count / 3)
-- ============================================

-- ============================================
-- 1. MAJ get_user_energy — regen progressive
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy INT;
  v_updated_at TIMESTAMPTZ;
  v_user_faction_id TEXT;
  v_claimed_count INT;
  v_regen_rate INT;
  v_seconds_elapsed FLOAT;
  v_ticks INT;
  v_points_to_add INT;
  v_max_energy INT := 5;
  v_cycle_seconds INT := 14400;  -- 4 heures en secondes
  v_next_point_in INT;
  v_elapsed_in_tick FLOAT;
BEGIN
  SELECT energy_points, energy_reset_at, faction_id
  INTO v_energy, v_updated_at, v_user_faction_id
  FROM users WHERE id = p_user_id;

  -- Compter les lieux revendiques par ce joueur ET toujours dans sa faction actuelle
  SELECT count(*)::int INTO v_claimed_count
  FROM places
  WHERE claimed_by = p_user_id
    AND faction_id = v_user_faction_id;

  -- Taux de regen : 1 base + 1 par tranche de 3 lieux
  v_regen_rate := 1 + (v_claimed_count / 3);

  -- Secondes ecoulees depuis le dernier update
  v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_updated_at));

  -- Nombre de cycles complets ecoules
  v_ticks := GREATEST(0, floor(v_seconds_elapsed / v_cycle_seconds)::int);

  -- Points a ajouter (cap a max)
  v_points_to_add := LEAST(v_ticks * v_regen_rate, v_max_energy - v_energy);

  IF v_points_to_add > 0 THEN
    v_energy := v_energy + v_points_to_add;

    -- Avancer le timer du nombre de ticks consommes
    UPDATE users
    SET energy_points = v_energy,
        energy_reset_at = energy_reset_at + (v_ticks * interval '4 hours')
    WHERE id = p_user_id;
  END IF;

  -- Calculer le temps avant le prochain point
  IF v_energy >= v_max_energy THEN
    v_next_point_in := 0;
  ELSE
    -- Secondes ecoulees dans le tick courant
    v_elapsed_in_tick := v_seconds_elapsed - (v_ticks * v_cycle_seconds);
    v_next_point_in := GREATEST(0, (v_cycle_seconds - v_elapsed_in_tick)::int);
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'regenRate', v_regen_rate,
    'claimedCount', v_claimed_count,
    'nextPointIn', v_next_point_in
  );
END;
$$;

-- ============================================
-- 2. MAJ discover_place — regen inline
-- ============================================

CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy INT;
  v_updated_at TIMESTAMPTZ;
  v_user_faction_id TEXT;
  v_already BOOLEAN;
  v_claimed_count INT;
  v_regen_rate INT;
  v_seconds_elapsed FLOAT;
  v_ticks INT;
  v_points_to_add INT;
  v_max_energy INT := 5;
  v_cycle_seconds INT := 14400;
  v_next_point_in INT;
  v_elapsed_in_tick FLOAT;
BEGIN
  -- Verifier que le lieu existe
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Verifier si deja decouvert (idempotent)
  SELECT EXISTS(
    SELECT 1 FROM places_discovered
    WHERE user_id = p_user_id AND place_id = p_place_id
  ) INTO v_already;

  IF v_already THEN
    SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
    RETURN json_build_object('success', true, 'already', true, 'energy', v_energy);
  END IF;

  -- Si methode = remote, appliquer la regen puis verifier l'energie
  IF p_method = 'remote' THEN
    SELECT energy_points, energy_reset_at, faction_id
    INTO v_energy, v_updated_at, v_user_faction_id
    FROM users WHERE id = p_user_id;

    -- Regen progressive (lieux revendiques par ce joueur ET dans sa faction actuelle)
    SELECT count(*)::int INTO v_claimed_count
    FROM places
    WHERE claimed_by = p_user_id
      AND faction_id = v_user_faction_id;

    v_regen_rate := 1 + (v_claimed_count / 3);
    v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_updated_at));
    v_ticks := GREATEST(0, floor(v_seconds_elapsed / v_cycle_seconds)::int);
    v_points_to_add := LEAST(v_ticks * v_regen_rate, v_max_energy - v_energy);

    IF v_points_to_add > 0 THEN
      v_energy := v_energy + v_points_to_add;
      UPDATE users
      SET energy_points = v_energy,
          energy_reset_at = energy_reset_at + (v_ticks * interval '4 hours')
      WHERE id = p_user_id;
    END IF;

    IF v_energy < 1 THEN
      RETURN json_build_object('error', 'Not enough energy', 'energy', 0);
    END IF;

    -- Deduire 1 point (sans toucher energy_reset_at)
    UPDATE users
    SET energy_points = energy_points - 1
    WHERE id = p_user_id;
  END IF;

  -- Inserer la decouverte
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Retourner l'energie restante + infos regen
  SELECT energy_points, energy_reset_at, faction_id
  INTO v_energy, v_updated_at, v_user_faction_id
  FROM users WHERE id = p_user_id;

  SELECT count(*)::int INTO v_claimed_count
  FROM places
  WHERE claimed_by = p_user_id
    AND faction_id = v_user_faction_id;

  v_regen_rate := 1 + (v_claimed_count / 3);
  v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_updated_at));
  v_ticks := GREATEST(0, floor(v_seconds_elapsed / v_cycle_seconds)::int);

  IF v_energy >= v_max_energy THEN
    v_next_point_in := 0;
  ELSE
    v_elapsed_in_tick := v_seconds_elapsed - (v_ticks * v_cycle_seconds);
    v_next_point_in := GREATEST(0, (v_cycle_seconds - v_elapsed_in_tick)::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'energy', v_energy,
    'regenRate', v_regen_rate,
    'claimedCount', v_claimed_count,
    'nextPointIn', v_next_point_in
  );
END;
$$;
-- ============================================
-- MIGRATION 025 : Correctif regen energie
-- ============================================
-- Compter TOUS les lieux revendiques par le joueur,
-- quelle que soit sa faction actuelle.
-- L'effort personnel est recompense, pas la loyaute.
-- ============================================

-- 1. get_user_energy

CREATE OR REPLACE FUNCTION public.get_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy INT;
  v_updated_at TIMESTAMPTZ;
  v_claimed_count INT;
  v_regen_rate INT;
  v_seconds_elapsed FLOAT;
  v_ticks INT;
  v_points_to_add INT;
  v_max_energy INT := 5;
  v_cycle_seconds INT := 14400;
  v_next_point_in INT;
  v_elapsed_in_tick FLOAT;
BEGIN
  SELECT energy_points, energy_reset_at
  INTO v_energy, v_updated_at
  FROM users WHERE id = p_user_id;

  -- Tous les lieux revendiques par ce joueur (toutes factions confondues)
  SELECT count(*)::int INTO v_claimed_count
  FROM places WHERE claimed_by = p_user_id;

  v_regen_rate := 1 + (v_claimed_count / 3);
  v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_updated_at));
  v_ticks := GREATEST(0, floor(v_seconds_elapsed / v_cycle_seconds)::int);
  v_points_to_add := LEAST(v_ticks * v_regen_rate, v_max_energy - v_energy);

  IF v_points_to_add > 0 THEN
    v_energy := v_energy + v_points_to_add;
    UPDATE users
    SET energy_points = v_energy,
        energy_reset_at = energy_reset_at + (v_ticks * interval '4 hours')
    WHERE id = p_user_id;
  END IF;

  IF v_energy >= v_max_energy THEN
    v_next_point_in := 0;
  ELSE
    v_elapsed_in_tick := v_seconds_elapsed - (v_ticks * v_cycle_seconds);
    v_next_point_in := GREATEST(0, (v_cycle_seconds - v_elapsed_in_tick)::int);
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'regenRate', v_regen_rate,
    'claimedCount', v_claimed_count,
    'nextPointIn', v_next_point_in
  );
END;
$$;

-- 2. discover_place

CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy INT;
  v_updated_at TIMESTAMPTZ;
  v_already BOOLEAN;
  v_claimed_count INT;
  v_regen_rate INT;
  v_seconds_elapsed FLOAT;
  v_ticks INT;
  v_points_to_add INT;
  v_max_energy INT := 5;
  v_cycle_seconds INT := 14400;
  v_next_point_in INT;
  v_elapsed_in_tick FLOAT;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM places_discovered
    WHERE user_id = p_user_id AND place_id = p_place_id
  ) INTO v_already;

  IF v_already THEN
    SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
    RETURN json_build_object('success', true, 'already', true, 'energy', v_energy);
  END IF;

  IF p_method = 'remote' THEN
    SELECT energy_points, energy_reset_at
    INTO v_energy, v_updated_at
    FROM users WHERE id = p_user_id;

    SELECT count(*)::int INTO v_claimed_count
    FROM places WHERE claimed_by = p_user_id;

    v_regen_rate := 1 + (v_claimed_count / 3);
    v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_updated_at));
    v_ticks := GREATEST(0, floor(v_seconds_elapsed / v_cycle_seconds)::int);
    v_points_to_add := LEAST(v_ticks * v_regen_rate, v_max_energy - v_energy);

    IF v_points_to_add > 0 THEN
      v_energy := v_energy + v_points_to_add;
      UPDATE users
      SET energy_points = v_energy,
          energy_reset_at = energy_reset_at + (v_ticks * interval '4 hours')
      WHERE id = p_user_id;
    END IF;

    IF v_energy < 1 THEN
      RETURN json_build_object('error', 'Not enough energy', 'energy', 0);
    END IF;

    UPDATE users
    SET energy_points = energy_points - 1
    WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT energy_points, energy_reset_at
  INTO v_energy, v_updated_at
  FROM users WHERE id = p_user_id;

  SELECT count(*)::int INTO v_claimed_count
  FROM places WHERE claimed_by = p_user_id;

  v_regen_rate := 1 + (v_claimed_count / 3);
  v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_updated_at));
  v_ticks := GREATEST(0, floor(v_seconds_elapsed / v_cycle_seconds)::int);

  IF v_energy >= v_max_energy THEN
    v_next_point_in := 0;
  ELSE
    v_elapsed_in_tick := v_seconds_elapsed - (v_ticks * v_cycle_seconds);
    v_next_point_in := GREATEST(0, (v_cycle_seconds - v_elapsed_in_tick)::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'energy', v_energy,
    'regenRate', v_regen_rate,
    'claimedCount', v_claimed_count,
    'nextPointIn', v_next_point_in
  );
END;
$$;
-- ============================================
-- MIGRATION 026 : Activity Log (notifications)
-- ============================================
-- Table d'historique des actions de jeu.
-- Triggers automatiques sur claim et discover.
-- RPC pour recuperer l'activite recente.
-- ============================================

-- 1. Table

CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  type VARCHAR(30) NOT NULL,
  actor_id VARCHAR(255) REFERENCES users(id),
  place_id VARCHAR(255) REFERENCES places(id),
  faction_id VARCHAR(255) REFERENCES factions(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(type);

-- 2. Trigger : claim → activity_log

CREATE OR REPLACE FUNCTION log_claim_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_title TEXT;
  v_faction_title TEXT;
  v_actor_name TEXT;
BEGIN
  SELECT title INTO v_place_title FROM places WHERE id = NEW.place_id;
  SELECT title INTO v_faction_title FROM factions WHERE id = NEW.faction_id;
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.user_id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'claim',
    NEW.user_id,
    NEW.place_id,
    NEW.faction_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'factionTitle', v_faction_title,
      'actorName', v_actor_name
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_claim ON place_claims;
CREATE TRIGGER trg_log_claim
  AFTER INSERT ON place_claims
  FOR EACH ROW
  EXECUTE FUNCTION log_claim_activity();

-- 3. Trigger : discover → activity_log

CREATE OR REPLACE FUNCTION log_discover_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_title TEXT;
  v_actor_name TEXT;
BEGIN
  SELECT title INTO v_place_title FROM places WHERE id = NEW.place_id;
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'discover',
    NEW.user_id,
    NEW.place_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'actorName', v_actor_name
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_discover ON places_discovered;
CREATE TRIGGER trg_log_discover
  AFTER INSERT ON places_discovered
  FOR EACH ROW
  EXECUTE FUNCTION log_discover_activity();

-- 4. RPC : activite recente

CREATE OR REPLACE FUNCTION public.get_recent_activity(
  p_limit INT DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(t))
    FROM (
      SELECT
        a.id,
        a.type,
        a.actor_id,
        a.place_id,
        a.faction_id,
        a.data,
        a.created_at
      FROM activity_log a
      ORDER BY a.created_at DESC
      LIMIT p_limit
    ) t
  );
END;
$$;
-- ============================================
-- MIGRATION 027 : Fix claim trigger + new_user trigger
-- ============================================
-- 1. Fix log_claim_activity : NEW.claimed_by → NEW.user_id
-- 2. Trigger new_user sur INSERT users → activity_log
-- ============================================

-- 1. Fix claim trigger

CREATE OR REPLACE FUNCTION log_claim_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_title TEXT;
  v_faction_title TEXT;
  v_actor_name TEXT;
BEGIN
  SELECT title INTO v_place_title FROM places WHERE id = NEW.place_id;
  SELECT title INTO v_faction_title FROM factions WHERE id = NEW.faction_id;
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.user_id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'claim',
    NEW.user_id,
    NEW.place_id,
    NEW.faction_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'factionTitle', v_faction_title,
      'actorName', v_actor_name
    )
  );
  RETURN NEW;
END;
$$;

-- 2. Trigger : nouveau user → activity_log

CREATE OR REPLACE FUNCTION log_new_user_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_name TEXT;
BEGIN
  v_name := COALESCE(NEW.first_name, NEW.email_address);

  INSERT INTO activity_log (type, actor_id, data)
  VALUES (
    'new_user',
    NEW.id,
    jsonb_build_object('actorName', v_name)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_new_user ON users;
CREATE TRIGGER trg_log_new_user
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION log_new_user_activity();
-- ============================================
-- MIGRATION 028 : Chat Messages (La Discussion)
-- ============================================
-- Table de messages pour le chat en jeu.
-- Deux canaux : 'general' (tous) et faction_id (faction only).
-- Auto-suppression apres 14 jours via RPC.
-- ============================================

-- 1. Table
CREATE TABLE IF NOT EXISTS chat_messages (
  id            BIGSERIAL PRIMARY KEY,
  channel       VARCHAR(255) NOT NULL,       -- 'general' ou faction_id
  user_id       VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name     VARCHAR(255) NOT NULL,       -- denormalise pour perf affichage
  faction_id    VARCHAR(255) REFERENCES factions(id),
  faction_color VARCHAR(50),                 -- denormalise
  faction_pattern TEXT,                      -- URL icone faction (denormalise)
  content       TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Index pour requetes par channel + tri chrono
CREATE INDEX idx_chat_channel_created ON chat_messages(channel, created_at DESC);

-- 3. RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- SELECT general : tous les authentifies
CREATE POLICY "chat_read_general" ON chat_messages FOR SELECT
  USING (channel = 'general' AND auth.role() = 'authenticated');

-- SELECT faction : membres uniquement
CREATE POLICY "chat_read_faction" ON chat_messages FOR SELECT
  USING (
    channel != 'general'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::text
        AND faction_id = chat_messages.channel
    )
  );

-- INSERT general : authentifie, son propre user_id
CREATE POLICY "chat_insert_general" ON chat_messages FOR INSERT
  WITH CHECK (
    channel = 'general'
    AND auth.uid()::text = user_id
  );

-- INSERT faction : membre de la faction, son propre user_id
CREATE POLICY "chat_insert_faction" ON chat_messages FOR INSERT
  WITH CHECK (
    channel != 'general'
    AND auth.uid()::text = user_id
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::text
        AND faction_id = channel
    )
  );

-- 4. Activer Realtime sur cette table
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- 5. Nettoyage des messages > 14 jours (appele periodiquement)
CREATE OR REPLACE FUNCTION public.cleanup_old_chat_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM chat_messages
  WHERE created_at < NOW() - INTERVAL '14 days';
END;
$$;
-- Ajouter la colonne faction_pattern pour l'icone de faction dans le chat
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS faction_pattern TEXT;
-- ============================================
-- MIGRATION 030 : Fix handle_new_user trigger
-- ============================================
-- Problème : si un email existe déjà dans public.users (créé via Hub)
-- mais pas dans auth.users, le trigger échoue car il essaie d'INSERT
-- avec un nouvel ID alors que l'email existe déjà.
-- Fix : d'abord chercher par email, mettre à jour l'ID si trouvé,
-- sinon insérer normalement.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id TEXT;
BEGIN
  -- Chercher si un user avec cet email existe déjà
  SELECT id INTO v_existing_id
  FROM public.users
  WHERE email_address = COALESCE(NEW.email, '')
  LIMIT 1;

  IF v_existing_id IS NOT NULL AND v_existing_id != NEW.id::TEXT THEN
    -- L'email existe avec un autre ID : mettre à jour l'ID pour matcher auth
    UPDATE public.users
    SET id = NEW.id::TEXT,
        updated_at = NOW()
    WHERE id = v_existing_id;
  ELSE
    -- Pas de doublon : insert normal avec ON CONFLICT sur id
    INSERT INTO public.users (
      id,
      email_address,
      last_name,
      gender,
      rank,
      role,
      bio,
      created_at,
      updated_at
    ) VALUES (
      NEW.id::TEXT,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'Aventurier'),
      COALESCE(NEW.raw_user_meta_data->>'gender', 'unknown'),
      'guest',
      'user',
      '',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email_address = COALESCE(EXCLUDED.email_address, public.users.email_address),
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;
-- ============================================
-- MIGRATION 031 : Realtime Activity + Faction Discovery Cost
-- ============================================
-- 1. Activer Realtime sur activity_log (pour toasts temps réel)
-- 2. Changer energy_points en NUMERIC pour supporter coût 0.5
-- 3. Modifier discover_place pour coût dynamique (0.5 si faction alliée)
-- 4. Modifier get_user_energy pour retourner NUMERIC
-- ============================================

-- 1. Realtime sur activity_log (idempotent)

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_log' AND policyname = 'activity_read') THEN
    CREATE POLICY "activity_read" ON activity_log FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Energy en NUMERIC

ALTER TABLE users ALTER COLUMN energy_points TYPE NUMERIC(4,1);

-- 3. get_user_energy (retourne NUMERIC)

CREATE OR REPLACE FUNCTION public.get_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy NUMERIC(4,1);
  v_updated_at TIMESTAMPTZ;
  v_claimed_count INT;
  v_regen_rate INT;
  v_seconds_elapsed FLOAT;
  v_ticks INT;
  v_points_to_add NUMERIC(4,1);
  v_max_energy NUMERIC(4,1) := 5.0;
  v_cycle_seconds INT := 14400;
  v_next_point_in INT;
  v_elapsed_in_tick FLOAT;
BEGIN
  SELECT energy_points, energy_reset_at
  INTO v_energy, v_updated_at
  FROM users WHERE id = p_user_id;

  SELECT count(*)::int INTO v_claimed_count
  FROM places WHERE claimed_by = p_user_id;

  v_regen_rate := 1 + (v_claimed_count / 3);
  v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_updated_at));
  v_ticks := GREATEST(0, floor(v_seconds_elapsed / v_cycle_seconds)::int);
  v_points_to_add := LEAST(v_ticks * v_regen_rate, v_max_energy - v_energy);

  IF v_points_to_add > 0 THEN
    v_energy := v_energy + v_points_to_add;
    UPDATE users
    SET energy_points = v_energy,
        energy_reset_at = energy_reset_at + (v_ticks * interval '4 hours')
    WHERE id = p_user_id;
  END IF;

  IF v_energy >= v_max_energy THEN
    v_next_point_in := 0;
  ELSE
    v_elapsed_in_tick := v_seconds_elapsed - (v_ticks * v_cycle_seconds);
    v_next_point_in := GREATEST(0, (v_cycle_seconds - v_elapsed_in_tick)::int);
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'regenRate', v_regen_rate,
    'claimedCount', v_claimed_count,
    'nextPointIn', v_next_point_in
  );
END;
$$;

-- 4. discover_place avec coût dynamique

CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy NUMERIC(4,1);
  v_updated_at TIMESTAMPTZ;
  v_already BOOLEAN;
  v_claimed_count INT;
  v_regen_rate INT;
  v_seconds_elapsed FLOAT;
  v_ticks INT;
  v_points_to_add NUMERIC(4,1);
  v_max_energy NUMERIC(4,1) := 5.0;
  v_cycle_seconds INT := 14400;
  v_next_point_in INT;
  v_elapsed_in_tick FLOAT;
  v_cost NUMERIC(4,1);
  v_place_faction VARCHAR(255);
  v_user_faction VARCHAR(255);
BEGIN
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM places_discovered
    WHERE user_id = p_user_id AND place_id = p_place_id
  ) INTO v_already;

  IF v_already THEN
    SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
    RETURN json_build_object('success', true, 'already', true, 'energy', v_energy);
  END IF;

  IF p_method = 'remote' THEN
    -- Déterminer le coût : 0.5 si le lieu appartient à la faction du joueur, 1 sinon
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_place_id;
    SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

    IF v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
      v_cost := 0.5;
    ELSE
      v_cost := 1.0;
    END IF;

    SELECT energy_points, energy_reset_at
    INTO v_energy, v_updated_at
    FROM users WHERE id = p_user_id;

    SELECT count(*)::int INTO v_claimed_count
    FROM places WHERE claimed_by = p_user_id;

    v_regen_rate := 1 + (v_claimed_count / 3);
    v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_updated_at));
    v_ticks := GREATEST(0, floor(v_seconds_elapsed / v_cycle_seconds)::int);
    v_points_to_add := LEAST(v_ticks * v_regen_rate, v_max_energy - v_energy);

    IF v_points_to_add > 0 THEN
      v_energy := v_energy + v_points_to_add;
      UPDATE users
      SET energy_points = v_energy,
          energy_reset_at = energy_reset_at + (v_ticks * interval '4 hours')
      WHERE id = p_user_id;
    END IF;

    IF v_energy < v_cost THEN
      RETURN json_build_object('error', 'Not enough energy', 'energy', v_energy);
    END IF;

    UPDATE users
    SET energy_points = energy_points - v_cost
    WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT energy_points, energy_reset_at
  INTO v_energy, v_updated_at
  FROM users WHERE id = p_user_id;

  SELECT count(*)::int INTO v_claimed_count
  FROM places WHERE claimed_by = p_user_id;

  v_regen_rate := 1 + (v_claimed_count / 3);
  v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_updated_at));
  v_ticks := GREATEST(0, floor(v_seconds_elapsed / v_cycle_seconds)::int);

  IF v_energy >= v_max_energy THEN
    v_next_point_in := 0;
  ELSE
    v_elapsed_in_tick := v_seconds_elapsed - (v_ticks * v_cycle_seconds);
    v_next_point_in := GREATEST(0, (v_cycle_seconds - v_elapsed_in_tick)::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'energy', v_energy,
    'regenRate', v_regen_rate,
    'claimedCount', v_claimed_count,
    'nextPointIn', v_next_point_in
  );
END;
$$;

-- 5. Backfill : tout lieu revendiqué par un user doit être marqué comme découvert
-- (corrige les claims faits avant l'introduction du fog personnel)

INSERT INTO places_discovered (user_id, place_id, method, discovered_at)
SELECT p.claimed_by, p.id, 'backfill', p.claimed_at
FROM places p
WHERE p.claimed_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM places_discovered pd
    WHERE pd.user_id = p.claimed_by AND pd.place_id = p.id
  );
-- ============================================
-- MIGRATION 032 : Fix claimedByName fallback
-- ============================================
-- claimer.last_name → COALESCE(first_name, email_address)
-- On n'utilise JAMAIS last_name (résidu des anciens comptes)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_map_places(
  p_type TEXT DEFAULT 'all',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_latitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_longitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', COALESCE(claimer.first_name, claimer.email_address),
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id, f.id, claimer.first_name, claimer.email_address, lk.likes_count, vw.views_count, ex.explored_count
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'latest' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', COALESCE(claimer.first_name, claimer.email_address),
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;

  ELSE
    -- type = 'all' avec viewport optionnel
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', COALESCE(claimer.first_name, claimer.email_address),
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
        AND (
          p_latitude IS NULL
          OR (
            p.latitude >= (p_latitude - p_latitude_delta)
            AND p.latitude <= (p_latitude + p_latitude_delta)
            AND p.longitude >= (p_longitude - p_longitude_delta)
            AND p.longitude <= (p_longitude + p_longitude_delta)
          )
        )
      ORDER BY p.created_at
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
-- ============================================
-- MIGRATION 033 : Ajouter coordonnées aux triggers activity_log
-- ============================================
-- Pour permettre le clic sur un toast → fly to sur la carte
-- ============================================

-- 1. Trigger claim : ajouter latitude/longitude

CREATE OR REPLACE FUNCTION log_claim_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_title TEXT;
  v_place_lat DOUBLE PRECISION;
  v_place_lng DOUBLE PRECISION;
  v_faction_title TEXT;
  v_actor_name TEXT;
BEGIN
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = NEW.place_id;
  SELECT title INTO v_faction_title FROM factions WHERE id = NEW.faction_id;
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.user_id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'claim',
    NEW.user_id,
    NEW.place_id,
    NEW.faction_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'factionTitle', v_faction_title,
      'actorName', v_actor_name
    )
  );
  RETURN NEW;
END;
$$;

-- 2. Trigger discover : ajouter latitude/longitude

CREATE OR REPLACE FUNCTION log_discover_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_title TEXT;
  v_place_lat DOUBLE PRECISION;
  v_place_lng DOUBLE PRECISION;
  v_actor_name TEXT;
BEGIN
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = NEW.place_id;
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'discover',
    NEW.user_id,
    NEW.place_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name
    )
  );
  RETURN NEW;
END;
$$;
-- ============================================
-- MIGRATION 034 : RPCs like/unlike place
-- ============================================

-- S'assurer que la contrainte unique existe (nettoyer doublons avant si besoin)
DELETE FROM places_liked
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM places_liked
  GROUP BY user_id, place_id
);
ALTER TABLE places_liked
  DROP CONSTRAINT IF EXISTS places_liked_user_id_place_id_key;
ALTER TABLE places_liked
  ADD CONSTRAINT places_liked_user_id_place_id_key UNIQUE (user_id, place_id);

CREATE OR REPLACE FUNCTION public.like_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO places_liked (id, user_id, place_id, created_at, updated_at)
  VALUES (p_user_id || '_' || p_place_id, p_user_id, p_place_id, NOW(), NOW())
  ON CONFLICT (user_id, place_id) DO NOTHING;
  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.unlike_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM places_liked
  WHERE user_id = p_user_id AND place_id = p_place_id;
  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.like_place TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlike_place TO authenticated;
-- ============================================
-- MIGRATION 035 : Trigger like → activity_log
-- ============================================

CREATE OR REPLACE FUNCTION log_like_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_title TEXT;
  v_place_lat DOUBLE PRECISION;
  v_place_lng DOUBLE PRECISION;
  v_actor_name TEXT;
BEGIN
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = NEW.place_id;
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'like',
    NEW.user_id,
    NEW.place_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_like ON places_liked;
CREATE TRIGGER trg_log_like
  AFTER INSERT ON places_liked
  FOR EACH ROW
  EXECUTE FUNCTION log_like_activity();
-- ============================================
-- MIGRATION 036 : RPC profil joueur public
-- ============================================

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_avatar_url TEXT;
BEGIN
  -- Récupérer l'avatar via image_media (même logique que get_my_informations)
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_avatar_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = p_user_id;

  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', v_avatar_url,
    'discoveredCount', (SELECT COUNT(*) FROM places_discovered pd WHERE pd.user_id = u.id),
    'claimedCount', (SELECT COUNT(DISTINCT pc.place_id) FROM place_claims pc WHERE pc.user_id = u.id),
    'likesCount', (SELECT COUNT(*) FROM places_liked pl WHERE pl.user_id = u.id),
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile TO authenticated;
-- ============================================
-- MIGRATION 037 : Ajouter couleur/pattern faction au trigger claim
-- ============================================
-- Pour permettre la mise à jour temps réel des territoires

CREATE OR REPLACE FUNCTION log_claim_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_title TEXT;
  v_place_lat DOUBLE PRECISION;
  v_place_lng DOUBLE PRECISION;
  v_faction_title TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_actor_name TEXT;
BEGIN
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = NEW.place_id;
  SELECT title, color, pattern INTO v_faction_title, v_faction_color, v_faction_pattern
  FROM factions WHERE id = NEW.faction_id;
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.user_id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'claim',
    NEW.user_id,
    NEW.place_id,
    NEW.faction_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'factionTitle', v_faction_title,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'actorName', v_actor_name
    )
  );
  RETURN NEW;
END;
$$;
-- ============================================
-- MIGRATION 038 : Système multi-ressources
-- ============================================
-- Ajoute Points de Conquête et Points de Construction
-- Les tags définissent les récompenses par lieu
-- ============================================

-- 1. Nouvelles colonnes users
ALTER TABLE users ADD COLUMN IF NOT EXISTS conquest_points NUMERIC(6,1) NOT NULL DEFAULT 5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS construction_points NUMERIC(6,1) NOT NULL DEFAULT 5;

-- 2. Colonnes récompenses sur tags
ALTER TABLE tags ADD COLUMN IF NOT EXISTS reward_energy INT NOT NULL DEFAULT 0;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS reward_conquest INT NOT NULL DEFAULT 0;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS reward_construction INT NOT NULL DEFAULT 0;

-- ============================================
-- 3. get_user_energy — retourne aussi conquête + construction
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy NUMERIC(4,1);
  v_updated_at TIMESTAMPTZ;
  v_claimed_count INT;
  v_regen_rate INT;
  v_seconds_elapsed FLOAT;
  v_ticks INT;
  v_points_to_add NUMERIC(4,1);
  v_max_energy NUMERIC(4,1) := 5.0;
  v_cycle_seconds INT := 14400;
  v_next_point_in INT;
  v_elapsed_in_tick FLOAT;
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
BEGIN
  SELECT energy_points, energy_reset_at, conquest_points, construction_points
  INTO v_energy, v_updated_at, v_conquest, v_construction
  FROM users WHERE id = p_user_id;

  SELECT count(*)::int INTO v_claimed_count
  FROM places WHERE claimed_by = p_user_id;

  v_regen_rate := 1 + (v_claimed_count / 3);
  v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_updated_at));
  v_ticks := GREATEST(0, floor(v_seconds_elapsed / v_cycle_seconds)::int);
  v_points_to_add := LEAST(v_ticks * v_regen_rate, v_max_energy - v_energy);

  IF v_points_to_add > 0 THEN
    v_energy := v_energy + v_points_to_add;
    UPDATE users
    SET energy_points = v_energy,
        energy_reset_at = energy_reset_at + (v_ticks * interval '4 hours')
    WHERE id = p_user_id;
  END IF;

  IF v_energy >= v_max_energy THEN
    v_next_point_in := 0;
  ELSE
    v_elapsed_in_tick := v_seconds_elapsed - (v_ticks * v_cycle_seconds);
    v_next_point_in := GREATEST(0, (v_cycle_seconds - v_elapsed_in_tick)::int);
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'regenRate', v_regen_rate,
    'claimedCount', v_claimed_count,
    'nextPointIn', v_next_point_in,
    'conquestPoints', COALESCE(v_conquest, 0),
    'constructionPoints', COALESCE(v_construction, 0)
  );
END;
$$;

-- ============================================
-- 4. discover_place — récompenses par tag après découverte
-- ============================================

CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy NUMERIC(4,1);
  v_updated_at TIMESTAMPTZ;
  v_already BOOLEAN;
  v_claimed_count INT;
  v_regen_rate INT;
  v_seconds_elapsed FLOAT;
  v_ticks INT;
  v_points_to_add NUMERIC(4,1);
  v_max_energy NUMERIC(4,1) := 5.0;
  v_cycle_seconds INT := 14400;
  v_next_point_in INT;
  v_elapsed_in_tick FLOAT;
  v_cost NUMERIC(4,1);
  v_place_faction VARCHAR(255);
  v_user_faction VARCHAR(255);
  v_reward_energy INT;
  v_reward_conquest INT;
  v_reward_construction INT;
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
BEGIN
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM places_discovered
    WHERE user_id = p_user_id AND place_id = p_place_id
  ) INTO v_already;

  IF v_already THEN
    SELECT energy_points, conquest_points, construction_points
    INTO v_energy, v_conquest, v_construction
    FROM users WHERE id = p_user_id;
    RETURN json_build_object(
      'success', true, 'already', true,
      'energy', v_energy,
      'conquestPoints', v_conquest,
      'constructionPoints', v_construction
    );
  END IF;

  IF p_method = 'remote' THEN
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_place_id;
    SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

    IF v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
      v_cost := 0.5;
    ELSE
      v_cost := 1.0;
    END IF;

    SELECT energy_points, energy_reset_at
    INTO v_energy, v_updated_at
    FROM users WHERE id = p_user_id;

    SELECT count(*)::int INTO v_claimed_count
    FROM places WHERE claimed_by = p_user_id;

    v_regen_rate := 1 + (v_claimed_count / 3);
    v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_updated_at));
    v_ticks := GREATEST(0, floor(v_seconds_elapsed / v_cycle_seconds)::int);
    v_points_to_add := LEAST(v_ticks * v_regen_rate, v_max_energy - v_energy);

    IF v_points_to_add > 0 THEN
      v_energy := v_energy + v_points_to_add;
      UPDATE users
      SET energy_points = v_energy,
          energy_reset_at = energy_reset_at + (v_ticks * interval '4 hours')
      WHERE id = p_user_id;
    END IF;

    IF v_energy < v_cost THEN
      RETURN json_build_object('error', 'Not enough energy', 'energy', v_energy);
    END IF;

    UPDATE users
    SET energy_points = energy_points - v_cost
    WHERE id = p_user_id;
  END IF;

  -- Insérer la découverte
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Récompenses basées sur le tag primaire du lieu
  SELECT t.reward_energy, t.reward_conquest, t.reward_construction
  INTO v_reward_energy, v_reward_conquest, v_reward_construction
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE
  LIMIT 1;

  v_reward_energy := COALESCE(v_reward_energy, 0);
  v_reward_conquest := COALESCE(v_reward_conquest, 0);
  v_reward_construction := COALESCE(v_reward_construction, 0);

  IF v_reward_energy > 0 OR v_reward_conquest > 0 OR v_reward_construction > 0 THEN
    UPDATE users
    SET energy_points = LEAST(energy_points + v_reward_energy, v_max_energy),
        conquest_points = conquest_points + v_reward_conquest,
        construction_points = construction_points + v_reward_construction
    WHERE id = p_user_id;
  END IF;

  -- Récupérer l'état final
  SELECT energy_points, energy_reset_at, conquest_points, construction_points
  INTO v_energy, v_updated_at, v_conquest, v_construction
  FROM users WHERE id = p_user_id;

  SELECT count(*)::int INTO v_claimed_count
  FROM places WHERE claimed_by = p_user_id;

  v_regen_rate := 1 + (v_claimed_count / 3);
  v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_updated_at));
  v_ticks := GREATEST(0, floor(v_seconds_elapsed / v_cycle_seconds)::int);

  IF v_energy >= v_max_energy THEN
    v_next_point_in := 0;
  ELSE
    v_elapsed_in_tick := v_seconds_elapsed - (v_ticks * v_cycle_seconds);
    v_next_point_in := GREATEST(0, (v_cycle_seconds - v_elapsed_in_tick)::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'energy', v_energy,
    'regenRate', v_regen_rate,
    'claimedCount', v_claimed_count,
    'nextPointIn', v_next_point_in,
    'conquestPoints', v_conquest,
    'constructionPoints', v_construction,
    'rewards', json_build_object(
      'energy', v_reward_energy,
      'conquest', v_reward_conquest,
      'construction', v_reward_construction
    )
  );
END;
$$;

-- ============================================
-- 5. claim_place — coût conquête + récompenses tag
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_claim_cost NUMERIC(6,1) := 1.0;
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_energy NUMERIC(4,1);
  v_reward_energy INT;
  v_reward_conquest INT;
  v_reward_construction INT;
BEGIN
  -- Récupérer la faction du user
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Vérifier les points de conquête
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest
    );
  END IF;

  -- Vérifier que le lieu existe
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Revendiquer le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Historique
  INSERT INTO place_claims (place_id, user_id, faction_id)
  VALUES (p_place_id, p_user_id, v_faction_id);

  -- Déduire le coût de conquête
  UPDATE users
  SET conquest_points = conquest_points - v_claim_cost
  WHERE id = p_user_id;

  -- Récompenses basées sur le tag primaire
  SELECT t.reward_energy, t.reward_conquest, t.reward_construction
  INTO v_reward_energy, v_reward_conquest, v_reward_construction
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE
  LIMIT 1;

  v_reward_energy := COALESCE(v_reward_energy, 0);
  v_reward_conquest := COALESCE(v_reward_conquest, 0);
  v_reward_construction := COALESCE(v_reward_construction, 0);

  IF v_reward_energy > 0 OR v_reward_conquest > 0 OR v_reward_construction > 0 THEN
    UPDATE users
    SET energy_points = LEAST(energy_points + v_reward_energy, 5.0),
        conquest_points = conquest_points + v_reward_conquest,
        construction_points = construction_points + v_reward_construction
    WHERE id = p_user_id;
  END IF;

  -- Récupérer l'état final
  SELECT energy_points, conquest_points, construction_points
  INTO v_energy, v_conquest, v_construction
  FROM users WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id,
    'energy', v_energy,
    'conquestPoints', v_conquest,
    'constructionPoints', v_construction,
    'rewards', json_build_object(
      'energy', v_reward_energy,
      'conquest', v_reward_conquest,
      'construction', v_reward_construction
    ),
    'claimCost', v_claim_cost
  );
END;
$$;
-- ============================================
-- MIGRATION 039 : Régénération des 3 ressources
-- ============================================
-- Énergie :     +0.5/h → 12 pts/jour (cycle 7200s, taux fixe 1)
-- Conquête :    +0.25/h → 6 pts/jour (cycle 14400s, taux fixe 1)
-- Construction : +0.25/h → 6 pts/jour (cycle 14400s, taux fixe 1)
-- Cap : 5 max pour les 3
-- ============================================

-- 1. Colonnes regen timestamps
ALTER TABLE users ADD COLUMN IF NOT EXISTS conquest_reset_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS construction_reset_at TIMESTAMPTZ DEFAULT NOW();

-- 1b. Remonter les utilisateurs existants à 5/5
UPDATE users SET conquest_points = 5 WHERE conquest_points < 5;
UPDATE users SET construction_points = 5 WHERE construction_points < 5;

-- ============================================
-- 2. get_user_energy — regen des 3 ressources
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Énergie (+0.5/h → 1 pt toutes les 7200s)
  v_energy NUMERIC(4,1);
  v_energy_reset_at TIMESTAMPTZ;
  v_max_energy NUMERIC(4,1) := 5.0;
  v_energy_cycle INT := 7200;
  v_energy_elapsed FLOAT;
  v_energy_ticks INT;
  v_energy_add NUMERIC(4,1);
  v_energy_next_in INT;
  -- Conquête (+0.25/h → 1 pt toutes les 14400s)
  v_conquest NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_max_conquest NUMERIC(6,1) := 5.0;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_add NUMERIC(6,1);
  v_conquest_next_in INT;
  -- Construction (+0.25/h → 1 pt toutes les 14400s)
  v_construction NUMERIC(6,1);
  v_construction_reset_at TIMESTAMPTZ;
  v_max_construction NUMERIC(6,1) := 5.0;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_add NUMERIC(6,1);
  v_construction_next_in INT;
BEGIN
  SELECT energy_points, energy_reset_at,
         conquest_points, conquest_reset_at,
         construction_points, construction_reset_at
  INTO v_energy, v_energy_reset_at,
       v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at
  FROM users WHERE id = p_user_id;

  -- ---- ÉNERGIE (cycle 7200s, taux fixe 1) ----
  v_energy_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset_at));
  v_energy_ticks := GREATEST(0, floor(v_energy_elapsed / v_energy_cycle)::int);
  v_energy_add := LEAST(v_energy_ticks * 1, v_max_energy - v_energy);

  IF v_energy_add > 0 THEN
    v_energy := v_energy + v_energy_add;
    UPDATE users
    SET energy_points = v_energy,
        energy_reset_at = energy_reset_at + make_interval(secs := v_energy_ticks * v_energy_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_energy >= v_max_energy THEN
    v_energy_next_in := 0;
  ELSE
    v_energy_next_in := GREATEST(0, (v_energy_cycle - (v_energy_elapsed - v_energy_ticks * v_energy_cycle))::int);
  END IF;

  -- ---- CONQUÊTE (cycle 14400s, taux fixe 1) ----
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  v_conquest_add := LEAST(v_conquest_ticks * 1, v_max_conquest - v_conquest);

  IF v_conquest_add > 0 THEN
    v_conquest := v_conquest + v_conquest_add;
    UPDATE users
    SET conquest_points = v_conquest,
        conquest_reset_at = conquest_reset_at + make_interval(secs := v_conquest_ticks * v_conquest_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- ---- CONSTRUCTION (cycle 14400s, taux fixe 1) ----
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  v_construction_add := LEAST(v_construction_ticks * 1, v_max_construction - v_construction);

  IF v_construction_add > 0 THEN
    v_construction := v_construction + v_construction_add;
    UPDATE users
    SET construction_points = v_construction,
        construction_reset_at = construction_reset_at + make_interval(secs := v_construction_ticks * v_construction_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'nextPointIn', v_energy_next_in,
    'conquestPoints', COALESCE(v_conquest, 0),
    'maxConquest', v_max_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', COALESCE(v_construction, 0),
    'maxConstruction', v_max_construction,
    'constructionNextPointIn', v_construction_next_in
  );
END;
$$;

-- ============================================
-- 3. discover_place — énergie cycle 7200s, taux fixe
-- ============================================

CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy NUMERIC(4,1);
  v_energy_reset_at TIMESTAMPTZ;
  v_already BOOLEAN;
  v_max_energy NUMERIC(4,1) := 5.0;
  v_energy_cycle INT := 7200;
  v_energy_elapsed FLOAT;
  v_energy_ticks INT;
  v_energy_add NUMERIC(4,1);
  v_energy_next_in INT;
  v_cost NUMERIC(4,1);
  v_place_faction VARCHAR(255);
  v_user_faction VARCHAR(255);
  v_reward_energy INT;
  v_reward_conquest INT;
  v_reward_construction INT;
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1) := 5.0;
  v_max_construction NUMERIC(6,1) := 5.0;
  -- Conquest regen
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  -- Construction regen
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM places_discovered
    WHERE user_id = p_user_id AND place_id = p_place_id
  ) INTO v_already;

  IF v_already THEN
    SELECT energy_points, conquest_points, construction_points
    INTO v_energy, v_conquest, v_construction
    FROM users WHERE id = p_user_id;
    RETURN json_build_object(
      'success', true, 'already', true,
      'energy', v_energy,
      'conquestPoints', v_conquest,
      'constructionPoints', v_construction
    );
  END IF;

  IF p_method = 'remote' THEN
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_place_id;
    SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

    IF v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
      v_cost := 0.5;
    ELSE
      v_cost := 1.0;
    END IF;

    SELECT energy_points, energy_reset_at
    INTO v_energy, v_energy_reset_at
    FROM users WHERE id = p_user_id;

    -- Regen énergie avant de vérifier le coût
    v_energy_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset_at));
    v_energy_ticks := GREATEST(0, floor(v_energy_elapsed / v_energy_cycle)::int);
    v_energy_add := LEAST(v_energy_ticks * 1, v_max_energy - v_energy);

    IF v_energy_add > 0 THEN
      v_energy := v_energy + v_energy_add;
      UPDATE users
      SET energy_points = v_energy,
          energy_reset_at = energy_reset_at + make_interval(secs := v_energy_ticks * v_energy_cycle)
      WHERE id = p_user_id;
    END IF;

    IF v_energy < v_cost THEN
      RETURN json_build_object('error', 'Not enough energy', 'energy', v_energy);
    END IF;

    UPDATE users
    SET energy_points = energy_points - v_cost
    WHERE id = p_user_id;
  END IF;

  -- Insérer la découverte
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Récompenses basées sur le tag primaire du lieu
  SELECT t.reward_energy, t.reward_conquest, t.reward_construction
  INTO v_reward_energy, v_reward_conquest, v_reward_construction
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE
  LIMIT 1;

  v_reward_energy := COALESCE(v_reward_energy, 0);
  v_reward_conquest := COALESCE(v_reward_conquest, 0);
  v_reward_construction := COALESCE(v_reward_construction, 0);

  IF v_reward_energy > 0 OR v_reward_conquest > 0 OR v_reward_construction > 0 THEN
    UPDATE users
    SET energy_points = LEAST(energy_points + v_reward_energy, v_max_energy),
        conquest_points = LEAST(conquest_points + v_reward_conquest, v_max_conquest),
        construction_points = LEAST(construction_points + v_reward_construction, v_max_construction)
    WHERE id = p_user_id;
  END IF;

  -- Récupérer l'état final
  SELECT energy_points, energy_reset_at,
         conquest_points, conquest_reset_at,
         construction_points, construction_reset_at
  INTO v_energy, v_energy_reset_at,
       v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at
  FROM users WHERE id = p_user_id;

  -- Energy next point
  v_energy_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset_at));
  v_energy_ticks := GREATEST(0, floor(v_energy_elapsed / v_energy_cycle)::int);
  IF v_energy >= v_max_energy THEN
    v_energy_next_in := 0;
  ELSE
    v_energy_next_in := GREATEST(0, (v_energy_cycle - (v_energy_elapsed - v_energy_ticks * v_energy_cycle))::int);
  END IF;

  -- Conquest next point
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- Construction next point
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'energy', v_energy,
    'nextPointIn', v_energy_next_in,
    'conquestPoints', v_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'rewards', json_build_object(
      'energy', v_reward_energy,
      'conquest', v_reward_conquest,
      'construction', v_reward_construction
    )
  );
END;
$$;

-- ============================================
-- 4. claim_place — conquête cycle 14400s
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_claim_cost NUMERIC(6,1) := 1.0;
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_energy NUMERIC(4,1);
  v_reward_energy INT;
  v_reward_conquest INT;
  v_reward_construction INT;
  v_max_conquest NUMERIC(6,1) := 5.0;
  v_max_construction NUMERIC(6,1) := 5.0;
  -- Conquest regen
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  -- Construction regen
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
BEGIN
  -- Récupérer la faction du user
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Vérifier les points de conquête
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest
    );
  END IF;

  -- Vérifier que le lieu existe
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Revendiquer le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Historique
  INSERT INTO place_claims (place_id, user_id, faction_id)
  VALUES (p_place_id, p_user_id, v_faction_id);

  -- Déduire le coût de conquête
  UPDATE users
  SET conquest_points = conquest_points - v_claim_cost
  WHERE id = p_user_id;

  -- Récompenses basées sur le tag primaire
  SELECT t.reward_energy, t.reward_conquest, t.reward_construction
  INTO v_reward_energy, v_reward_conquest, v_reward_construction
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE
  LIMIT 1;

  v_reward_energy := COALESCE(v_reward_energy, 0);
  v_reward_conquest := COALESCE(v_reward_conquest, 0);
  v_reward_construction := COALESCE(v_reward_construction, 0);

  IF v_reward_energy > 0 OR v_reward_conquest > 0 OR v_reward_construction > 0 THEN
    UPDATE users
    SET energy_points = LEAST(energy_points + v_reward_energy, 5.0),
        conquest_points = LEAST(conquest_points + v_reward_conquest, v_max_conquest),
        construction_points = LEAST(construction_points + v_reward_construction, v_max_construction)
    WHERE id = p_user_id;
  END IF;

  -- Récupérer l'état final
  SELECT energy_points, conquest_points, conquest_reset_at,
         construction_points, construction_reset_at
  INTO v_energy, v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at
  FROM users WHERE id = p_user_id;

  -- Conquest next point
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- Construction next point
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id,
    'energy', v_energy,
    'conquestPoints', v_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'rewards', json_build_object(
      'energy', v_reward_energy,
      'conquest', v_reward_conquest,
      'construction', v_reward_construction
    ),
    'claimCost', v_claim_cost
  );
END;
$$;
-- ============================================
-- MIGRATION 040 : Systeme de Fortification
-- ============================================
-- Les joueurs depensent des pts de Construction
-- pour fortifier les lieux de leur faction.
-- Chaque niveau augmente le cout de conquete de +1.
-- ============================================
-- Niveau 0 : — (default)         | claim cost 1
-- Niveau 1 : Tour de guet   (1)  | claim cost 2
-- Niveau 2 : Tour de defense (2) | claim cost 3
-- Niveau 3 : Bastion         (3) | claim cost 4
-- Niveau 4 : Befroi          (5) | claim cost 5
-- ============================================

-- 1. Schema
ALTER TABLE places ADD COLUMN IF NOT EXISTS fortification_level INT NOT NULL DEFAULT 0;

-- ============================================
-- 2. fortify_place — depenser construction pour fortifier
-- ============================================

CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_cost INT;
  v_costs INT[] := ARRAY[1, 2, 3, 5];
  v_names TEXT[] := ARRAY['Tour de guet', 'Tour de défense', 'Bastion', 'Béfroi'];
  v_construction NUMERIC(6,1);
  v_max_construction NUMERIC(6,1) := 5.0;
  -- Construction regen (pour retourner nextPointIn)
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
BEGIN
  -- Verifier faction du user
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe et est revendique par la faction du user
  SELECT faction_id, fortification_level
  INTO v_place_faction, v_current_level
  FROM places WHERE id = p_place_id;

  IF v_place_faction IS NULL THEN
    RETURN json_build_object('error', 'Place not claimed');
  END IF;

  IF v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'Not your faction territory');
  END IF;

  IF v_current_level >= 4 THEN
    RETURN json_build_object('error', 'Max fortification reached');
  END IF;

  -- Cout du prochain niveau
  v_cost := v_costs[v_current_level + 1];

  -- Verifier les points de construction
  SELECT construction_points INTO v_construction FROM users WHERE id = p_user_id;
  IF v_construction < v_cost THEN
    RETURN json_build_object(
      'error', 'Not enough construction points',
      'constructionPoints', v_construction,
      'cost', v_cost
    );
  END IF;

  -- Deduire les points
  UPDATE users
  SET construction_points = construction_points - v_cost
  WHERE id = p_user_id;

  -- Incrementer le niveau
  UPDATE places
  SET fortification_level = v_current_level + 1,
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Recuperer l'etat final
  SELECT construction_points, construction_reset_at
  INTO v_construction, v_construction_reset_at
  FROM users WHERE id = p_user_id;

  -- Construction next point
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'fortificationLevel', v_current_level + 1,
    'fortificationName', v_names[v_current_level + 1],
    'cost', v_cost
  );
END;
$$;

-- ============================================
-- 3. claim_place — cout dynamique + reset fortification
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_fortification INT;
  v_claim_cost NUMERIC(6,1);
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_energy NUMERIC(4,1);
  v_reward_energy INT;
  v_reward_conquest INT;
  v_reward_construction INT;
  v_max_conquest NUMERIC(6,1) := 5.0;
  v_max_construction NUMERIC(6,1) := 5.0;
  -- Conquest regen
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  -- Construction regen
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
BEGIN
  -- Recuperer la faction du user
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe + lire fortification
  SELECT fortification_level INTO v_fortification
  FROM places WHERE id = p_place_id;

  IF v_fortification IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Cout dynamique : 1 + niveau de fortification
  v_claim_cost := 1 + COALESCE(v_fortification, 0);

  -- Verifier les points de conquete
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost
    );
  END IF;

  -- Revendiquer le lieu + reset fortification
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = 0,
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Historique
  INSERT INTO place_claims (place_id, user_id, faction_id)
  VALUES (p_place_id, p_user_id, v_faction_id);

  -- Deduire le cout de conquete
  UPDATE users
  SET conquest_points = conquest_points - v_claim_cost
  WHERE id = p_user_id;

  -- Recompenses basees sur le tag primaire
  SELECT t.reward_energy, t.reward_conquest, t.reward_construction
  INTO v_reward_energy, v_reward_conquest, v_reward_construction
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE
  LIMIT 1;

  v_reward_energy := COALESCE(v_reward_energy, 0);
  v_reward_conquest := COALESCE(v_reward_conquest, 0);
  v_reward_construction := COALESCE(v_reward_construction, 0);

  IF v_reward_energy > 0 OR v_reward_conquest > 0 OR v_reward_construction > 0 THEN
    UPDATE users
    SET energy_points = LEAST(energy_points + v_reward_energy, 5.0),
        conquest_points = LEAST(conquest_points + v_reward_conquest, v_max_conquest),
        construction_points = LEAST(construction_points + v_reward_construction, v_max_construction)
    WHERE id = p_user_id;
  END IF;

  -- Recuperer l'etat final
  SELECT energy_points, conquest_points, conquest_reset_at,
         construction_points, construction_reset_at
  INTO v_energy, v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at
  FROM users WHERE id = p_user_id;

  -- Conquest next point
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- Construction next point
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id,
    'energy', v_energy,
    'conquestPoints', v_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'fortificationLevel', 0,
    'rewards', json_build_object(
      'energy', v_reward_energy,
      'conquest', v_reward_conquest,
      'construction', v_reward_construction
    ),
    'claimCost', v_claim_cost
  );
END;
$$;

-- ============================================
-- 4. get_place_by_id — ajouter fortificationLevel au claim
-- ============================================

CREATE OR REPLACE FUNCTION public.get_place_by_id(
  p_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place RECORD;
  v_place_type RECORD;
  v_author RECORD;
  v_views_count INT;
  v_likes_count INT;
  v_explored_count INT;
  v_geocache_count INT;
  v_avg_score DOUBLE PRECISION;
  v_last_explorers JSON;
  v_requester JSON;
  v_author_profile_url TEXT;
  v_primary_tag JSON;
  v_all_tags JSON;
  v_claim JSON;
BEGIN
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT * INTO v_place_type FROM place_types WHERE id = v_place.place_type_id;
  SELECT * INTO v_author FROM users WHERE id = v_place.author_id;

  -- Photo de profil de l'auteur (même logique que get_player_profile)
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_author_profile_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = v_place.author_id;

  -- Metrics
  SELECT COUNT(*) INTO v_views_count FROM places_viewed WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_likes_count FROM places_liked WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_explored_count FROM places_explored WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_geocache_count FROM reviews WHERE place_id = p_id AND geocache = true;
  SELECT AVG(score) INTO v_avg_score FROM reviews WHERE place_id = p_id;

  -- Derniers explorateurs
  SELECT json_agg(explorer) INTO v_last_explorers
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'lastName', u.last_name,
      'profileImageUrl', CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
    WHERE pe.place_id = p_id AND pe.user_id != v_place.author_id
    ORDER BY pe.updated_at DESC
  ) sub;

  -- Tag primaire
  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'color', t.color,
    'background', t.background
  ) INTO v_primary_tag
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_id AND ptag.is_primary = TRUE
  LIMIT 1;

  -- Tous les tags
  SELECT json_agg(tag_data) INTO v_all_tags
  FROM (
    SELECT json_build_object(
      'id', t.id,
      'title', t.title,
      'color', t.color,
      'background', t.background,
      'isPrimary', ptag.is_primary
    ) AS tag_data
    FROM place_tags ptag
    JOIN tags t ON t.id = ptag.tag_id
    WHERE ptag.place_id = p_id
    ORDER BY ptag.is_primary DESC, t."order"
  ) sub;

  -- Requester state
  IF p_user_id IS NOT NULL THEN
    v_requester := json_build_object(
      'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked WHERE place_id = p_id AND user_id = p_user_id),
      'liked', EXISTS(SELECT 1 FROM places_liked WHERE place_id = p_id AND user_id = p_user_id),
      'explored', EXISTS(SELECT 1 FROM places_explored WHERE place_id = p_id AND user_id = p_user_id)
    );
  ELSE
    v_requester := NULL;
  END IF;

  -- Claim info (avec fortification)
  IF v_place.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'factionId', f.id,
      'factionTitle', f.title,
      'factionColor', f.color,
      'factionPattern', f.pattern,
      'claimedBy', v_place.claimed_by,
      'claimedAt', v_place.claimed_at,
      'fortificationLevel', v_place.fortification_level
    ) INTO v_claim
    FROM factions f
    WHERE f.id = v_place.faction_id;
  ELSE
    v_claim := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_place.id,
    'title', v_place.title,
    'text', v_place.text,
    'address', v_place.address,
    'accessibility', v_place.accessibility,
    'sensible', COALESCE(v_place.sensible, false),
    'geocaching', v_geocache_count > 0,
    'images', v_place.images,
    'author', json_build_object(
      'id', COALESCE(v_author.id, v_place.author_id),
      'lastName', COALESCE(v_author.first_name, v_author.last_name, 'Utilisateur inconnu'),
      'profileImageUrl', v_author_profile_url
    ),
    'type', json_build_object(
      'id', v_place_type.id,
      'title', v_place_type.title
    ),
    'primaryTag', v_primary_tag,
    'tags', COALESCE(v_all_tags, '[]'::json),
    'location', json_build_object(
      'latitude', v_place.latitude,
      'longitude', v_place.longitude
    ),
    'metrics', json_build_object(
      'views', v_views_count,
      'likes', v_likes_count,
      'explored', v_explored_count,
      'note', v_avg_score
    ),
    'claim', v_claim,
    'requester', v_requester,
    'lastExplorers', COALESCE(v_last_explorers, '[]'::json),
    'beginAt', v_place.begin_at,
    'endAt', v_place.end_at,
    'createdAt', v_place.created_at
  );
END;
$$;
-- ============================================
-- MIGRATION 041 : Systeme de Notoriete
-- ============================================
-- Notoriete personnelle : +10 au claim, +5 a la fortification
-- Notoriete de faction  : temporelle, basee sur la duree de
--   controle des territoires avec bonus de fortification.
-- Remplace le pourcentage dans le FactionBar.
-- ============================================
-- Multiplicateur fortification :
--   Lvl 0 = x1.0 | Lvl 1 = x1.5 | Lvl 2 = x2.0
--   Lvl 3 = x2.5 | Lvl 4 = x3.0
-- ============================================

-- 1. Schema
ALTER TABLE users ADD COLUMN IF NOT EXISTS notoriety_points INT NOT NULL DEFAULT 0;

-- ============================================
-- 2. get_faction_notoriety — calcul temps reel
-- ============================================

CREATE OR REPLACE FUNCTION public.get_faction_notoriety()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT
      f.id AS "factionId",
      f.title,
      f.color,
      f.pattern,
      COUNT(p.id)::INT AS "placesCount",
      COALESCE(SUM(
        FLOOR(EXTRACT(EPOCH FROM (NOW() - p.claimed_at)) / 3600)
        * (1 + p.fortification_level * 0.5)
      ), 0)::INT AS notoriety
    FROM factions f
    LEFT JOIN places p ON p.faction_id = f.id AND p.claimed_at IS NOT NULL
    GROUP BY f.id, f.title, f.color, f.pattern, f."order"
    ORDER BY notoriety DESC
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_faction_notoriety TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_faction_notoriety TO anon;

-- ============================================
-- 3. claim_place — notoriete au lieu de rewards tag
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_fortification INT;
  v_claim_cost NUMERIC(6,1);
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_energy NUMERIC(4,1);
  v_notoriety INT;
  v_max_conquest NUMERIC(6,1) := 5.0;
  v_max_construction NUMERIC(6,1) := 5.0;
  -- Conquest regen
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  -- Construction regen
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
BEGIN
  -- Recuperer la faction du user
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe + lire fortification
  SELECT fortification_level INTO v_fortification
  FROM places WHERE id = p_place_id;

  IF v_fortification IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Cout dynamique : 1 + niveau de fortification
  v_claim_cost := 1 + COALESCE(v_fortification, 0);

  -- Verifier les points de conquete
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost
    );
  END IF;

  -- Revendiquer le lieu + reset fortification
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = 0,
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Historique
  INSERT INTO place_claims (place_id, user_id, faction_id)
  VALUES (p_place_id, p_user_id, v_faction_id);

  -- Deduire conquete + ajouter notoriete
  UPDATE users
  SET conquest_points = conquest_points - v_claim_cost,
      notoriety_points = notoriety_points + 10
  WHERE id = p_user_id;

  -- Recuperer l'etat final
  SELECT energy_points, conquest_points, conquest_reset_at,
         construction_points, construction_reset_at, notoriety_points
  INTO v_energy, v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at, v_notoriety
  FROM users WHERE id = p_user_id;

  -- Conquest next point
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- Construction next point
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id,
    'energy', v_energy,
    'conquestPoints', v_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', 0,
    'claimCost', v_claim_cost
  );
END;
$$;

-- ============================================
-- 4. fortify_place — +5 notoriete
-- ============================================

CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_cost INT;
  v_costs INT[] := ARRAY[1, 2, 3, 5];
  v_names TEXT[] := ARRAY['Tour de guet', 'Tour de defense', 'Bastion', 'Befroi'];
  v_construction NUMERIC(6,1);
  v_notoriety INT;
  v_max_construction NUMERIC(6,1) := 5.0;
  -- Construction regen (pour retourner nextPointIn)
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
BEGIN
  -- Verifier faction du user
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe et est revendique par la faction du user
  SELECT faction_id, fortification_level
  INTO v_place_faction, v_current_level
  FROM places WHERE id = p_place_id;

  IF v_place_faction IS NULL THEN
    RETURN json_build_object('error', 'Place not claimed');
  END IF;

  IF v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'Not your faction territory');
  END IF;

  IF v_current_level >= 4 THEN
    RETURN json_build_object('error', 'Max fortification reached');
  END IF;

  -- Cout du prochain niveau
  v_cost := v_costs[v_current_level + 1];

  -- Verifier les points de construction
  SELECT construction_points INTO v_construction FROM users WHERE id = p_user_id;
  IF v_construction < v_cost THEN
    RETURN json_build_object(
      'error', 'Not enough construction points',
      'constructionPoints', v_construction,
      'cost', v_cost
    );
  END IF;

  -- Deduire les points + ajouter notoriete
  UPDATE users
  SET construction_points = construction_points - v_cost,
      notoriety_points = notoriety_points + 5
  WHERE id = p_user_id;

  -- Incrementer le niveau
  UPDATE places
  SET fortification_level = v_current_level + 1,
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Recuperer l'etat final
  SELECT construction_points, construction_reset_at, notoriety_points
  INTO v_construction, v_construction_reset_at, v_notoriety
  FROM users WHERE id = p_user_id;

  -- Construction next point
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', v_current_level + 1,
    'fortificationName', v_names[v_current_level + 1],
    'cost', v_cost
  );
END;
$$;

-- ============================================
-- 5. get_user_energy — ajouter notorietyPoints
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Energie (+0.5/h -> 1 pt toutes les 7200s)
  v_energy NUMERIC(4,1);
  v_energy_reset_at TIMESTAMPTZ;
  v_max_energy NUMERIC(4,1) := 5.0;
  v_energy_cycle INT := 7200;
  v_energy_elapsed FLOAT;
  v_energy_ticks INT;
  v_energy_add NUMERIC(4,1);
  v_energy_next_in INT;
  -- Conquete (+0.25/h -> 1 pt toutes les 14400s)
  v_conquest NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_max_conquest NUMERIC(6,1) := 5.0;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_add NUMERIC(6,1);
  v_conquest_next_in INT;
  -- Construction (+0.25/h -> 1 pt toutes les 14400s)
  v_construction NUMERIC(6,1);
  v_construction_reset_at TIMESTAMPTZ;
  v_max_construction NUMERIC(6,1) := 5.0;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_add NUMERIC(6,1);
  v_construction_next_in INT;
  -- Notoriete
  v_notoriety INT;
BEGIN
  SELECT energy_points, energy_reset_at,
         conquest_points, conquest_reset_at,
         construction_points, construction_reset_at,
         notoriety_points
  INTO v_energy, v_energy_reset_at,
       v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at,
       v_notoriety
  FROM users WHERE id = p_user_id;

  -- ---- ENERGIE (cycle 7200s, taux fixe 1) ----
  v_energy_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset_at));
  v_energy_ticks := GREATEST(0, floor(v_energy_elapsed / v_energy_cycle)::int);
  v_energy_add := LEAST(v_energy_ticks * 1, v_max_energy - v_energy);

  IF v_energy_add > 0 THEN
    v_energy := v_energy + v_energy_add;
    UPDATE users
    SET energy_points = v_energy,
        energy_reset_at = energy_reset_at + make_interval(secs := v_energy_ticks * v_energy_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_energy >= v_max_energy THEN
    v_energy_next_in := 0;
  ELSE
    v_energy_next_in := GREATEST(0, (v_energy_cycle - (v_energy_elapsed - v_energy_ticks * v_energy_cycle))::int);
  END IF;

  -- ---- CONQUETE (cycle 14400s, taux fixe 1) ----
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  v_conquest_add := LEAST(v_conquest_ticks * 1, v_max_conquest - v_conquest);

  IF v_conquest_add > 0 THEN
    v_conquest := v_conquest + v_conquest_add;
    UPDATE users
    SET conquest_points = v_conquest,
        conquest_reset_at = conquest_reset_at + make_interval(secs := v_conquest_ticks * v_conquest_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- ---- CONSTRUCTION (cycle 14400s, taux fixe 1) ----
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  v_construction_add := LEAST(v_construction_ticks * 1, v_max_construction - v_construction);

  IF v_construction_add > 0 THEN
    v_construction := v_construction + v_construction_add;
    UPDATE users
    SET construction_points = v_construction,
        construction_reset_at = construction_reset_at + make_interval(secs := v_construction_ticks * v_construction_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'nextPointIn', v_energy_next_in,
    'conquestPoints', COALESCE(v_conquest, 0),
    'maxConquest', v_max_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', COALESCE(v_construction, 0),
    'maxConstruction', v_max_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', COALESCE(v_notoriety, 0)
  );
END;
$$;

-- ============================================
-- 6. get_player_profile — ajouter notorietyPoints
-- ============================================

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_avatar_url TEXT;
BEGIN
  -- Recuperer l'avatar via image_media
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_avatar_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = p_user_id;

  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', v_avatar_url,
    'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (SELECT COUNT(*) FROM places_discovered pd WHERE pd.user_id = u.id),
    'claimedCount', (SELECT COUNT(DISTINCT pc.place_id) FROM place_claims pc WHERE pc.user_id = u.id),
    'likesCount', (SELECT COUNT(*) FROM places_liked pl WHERE pl.user_id = u.id),
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile TO authenticated;
-- ============================================
-- MIGRATION 042 : RPC get_place_likers
-- ============================================
-- Retourne la liste des utilisateurs ayant liké un lieu

CREATE OR REPLACE FUNCTION public.get_place_likers(
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(liker) INTO v_result
  FROM (
    SELECT json_build_object(
      'userId', u.id,
      'name', COALESCE(u.first_name, u.email_address),
      'factionColor', f.color,
      'profileImage', CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END
    ) AS liker
    FROM places_liked pl
    JOIN users u ON u.id = pl.user_id
    LEFT JOIN factions f ON f.id = u.faction_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
    WHERE pl.place_id = p_place_id
    ORDER BY pl.created_at DESC
  ) sub;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_likers TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_likers TO anon;
-- ============================================
-- MIGRATION 043 : RPC explore_place + get_place_explorers
-- ============================================

-- 1. RPC explore_place — marquer un lieu comme exploré
CREATE OR REPLACE FUNCTION public.explore_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifier que le lieu existe
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Vérifier si déjà exploré
  IF EXISTS(SELECT 1 FROM places_explored WHERE user_id = p_user_id AND place_id = p_place_id) THEN
    RETURN json_build_object('success', true);
  END IF;

  -- Insérer
  INSERT INTO places_explored (id, user_id, place_id, created_at, updated_at)
  VALUES (p_user_id || '_' || p_place_id, p_user_id, p_place_id, NOW(), NOW());

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.explore_place TO authenticated;

-- 2. RPC get_place_explorers — liste des explorateurs d'un lieu
CREATE OR REPLACE FUNCTION public.get_place_explorers(
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(explorer) INTO v_result
  FROM (
    SELECT json_build_object(
      'userId', u.id,
      'name', COALESCE(u.first_name, u.email_address),
      'factionColor', f.color,
      'profileImage', CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END,
      'exploredAt', pe.created_at
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    LEFT JOIN factions f ON f.id = u.faction_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
    WHERE pe.place_id = p_place_id
    ORDER BY pe.created_at DESC
  ) sub;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_explorers TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_explorers TO anon;
-- ============================================
-- MIGRATION 044 : Renommer les noms par défaut
-- ============================================
-- Remplace "Aventurier" et "Intrépide" par "Un voyageur sans nom"

UPDATE users
SET first_name = 'Un voyageur sans nom'
WHERE first_name IN ('Aventurier', 'Intrépide');

UPDATE users
SET last_name = 'Un voyageur sans nom'
WHERE last_name IN ('Aventurier', 'Intrépide');
-- ============================================
-- MIGRATION 045 : Trigger explore → activity_log
-- ============================================

CREATE OR REPLACE FUNCTION log_explore_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_title TEXT;
  v_actor_name TEXT;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
BEGIN
  SELECT title, latitude, longitude
  INTO v_place_title, v_lat, v_lng
  FROM places WHERE id = NEW.place_id;

  SELECT COALESCE(first_name, email_address)
  INTO v_actor_name
  FROM users WHERE id = NEW.user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'explore',
    NEW.user_id,
    NEW.place_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'actorName', v_actor_name,
      'placeLatitude', v_lat,
      'placeLongitude', v_lng
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_explore ON places_explored;
CREATE TRIGGER trg_log_explore
  AFTER INSERT ON places_explored
  FOR EACH ROW
  EXECUTE FUNCTION log_explore_activity();
-- ============================================
-- MIGRATION 046 : Taux horaire de notoriete
-- ============================================
-- 1. get_faction_notoriety : ajouter hourlyRate
-- 2. get_map_places : ajouter fortificationLevel par lieu
-- ============================================

-- 1. get_faction_notoriety — ajouter hourlyRate
CREATE OR REPLACE FUNCTION public.get_faction_notoriety()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT
      f.id AS "factionId",
      f.title,
      f.color,
      f.pattern,
      COUNT(p.id)::INT AS "placesCount",
      COALESCE(SUM(
        FLOOR(EXTRACT(EPOCH FROM (NOW() - p.claimed_at)) / 3600)
        * (1 + p.fortification_level * 0.5)
      ), 0)::INT AS notoriety,
      COALESCE(SUM(1 + p.fortification_level * 0.5), 0)::NUMERIC(10,1) AS "hourlyRate"
    FROM factions f
    LEFT JOIN places p ON p.faction_id = f.id AND p.claimed_at IS NOT NULL
    GROUP BY f.id, f.title, f.color, f.pattern, f."order"
    ORDER BY notoriety DESC
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- 2. get_map_places — ajouter fortificationLevel
CREATE OR REPLACE FUNCTION public.get_map_places(
  p_type TEXT DEFAULT 'all',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_latitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_longitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', COALESCE(claimer.first_name, claimer.email_address),
        'fortificationLevel', p.fortification_level,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id, f.id, claimer.first_name, claimer.email_address, lk.likes_count, vw.views_count, ex.explored_count
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'latest' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', COALESCE(claimer.first_name, claimer.email_address),
        'fortificationLevel', p.fortification_level,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;

  ELSE
    -- type = 'all' avec viewport optionnel
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', COALESCE(claimer.first_name, claimer.email_address),
        'fortificationLevel', p.fortification_level,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
        AND (
          p_latitude IS NULL
          OR (
            p.latitude >= (p_latitude - p_latitude_delta)
            AND p.latitude <= (p_latitude + p_latitude_delta)
            AND p.longitude >= (p_longitude - p_longitude_delta)
            AND p.longitude <= (p_longitude + p_longitude_delta)
          )
        )
      ORDER BY p.created_at
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
-- ============================================
-- MIGRATION 047 : Max jauges per-user
-- ============================================
-- Les max energy/conquest/construction sont désormais
-- stockés par utilisateur au lieu d'être hardcodés à 5.
-- Configurable depuis le Hub → /carte/reglages
-- ============================================

-- 1. Nouvelles colonnes
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_energy NUMERIC(4,1) NOT NULL DEFAULT 5.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_conquest NUMERIC(6,1) NOT NULL DEFAULT 5.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_construction NUMERIC(6,1) NOT NULL DEFAULT 5.0;

-- Bonus admin existants
UPDATE users SET max_energy = 10, max_conquest = 10, max_construction = 10 WHERE role = 'admin';

-- ============================================
-- 2. get_user_energy — lire les max du user
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy NUMERIC(4,1);
  v_energy_reset_at TIMESTAMPTZ;
  v_max_energy NUMERIC(4,1);
  v_energy_cycle INT := 7200;
  v_energy_elapsed FLOAT;
  v_energy_ticks INT;
  v_energy_add NUMERIC(4,1);
  v_energy_next_in INT;
  v_conquest NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_max_conquest NUMERIC(6,1);
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_add NUMERIC(6,1);
  v_conquest_next_in INT;
  v_construction NUMERIC(6,1);
  v_construction_reset_at TIMESTAMPTZ;
  v_max_construction NUMERIC(6,1);
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_add NUMERIC(6,1);
  v_construction_next_in INT;
  v_notoriety INT;
BEGIN
  SELECT energy_points, energy_reset_at, max_energy,
         conquest_points, conquest_reset_at, max_conquest,
         construction_points, construction_reset_at, max_construction,
         notoriety_points
  INTO v_energy, v_energy_reset_at, v_max_energy,
       v_conquest, v_conquest_reset_at, v_max_conquest,
       v_construction, v_construction_reset_at, v_max_construction,
       v_notoriety
  FROM users WHERE id = p_user_id;

  -- ---- ENERGIE ----
  v_energy_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset_at));
  v_energy_ticks := GREATEST(0, floor(v_energy_elapsed / v_energy_cycle)::int);
  v_energy_add := LEAST(v_energy_ticks * 1, v_max_energy - v_energy);

  IF v_energy_add > 0 THEN
    v_energy := v_energy + v_energy_add;
    UPDATE users
    SET energy_points = v_energy,
        energy_reset_at = energy_reset_at + make_interval(secs := v_energy_ticks * v_energy_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_energy >= v_max_energy THEN
    v_energy_next_in := 0;
  ELSE
    v_energy_next_in := GREATEST(0, (v_energy_cycle - (v_energy_elapsed - v_energy_ticks * v_energy_cycle))::int);
  END IF;

  -- ---- CONQUETE ----
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  v_conquest_add := LEAST(v_conquest_ticks * 1, v_max_conquest - v_conquest);

  IF v_conquest_add > 0 THEN
    v_conquest := v_conquest + v_conquest_add;
    UPDATE users
    SET conquest_points = v_conquest,
        conquest_reset_at = conquest_reset_at + make_interval(secs := v_conquest_ticks * v_conquest_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- ---- CONSTRUCTION ----
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  v_construction_add := LEAST(v_construction_ticks * 1, v_max_construction - v_construction);

  IF v_construction_add > 0 THEN
    v_construction := v_construction + v_construction_add;
    UPDATE users
    SET construction_points = v_construction,
        construction_reset_at = construction_reset_at + make_interval(secs := v_construction_ticks * v_construction_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'nextPointIn', v_energy_next_in,
    'conquestPoints', COALESCE(v_conquest, 0),
    'maxConquest', v_max_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', COALESCE(v_construction, 0),
    'maxConstruction', v_max_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', COALESCE(v_notoriety, 0)
  );
END;
$$;

-- ============================================
-- 3. discover_place — max per-user
-- ============================================

CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy NUMERIC(4,1);
  v_energy_reset_at TIMESTAMPTZ;
  v_already BOOLEAN;
  v_max_energy NUMERIC(4,1);
  v_energy_cycle INT := 7200;
  v_energy_elapsed FLOAT;
  v_energy_ticks INT;
  v_energy_add NUMERIC(4,1);
  v_energy_next_in INT;
  v_cost NUMERIC(4,1);
  v_place_faction VARCHAR(255);
  v_user_faction VARCHAR(255);
  v_reward_energy INT;
  v_reward_conquest INT;
  v_reward_construction INT;
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Lire les max du user
  SELECT max_energy, max_conquest, max_construction
  INTO v_max_energy, v_max_conquest, v_max_construction
  FROM users WHERE id = p_user_id;

  SELECT EXISTS(
    SELECT 1 FROM places_discovered
    WHERE user_id = p_user_id AND place_id = p_place_id
  ) INTO v_already;

  IF v_already THEN
    SELECT energy_points, conquest_points, construction_points
    INTO v_energy, v_conquest, v_construction
    FROM users WHERE id = p_user_id;
    RETURN json_build_object(
      'success', true, 'already', true,
      'energy', v_energy,
      'conquestPoints', v_conquest,
      'constructionPoints', v_construction
    );
  END IF;

  IF p_method = 'remote' THEN
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_place_id;
    SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

    IF v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
      v_cost := 0.5;
    ELSE
      v_cost := 1.0;
    END IF;

    SELECT energy_points, energy_reset_at
    INTO v_energy, v_energy_reset_at
    FROM users WHERE id = p_user_id;

    v_energy_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset_at));
    v_energy_ticks := GREATEST(0, floor(v_energy_elapsed / v_energy_cycle)::int);
    v_energy_add := LEAST(v_energy_ticks * 1, v_max_energy - v_energy);

    IF v_energy_add > 0 THEN
      v_energy := v_energy + v_energy_add;
      UPDATE users
      SET energy_points = v_energy,
          energy_reset_at = energy_reset_at + make_interval(secs := v_energy_ticks * v_energy_cycle)
      WHERE id = p_user_id;
    END IF;

    IF v_energy < v_cost THEN
      RETURN json_build_object('error', 'Not enough energy', 'energy', v_energy);
    END IF;

    UPDATE users
    SET energy_points = energy_points - v_cost
    WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT t.reward_energy, t.reward_conquest, t.reward_construction
  INTO v_reward_energy, v_reward_conquest, v_reward_construction
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE
  LIMIT 1;

  v_reward_energy := COALESCE(v_reward_energy, 0);
  v_reward_conquest := COALESCE(v_reward_conquest, 0);
  v_reward_construction := COALESCE(v_reward_construction, 0);

  IF v_reward_energy > 0 OR v_reward_conquest > 0 OR v_reward_construction > 0 THEN
    UPDATE users
    SET energy_points = LEAST(energy_points + v_reward_energy, v_max_energy),
        conquest_points = LEAST(conquest_points + v_reward_conquest, v_max_conquest),
        construction_points = LEAST(construction_points + v_reward_construction, v_max_construction)
    WHERE id = p_user_id;
  END IF;

  SELECT energy_points, energy_reset_at,
         conquest_points, conquest_reset_at,
         construction_points, construction_reset_at
  INTO v_energy, v_energy_reset_at,
       v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at
  FROM users WHERE id = p_user_id;

  v_energy_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset_at));
  v_energy_ticks := GREATEST(0, floor(v_energy_elapsed / v_energy_cycle)::int);
  IF v_energy >= v_max_energy THEN
    v_energy_next_in := 0;
  ELSE
    v_energy_next_in := GREATEST(0, (v_energy_cycle - (v_energy_elapsed - v_energy_ticks * v_energy_cycle))::int);
  END IF;

  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'energy', v_energy,
    'nextPointIn', v_energy_next_in,
    'conquestPoints', v_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'rewards', json_build_object(
      'energy', v_reward_energy,
      'conquest', v_reward_conquest,
      'construction', v_reward_construction
    )
  );
END;
$$;

-- ============================================
-- 4. claim_place — max per-user
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_fortification INT;
  v_claim_cost NUMERIC(6,1);
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_energy NUMERIC(4,1);
  v_notoriety INT;
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
BEGIN
  -- Recuperer faction + max du user
  SELECT faction_id, max_conquest, max_construction
  INTO v_faction_id, v_max_conquest, v_max_construction
  FROM users WHERE id = p_user_id;

  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe + lire fortification
  SELECT fortification_level INTO v_fortification
  FROM places WHERE id = p_place_id;

  IF v_fortification IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  v_claim_cost := 1 + COALESCE(v_fortification, 0);

  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost
    );
  END IF;

  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = 0,
      updated_at = NOW()
  WHERE id = p_place_id;

  INSERT INTO place_claims (place_id, user_id, faction_id)
  VALUES (p_place_id, p_user_id, v_faction_id);

  UPDATE users
  SET conquest_points = conquest_points - v_claim_cost,
      notoriety_points = notoriety_points + 10
  WHERE id = p_user_id;

  SELECT energy_points, conquest_points, conquest_reset_at,
         construction_points, construction_reset_at, notoriety_points
  INTO v_energy, v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at, v_notoriety
  FROM users WHERE id = p_user_id;

  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id,
    'energy', v_energy,
    'conquestPoints', v_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', 0,
    'claimCost', v_claim_cost
  );
END;
$$;

-- ============================================
-- 5. fortify_place — max per-user
-- ============================================

CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_cost INT;
  v_costs INT[] := ARRAY[1, 2, 3, 5];
  v_names TEXT[] := ARRAY['Tour de guet', 'Tour de defense', 'Bastion', 'Befroi'];
  v_construction NUMERIC(6,1);
  v_notoriety INT;
  v_max_construction NUMERIC(6,1);
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
BEGIN
  -- Verifier faction + lire max du user
  SELECT faction_id, max_construction
  INTO v_user_faction, v_max_construction
  FROM users WHERE id = p_user_id;

  IF v_user_faction IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  SELECT faction_id, fortification_level
  INTO v_place_faction, v_current_level
  FROM places WHERE id = p_place_id;

  IF v_place_faction IS NULL THEN
    RETURN json_build_object('error', 'Place not claimed');
  END IF;

  IF v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'Not your faction territory');
  END IF;

  IF v_current_level >= 4 THEN
    RETURN json_build_object('error', 'Max fortification reached');
  END IF;

  v_cost := v_costs[v_current_level + 1];

  SELECT construction_points INTO v_construction FROM users WHERE id = p_user_id;
  IF v_construction < v_cost THEN
    RETURN json_build_object(
      'error', 'Not enough construction points',
      'constructionPoints', v_construction,
      'cost', v_cost
    );
  END IF;

  UPDATE users
  SET construction_points = construction_points - v_cost,
      notoriety_points = notoriety_points + 5
  WHERE id = p_user_id;

  UPDATE places
  SET fortification_level = v_current_level + 1,
      updated_at = NOW()
  WHERE id = p_place_id;

  SELECT construction_points, construction_reset_at, notoriety_points
  INTO v_construction, v_construction_reset_at, v_notoriety
  FROM users WHERE id = p_user_id;

  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', v_current_level + 1,
    'fortificationName', v_names[v_current_level + 1],
    'cost', v_cost
  );
END;
$$;
-- ============================================
-- 048 : Ajout description + image_url sur factions
-- ============================================

ALTER TABLE factions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS image_url TEXT;
-- ============================================
-- MIGRATION 049 : Bonus de faction sur les jauges
-- ============================================
-- Chaque faction peut accorder un bonus au max des jauges.
-- Max effectif = users.max_X + factions.bonus_X
-- ============================================

-- 1. Colonnes bonus sur factions
ALTER TABLE factions ADD COLUMN IF NOT EXISTS bonus_energy NUMERIC(4,1) NOT NULL DEFAULT 0;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS bonus_conquest NUMERIC(6,1) NOT NULL DEFAULT 0;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS bonus_construction NUMERIC(6,1) NOT NULL DEFAULT 0;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS bonus_regen_energy NUMERIC(4,1) NOT NULL DEFAULT 0;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS bonus_regen_conquest NUMERIC(4,1) NOT NULL DEFAULT 0;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS bonus_regen_construction NUMERIC(4,1) NOT NULL DEFAULT 0;

-- ============================================
-- 2. get_user_energy — LEFT JOIN factions
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy NUMERIC(4,1);
  v_energy_reset_at TIMESTAMPTZ;
  v_max_energy NUMERIC(4,1);
  v_energy_cycle INT := 7200;
  v_energy_elapsed FLOAT;
  v_energy_ticks INT;
  v_energy_add NUMERIC(4,1);
  v_energy_next_in INT;
  v_conquest NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_max_conquest NUMERIC(6,1);
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_add NUMERIC(6,1);
  v_conquest_next_in INT;
  v_construction NUMERIC(6,1);
  v_construction_reset_at TIMESTAMPTZ;
  v_max_construction NUMERIC(6,1);
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_add NUMERIC(6,1);
  v_construction_next_in INT;
  v_notoriety INT;
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
BEGIN
  SELECT u.energy_points, u.energy_reset_at,
         GREATEST(1, u.max_energy + COALESCE(f.bonus_energy, 0)),
         u.conquest_points, u.conquest_reset_at,
         GREATEST(1, u.max_conquest + COALESCE(f.bonus_conquest, 0)),
         u.construction_points, u.construction_reset_at,
         GREATEST(1, u.max_construction + COALESCE(f.bonus_construction, 0)),
         u.notoriety_points,
         GREATEST(600, (7200 * (100 - COALESCE(f.bonus_regen_energy, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_conquest, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_construction, 0)) / 100)::INT),
         COALESCE(f.bonus_energy, 0),
         COALESCE(f.bonus_conquest, 0),
         COALESCE(f.bonus_construction, 0)
  INTO v_energy, v_energy_reset_at, v_max_energy,
       v_conquest, v_conquest_reset_at, v_max_conquest,
       v_construction, v_construction_reset_at, v_max_construction,
       v_notoriety,
       v_energy_cycle, v_conquest_cycle, v_construction_cycle,
       v_bonus_energy, v_bonus_conquest, v_bonus_construction
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  -- ---- ENERGIE ----
  v_energy_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset_at));
  v_energy_ticks := GREATEST(0, floor(v_energy_elapsed / v_energy_cycle)::int);
  v_energy_add := LEAST(v_energy_ticks * 1, v_max_energy - v_energy);

  IF v_energy_add > 0 THEN
    v_energy := v_energy + v_energy_add;
    UPDATE users
    SET energy_points = v_energy,
        energy_reset_at = energy_reset_at + make_interval(secs := v_energy_ticks * v_energy_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_energy >= v_max_energy THEN
    v_energy_next_in := 0;
  ELSE
    v_energy_next_in := GREATEST(0, (v_energy_cycle - (v_energy_elapsed - v_energy_ticks * v_energy_cycle))::int);
  END IF;

  -- ---- CONQUETE ----
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  v_conquest_add := LEAST(v_conquest_ticks * 1, v_max_conquest - v_conquest);

  IF v_conquest_add > 0 THEN
    v_conquest := v_conquest + v_conquest_add;
    UPDATE users
    SET conquest_points = v_conquest,
        conquest_reset_at = conquest_reset_at + make_interval(secs := v_conquest_ticks * v_conquest_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- ---- CONSTRUCTION ----
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  v_construction_add := LEAST(v_construction_ticks * 1, v_max_construction - v_construction);

  IF v_construction_add > 0 THEN
    v_construction := v_construction + v_construction_add;
    UPDATE users
    SET construction_points = v_construction,
        construction_reset_at = construction_reset_at + make_interval(secs := v_construction_ticks * v_construction_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'nextPointIn', v_energy_next_in,
    'energyCycle', v_energy_cycle,
    'conquestPoints', COALESCE(v_conquest, 0),
    'maxConquest', v_max_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'conquestCycle', v_conquest_cycle,
    'constructionPoints', COALESCE(v_construction, 0),
    'maxConstruction', v_max_construction,
    'constructionNextPointIn', v_construction_next_in,
    'constructionCycle', v_construction_cycle,
    'notorietyPoints', COALESCE(v_notoriety, 0),
    'bonusEnergy', v_bonus_energy,
    'bonusConquest', v_bonus_conquest,
    'bonusConstruction', v_bonus_construction
  );
END;
$$;

-- ============================================
-- 3. discover_place — LEFT JOIN factions
-- ============================================

CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy NUMERIC(4,1);
  v_energy_reset_at TIMESTAMPTZ;
  v_already BOOLEAN;
  v_max_energy NUMERIC(4,1);
  v_energy_cycle INT := 7200;
  v_energy_elapsed FLOAT;
  v_energy_ticks INT;
  v_energy_add NUMERIC(4,1);
  v_energy_next_in INT;
  v_cost NUMERIC(4,1);
  v_place_faction VARCHAR(255);
  v_user_faction VARCHAR(255);
  v_reward_energy INT;
  v_reward_conquest INT;
  v_reward_construction INT;
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Lire les max du user + bonus faction + cycles regen
  SELECT GREATEST(1, u.max_energy + COALESCE(f.bonus_energy, 0)),
         GREATEST(1, u.max_conquest + COALESCE(f.bonus_conquest, 0)),
         GREATEST(1, u.max_construction + COALESCE(f.bonus_construction, 0)),
         GREATEST(600, (7200 * (100 - COALESCE(f.bonus_regen_energy, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_conquest, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_construction, 0)) / 100)::INT)
  INTO v_max_energy, v_max_conquest, v_max_construction,
       v_energy_cycle, v_conquest_cycle, v_construction_cycle
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  SELECT EXISTS(
    SELECT 1 FROM places_discovered
    WHERE user_id = p_user_id AND place_id = p_place_id
  ) INTO v_already;

  IF v_already THEN
    SELECT energy_points, conquest_points, construction_points
    INTO v_energy, v_conquest, v_construction
    FROM users WHERE id = p_user_id;
    RETURN json_build_object(
      'success', true, 'already', true,
      'energy', v_energy,
      'conquestPoints', v_conquest,
      'constructionPoints', v_construction
    );
  END IF;

  IF p_method = 'remote' THEN
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_place_id;
    SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

    IF v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
      v_cost := 0.5;
    ELSE
      v_cost := 1.0;
    END IF;

    SELECT energy_points, energy_reset_at
    INTO v_energy, v_energy_reset_at
    FROM users WHERE id = p_user_id;

    v_energy_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset_at));
    v_energy_ticks := GREATEST(0, floor(v_energy_elapsed / v_energy_cycle)::int);
    v_energy_add := LEAST(v_energy_ticks * 1, v_max_energy - v_energy);

    IF v_energy_add > 0 THEN
      v_energy := v_energy + v_energy_add;
      UPDATE users
      SET energy_points = v_energy,
          energy_reset_at = energy_reset_at + make_interval(secs := v_energy_ticks * v_energy_cycle)
      WHERE id = p_user_id;
    END IF;

    IF v_energy < v_cost THEN
      RETURN json_build_object('error', 'Not enough energy', 'energy', v_energy);
    END IF;

    UPDATE users
    SET energy_points = energy_points - v_cost
    WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT t.reward_energy, t.reward_conquest, t.reward_construction
  INTO v_reward_energy, v_reward_conquest, v_reward_construction
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE
  LIMIT 1;

  v_reward_energy := COALESCE(v_reward_energy, 0);
  v_reward_conquest := COALESCE(v_reward_conquest, 0);
  v_reward_construction := COALESCE(v_reward_construction, 0);

  IF v_reward_energy > 0 OR v_reward_conquest > 0 OR v_reward_construction > 0 THEN
    UPDATE users
    SET energy_points = LEAST(energy_points + v_reward_energy, v_max_energy),
        conquest_points = LEAST(conquest_points + v_reward_conquest, v_max_conquest),
        construction_points = LEAST(construction_points + v_reward_construction, v_max_construction)
    WHERE id = p_user_id;
  END IF;

  SELECT energy_points, energy_reset_at,
         conquest_points, conquest_reset_at,
         construction_points, construction_reset_at
  INTO v_energy, v_energy_reset_at,
       v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at
  FROM users WHERE id = p_user_id;

  v_energy_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset_at));
  v_energy_ticks := GREATEST(0, floor(v_energy_elapsed / v_energy_cycle)::int);
  IF v_energy >= v_max_energy THEN
    v_energy_next_in := 0;
  ELSE
    v_energy_next_in := GREATEST(0, (v_energy_cycle - (v_energy_elapsed - v_energy_ticks * v_energy_cycle))::int);
  END IF;

  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'energy', v_energy,
    'nextPointIn', v_energy_next_in,
    'conquestPoints', v_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'rewards', json_build_object(
      'energy', v_reward_energy,
      'conquest', v_reward_conquest,
      'construction', v_reward_construction
    )
  );
END;
$$;

-- ============================================
-- 4. claim_place — LEFT JOIN factions
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_fortification INT;
  v_claim_cost NUMERIC(6,1);
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_energy NUMERIC(4,1);
  v_notoriety INT;
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
BEGIN
  -- Recuperer faction + max du user + bonus faction + cycles regen
  SELECT u.faction_id,
         GREATEST(1, u.max_conquest + COALESCE(f.bonus_conquest, 0)),
         GREATEST(1, u.max_construction + COALESCE(f.bonus_construction, 0)),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_conquest, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_construction, 0)) / 100)::INT)
  INTO v_faction_id, v_max_conquest, v_max_construction,
       v_conquest_cycle, v_construction_cycle
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe + lire fortification
  SELECT fortification_level INTO v_fortification
  FROM places WHERE id = p_place_id;

  IF v_fortification IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  v_claim_cost := 1 + COALESCE(v_fortification, 0);

  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost
    );
  END IF;

  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = 0,
      updated_at = NOW()
  WHERE id = p_place_id;

  INSERT INTO place_claims (place_id, user_id, faction_id)
  VALUES (p_place_id, p_user_id, v_faction_id);

  UPDATE users
  SET conquest_points = conquest_points - v_claim_cost,
      notoriety_points = notoriety_points + 10
  WHERE id = p_user_id;

  SELECT energy_points, conquest_points, conquest_reset_at,
         construction_points, construction_reset_at, notoriety_points
  INTO v_energy, v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at, v_notoriety
  FROM users WHERE id = p_user_id;

  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id,
    'energy', v_energy,
    'conquestPoints', v_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', 0,
    'claimCost', v_claim_cost
  );
END;
$$;

-- ============================================
-- 5. fortify_place — LEFT JOIN factions
-- ============================================

CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_cost INT;
  v_costs INT[] := ARRAY[1, 2, 3, 5];
  v_names TEXT[] := ARRAY['Tour de guet', 'Tour de defense', 'Bastion', 'Befroi'];
  v_construction NUMERIC(6,1);
  v_notoriety INT;
  v_max_construction NUMERIC(6,1);
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
BEGIN
  -- Verifier faction + lire max du user + bonus faction + cycle regen
  SELECT u.faction_id,
         GREATEST(1, u.max_construction + COALESCE(f.bonus_construction, 0)),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_construction, 0)) / 100)::INT)
  INTO v_user_faction, v_max_construction, v_construction_cycle
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  IF v_user_faction IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  SELECT faction_id, fortification_level
  INTO v_place_faction, v_current_level
  FROM places WHERE id = p_place_id;

  IF v_place_faction IS NULL THEN
    RETURN json_build_object('error', 'Place not claimed');
  END IF;

  IF v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'Not your faction territory');
  END IF;

  IF v_current_level >= 4 THEN
    RETURN json_build_object('error', 'Max fortification reached');
  END IF;

  v_cost := v_costs[v_current_level + 1];

  SELECT construction_points INTO v_construction FROM users WHERE id = p_user_id;
  IF v_construction < v_cost THEN
    RETURN json_build_object(
      'error', 'Not enough construction points',
      'constructionPoints', v_construction,
      'cost', v_cost
    );
  END IF;

  UPDATE users
  SET construction_points = construction_points - v_cost,
      notoriety_points = notoriety_points + 5
  WHERE id = p_user_id;

  UPDATE places
  SET fortification_level = v_current_level + 1,
      updated_at = NOW()
  WHERE id = p_place_id;

  SELECT construction_points, construction_reset_at, notoriety_points
  INTO v_construction, v_construction_reset_at, v_notoriety
  FROM users WHERE id = p_user_id;

  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', v_current_level + 1,
    'fortificationName', v_names[v_current_level + 1],
    'cost', v_cost
  );
END;
$$;
-- ============================================
-- MIGRATION 050 : Systeme de Titres
-- ============================================
-- Titres generaux (basés sur stats globales) + titres de faction
-- (basés sur la notoriété, avec noms propres par faction).
-- Configurables par l'admin dans le Hub.
-- ============================================

-- 1. Table titles
CREATE TABLE IF NOT EXISTS titles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('general', 'faction')),
  faction_id VARCHAR(255) REFERENCES factions(id) ON DELETE CASCADE,
  condition_type VARCHAR(30) NOT NULL,
  condition_value INT NOT NULL DEFAULT 0,
  "order" INT NOT NULL DEFAULT 0,
  icon VARCHAR(50),
  unlocks TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE titles ADD CONSTRAINT titles_faction_check
  CHECK (type = 'general' OR faction_id IS NOT NULL);

-- RLS : lecture publique, ecriture admin uniquement (via SECURITY DEFINER RPCs ou Hub direct)
ALTER TABLE titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view titles"
  ON titles FOR SELECT USING (true);

CREATE POLICY "Service role can manage titles"
  ON titles FOR ALL USING (true) WITH CHECK (true);

-- 2. Seed — Titres generaux de base
INSERT INTO titles (name, type, faction_id, condition_type, condition_value, "order", icon, unlocks) VALUES
  ('Novice',               'general', NULL, 'discoveries',     0,   0,  '🌱', '{}'),
  ('Explorateur novice',   'general', NULL, 'discoveries',     5,   1,  '🧭', '{add_place}'),
  ('Explorateur',          'general', NULL, 'discoveries',     25,  2,  '🗺️', '{}'),
  ('Explorateur confirmé', 'general', NULL, 'discoveries',     100, 3,  '⭐', '{}'),
  ('Conquérant',           'general', NULL, 'claims',          10,  4,  '⚔️', '{}'),
  ('Bâtisseur',            'general', NULL, 'fortifications',  5,   5,  '🏗️', '{}'),
  ('Légende',              'general', NULL, 'notoriety',       500, 10, '👑', '{}');

-- ============================================
-- 3. RPC get_user_titles
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_discoveries INT;
  v_claims INT;
  v_notoriety INT;
  v_likes INT;
  v_fortifications INT;
  v_faction_id VARCHAR(255);
  v_general JSON;
  v_faction JSON;
BEGIN
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_claims FROM place_claims WHERE user_id = p_user_id;
  SELECT COALESCE(notoriety_points, 0), faction_id INTO v_notoriety, v_faction_id FROM users WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_likes FROM places_liked WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_fortifications FROM activity_log WHERE actor_id = p_user_id AND type = 'fortify';

  -- Titre general le plus eleve
  SELECT json_build_object(
    'id', t.id, 'name', t.name, 'icon', t.icon,
    'unlocks', t.unlocks, 'order', t."order"
  )
  INTO v_general
  FROM titles t
  WHERE t.type = 'general'
    AND (
      (t.condition_type = 'discoveries' AND v_discoveries >= t.condition_value) OR
      (t.condition_type = 'claims' AND v_claims >= t.condition_value) OR
      (t.condition_type = 'notoriety' AND v_notoriety >= t.condition_value) OR
      (t.condition_type = 'likes' AND v_likes >= t.condition_value) OR
      (t.condition_type = 'fortifications' AND v_fortifications >= t.condition_value)
    )
  ORDER BY t."order" DESC
  LIMIT 1;

  -- Titre de faction le plus eleve
  IF v_faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'id', t.id, 'name', t.name, 'icon', t.icon,
      'unlocks', t.unlocks, 'order', t."order"
    )
    INTO v_faction
    FROM titles t
    WHERE t.type = 'faction'
      AND t.faction_id = v_faction_id
      AND (
        (t.condition_type = 'notoriety' AND v_notoriety >= t.condition_value) OR
        (t.condition_type = 'claims' AND v_claims >= t.condition_value) OR
        (t.condition_type = 'discoveries' AND v_discoveries >= t.condition_value)
      )
    ORDER BY t."order" DESC
    LIMIT 1;
  END IF;

  RETURN json_build_object(
    'generalTitle', v_general,
    'factionTitle', v_faction,
    'stats', json_build_object(
      'discoveries', v_discoveries,
      'claims', v_claims,
      'notoriety', v_notoriety,
      'likes', v_likes,
      'fortifications', v_fortifications
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_titles TO authenticated;

-- ============================================
-- 4. Update get_player_profile — ajouter titres
-- ============================================

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_avatar_url TEXT;
  v_discoveries INT;
  v_claims INT;
  v_notoriety INT;
  v_likes INT;
  v_fortifications INT;
  v_faction_id VARCHAR(255);
  v_general_title JSON;
  v_faction_title JSON;
BEGIN
  -- Avatar
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_avatar_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = p_user_id;

  -- Stats pour les titres
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_claims FROM place_claims WHERE user_id = p_user_id;
  SELECT COALESCE(notoriety_points, 0), faction_id INTO v_notoriety, v_faction_id FROM users WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_likes FROM places_liked WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_fortifications FROM activity_log WHERE actor_id = p_user_id AND type = 'fortify';

  -- Titre general
  SELECT json_build_object('id', t.id, 'name', t.name, 'icon', t.icon)
  INTO v_general_title
  FROM titles t
  WHERE t.type = 'general'
    AND (
      (t.condition_type = 'discoveries' AND v_discoveries >= t.condition_value) OR
      (t.condition_type = 'claims' AND v_claims >= t.condition_value) OR
      (t.condition_type = 'notoriety' AND v_notoriety >= t.condition_value) OR
      (t.condition_type = 'likes' AND v_likes >= t.condition_value) OR
      (t.condition_type = 'fortifications' AND v_fortifications >= t.condition_value)
    )
  ORDER BY t."order" DESC
  LIMIT 1;

  -- Titre faction
  IF v_faction_id IS NOT NULL THEN
    SELECT json_build_object('id', t.id, 'name', t.name, 'icon', t.icon)
    INTO v_faction_title
    FROM titles t
    WHERE t.type = 'faction'
      AND t.faction_id = v_faction_id
      AND (
        (t.condition_type = 'notoriety' AND v_notoriety >= t.condition_value) OR
        (t.condition_type = 'claims' AND v_claims >= t.condition_value) OR
        (t.condition_type = 'discoveries' AND v_discoveries >= t.condition_value)
      )
    ORDER BY t."order" DESC
    LIMIT 1;
  END IF;

  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', v_avatar_url,
    'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', v_discoveries,
    'claimedCount', v_claims,
    'likesCount', v_likes,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'generalTitle', v_general_title,
    'factionTitle2', v_faction_title
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

-- ============================================
-- 5. Log des fortifications dans activity_log
-- ============================================
-- Le trigger n'existe pas encore pour 'fortify'.
-- On l'ajoute ici.

CREATE OR REPLACE FUNCTION public.log_fortify_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_name TEXT;
  v_place_title TEXT;
BEGIN
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.claimed_by;
  SELECT title INTO v_place_title FROM places WHERE id = NEW.id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'fortify',
    NEW.claimed_by,
    NEW.id,
    NEW.faction_id,
    json_build_object(
      'placeTitle', v_place_title,
      'actorName', v_actor_name,
      'fortificationLevel', NEW.fortification_level
    )
  );

  RETURN NEW;
END;
$$;

-- Trigger sur UPDATE de fortification_level (quand il augmente)
DROP TRIGGER IF EXISTS trg_log_fortify ON places;
CREATE TRIGGER trg_log_fortify
  AFTER UPDATE OF fortification_level ON places
  FOR EACH ROW
  WHEN (NEW.fortification_level > OLD.fortification_level)
  EXECUTE FUNCTION log_fortify_activity();
-- ============================================
-- MIGRATION 051 : Titres v2 — Conditions flexibles + Selection joueur
-- ============================================
-- 1. Remplace condition_type/condition_value par JSONB condition
-- 2. Ajoute displayed_general_title_ids sur users
-- 3. Helper check_title_condition()
-- 4. Rewrite get_user_titles() — retourne TOUS les titres generaux debloques
-- 5. Nouvelle RPC set_displayed_titles()
-- 6. Rewrite get_player_profile() — retourne titres affiches
-- ============================================

-- ============================================
-- 1. Schema : JSONB condition
-- ============================================

ALTER TABLE titles ADD COLUMN IF NOT EXISTS condition JSONB;

-- Migrer les donnees existantes
UPDATE titles
SET condition = jsonb_build_object('stat', condition_type, 'min', condition_value)
WHERE condition IS NULL;

ALTER TABLE titles ALTER COLUMN condition SET NOT NULL;
ALTER TABLE titles ALTER COLUMN condition SET DEFAULT '{"stat":"discoveries","min":0}'::jsonb;

ALTER TABLE titles DROP COLUMN IF EXISTS condition_type;
ALTER TABLE titles DROP COLUMN IF EXISTS condition_value;

-- ============================================
-- 2. Selection joueur (max 2 titres generaux)
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS displayed_general_title_ids INT[] DEFAULT '{}';

-- ============================================
-- 3. Helper check_title_condition()
-- ============================================

CREATE OR REPLACE FUNCTION public.check_title_condition(
  p_condition JSONB,
  p_stat_value INT,
  p_rank_value INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Seuil : {"stat": "xxx", "min": N}
  IF p_condition ? 'min' THEN
    RETURN p_stat_value >= (p_condition->>'min')::INT;
  END IF;

  -- Top N : {"stat": "xxx", "rank": N}
  IF p_condition ? 'rank' THEN
    RETURN p_rank_value <= (p_condition->>'rank')::INT;
  END IF;

  -- Classement : {"stat": "xxx", "rank_from": N, "rank_to": M}
  IF p_condition ? 'rank_from' AND p_condition ? 'rank_to' THEN
    RETURN p_rank_value >= (p_condition->>'rank_from')::INT
       AND p_rank_value <= (p_condition->>'rank_to')::INT;
  END IF;

  RETURN FALSE;
END;
$$;

-- ============================================
-- 4. Rewrite get_user_titles()
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Stats
  v_discoveries INT;
  v_claims INT;
  v_notoriety INT;
  v_likes INT;
  v_fortifications INT;
  v_faction_id VARCHAR(255);
  v_displayed_ids INT[];
  -- Rangs globaux
  v_grank_discoveries INT;
  v_grank_claims INT;
  v_grank_notoriety INT;
  v_grank_likes INT;
  v_grank_fortifications INT;
  -- Rangs faction
  v_frank_discoveries INT;
  v_frank_claims INT;
  v_frank_notoriety INT;
  v_frank_likes INT;
  v_frank_fortifications INT;
  -- Resultats
  v_general_all JSON;
  v_faction JSON;
  -- Helpers pour iteration
  v_title RECORD;
  v_stat TEXT;
  v_stat_val INT;
  v_rank_val INT;
  v_matched BOOLEAN;
  v_general_arr JSON[] := '{}';
BEGIN
  -- ====== Stats du joueur ======
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_claims FROM place_claims WHERE user_id = p_user_id;
  SELECT COALESCE(notoriety_points, 0), faction_id, COALESCE(displayed_general_title_ids, '{}')
    INTO v_notoriety, v_faction_id, v_displayed_ids
    FROM users WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_likes FROM places_liked WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_fortifications FROM activity_log
    WHERE actor_id = p_user_id AND type = 'fortify';

  -- ====== Rangs globaux ======
  SELECT COALESCE(r, 999999) INTO v_grank_discoveries FROM (
    SELECT user_id, RANK() OVER (ORDER BY cnt DESC) AS r
    FROM (SELECT user_id, COUNT(*) AS cnt FROM places_discovered GROUP BY user_id) sub
  ) ranked WHERE user_id = p_user_id;
  v_grank_discoveries := COALESCE(v_grank_discoveries, 999999);

  SELECT COALESCE(r, 999999) INTO v_grank_claims FROM (
    SELECT user_id, RANK() OVER (ORDER BY cnt DESC) AS r
    FROM (SELECT user_id, COUNT(*) AS cnt FROM place_claims GROUP BY user_id) sub
  ) ranked WHERE user_id = p_user_id;
  v_grank_claims := COALESCE(v_grank_claims, 999999);

  SELECT COALESCE(r, 999999) INTO v_grank_notoriety FROM (
    SELECT id AS user_id, RANK() OVER (ORDER BY COALESCE(notoriety_points, 0) DESC) AS r
    FROM users
  ) ranked WHERE user_id = p_user_id;
  v_grank_notoriety := COALESCE(v_grank_notoriety, 999999);

  SELECT COALESCE(r, 999999) INTO v_grank_likes FROM (
    SELECT user_id, RANK() OVER (ORDER BY cnt DESC) AS r
    FROM (SELECT user_id, COUNT(*) AS cnt FROM places_liked GROUP BY user_id) sub
  ) ranked WHERE user_id = p_user_id;
  v_grank_likes := COALESCE(v_grank_likes, 999999);

  SELECT COALESCE(r, 999999) INTO v_grank_fortifications FROM (
    SELECT actor_id AS user_id, RANK() OVER (ORDER BY cnt DESC) AS r
    FROM (SELECT actor_id, COUNT(*) AS cnt FROM activity_log WHERE type = 'fortify' GROUP BY actor_id) sub
  ) ranked WHERE user_id = p_user_id;
  v_grank_fortifications := COALESCE(v_grank_fortifications, 999999);

  -- ====== Rangs faction ======
  IF v_faction_id IS NOT NULL THEN
    SELECT COALESCE(r, 999999) INTO v_frank_discoveries FROM (
      SELECT pd.user_id, RANK() OVER (ORDER BY COUNT(*) DESC) AS r
      FROM places_discovered pd
      JOIN users u ON u.id = pd.user_id
      WHERE u.faction_id = v_faction_id
      GROUP BY pd.user_id
    ) ranked WHERE user_id = p_user_id;
    v_frank_discoveries := COALESCE(v_frank_discoveries, 999999);

    SELECT COALESCE(r, 999999) INTO v_frank_claims FROM (
      SELECT pc.user_id, RANK() OVER (ORDER BY COUNT(*) DESC) AS r
      FROM place_claims pc
      JOIN users u ON u.id = pc.user_id
      WHERE u.faction_id = v_faction_id
      GROUP BY pc.user_id
    ) ranked WHERE user_id = p_user_id;
    v_frank_claims := COALESCE(v_frank_claims, 999999);

    SELECT COALESCE(r, 999999) INTO v_frank_notoriety FROM (
      SELECT id AS user_id, RANK() OVER (ORDER BY COALESCE(notoriety_points, 0) DESC) AS r
      FROM users WHERE faction_id = v_faction_id
    ) ranked WHERE user_id = p_user_id;
    v_frank_notoriety := COALESCE(v_frank_notoriety, 999999);

    SELECT COALESCE(r, 999999) INTO v_frank_likes FROM (
      SELECT pl.user_id, RANK() OVER (ORDER BY COUNT(*) DESC) AS r
      FROM places_liked pl
      JOIN users u ON u.id = pl.user_id
      WHERE u.faction_id = v_faction_id
      GROUP BY pl.user_id
    ) ranked WHERE user_id = p_user_id;
    v_frank_likes := COALESCE(v_frank_likes, 999999);

    SELECT COALESCE(r, 999999) INTO v_frank_fortifications FROM (
      SELECT al.actor_id AS user_id, RANK() OVER (ORDER BY COUNT(*) DESC) AS r
      FROM activity_log al
      JOIN users u ON u.id = al.actor_id
      WHERE al.type = 'fortify' AND u.faction_id = v_faction_id
      GROUP BY al.actor_id
    ) ranked WHERE user_id = p_user_id;
    v_frank_fortifications := COALESCE(v_frank_fortifications, 999999);
  END IF;

  -- ====== Titres generaux debloques (TOUS) ======
  FOR v_title IN
    SELECT t.id, t.name, t.icon, t.unlocks, t."order", t.condition
    FROM titles t
    WHERE t.type = 'general'
    ORDER BY t."order" DESC
  LOOP
    v_stat := v_title.condition->>'stat';

    v_stat_val := CASE v_stat
      WHEN 'discoveries' THEN v_discoveries
      WHEN 'claims' THEN v_claims
      WHEN 'notoriety' THEN v_notoriety
      WHEN 'likes' THEN v_likes
      WHEN 'fortifications' THEN v_fortifications
      ELSE 0
    END;

    v_rank_val := CASE v_stat
      WHEN 'discoveries' THEN v_grank_discoveries
      WHEN 'claims' THEN v_grank_claims
      WHEN 'notoriety' THEN v_grank_notoriety
      WHEN 'likes' THEN v_grank_likes
      WHEN 'fortifications' THEN v_grank_fortifications
      ELSE 999999
    END;

    v_matched := check_title_condition(v_title.condition, v_stat_val, v_rank_val);

    IF v_matched THEN
      v_general_arr := array_append(v_general_arr,
        json_build_object(
          'id', v_title.id, 'name', v_title.name,
          'icon', v_title.icon, 'unlocks', v_title.unlocks,
          'order', v_title."order"
        )
      );
    END IF;
  END LOOP;

  -- Convertir en JSON array
  IF array_length(v_general_arr, 1) > 0 THEN
    v_general_all := array_to_json(v_general_arr);
  ELSE
    v_general_all := '[]'::json;
  END IF;

  -- ====== Titre de faction (highest order, automatique) ======
  IF v_faction_id IS NOT NULL THEN
    FOR v_title IN
      SELECT t.id, t.name, t.icon, t.unlocks, t."order", t.condition
      FROM titles t
      WHERE t.type = 'faction' AND t.faction_id = v_faction_id
      ORDER BY t."order" DESC
    LOOP
      v_stat := v_title.condition->>'stat';

      v_stat_val := CASE v_stat
        WHEN 'discoveries' THEN v_discoveries
        WHEN 'claims' THEN v_claims
        WHEN 'notoriety' THEN v_notoriety
        WHEN 'likes' THEN v_likes
        WHEN 'fortifications' THEN v_fortifications
        ELSE 0
      END;

      v_rank_val := CASE v_stat
        WHEN 'discoveries' THEN v_frank_discoveries
        WHEN 'claims' THEN v_frank_claims
        WHEN 'notoriety' THEN v_frank_notoriety
        WHEN 'likes' THEN v_frank_likes
        WHEN 'fortifications' THEN v_frank_fortifications
        ELSE 999999
      END;

      v_matched := check_title_condition(v_title.condition, v_stat_val, v_rank_val);

      IF v_matched THEN
        v_faction := json_build_object(
          'id', v_title.id, 'name', v_title.name,
          'icon', v_title.icon, 'unlocks', v_title.unlocks,
          'order', v_title."order"
        );
        EXIT; -- Premier match = highest order (tri DESC)
      END IF;
    END LOOP;
  END IF;

  RETURN json_build_object(
    'unlockedGeneralTitles', v_general_all,
    'factionTitle', v_faction,
    'displayedGeneralTitleIds', v_displayed_ids,
    'stats', json_build_object(
      'discoveries', v_discoveries,
      'claims', v_claims,
      'notoriety', v_notoriety,
      'likes', v_likes,
      'fortifications', v_fortifications
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_titles TO authenticated;

-- ============================================
-- 5. set_displayed_titles()
-- ============================================

CREATE OR REPLACE FUNCTION public.set_displayed_titles(
  p_user_id TEXT,
  p_title_ids INT[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Max 2 titres generaux
  IF array_length(p_title_ids, 1) > 2 THEN
    RETURN json_build_object('error', 'Maximum 2 titres generaux');
  END IF;

  -- Valider que les IDs sont des titres generaux existants
  IF p_title_ids IS NOT NULL AND array_length(p_title_ids, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(p_title_ids) tid
      WHERE NOT EXISTS (SELECT 1 FROM titles WHERE id = tid AND type = 'general')
    ) THEN
      RETURN json_build_object('error', 'Titre invalide');
    END IF;
  END IF;

  UPDATE users
  SET displayed_general_title_ids = COALESCE(p_title_ids, '{}')
  WHERE id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_displayed_titles TO authenticated;

-- ============================================
-- 6. Rewrite get_player_profile()
-- ============================================

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_avatar_url TEXT;
  v_titles_data JSON;
  v_displayed_ids INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
BEGIN
  -- Avatar
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_avatar_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = p_user_id;

  -- Charger titres via get_user_titles
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  -- Selection du joueur
  SELECT COALESCE(displayed_general_title_ids, '{}')
  INTO v_displayed_ids
  FROM users WHERE id = p_user_id;

  -- Filtrer les titres generaux affiches
  IF array_length(v_displayed_ids, 1) > 0 THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
    WHERE (elem->>'id')::INT = ANY(v_displayed_ids);
  END IF;

  -- Fallback : titre le plus haut (premier element, tri DESC)
  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM (
      SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
      LIMIT 1
    ) sub;
  END IF;

  -- Resultat
  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', v_avatar_url,
    'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;
-- ============================================
-- MIGRATION 052 : Profil unifie + Faction payante + Membres
-- ============================================
-- 1. set_user_faction rewrite — cout notoriete au changement
-- 2. get_faction_members() — liste des joueurs d'une faction
-- 3. get_player_profile() rewrite — bio, instagram, lieux ajoutes
-- 4. update_my_profile() — modifier bio + instagram
-- ============================================

-- ============================================
-- 1. set_user_faction — reset notoriete si changement
-- ============================================

CREATE OR REPLACE FUNCTION public.set_user_faction(
  p_user_id TEXT,
  p_faction_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_faction_id TEXT;
  v_notoriety_lost INT;
BEGIN
  -- Verifier que la faction existe (ou null pour quitter)
  IF p_faction_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM factions WHERE id = p_faction_id) THEN
      RETURN json_build_object('error', 'Faction not found');
    END IF;
  END IF;

  -- Recuperer l'ancienne faction + notoriete actuelle
  SELECT faction_id, COALESCE(notoriety_points, 0)
  INTO v_old_faction_id, v_notoriety_lost
  FROM users WHERE id = p_user_id;

  -- Solidifier : tous les lieux de l'ancienne faction deviennent des decouvertes
  IF v_old_faction_id IS NOT NULL THEN
    INSERT INTO places_discovered (user_id, place_id, method)
    SELECT p_user_id, p.id, 'remote'
    FROM places p
    WHERE p.faction_id = v_old_faction_id
    ON CONFLICT (user_id, place_id) DO NOTHING;
  END IF;

  -- Si CHANGEMENT de faction (avait une, passe a une autre differente) → reset notoriete
  IF v_old_faction_id IS NOT NULL
     AND p_faction_id IS NOT NULL
     AND v_old_faction_id != p_faction_id THEN
    UPDATE users
    SET faction_id = p_faction_id,
        notoriety_points = 0,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN json_build_object('success', true, 'notorietyLost', v_notoriety_lost);
  ELSE
    -- Premier join ou depart → pas de cout
    UPDATE users SET faction_id = p_faction_id, updated_at = NOW() WHERE id = p_user_id;
    RETURN json_build_object('success', true, 'notorietyLost', 0);
  END IF;
END;
$$;

-- ============================================
-- 2. get_faction_members(p_faction_id)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_faction_members(p_faction_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT COALESCE(json_agg(member), '[]'::json) INTO v_result
  FROM (
    SELECT json_build_object(
      'userId', u.id,
      'name', COALESCE(u.first_name, u.email_address),
      'profileImage', (
        SELECT COALESCE(
          (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
          (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
          (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
        )
        FROM image_media im WHERE im.id = u.profile_image_id
      ),
      'notorietyPoints', COALESCE(u.notoriety_points, 0),
      'displayedGeneralTitles', (
        SELECT COALESCE(json_agg(
          json_build_object('id', t.id, 'name', t.name, 'icon', t.icon)
        ), '[]'::json)
        FROM titles t
        WHERE t.id = ANY(COALESCE(u.displayed_general_title_ids, '{}'))
          AND t.type = 'general'
      ),
      'factionTitle2', (SELECT get_user_titles(u.id)->'factionTitle')
    ) AS member
    FROM users u
    WHERE u.faction_id = p_faction_id
    ORDER BY u.notoriety_points DESC NULLS LAST
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_faction_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_faction_members TO anon;

-- ============================================
-- 3. get_player_profile() — ajout bio, instagram, lieux
-- ============================================

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_avatar_url TEXT;
  v_titles_data JSON;
  v_displayed_ids INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_claimed_places JSON;
BEGIN
  -- Avatar
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_avatar_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = p_user_id;

  -- Charger titres via get_user_titles
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  -- Selection du joueur
  SELECT COALESCE(displayed_general_title_ids, '{}')
  INTO v_displayed_ids
  FROM users WHERE id = p_user_id;

  -- Filtrer les titres generaux affiches
  IF array_length(v_displayed_ids, 1) > 0 THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
    WHERE (elem->>'id')::INT = ANY(v_displayed_ids);
  END IF;

  -- Fallback : titre le plus haut (premier element, tri DESC)
  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM (
      SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
      LIMIT 1
    ) sub;
  END IF;

  -- Lieux ajoutes par le joueur (max 50, plus recents d'abord)
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_authored_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'createdAt', p.created_at,
      'imageUrl', CASE
        WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
        THEN p.images->0->>'url'
        ELSE NULL
      END
    ) AS place_data
    FROM places p
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.author_id = p_user_id
    ORDER BY p.created_at DESC
    LIMIT 50
  ) sub;

  -- Lieux explores (clic explicite "Explorer") par le joueur (max 50, plus recents d'abord)
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_discovered_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE
        WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
        THEN p.images->0->>'url'
        ELSE NULL
      END
    ) AS place_data
    FROM places_explored pe
    JOIN places p ON p.id = pe.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE pe.user_id = p_user_id
    ORDER BY pe.created_at DESC
    LIMIT 50
  ) sub;

  -- Lieux conquis (revendiques) par le joueur (max 50, plus recents d'abord)
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_claimed_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE
        WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
        THEN p.images->0->>'url'
        ELSE NULL
      END
    ) AS place_data
    FROM places p
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.claimed_by = p_user_id
    ORDER BY p.claimed_at DESC
    LIMIT 50
  ) sub;

  -- Resultat complet
  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', v_avatar_url,
    'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places,
    'discoveredPlaces', v_discovered_places,
    'claimedPlaces', v_claimed_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

-- ============================================
-- 4. update_my_profile(p_user_id, p_bio, p_instagram)
-- ============================================

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_user_id TEXT,
  p_bio TEXT DEFAULT NULL,
  p_instagram TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET bio = p_bio,
      instagram = p_instagram,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_profile TO authenticated;

-- ============================================
-- 5. delete_place(p_user_id, p_place_id)
-- ============================================

CREATE OR REPLACE FUNCTION public.delete_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_author_id TEXT;
  v_user_role TEXT;
BEGIN
  -- Verifier que le lieu existe et recuperer l'auteur
  SELECT author_id INTO v_author_id FROM places WHERE id = p_place_id;
  IF v_author_id IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Verifier les droits : auteur ou admin
  SELECT role INTO v_user_role FROM users WHERE id = p_user_id;
  IF v_author_id != p_user_id AND COALESCE(v_user_role, 'user') != 'admin' THEN
    RETURN json_build_object('error', 'Not authorized');
  END IF;

  -- Nettoyer activity_log (FK sans CASCADE)
  DELETE FROM activity_log WHERE place_id = p_place_id;

  -- Supprimer (CASCADE sur toutes les tables liees)
  DELETE FROM places WHERE id = p_place_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_place TO authenticated;

-- ============================================
-- 6. get_leaderboard(p_type, p_limit)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_type TEXT DEFAULT 'notoriety',
  p_limit INT DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'notoriety' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COALESCE(u.notoriety_points, 0) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', (
          SELECT COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
          FROM image_media im WHERE im.id = u.profile_image_id
        ),
        'factionColor', f.color,
        'value', COALESCE(u.notoriety_points, 0)
      ) AS row_data
      FROM users u
      LEFT JOIN factions f ON f.id = u.faction_id
      WHERE COALESCE(u.notoriety_points, 0) > 0
      ORDER BY COALESCE(u.notoriety_points, 0) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'authored' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', (
          SELECT COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
          FROM image_media im WHERE im.id = u.profile_image_id
        ),
        'factionColor', f.color,
        'value', COUNT(*)::INT
      ) AS row_data
      FROM users u
      JOIN places p ON p.author_id = u.id
      LEFT JOIN factions f ON f.id = u.faction_id
      GROUP BY u.id, u.first_name, u.email_address, u.profile_image_id, f.color
      ORDER BY COUNT(*) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'explored' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', (
          SELECT COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
          FROM image_media im WHERE im.id = u.profile_image_id
        ),
        'factionColor', f.color,
        'value', COUNT(*)::INT
      ) AS row_data
      FROM users u
      JOIN places_explored pe ON pe.user_id = u.id
      LEFT JOIN factions f ON f.id = u.faction_id
      GROUP BY u.id, u.first_name, u.email_address, u.profile_image_id, f.color
      ORDER BY COUNT(*) DESC
      LIMIT p_limit
    ) sub;

  ELSE
    v_result := '[]'::json;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard TO anon;
-- ============================================
-- 053 : Ajout de lieu depuis la carte
-- ============================================

-- RPC : create_place
-- Permet à un joueur authentifié d'ajouter un lieu sur la carte.
-- Gratuit (pas de coût en ressource).

CREATE OR REPLACE FUNCTION public.create_place(
  p_user_id    TEXT,
  p_title      TEXT,
  p_latitude   REAL,
  p_longitude  REAL,
  p_tag_id     TEXT,
  p_image_url  TEXT DEFAULT NULL,
  p_thumb_url  TEXT DEFAULT NULL,
  p_address    TEXT DEFAULT '',
  p_text       TEXT DEFAULT ''
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id     TEXT;
  v_actor_name TEXT;
  v_images     JSONB;
  v_img_obj    JSONB;
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Verify user exists
  IF NOT EXISTS(SELECT 1 FROM users WHERE id = p_user_id) THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- Verify tag exists
  IF NOT EXISTS(SELECT 1 FROM tags WHERE id = p_tag_id) THEN
    RETURN json_build_object('error', 'Tag not found');
  END IF;

  -- Generate place ID
  v_new_id := gen_random_uuid()::TEXT;

  -- Build images JSONB (avec thumb si fourni)
  IF p_image_url IS NOT NULL AND p_image_url <> '' THEN
    v_img_obj := jsonb_build_object('id', gen_random_uuid()::TEXT, 'url', p_image_url);
    IF p_thumb_url IS NOT NULL AND p_thumb_url <> '' THEN
      v_img_obj := v_img_obj || jsonb_build_object('thumb', p_thumb_url);
    END IF;
    v_images := jsonb_build_array(v_img_obj);
  ELSE
    v_images := '[]'::JSONB;
  END IF;

  -- Insert place
  INSERT INTO places (
    id, created_at, updated_at,
    author_id, place_type_id,
    title, text, address,
    latitude, longitude,
    images, private, masked
  ) VALUES (
    v_new_id, NOW(), NOW(),
    p_user_id, 'lieu',
    p_title, p_text, p_address,
    p_latitude, p_longitude,
    v_images, false, false
  );

  -- Insert primary tag
  INSERT INTO place_tags (place_id, tag_id, is_primary)
  VALUES (v_new_id, p_tag_id, true);

  -- Auto-discover (author discovers their own place)
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, v_new_id, 'gps')
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Activity log
  SELECT COALESCE(first_name, email_address) INTO v_actor_name
  FROM users WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'new_place',
    p_user_id,
    v_new_id,
    jsonb_build_object(
      'placeTitle', p_title,
      'placeLatitude', p_latitude,
      'placeLongitude', p_longitude,
      'actorName', v_actor_name
    )
  );

  RETURN json_build_object('success', true, 'placeId', v_new_id);
END;
$$;
-- ============================================
-- 054 : Policy INSERT sur places_viewed
-- ============================================
-- Permet aux utilisateurs authentifiés d'enregistrer une vue.

CREATE POLICY "Auth users can insert views"
  ON places_viewed FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
-- ============================================
-- 055 : Retirer le LIMIT 50 + servir les thumbnails
-- ============================================
-- 1. Retire le LIMIT 50 sur les 3 requêtes de lieux
-- 2. Préfère images->0->>'thumb' (400px) quand il existe,
--    sinon fallback sur images->0->>'url'

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_avatar_url TEXT;
  v_titles_data JSON;
  v_displayed_ids INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_claimed_places JSON;
BEGIN
  -- Avatar
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_avatar_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = p_user_id;

  -- Charger titres via get_user_titles
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  -- Selection du joueur
  SELECT COALESCE(displayed_general_title_ids, '{}')
  INTO v_displayed_ids
  FROM users WHERE id = p_user_id;

  -- Filtrer les titres generaux affiches
  IF array_length(v_displayed_ids, 1) > 0 THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
    WHERE (elem->>'id')::INT = ANY(v_displayed_ids);
  END IF;

  -- Fallback : titre le plus haut (premier element, tri DESC)
  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM (
      SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
      LIMIT 1
    ) sub;
  END IF;

  -- Lieux ajoutes par le joueur (plus recents d'abord, sans limite)
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_authored_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'createdAt', p.created_at,
      'imageUrl', CASE
        WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
        THEN COALESCE(p.images->0->>'thumb', p.images->0->>'url')
        ELSE NULL
      END
    ) AS place_data
    FROM places p
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.author_id = p_user_id
    ORDER BY p.created_at DESC
  ) sub;

  -- Lieux explores par le joueur (plus recents d'abord, sans limite)
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_discovered_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE
        WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
        THEN COALESCE(p.images->0->>'thumb', p.images->0->>'url')
        ELSE NULL
      END
    ) AS place_data
    FROM places_explored pe
    JOIN places p ON p.id = pe.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE pe.user_id = p_user_id
    ORDER BY pe.created_at DESC
  ) sub;

  -- Lieux conquis par le joueur (plus recents d'abord, sans limite)
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_claimed_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE
        WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
        THEN COALESCE(p.images->0->>'thumb', p.images->0->>'url')
        ELSE NULL
      END
    ) AS place_data
    FROM places p
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.claimed_by = p_user_id
    ORDER BY p.claimed_at DESC
  ) sub;

  -- Resultat complet
  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', v_avatar_url,
    'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places,
    'discoveredPlaces', v_discovered_places,
    'claimedPlaces', v_claimed_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;
-- ============================================
-- 056 : Ajouter p_first_name a update_my_profile
-- ============================================

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_user_id TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_instagram TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET first_name = COALESCE(p_first_name, first_name),
      bio = p_bio,
      instagram = p_instagram,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;
-- ============================================
-- 057 : Onboarding — avatar_url + update RPCs
-- ============================================

-- 1. Ajouter colonne avatar_url
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- 2. Etendre update_my_profile avec p_avatar_url
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_user_id TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_instagram TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET first_name = COALESCE(p_first_name, first_name),
      bio = p_bio,
      instagram = p_instagram,
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;

-- 3. Mettre a jour get_player_profile — avatar_url prioritaire
CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_avatar_url TEXT;
  v_titles_data JSON;
  v_displayed_ids INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_claimed_places JSON;
BEGIN
  -- Avatar : avatar_url prioritaire, fallback image_media
  SELECT COALESCE(
    u2.avatar_url,
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_avatar_url
  FROM users u2
  LEFT JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = p_user_id;

  -- Charger titres via get_user_titles
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  -- Selection du joueur
  SELECT COALESCE(displayed_general_title_ids, '{}')
  INTO v_displayed_ids
  FROM users WHERE id = p_user_id;

  -- Filtrer les titres generaux affiches
  IF array_length(v_displayed_ids, 1) > 0 THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
    WHERE (elem->>'id')::INT = ANY(v_displayed_ids);
  END IF;

  -- Fallback : titre le plus haut (premier element, tri DESC)
  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM (
      SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
      LIMIT 1
    ) sub;
  END IF;

  -- Lieux ajoutes par le joueur (plus recents d'abord, sans limite)
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_authored_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'createdAt', p.created_at,
      'imageUrl', CASE
        WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
        THEN COALESCE(p.images->0->>'thumb', p.images->0->>'url')
        ELSE NULL
      END
    ) AS place_data
    FROM places p
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.author_id = p_user_id
    ORDER BY p.created_at DESC
  ) sub;

  -- Lieux explores par le joueur (plus recents d'abord, sans limite)
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_discovered_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE
        WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
        THEN COALESCE(p.images->0->>'thumb', p.images->0->>'url')
        ELSE NULL
      END
    ) AS place_data
    FROM places_explored pe
    JOIN places p ON p.id = pe.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE pe.user_id = p_user_id
    ORDER BY pe.created_at DESC
  ) sub;

  -- Lieux conquis par le joueur (plus recents d'abord, sans limite)
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_claimed_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE
        WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
        THEN COALESCE(p.images->0->>'thumb', p.images->0->>'url')
        ELSE NULL
      END
    ) AS place_data
    FROM places p
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.claimed_by = p_user_id
    ORDER BY p.claimed_at DESC
  ) sub;

  -- Resultat complet
  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', v_avatar_url,
    'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places,
    'discoveredPlaces', v_discovered_places,
    'claimedPlaces', v_claimed_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

-- 4. Mettre a jour get_my_informations — avatar_url prioritaire
CREATE OR REPLACE FUNCTION public.get_my_informations(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_profile_image JSON;
  v_faction JSON;
BEGIN
  SELECT * INTO v_user FROM users WHERE id = p_user_id;
  IF v_user IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- Photo de profil : avatar_url prioritaire, fallback image_media
  IF v_user.avatar_url IS NOT NULL THEN
    v_profile_image := json_build_object('url', v_user.avatar_url);
  ELSIF v_user.profile_image_id IS NOT NULL THEN
    SELECT json_build_object(
      'id', im.id,
      'url', COALESCE(
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
      )
    ) INTO v_profile_image
    FROM image_media im
    WHERE im.id = v_user.profile_image_id;
  ELSE
    v_profile_image := NULL;
  END IF;

  -- Faction
  IF v_user.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'id', f.id,
      'title', f.title,
      'color', f.color,
      'pattern', f.pattern
    ) INTO v_faction
    FROM factions f
    WHERE f.id = v_user.faction_id;
  ELSE
    v_faction := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_user.id,
    'emailAddress', v_user.email_address,
    'role', COALESCE(v_user.role, 'user'),
    'rank', COALESCE(v_user.rank, 'guest'),
    'gender', v_user.gender,
    'lastName', v_user.last_name,
    'biography', COALESCE(v_user.bio, v_user.biography, ''),
    'instagramId', v_user.instagram_id,
    'websiteUrl', v_user.website_url,
    'profileImage', v_profile_image,
    'faction', v_faction
  );
END;
$$;
-- ============================================
-- MIGRATION 058 : RPC rename_faction
-- ============================================
-- Permet de renommer l'ID (handle) d'une faction.
-- Cascade sur toutes les tables qui referent factions(id).
-- ============================================

CREATE OR REPLACE FUNCTION public.rename_faction(
  p_old_id TEXT,
  p_new_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verifier que l'ancien ID existe
  IF NOT EXISTS(SELECT 1 FROM factions WHERE id = p_old_id) THEN
    RETURN json_build_object('error', 'Faction not found');
  END IF;

  -- Verifier que le nouvel ID n'existe pas deja
  IF EXISTS(SELECT 1 FROM factions WHERE id = p_new_id) THEN
    RETURN json_build_object('error', 'ID already exists');
  END IF;

  -- 1. Inserer la nouvelle faction (copie de l'ancienne)
  INSERT INTO factions (id, title, color, pattern, description, image_url, "order",
    bonus_energy, bonus_conquest, bonus_construction,
    bonus_regen_energy, bonus_regen_conquest, bonus_regen_construction,
    created_at, updated_at)
  SELECT p_new_id, title, color, pattern, description, image_url, "order",
    bonus_energy, bonus_conquest, bonus_construction,
    bonus_regen_energy, bonus_regen_conquest, bonus_regen_construction,
    created_at, NOW()
  FROM factions WHERE id = p_old_id;

  -- 2. Mettre a jour toutes les references
  UPDATE users SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE places SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE place_claims SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE activity_log SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE chat_messages SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE titles SET faction_id = p_new_id WHERE faction_id = p_old_id;

  -- 3. Supprimer l'ancienne faction
  DELETE FROM factions WHERE id = p_old_id;

  RETURN json_build_object('success', true, 'newId', p_new_id);
END;
$$;
-- ============================================
-- MIGRATION 059 : Backfill author discoveries
-- ============================================
-- Chaque auteur decouvre automatiquement ses propres lieux.
-- create_place le fait deja depuis la migration 053, mais les
-- lieux crees avant cette migration n'ont pas ete marques.
--
-- IMPORTANT : desactiver le trigger activity_log pour eviter
-- de creer des milliers de fausses notifications.
-- ============================================

-- Desactiver le trigger avant le backfill
ALTER TABLE places_discovered DISABLE TRIGGER trg_log_discover;

INSERT INTO places_discovered (user_id, place_id, method, discovered_at)
SELECT p.author_id, p.id, 'gps', p.created_at
FROM places p
WHERE p.author_id IS NOT NULL
ON CONFLICT (user_id, place_id) DO NOTHING;

-- Reactiver le trigger
ALTER TABLE places_discovered ENABLE TRIGGER trg_log_discover;
-- ============================================
-- MIGRATION 060 : Ajouter couleur faction au trigger fortify
-- ============================================

CREATE OR REPLACE FUNCTION public.log_fortify_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_name TEXT;
  v_place_title TEXT;
  v_place_lat DOUBLE PRECISION;
  v_place_lng DOUBLE PRECISION;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.claimed_by;
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng FROM places WHERE id = NEW.id;
  SELECT color, pattern INTO v_faction_color, v_faction_pattern FROM factions WHERE id = NEW.faction_id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'fortify',
    NEW.claimed_by,
    NEW.id,
    NEW.faction_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'fortificationLevel', NEW.fortification_level
    )
  );

  RETURN NEW;
END;
$$;
-- ============================================
-- MIGRATION 061 : Types de construction dynamiques
-- ============================================
-- Remplace les constantes hardcodees (FORTIFICATION_NAMES, etc.)
-- par une table construction_types geree depuis le Hub.
-- ============================================

CREATE TABLE IF NOT EXISTS construction_types (
  level INT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  cost INT NOT NULL DEFAULT 1,
  conquest_bonus INT NOT NULL DEFAULT 1,
  tag_ids TEXT[] DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed avec les 4 niveaux existants
INSERT INTO construction_types (level, name, description, cost, conquest_bonus) VALUES
  (1, 'Tour de guet',    'Coute +1 point de conquete aux ennemis pour revendiquer ce lieu.', 1, 1),
  (2, 'Tour de defense', 'Coute +2 points de conquete aux ennemis pour revendiquer ce lieu.', 2, 2),
  (3, 'Bastion',         'Coute +3 points de conquete aux ennemis pour revendiquer ce lieu.', 3, 3),
  (4, 'Befroi',          'Forteresse imprenable. Coute +4 points de conquete aux ennemis.', 5, 4)
ON CONFLICT (level) DO NOTHING;

-- RLS : lecture publique, ecriture admin
ALTER TABLE construction_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "construction_types_read" ON construction_types;
CREATE POLICY "construction_types_read" ON construction_types
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "construction_types_admin" ON construction_types;
CREATE POLICY "construction_types_admin" ON construction_types
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin')
  );

-- RPC pour lire tous les types (ordonnee par level)
CREATE OR REPLACE FUNCTION public.get_construction_types()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(json_agg(row_to_json(ct) ORDER BY ct.level), '[]'::json)
  FROM construction_types ct;
$$;

-- Mettre a jour fortify_place pour lire depuis la table
CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_max_level INT;
  v_cost INT;
  v_next_name TEXT;
  v_construction NUMERIC(6,1);
  v_max_construction NUMERIC(6,1) := 5.0;
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
  v_place_tags TEXT[];
BEGIN
  -- Verifier faction du user
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe et est revendique par la faction du user
  SELECT faction_id, fortification_level
  INTO v_place_faction, v_current_level
  FROM places WHERE id = p_place_id;

  IF v_place_faction IS NULL THEN
    RETURN json_build_object('error', 'Place not claimed');
  END IF;

  IF v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'Not your faction territory');
  END IF;

  -- Max level depuis la table
  SELECT MAX(level) INTO v_max_level FROM construction_types;
  IF v_max_level IS NULL THEN v_max_level := 0; END IF;

  IF v_current_level >= v_max_level THEN
    RETURN json_build_object('error', 'Max fortification reached');
  END IF;

  -- Tags du lieu (pour filtrage optionnel)
  SELECT ARRAY_AGG(tag_id) INTO v_place_tags
  FROM place_tags WHERE place_id = p_place_id;

  -- Cout et nom du prochain niveau
  SELECT ct.cost, ct.name INTO v_cost, v_next_name
  FROM construction_types ct
  WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_cost IS NULL THEN
    RETURN json_build_object('error', 'No construction type available for this level');
  END IF;

  -- Verifier les points de construction
  SELECT construction_points INTO v_construction FROM users WHERE id = p_user_id;
  IF v_construction < v_cost THEN
    RETURN json_build_object(
      'error', 'Not enough construction points',
      'constructionPoints', v_construction,
      'cost', v_cost
    );
  END IF;

  -- Deduire les points
  UPDATE users
  SET construction_points = construction_points - v_cost
  WHERE id = p_user_id;

  -- Incrementer le niveau
  UPDATE places
  SET fortification_level = v_current_level + 1,
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Recuperer l'etat final
  SELECT construction_points, construction_reset_at
  INTO v_construction, v_construction_reset_at
  FROM users WHERE id = p_user_id;

  -- Construction next point
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'fortificationLevel', v_current_level + 1,
    'fortificationName', v_next_name,
    'cost', v_cost
  );
END;
$$;
-- ============================================
-- MIGRATION 062 : Changement de faction = /2 notoriete
-- ============================================
-- Avant : notoriety_points = 0 lors d'un changement
-- Maintenant : notoriety_points = FLOOR(notoriety_points / 2)
-- ============================================

CREATE OR REPLACE FUNCTION public.set_user_faction(
  p_user_id TEXT,
  p_faction_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_faction_id TEXT;
  v_old_notoriety INT;
  v_new_notoriety INT;
  v_notoriety_lost INT;
BEGIN
  -- Verifier que la faction existe (ou null pour quitter)
  IF p_faction_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM factions WHERE id = p_faction_id) THEN
      RETURN json_build_object('error', 'Faction not found');
    END IF;
  END IF;

  -- Recuperer l'ancienne faction + notoriete actuelle
  SELECT faction_id, COALESCE(notoriety_points, 0)
  INTO v_old_faction_id, v_old_notoriety
  FROM users WHERE id = p_user_id;

  -- Solidifier : tous les lieux de l'ancienne faction deviennent des decouvertes
  IF v_old_faction_id IS NOT NULL THEN
    INSERT INTO places_discovered (user_id, place_id, method)
    SELECT p_user_id, p.id, 'remote'
    FROM places p
    WHERE p.faction_id = v_old_faction_id
    ON CONFLICT (user_id, place_id) DO NOTHING;
  END IF;

  -- Si CHANGEMENT de faction (avait une, passe a une autre differente) → diviser notoriete par 2
  IF v_old_faction_id IS NOT NULL
     AND p_faction_id IS NOT NULL
     AND v_old_faction_id != p_faction_id THEN

    v_new_notoriety := FLOOR(v_old_notoriety / 2);
    v_notoriety_lost := v_old_notoriety - v_new_notoriety;

    UPDATE users
    SET faction_id = p_faction_id,
        notoriety_points = v_new_notoriety,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN json_build_object('success', true, 'notorietyLost', v_notoriety_lost, 'notorietyPoints', v_new_notoriety);
  ELSE
    -- Premier join ou depart → pas de cout
    UPDATE users SET faction_id = p_faction_id, updated_at = NOW() WHERE id = p_user_id;
    RETURN json_build_object('success', true, 'notorietyLost', 0);
  END IF;
END;
$$;
-- ============================================
-- MIGRATION 063 : Cheat code — refill ressources
-- ============================================
-- RPC admin-only : remet les 3 jauges au max en base.
-- Vérifie que l'user est admin (role = 'admin').
-- ============================================

CREATE OR REPLACE FUNCTION public.cheat_refill(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_max_energy NUMERIC(4,1);
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
BEGIN
  -- Vérifier que c'est un admin
  SELECT role INTO v_role FROM users WHERE id = p_user_id;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- Lire les max + bonus faction
  SELECT u.max_energy, u.max_conquest, u.max_construction,
         COALESCE(f.bonus_energy, 0),
         COALESCE(f.bonus_conquest, 0),
         COALESCE(f.bonus_construction, 0)
  INTO v_max_energy, v_max_conquest, v_max_construction,
       v_bonus_energy, v_bonus_conquest, v_bonus_construction
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  -- Mettre au max + reset timestamps
  UPDATE users
  SET energy_points = v_max_energy + v_bonus_energy,
      energy_reset_at = NOW(),
      conquest_points = v_max_conquest + v_bonus_conquest,
      conquest_reset_at = NOW(),
      construction_points = v_max_construction + v_bonus_construction,
      construction_reset_at = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'energy', v_max_energy + v_bonus_energy,
    'maxEnergy', v_max_energy + v_bonus_energy,
    'conquestPoints', v_max_conquest + v_bonus_conquest,
    'maxConquest', v_max_conquest + v_bonus_conquest,
    'constructionPoints', v_max_construction + v_bonus_construction,
    'maxConstruction', v_max_construction + v_bonus_construction
  );
END;
$$;
-- ============================================
-- MIGRATION 064 : Notification "territoire perdu"
-- ============================================
-- Quand un joueur conquiert un lieu deja controle, l'ancien
-- controleur recoit une notification.
-- On stocke l'ancien proprietaire dans place_claims et on
-- l'inclut dans l'activity_log via le trigger.
-- ============================================

-- 1. Colonnes historique ancien controleur
ALTER TABLE place_claims ADD COLUMN IF NOT EXISTS previous_faction_id VARCHAR(255);
ALTER TABLE place_claims ADD COLUMN IF NOT EXISTS previous_claimed_by VARCHAR(255);

-- 2. MAJ claim_place : capturer l'ancien proprio AVANT l'update
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_prev_faction_id TEXT;
  v_prev_claimed_by TEXT;
BEGIN
  -- Recuperer la faction du user
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;

  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Capturer l'ancien controleur AVANT l'update
  SELECT faction_id, claimed_by
  INTO v_prev_faction_id, v_prev_claimed_by
  FROM places WHERE id = p_place_id;

  -- Revendiquer le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Historique (avec ancien proprio)
  INSERT INTO place_claims (place_id, user_id, faction_id, previous_faction_id, previous_claimed_by)
  VALUES (p_place_id, p_user_id, v_faction_id, v_prev_faction_id, v_prev_claimed_by);

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id
  );
END;
$$;

-- 3. MAJ trigger : inclure l'ancien controleur dans activity_log.data
CREATE OR REPLACE FUNCTION log_claim_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_title TEXT;
  v_place_lat DOUBLE PRECISION;
  v_place_lng DOUBLE PRECISION;
  v_faction_title TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_actor_name TEXT;
  v_prev_faction_title TEXT;
  v_prev_claimer_name TEXT;
BEGIN
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = NEW.place_id;
  SELECT title, color, pattern INTO v_faction_title, v_faction_color, v_faction_pattern
  FROM factions WHERE id = NEW.faction_id;
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.user_id;

  -- Ancien controleur (si le lieu etait deja revendique)
  IF NEW.previous_faction_id IS NOT NULL THEN
    SELECT title INTO v_prev_faction_title FROM factions WHERE id = NEW.previous_faction_id;
  END IF;
  IF NEW.previous_claimed_by IS NOT NULL THEN
    SELECT COALESCE(first_name, email_address) INTO v_prev_claimer_name FROM users WHERE id = NEW.previous_claimed_by;
  END IF;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'claim',
    NEW.user_id,
    NEW.place_id,
    NEW.faction_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'factionTitle', v_faction_title,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'actorName', v_actor_name,
      'previousClaimedBy', NEW.previous_claimed_by,
      'previousFactionId', NEW.previous_faction_id,
      'previousFactionTitle', v_prev_faction_title,
      'previousClaimerName', v_prev_claimer_name
    )
  );
  RETURN NEW;
END;
$$;
-- ============================================
-- MIGRATION 065 : Cheat code — refill un joueur cible par nom
-- ============================================
-- RPC admin-only. Cherche le joueur par first_name (insensible a la casse),
-- recharge ses 3 jauges au max.
-- ============================================

CREATE OR REPLACE FUNCTION public.cheat_refill_target(
  p_caller_id TEXT,
  p_target_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_target RECORD;
  v_max_energy NUMERIC(4,1);
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
BEGIN
  -- Verifier que l'appelant est admin
  SELECT role INTO v_role FROM users WHERE id = p_caller_id;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- Trouver le joueur cible par first_name (insensible a la casse)
  SELECT id, first_name INTO v_target
  FROM users
  WHERE LOWER(first_name) = LOWER(TRIM(p_target_name))
  LIMIT 1;

  IF v_target.id IS NULL THEN
    RETURN json_build_object('error', 'Joueur introuvable');
  END IF;

  -- Lire les max + bonus faction de la cible
  SELECT u.max_energy, u.max_conquest, u.max_construction,
         COALESCE(f.bonus_energy, 0),
         COALESCE(f.bonus_conquest, 0),
         COALESCE(f.bonus_construction, 0)
  INTO v_max_energy, v_max_conquest, v_max_construction,
       v_bonus_energy, v_bonus_conquest, v_bonus_construction
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = v_target.id;

  -- Mettre au max + reset timestamps
  UPDATE users
  SET energy_points = v_max_energy + v_bonus_energy,
      energy_reset_at = NOW(),
      conquest_points = v_max_conquest + v_bonus_conquest,
      conquest_reset_at = NOW(),
      construction_points = v_max_construction + v_bonus_construction,
      construction_reset_at = NOW()
  WHERE id = v_target.id;

  RETURN json_build_object(
    'success', true,
    'targetName', v_target.first_name,
    'targetId', v_target.id
  );
END;
$$;
-- ============================================
-- MIGRATION 066 : Corriger la regression de claim_place
-- ============================================
-- La migration 064 a ecrase claim_place avec une version simplifiee
-- qui a perdu : cout conquete, fortification, notoriete, bonus faction.
-- On restaure la logique complete de 049 + le tracking ancien proprio de 064.
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_fortification INT;
  v_claim_cost NUMERIC(6,1);
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_energy NUMERIC(4,1);
  v_notoriety INT;
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
  -- Ancien proprietaire (tracking 064)
  v_prev_faction_id TEXT;
  v_prev_claimed_by TEXT;
BEGIN
  -- Recuperer faction + max du user + bonus faction + cycles regen
  SELECT u.faction_id,
         GREATEST(1, u.max_conquest + COALESCE(f.bonus_conquest, 0)),
         GREATEST(1, u.max_construction + COALESCE(f.bonus_construction, 0)),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_conquest, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_construction, 0)) / 100)::INT)
  INTO v_faction_id, v_max_conquest, v_max_construction,
       v_conquest_cycle, v_construction_cycle
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe + lire fortification
  SELECT fortification_level INTO v_fortification
  FROM places WHERE id = p_place_id;

  IF v_fortification IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Cout dynamique : 1 + niveau de fortification
  v_claim_cost := 1 + COALESCE(v_fortification, 0);

  -- Verifier les points de conquete
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost
    );
  END IF;

  -- Capturer l'ancien controleur AVANT l'update (tracking 064)
  SELECT faction_id, claimed_by
  INTO v_prev_faction_id, v_prev_claimed_by
  FROM places WHERE id = p_place_id;

  -- Revendiquer le lieu (reset fortification a 0)
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = 0,
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Historique (avec ancien proprio)
  INSERT INTO place_claims (place_id, user_id, faction_id, previous_faction_id, previous_claimed_by)
  VALUES (p_place_id, p_user_id, v_faction_id, v_prev_faction_id, v_prev_claimed_by);

  -- Deduire le cout + ajouter notoriete
  UPDATE users
  SET conquest_points = conquest_points - v_claim_cost,
      notoriety_points = notoriety_points + 10
  WHERE id = p_user_id;

  -- Lire les valeurs mises a jour
  SELECT energy_points, conquest_points, conquest_reset_at,
         construction_points, construction_reset_at, notoriety_points
  INTO v_energy, v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at, v_notoriety
  FROM users WHERE id = p_user_id;

  -- Calculer le temps avant prochain point de conquete
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- Calculer le temps avant prochain point de construction
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id,
    'energy', v_energy,
    'conquestPoints', v_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', 0,
    'claimCost', v_claim_cost
  );
END;
$$;
-- ============================================
-- MIGRATION 067 : Fix handle_new_user — cascade FK
-- ============================================
-- Quand un ancien compte (email dans users mais pas dans auth)
-- essaie de se connecter, le trigger doit migrer l'ancien ID
-- vers le nouveau ID auth. Il faut aussi mettre a jour
-- toutes les tables qui referencent users.id.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id TEXT;
BEGIN
  -- Chercher si un user avec cet email existe deja
  SELECT id INTO v_existing_id
  FROM public.users
  WHERE email_address = COALESCE(NEW.email, '')
  LIMIT 1;

  IF v_existing_id IS NOT NULL AND v_existing_id != NEW.id::TEXT THEN
    -- L'email existe avec un autre ID : migrer toutes les FK vers le nouvel ID

    -- Tables avec user_id
    UPDATE places_discovered SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE place_claims SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE chat_messages SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE places_viewed SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE places_liked SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE places_explored SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE places_bookmarked SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE reviews SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE image_media SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE member_codes SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE hub_community_photos SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE hub_photo_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE hub_review_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;

    -- Tables avec moderated_by
    UPDATE hub_community_photos SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing_id;
    UPDATE hub_photo_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing_id;
    UPDATE hub_review_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing_id;

    -- Tables avec author_id / claimed_by / actor_id
    UPDATE places SET author_id = NEW.id::TEXT WHERE author_id = v_existing_id;
    UPDATE places SET claimed_by = NEW.id::TEXT WHERE claimed_by = v_existing_id;
    UPDATE activity_log SET actor_id = NEW.id::TEXT WHERE actor_id = v_existing_id;

    -- place_claims.previous_claimed_by (tracking conquete)
    UPDATE place_claims SET previous_claimed_by = NEW.id::TEXT WHERE previous_claimed_by = v_existing_id;

    -- Enfin, mettre a jour l'ID de l'user
    UPDATE public.users
    SET id = NEW.id::TEXT,
        updated_at = NOW()
    WHERE id = v_existing_id;

  ELSE
    -- Pas de doublon : insert normal avec ON CONFLICT sur id
    INSERT INTO public.users (
      id,
      email_address,
      last_name,
      gender,
      rank,
      role,
      bio,
      created_at,
      updated_at
    ) VALUES (
      NEW.id::TEXT,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'Aventurier'),
      COALESCE(NEW.raw_user_meta_data->>'gender', 'unknown'),
      'guest',
      'user',
      '',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email_address = COALESCE(EXCLUDED.email_address, public.users.email_address),
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;
-- ============================================
-- MIGRATION 068 : handle_new_user — version defensive
-- ============================================
-- Si la migration d'ID echoue (FK constraint, unique index, etc.),
-- on supprime l'ancien user (les FK CASCADE gerent le nettoyage)
-- et on cree un nouveau user propre.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id TEXT;
BEGIN
  -- Chercher si un user avec cet email existe deja
  SELECT id INTO v_existing_id
  FROM public.users
  WHERE LOWER(email_address) = LOWER(COALESCE(NEW.email, ''))
  LIMIT 1;

  IF v_existing_id IS NOT NULL AND v_existing_id != NEW.id::TEXT THEN
    -- L'email existe avec un ancien ID : tenter la migration
    BEGIN
      -- Tables avec user_id
      UPDATE places_discovered SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
      UPDATE place_claims SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
      UPDATE chat_messages SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
      UPDATE places_viewed SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
      UPDATE places_liked SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
      UPDATE places_explored SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
      UPDATE places_bookmarked SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
      UPDATE reviews SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
      UPDATE image_media SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
      UPDATE member_codes SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
      UPDATE hub_community_photos SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
      UPDATE hub_photo_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
      UPDATE hub_review_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;

      -- Tables avec moderated_by
      UPDATE hub_community_photos SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing_id;
      UPDATE hub_photo_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing_id;
      UPDATE hub_review_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing_id;

      -- Tables avec author_id / claimed_by / actor_id
      UPDATE places SET author_id = NEW.id::TEXT WHERE author_id = v_existing_id;
      UPDATE places SET claimed_by = NEW.id::TEXT WHERE claimed_by = v_existing_id;
      UPDATE activity_log SET actor_id = NEW.id::TEXT WHERE actor_id = v_existing_id;
      UPDATE place_claims SET previous_claimed_by = NEW.id::TEXT WHERE previous_claimed_by = v_existing_id;

      -- Migrer l'ID de l'user
      UPDATE public.users
      SET id = NEW.id::TEXT,
          updated_at = NOW()
      WHERE id = v_existing_id;

    EXCEPTION WHEN OTHERS THEN
      -- La migration a echoue : supprimer l'ancien user
      -- Les FK avec ON DELETE CASCADE nettoient automatiquement
      -- Les FK sans CASCADE (hub tables, activity_log) : on nettoie manuellement
      UPDATE hub_community_photos SET user_id = NULL WHERE user_id = v_existing_id;
      UPDATE hub_community_photos SET moderated_by = NULL WHERE moderated_by = v_existing_id;
      UPDATE hub_photo_submissions SET user_id = NULL WHERE user_id = v_existing_id;
      UPDATE hub_photo_submissions SET moderated_by = NULL WHERE moderated_by = v_existing_id;
      UPDATE hub_review_submissions SET user_id = NULL WHERE user_id = v_existing_id;
      UPDATE hub_review_submissions SET moderated_by = NULL WHERE moderated_by = v_existing_id;
      UPDATE activity_log SET actor_id = NULL WHERE actor_id = v_existing_id;
      UPDATE place_claims SET previous_claimed_by = NULL WHERE previous_claimed_by = v_existing_id;

      DELETE FROM public.users WHERE id = v_existing_id;

      -- Creer un user propre avec le nouvel ID
      INSERT INTO public.users (id, email_address, last_name, gender, rank, role, bio, created_at, updated_at)
      VALUES (
        NEW.id::TEXT,
        COALESCE(NEW.email, ''),
        'Aventurier', 'unknown', 'guest', 'user', '',
        NOW(), NOW()
      );
    END;

  ELSE
    -- Pas de doublon : insert normal
    INSERT INTO public.users (id, email_address, last_name, gender, rank, role, bio, created_at, updated_at)
    VALUES (
      NEW.id::TEXT,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'Aventurier'),
      COALESCE(NEW.raw_user_meta_data->>'gender', 'unknown'),
      'guest', 'user', '',
      NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email_address = COALESCE(EXCLUDED.email_address, public.users.email_address),
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;
-- ============================================
-- MIGRATION 069 : handle_new_user — bon ordre d'operations
-- ============================================
-- Bug : les UPDATE FK echouaient car le nouvel ID n'existait
-- pas encore dans users (violation de FK constraint).
-- Fix : 1) copier l'ancien user avec le nouvel ID
--        2) migrer les FK
--        3) supprimer l'ancien doublon
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
BEGIN
  -- Chercher si un user avec cet email existe deja
  SELECT * INTO v_existing
  FROM public.users
  WHERE LOWER(email_address) = LOWER(COALESCE(NEW.email, ''))
  LIMIT 1;

  IF v_existing.id IS NOT NULL AND v_existing.id != NEW.id::TEXT THEN
    -- 1) Creer un nouveau user avec le nouvel ID (copie de l'ancien)
    INSERT INTO public.users (
      id, email_address, first_name, last_name, gender, rank, role, bio,
      avatar_url, display_name, instagram, location_name, location_zip,
      faction_id, energy_points, energy_reset_at,
      conquest_points, conquest_reset_at,
      construction_points, construction_reset_at,
      max_energy, max_conquest, max_construction,
      notoriety_points, displayed_general_title_ids,
      is_active, website_url, profile_image_id,
      created_at, updated_at
    )
    SELECT
      NEW.id::TEXT,
      v_existing.email_address,
      v_existing.first_name,
      v_existing.last_name,
      v_existing.gender,
      v_existing.rank,
      v_existing.role,
      v_existing.bio,
      v_existing.avatar_url,
      v_existing.display_name,
      v_existing.instagram,
      v_existing.location_name,
      v_existing.location_zip,
      v_existing.faction_id,
      v_existing.energy_points,
      v_existing.energy_reset_at,
      v_existing.conquest_points,
      v_existing.conquest_reset_at,
      v_existing.construction_points,
      v_existing.construction_reset_at,
      v_existing.max_energy,
      v_existing.max_conquest,
      v_existing.max_construction,
      v_existing.notoriety_points,
      v_existing.displayed_general_title_ids,
      v_existing.is_active,
      v_existing.website_url,
      v_existing.profile_image_id,
      v_existing.created_at,
      NOW()
    ON CONFLICT (id) DO NOTHING;

    -- 2) Migrer toutes les FK de l'ancien ID vers le nouveau
    UPDATE places_discovered SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
    UPDATE place_claims SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
    UPDATE chat_messages SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
    UPDATE places_viewed SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
    UPDATE places_liked SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
    UPDATE places_explored SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
    UPDATE places_bookmarked SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
    UPDATE reviews SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
    UPDATE image_media SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
    UPDATE member_codes SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
    UPDATE hub_community_photos SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
    UPDATE hub_photo_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
    UPDATE hub_review_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
    UPDATE hub_community_photos SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
    UPDATE hub_photo_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
    UPDATE hub_review_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
    UPDATE places SET author_id = NEW.id::TEXT WHERE author_id = v_existing.id;
    UPDATE places SET claimed_by = NEW.id::TEXT WHERE claimed_by = v_existing.id;
    UPDATE activity_log SET actor_id = NEW.id::TEXT WHERE actor_id = v_existing.id;
    UPDATE place_claims SET previous_claimed_by = NEW.id::TEXT WHERE previous_claimed_by = v_existing.id;

    -- 3) Supprimer l'ancien doublon (plus aucune FK ne pointe dessus)
    DELETE FROM public.users WHERE id = v_existing.id;

  ELSE
    -- Pas de doublon : insert normal
    INSERT INTO public.users (id, email_address, last_name, gender, rank, role, bio, created_at, updated_at)
    VALUES (
      NEW.id::TEXT,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'Aventurier'),
      COALESCE(NEW.raw_user_meta_data->>'gender', 'unknown'),
      'guest', 'user', '',
      NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email_address = COALESCE(EXCLUDED.email_address, public.users.email_address),
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;
-- ============================================
-- MIGRATION 070 : Fortification mutualisee des blobs
-- ============================================
-- Quand des lieux de la meme faction sont proches (~5km),
-- leurs fortifications s'additionnent pour augmenter le cout
-- de conquete : cost = 1 + fort_lieu + floor(fort_voisins * 0.5)
-- ============================================

-- 1. Modifier claim_place pour inclure le bonus de zone
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_fortification INT;
  v_neighbor_fort INT;
  v_claim_cost NUMERIC(6,1);
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_energy NUMERIC(4,1);
  v_notoriety INT;
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
  -- Ancien proprietaire
  v_prev_faction_id TEXT;
  v_prev_claimed_by TEXT;
  -- Coordonnees du lieu cible
  v_lat REAL;
  v_lon REAL;
  v_current_faction TEXT;
BEGIN
  -- Recuperer faction + max du user + bonus faction + cycles regen
  SELECT u.faction_id,
         GREATEST(1, u.max_conquest + COALESCE(f.bonus_conquest, 0)),
         GREATEST(1, u.max_construction + COALESCE(f.bonus_construction, 0)),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_conquest, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_construction, 0)) / 100)::INT)
  INTO v_faction_id, v_max_conquest, v_max_construction,
       v_conquest_cycle, v_construction_cycle
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe + lire fortification + coordonnees + faction actuelle
  SELECT fortification_level, latitude, longitude, faction_id
  INTO v_fortification, v_lat, v_lon, v_current_faction
  FROM places WHERE id = p_place_id;

  IF v_fortification IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Calculer la fortification des voisins de meme faction (~10km)
  v_neighbor_fort := 0;
  IF v_current_faction IS NOT NULL THEN
    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_neighbor_fort
    FROM places p2
    WHERE p2.faction_id = v_current_faction
      AND p2.id != p_place_id
      AND p2.fortification_level > 0
      AND ABS(p2.latitude - v_lat) < 0.09
      AND ABS(p2.longitude - v_lon) < 0.127;
  END IF;

  -- Cout dynamique : 1 + fort du lieu + bonus zone (x0.5)
  v_claim_cost := 1 + COALESCE(v_fortification, 0) + FLOOR(v_neighbor_fort * 0.5);

  -- Verifier les points de conquete
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost,
      'neighborFort', v_neighbor_fort
    );
  END IF;

  -- Capturer l'ancien controleur AVANT l'update
  SELECT faction_id, claimed_by
  INTO v_prev_faction_id, v_prev_claimed_by
  FROM places WHERE id = p_place_id;

  -- Revendiquer le lieu (reset fortification a 0)
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = 0,
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Historique
  INSERT INTO place_claims (place_id, user_id, faction_id, previous_faction_id, previous_claimed_by)
  VALUES (p_place_id, p_user_id, v_faction_id, v_prev_faction_id, v_prev_claimed_by);

  -- Deduire le cout + ajouter notoriete
  UPDATE users
  SET conquest_points = conquest_points - v_claim_cost,
      notoriety_points = notoriety_points + 10
  WHERE id = p_user_id;

  -- Lire les valeurs mises a jour
  SELECT energy_points, conquest_points, conquest_reset_at,
         construction_points, construction_reset_at, notoriety_points
  INTO v_energy, v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at, v_notoriety
  FROM users WHERE id = p_user_id;

  -- Calculer le temps avant prochain point de conquete
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- Calculer le temps avant prochain point de construction
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id,
    'energy', v_energy,
    'conquestPoints', v_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', 0,
    'claimCost', v_claim_cost,
    'neighborFort', v_neighbor_fort
  );
END;
$$;

-- 2. Modifier get_place_by_id pour retourner zoneFortification
CREATE OR REPLACE FUNCTION public.get_place_by_id(
  p_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place RECORD;
  v_place_type RECORD;
  v_author RECORD;
  v_views_count INT;
  v_likes_count INT;
  v_explored_count INT;
  v_geocache_count INT;
  v_avg_score DOUBLE PRECISION;
  v_last_explorers JSON;
  v_requester JSON;
  v_author_profile_url TEXT;
  v_primary_tag JSON;
  v_all_tags JSON;
  v_claim JSON;
  v_zone_fort INT;
BEGIN
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT * INTO v_place_type FROM place_types WHERE id = v_place.place_type_id;
  SELECT * INTO v_author FROM users WHERE id = v_place.author_id;

  -- Photo de profil de l'auteur
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_author_profile_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = v_place.author_id;

  -- Metrics
  SELECT COUNT(*) INTO v_views_count FROM places_viewed WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_likes_count FROM places_liked WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_explored_count FROM places_explored WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_geocache_count FROM reviews WHERE place_id = p_id AND geocache = true;
  SELECT AVG(score) INTO v_avg_score FROM reviews WHERE place_id = p_id;

  -- Derniers explorateurs
  SELECT json_agg(explorer) INTO v_last_explorers
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'lastName', u.last_name,
      'profileImageUrl', CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
    WHERE pe.place_id = p_id AND pe.user_id != v_place.author_id
    ORDER BY pe.updated_at DESC
  ) sub;

  -- Tag primaire
  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'color', t.color,
    'background', t.background
  ) INTO v_primary_tag
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_id AND ptag.is_primary = TRUE
  LIMIT 1;

  -- Tous les tags
  SELECT json_agg(tag_data) INTO v_all_tags
  FROM (
    SELECT json_build_object(
      'id', t.id,
      'title', t.title,
      'color', t.color,
      'background', t.background,
      'isPrimary', ptag.is_primary
    ) AS tag_data
    FROM place_tags ptag
    JOIN tags t ON t.id = ptag.tag_id
    WHERE ptag.place_id = p_id
    ORDER BY ptag.is_primary DESC, t."order"
  ) sub;

  -- Requester state
  IF p_user_id IS NOT NULL THEN
    v_requester := json_build_object(
      'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked WHERE place_id = p_id AND user_id = p_user_id),
      'liked', EXISTS(SELECT 1 FROM places_liked WHERE place_id = p_id AND user_id = p_user_id),
      'explored', EXISTS(SELECT 1 FROM places_explored WHERE place_id = p_id AND user_id = p_user_id)
    );
  ELSE
    v_requester := NULL;
  END IF;

  -- Fortification de zone : somme des fort des voisins same-faction (~10km)
  v_zone_fort := 0;
  IF v_place.faction_id IS NOT NULL THEN
    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_zone_fort
    FROM places p2
    WHERE p2.faction_id = v_place.faction_id
      AND p2.id != p_id
      AND p2.fortification_level > 0
      AND ABS(p2.latitude - v_place.latitude) < 0.09
      AND ABS(p2.longitude - v_place.longitude) < 0.127;
  END IF;

  -- Claim info (avec fortification + zone)
  IF v_place.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'factionId', f.id,
      'factionTitle', f.title,
      'factionColor', f.color,
      'factionPattern', f.pattern,
      'claimedBy', v_place.claimed_by,
      'claimedAt', v_place.claimed_at,
      'fortificationLevel', v_place.fortification_level,
      'zoneFortification', v_zone_fort
    ) INTO v_claim
    FROM factions f
    WHERE f.id = v_place.faction_id;
  ELSE
    v_claim := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_place.id,
    'title', v_place.title,
    'text', v_place.text,
    'address', v_place.address,
    'accessibility', v_place.accessibility,
    'sensible', COALESCE(v_place.sensible, false),
    'geocaching', v_geocache_count > 0,
    'images', v_place.images,
    'author', json_build_object(
      'id', COALESCE(v_author.id, v_place.author_id),
      'lastName', COALESCE(v_author.first_name, v_author.last_name, 'Utilisateur inconnu'),
      'profileImageUrl', v_author_profile_url
    ),
    'type', json_build_object(
      'id', v_place_type.id,
      'title', v_place_type.title
    ),
    'primaryTag', v_primary_tag,
    'tags', COALESCE(v_all_tags, '[]'::json),
    'location', json_build_object(
      'latitude', v_place.latitude,
      'longitude', v_place.longitude
    ),
    'metrics', json_build_object(
      'views', v_views_count,
      'likes', v_likes_count,
      'explored', v_explored_count,
      'note', v_avg_score
    ),
    'claim', v_claim,
    'requester', v_requester,
    'lastExplorers', COALESCE(v_last_explorers, '[]'::json),
    'beginAt', v_place.begin_at,
    'endAt', v_place.end_at,
    'createdAt', v_place.created_at
  );
END;
$$;
-- ============================================
-- MIGRATION 071 : Fix cheat_refill_target pour accents
-- ============================================
-- Le cheat code 1453>Mathéo ne trouvait pas le joueur
-- a cause des differences de normalisation Unicode (NFC/NFD)
-- sur le caractere é. On utilise normalize(NFC) + unaccent
-- pour comparer les noms sans accents ni problemes d'encodage.
-- ============================================

-- Activer l'extension unaccent (standard PostgreSQL, dispo sur Supabase)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Recréer la fonction avec comparaison insensible aux accents
CREATE OR REPLACE FUNCTION public.cheat_refill_target(
  p_caller_id TEXT,
  p_target_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_target RECORD;
  v_max_energy NUMERIC(4,1);
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
BEGIN
  -- Verifier que l'appelant est admin
  SELECT role INTO v_role FROM users WHERE id = p_caller_id;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- Trouver le joueur cible par first_name (insensible casse + accents + NFC/NFD)
  SELECT id, first_name INTO v_target
  FROM users
  WHERE LOWER(unaccent(normalize(first_name, NFC))) = LOWER(unaccent(normalize(TRIM(p_target_name), NFC)))
  LIMIT 1;

  IF v_target.id IS NULL THEN
    RETURN json_build_object('error', 'Joueur introuvable');
  END IF;

  -- Lire les max + bonus faction de la cible
  SELECT u.max_energy, u.max_conquest, u.max_construction,
         COALESCE(f.bonus_energy, 0),
         COALESCE(f.bonus_conquest, 0),
         COALESCE(f.bonus_construction, 0)
  INTO v_max_energy, v_max_conquest, v_max_construction,
       v_bonus_energy, v_bonus_conquest, v_bonus_construction
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = v_target.id;

  -- Mettre au max + reset timestamps
  UPDATE users
  SET energy_points = v_max_energy + v_bonus_energy,
      energy_reset_at = NOW(),
      conquest_points = v_max_conquest + v_bonus_conquest,
      conquest_reset_at = NOW(),
      construction_points = v_max_construction + v_bonus_construction,
      construction_reset_at = NOW()
  WHERE id = v_target.id;

  RETURN json_build_object(
    'success', true,
    'targetName', v_target.first_name,
    'targetId', v_target.id
  );
END;
$$;
-- ============================================
-- MIGRATION 072 : Fix acteur dans les toasts de fortification
-- ============================================
-- Le trigger log_fortify_activity utilisait NEW.claimed_by
-- (proprietaire du lieu) au lieu du joueur qui fortifie.
-- On supprime le trigger et on deplace le log dans la RPC
-- fortify_place qui a acces au vrai p_user_id.
-- ============================================

-- 1. Supprimer le trigger
DROP TRIGGER IF EXISTS trg_fortify_activity ON places;
DROP TRIGGER IF EXISTS trg_log_fortify ON places;

-- 2. Mettre a jour fortify_place pour logger l'activite directement
CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_max_level INT;
  v_cost INT;
  v_next_name TEXT;
  v_construction NUMERIC(6,1);
  v_max_construction NUMERIC(6,1) := 5.0;
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
  v_place_tags TEXT[];
  -- Pour le log d'activite
  v_actor_name TEXT;
  v_place_title TEXT;
  v_place_lat DOUBLE PRECISION;
  v_place_lng DOUBLE PRECISION;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  -- Verifier faction du user
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe et est revendique par la faction du user
  SELECT faction_id, fortification_level
  INTO v_place_faction, v_current_level
  FROM places WHERE id = p_place_id;

  IF v_place_faction IS NULL THEN
    RETURN json_build_object('error', 'Place not claimed');
  END IF;

  IF v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'Not your faction territory');
  END IF;

  -- Max level depuis la table
  SELECT MAX(level) INTO v_max_level FROM construction_types;
  IF v_max_level IS NULL THEN v_max_level := 0; END IF;

  IF v_current_level >= v_max_level THEN
    RETURN json_build_object('error', 'Max fortification reached');
  END IF;

  -- Tags du lieu (pour filtrage optionnel)
  SELECT ARRAY_AGG(tag_id) INTO v_place_tags
  FROM place_tags WHERE place_id = p_place_id;

  -- Cout et nom du prochain niveau
  SELECT ct.cost, ct.name INTO v_cost, v_next_name
  FROM construction_types ct
  WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_cost IS NULL THEN
    RETURN json_build_object('error', 'No construction type available for this level');
  END IF;

  -- Verifier les points de construction
  SELECT construction_points INTO v_construction FROM users WHERE id = p_user_id;
  IF v_construction < v_cost THEN
    RETURN json_build_object(
      'error', 'Not enough construction points',
      'constructionPoints', v_construction,
      'cost', v_cost
    );
  END IF;

  -- Deduire les points
  UPDATE users
  SET construction_points = construction_points - v_cost
  WHERE id = p_user_id;

  -- Incrementer le niveau
  UPDATE places
  SET fortification_level = v_current_level + 1,
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Logger l'activite avec le VRAI acteur (p_user_id, pas claimed_by)
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = p_user_id;
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  SELECT color, pattern INTO v_faction_color, v_faction_pattern FROM factions WHERE id = v_user_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'fortify',
    p_user_id,
    p_place_id,
    v_user_faction,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'fortificationLevel', v_current_level + 1
    )
  );

  -- Recuperer l'etat final
  SELECT construction_points, construction_reset_at
  INTO v_construction, v_construction_reset_at
  FROM users WHERE id = p_user_id;

  -- Construction next point
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'fortificationLevel', v_current_level + 1,
    'fortificationName', v_next_name,
    'cost', v_cost
  );
END;
$$;
-- ============================================
-- MIGRATION 073 : Zone fortification — verifier l'overlap des territoires
-- ============================================
-- Le bonus de zone ne s'applique QUE si les cercles de territoire
-- se touchent (territoires fusionnes visuellement).
-- Formule rayon : 0.25 + sqrt(score - 1) * 0.65 km
-- Formule score : likes + vues*0.1 + explorations*2
-- Condition : distance(A,B) <= rayon(A) + rayon(B)
-- ============================================

-- 1. Helper : score d'influence d'un lieu
CREATE OR REPLACE FUNCTION public.place_influence_score(p_place_id TEXT)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT GREATEST(0, ROUND(
    COALESCE((SELECT COUNT(*) FROM places_liked WHERE place_id = p_place_id), 0)
    + COALESCE((SELECT COUNT(*) FROM places_viewed WHERE place_id = p_place_id), 0) * 0.1
    + COALESCE((SELECT COUNT(*) FROM places_explored WHERE place_id = p_place_id), 0) * 2
  ))::int;
$$;

-- 2. Helper : rayon de territoire en km (meme formule que territoryWorker.ts)
CREATE OR REPLACE FUNCTION public.territory_radius_km(p_score INT)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_score <= 0 THEN 0.0
    WHEN p_score <= 1 THEN 0.25
    ELSE 0.25 + sqrt(p_score - 1) * 0.65
  END;
$$;

-- 3. Mettre a jour claim_place — bonus zone seulement si territoires fusionnes
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_fortification INT;
  v_neighbor_fort INT;
  v_claim_cost NUMERIC(6,1);
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_energy NUMERIC(4,1);
  v_notoriety INT;
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
  v_prev_faction_id TEXT;
  v_prev_claimed_by TEXT;
  v_lat REAL;
  v_lon REAL;
  v_current_faction TEXT;
  v_target_score INT;
  v_target_radius DOUBLE PRECISION;
BEGIN
  -- Recuperer faction + max du user + bonus faction + cycles regen
  SELECT u.faction_id,
         GREATEST(1, u.max_conquest + COALESCE(f.bonus_conquest, 0)),
         GREATEST(1, u.max_construction + COALESCE(f.bonus_construction, 0)),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_conquest, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_construction, 0)) / 100)::INT)
  INTO v_faction_id, v_max_conquest, v_max_construction,
       v_conquest_cycle, v_construction_cycle
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe + lire fortification + coordonnees + faction actuelle
  SELECT fortification_level, latitude, longitude, faction_id
  INTO v_fortification, v_lat, v_lon, v_current_faction
  FROM places WHERE id = p_place_id;

  IF v_fortification IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Score et rayon du lieu cible
  v_target_score := place_influence_score(p_place_id);
  v_target_radius := territory_radius_km(v_target_score);

  -- Fortification des voisins dont le territoire est fusionne (cercles qui se touchent)
  v_neighbor_fort := 0;
  IF v_current_faction IS NOT NULL THEN
    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_neighbor_fort
    FROM places p2
    WHERE p2.faction_id = v_current_faction
      AND p2.id != p_place_id
      AND p2.fortification_level > 0
      AND ABS(p2.latitude - v_lat) < 0.09
      AND ABS(p2.longitude - v_lon) < 0.127
      -- Verifier que les cercles de territoire se touchent
      AND (v_target_radius + territory_radius_km(place_influence_score(p2.id)))
          >= sqrt(
            pow((p2.latitude - v_lat) * 111, 2)
            + pow((p2.longitude - v_lon) * 79, 2)
          );
  END IF;

  -- Cout dynamique : 1 + fort du lieu + bonus zone (x0.5)
  v_claim_cost := 1 + COALESCE(v_fortification, 0) + FLOOR(v_neighbor_fort * 0.5);

  -- Verifier les points de conquete
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost,
      'neighborFort', v_neighbor_fort
    );
  END IF;

  -- Capturer l'ancien controleur AVANT l'update
  SELECT faction_id, claimed_by
  INTO v_prev_faction_id, v_prev_claimed_by
  FROM places WHERE id = p_place_id;

  -- Revendiquer le lieu (reset fortification a 0)
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = 0,
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Historique
  INSERT INTO place_claims (place_id, user_id, faction_id, previous_faction_id, previous_claimed_by)
  VALUES (p_place_id, p_user_id, v_faction_id, v_prev_faction_id, v_prev_claimed_by);

  -- Deduire le cout + ajouter notoriete
  UPDATE users
  SET conquest_points = conquest_points - v_claim_cost,
      notoriety_points = notoriety_points + 10
  WHERE id = p_user_id;

  -- Lire les valeurs mises a jour
  SELECT energy_points, conquest_points, conquest_reset_at,
         construction_points, construction_reset_at, notoriety_points
  INTO v_energy, v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at, v_notoriety
  FROM users WHERE id = p_user_id;

  -- Calculer le temps avant prochain point de conquete
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- Calculer le temps avant prochain point de construction
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id,
    'energy', v_energy,
    'conquestPoints', v_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', 0,
    'claimCost', v_claim_cost,
    'neighborFort', v_neighbor_fort
  );
END;
$$;

-- 4. Mettre a jour get_place_by_id — zone fort seulement si territoires fusionnes
CREATE OR REPLACE FUNCTION public.get_place_by_id(
  p_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place RECORD;
  v_place_type RECORD;
  v_author RECORD;
  v_views_count INT;
  v_likes_count INT;
  v_explored_count INT;
  v_geocache_count INT;
  v_avg_score DOUBLE PRECISION;
  v_last_explorers JSON;
  v_requester JSON;
  v_author_profile_url TEXT;
  v_primary_tag JSON;
  v_all_tags JSON;
  v_claim JSON;
  v_zone_fort INT;
  v_target_score INT;
  v_target_radius DOUBLE PRECISION;
  v_claimer_name TEXT;
BEGIN
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT * INTO v_place_type FROM place_types WHERE id = v_place.place_type_id;
  SELECT * INTO v_author FROM users WHERE id = v_place.author_id;

  -- Photo de profil de l'auteur
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_author_profile_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = v_place.author_id;

  -- Metrics
  SELECT COUNT(*) INTO v_views_count FROM places_viewed WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_likes_count FROM places_liked WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_explored_count FROM places_explored WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_geocache_count FROM reviews WHERE place_id = p_id AND geocache = true;
  SELECT AVG(score) INTO v_avg_score FROM reviews WHERE place_id = p_id;

  -- Derniers explorateurs
  SELECT json_agg(explorer) INTO v_last_explorers
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'lastName', u.last_name,
      'profileImageUrl', CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
    WHERE pe.place_id = p_id AND pe.user_id != v_place.author_id
    ORDER BY pe.updated_at DESC
  ) sub;

  -- Tag primaire
  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'color', t.color,
    'background', t.background
  ) INTO v_primary_tag
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_id AND ptag.is_primary = TRUE
  LIMIT 1;

  -- Tous les tags
  SELECT json_agg(tag_data) INTO v_all_tags
  FROM (
    SELECT json_build_object(
      'id', t.id,
      'title', t.title,
      'color', t.color,
      'background', t.background,
      'isPrimary', ptag.is_primary
    ) AS tag_data
    FROM place_tags ptag
    JOIN tags t ON t.id = ptag.tag_id
    WHERE ptag.place_id = p_id
    ORDER BY ptag.is_primary DESC, t."order"
  ) sub;

  -- Requester state
  IF p_user_id IS NOT NULL THEN
    v_requester := json_build_object(
      'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked WHERE place_id = p_id AND user_id = p_user_id),
      'liked', EXISTS(SELECT 1 FROM places_liked WHERE place_id = p_id AND user_id = p_user_id),
      'explored', EXISTS(SELECT 1 FROM places_explored WHERE place_id = p_id AND user_id = p_user_id)
    );
  ELSE
    v_requester := NULL;
  END IF;

  -- Fortification de zone : seulement les voisins dont le territoire est fusionne
  v_zone_fort := 0;
  IF v_place.faction_id IS NOT NULL THEN
    v_target_score := place_influence_score(p_id);
    v_target_radius := territory_radius_km(v_target_score);

    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_zone_fort
    FROM places p2
    WHERE p2.faction_id = v_place.faction_id
      AND p2.id != p_id
      AND p2.fortification_level > 0
      AND ABS(p2.latitude - v_place.latitude) < 0.09
      AND ABS(p2.longitude - v_place.longitude) < 0.127
      -- Verifier que les cercles de territoire se touchent
      AND (v_target_radius + territory_radius_km(place_influence_score(p2.id)))
          >= sqrt(
            pow((p2.latitude - v_place.latitude) * 111, 2)
            + pow((p2.longitude - v_place.longitude) * 79, 2)
          );
  END IF;

  -- Nom du joueur qui a revendique
  IF v_place.claimed_by IS NOT NULL THEN
    SELECT COALESCE(first_name, last_name, 'Inconnu')
    INTO v_claimer_name
    FROM users WHERE id = v_place.claimed_by;
  END IF;

  -- Claim info (avec fortification + zone + nom du joueur)
  IF v_place.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'factionId', f.id,
      'factionTitle', f.title,
      'factionColor', f.color,
      'factionPattern', f.pattern,
      'claimedBy', v_place.claimed_by,
      'claimedByName', COALESCE(v_claimer_name, 'Inconnu'),
      'claimedAt', v_place.claimed_at,
      'fortificationLevel', v_place.fortification_level,
      'zoneFortification', v_zone_fort
    ) INTO v_claim
    FROM factions f
    WHERE f.id = v_place.faction_id;
  ELSE
    v_claim := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_place.id,
    'title', v_place.title,
    'text', v_place.text,
    'address', v_place.address,
    'accessibility', v_place.accessibility,
    'sensible', COALESCE(v_place.sensible, false),
    'geocaching', v_geocache_count > 0,
    'images', v_place.images,
    'author', json_build_object(
      'id', COALESCE(v_author.id, v_place.author_id),
      'lastName', COALESCE(v_author.first_name, v_author.last_name, 'Utilisateur inconnu'),
      'profileImageUrl', v_author_profile_url
    ),
    'type', json_build_object(
      'id', v_place_type.id,
      'title', v_place_type.title
    ),
    'primaryTag', v_primary_tag,
    'tags', COALESCE(v_all_tags, '[]'::json),
    'location', json_build_object(
      'latitude', v_place.latitude,
      'longitude', v_place.longitude
    ),
    'metrics', json_build_object(
      'views', v_views_count,
      'likes', v_likes_count,
      'explored', v_explored_count,
      'note', v_avg_score
    ),
    'claim', v_claim,
    'requester', v_requester,
    'lastExplorers', COALESCE(v_last_explorers, '[]'::json),
    'beginAt', v_place.begin_at,
    'endAt', v_place.end_at,
    'createdAt', v_place.created_at
  );
END;
$$;
-- ============================================
-- MIGRATION 074 : handle_new_user — safe v2
-- ============================================
-- Bug : "Database error saving new user" pour les comptes pre-Supabase.
-- Cause : UNIQUE INDEX sur email_address dans public.users.
-- Le trigger essayait d'INSERT un nouveau user avec le meme email
-- que l'ancien → violation de l'index unique.
-- Fix : vider l'email de l'ancien user AVANT d'inserer le nouveau.
-- v_existing (RECORD) garde la valeur originale en memoire.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_err TEXT;
BEGIN
  -- Chercher si un user avec cet email existe deja
  SELECT * INTO v_existing
  FROM public.users
  WHERE LOWER(email_address) = LOWER(COALESCE(NEW.email, ''))
  LIMIT 1;

  IF v_existing.id IS NOT NULL AND v_existing.id != NEW.id::TEXT THEN
    -- Ancien compte pre-Supabase : migrer vers le nouvel auth ID
    BEGIN
      -- 0) Vider l'email de l'ancien user pour liberer l'index unique
      --    (v_existing garde la valeur originale en memoire)
      UPDATE public.users SET email_address = '' WHERE id = v_existing.id;

      -- 1) Creer un nouveau user avec le nouvel ID (copie de l'ancien)
      INSERT INTO public.users (
        id, email_address, first_name, last_name, gender, rank, role, bio,
        avatar_url, display_name, instagram, location_name, location_zip,
        faction_id, energy_points, energy_reset_at,
        conquest_points, conquest_reset_at,
        construction_points, construction_reset_at,
        max_energy, max_conquest, max_construction,
        notoriety_points, displayed_general_title_ids,
        is_active, website_url, profile_image_id,
        created_at, updated_at
      )
      SELECT
        NEW.id::TEXT,
        v_existing.email_address,
        v_existing.first_name,
        v_existing.last_name,
        v_existing.gender,
        v_existing.rank,
        v_existing.role,
        v_existing.bio,
        v_existing.avatar_url,
        v_existing.display_name,
        v_existing.instagram,
        v_existing.location_name,
        v_existing.location_zip,
        v_existing.faction_id,
        v_existing.energy_points,
        v_existing.energy_reset_at,
        v_existing.conquest_points,
        v_existing.conquest_reset_at,
        v_existing.construction_points,
        v_existing.construction_reset_at,
        v_existing.max_energy,
        v_existing.max_conquest,
        v_existing.max_construction,
        v_existing.notoriety_points,
        v_existing.displayed_general_title_ids,
        v_existing.is_active,
        v_existing.website_url,
        v_existing.profile_image_id,
        v_existing.created_at,
        NOW()
      ON CONFLICT (id) DO NOTHING;

      -- 2) Migrer toutes les FK de l'ancien ID vers le nouveau
      UPDATE places_discovered SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE place_claims SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE chat_messages SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_viewed SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_liked SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_explored SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_bookmarked SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE reviews SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE image_media SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE member_codes SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_community_photos SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_photo_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_review_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_community_photos SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE hub_photo_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE hub_review_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE places SET author_id = NEW.id::TEXT WHERE author_id = v_existing.id;
      UPDATE places SET claimed_by = NEW.id::TEXT WHERE claimed_by = v_existing.id;
      UPDATE activity_log SET actor_id = NEW.id::TEXT WHERE actor_id = v_existing.id;
      UPDATE place_claims SET previous_claimed_by = NEW.id::TEXT WHERE previous_claimed_by = v_existing.id;

      -- 3) Supprimer l'ancien doublon (email deja vide, FKs migrees)
      DELETE FROM public.users WHERE id = v_existing.id;

    EXCEPTION WHEN OTHERS THEN
      -- Log l'erreur mais ne bloque JAMAIS la creation du compte auth
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE WARNING '[handle_new_user] Migration failed for % (old_id=%, new_id=%): %',
        NEW.email, v_existing.id, NEW.id, v_err;

      -- S'assurer qu'un user existe quand meme avec le nouvel ID
      -- Utiliser un email vide pour eviter le conflit unique
      INSERT INTO public.users (id, email_address, first_name, last_name, gender, rank, role, bio, created_at, updated_at)
      VALUES (
        NEW.id::TEXT,
        '',
        COALESCE(v_existing.first_name, 'Aventurier'),
        COALESCE(v_existing.last_name, ''),
        COALESCE(v_existing.gender, 'unknown'),
        COALESCE(v_existing.rank, 'guest'),
        COALESCE(v_existing.role, 'user'),
        COALESCE(v_existing.bio, ''),
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    END;

  ELSE
    -- Pas de doublon : insert normal
    INSERT INTO public.users (id, email_address, last_name, gender, rank, role, bio, created_at, updated_at)
    VALUES (
      NEW.id::TEXT,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'Aventurier'),
      COALESCE(NEW.raw_user_meta_data->>'gender', 'unknown'),
      'guest', 'user', '',
      NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email_address = COALESCE(EXCLUDED.email_address, public.users.email_address),
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;
-- ============================================
-- MIGRATION 075 : RLS pour le canal chat 'bugs'
-- ============================================
-- Le canal 'bugs' n'est ni 'general' ni un faction_id.
-- Les policies existantes le bloquaient car la policy faction
-- exigeait faction_id = 'bugs' qui n'existe pas.
-- ============================================

-- SELECT bugs : tous les authentifies
CREATE POLICY "chat_read_bugs" ON chat_messages FOR SELECT
  USING (channel = 'bugs' AND auth.role() = 'authenticated');

-- INSERT bugs : authentifie, son propre user_id
CREATE POLICY "chat_insert_bugs" ON chat_messages FOR INSERT
  WITH CHECK (
    channel = 'bugs'
    AND auth.uid()::text = user_id
  );

-- Corriger la policy faction pour exclure 'bugs'
-- (sinon elle match channel != 'general' et echoue sur le check faction_id)
DROP POLICY IF EXISTS "chat_read_faction" ON chat_messages;
CREATE POLICY "chat_read_faction" ON chat_messages FOR SELECT
  USING (
    channel NOT IN ('general', 'bugs')
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::text
        AND faction_id = chat_messages.channel
    )
  );

DROP POLICY IF EXISTS "chat_insert_faction" ON chat_messages;
CREATE POLICY "chat_insert_faction" ON chat_messages FOR INSERT
  WITH CHECK (
    channel NOT IN ('general', 'bugs')
    AND auth.uid()::text = user_id
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::text
        AND faction_id = channel
    )
  );
-- ============================================
-- MIGRATION 076 : Supprimer last_name
-- ============================================
-- La colonne last_name n'est plus utilisee.
-- On met a jour TOUTES les fonctions qui la referencent,
-- puis on supprime la colonne.
-- ============================================

-- =============================================
-- 1. get_my_informations (derniere version : 057)
-- =============================================
CREATE OR REPLACE FUNCTION public.get_my_informations(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_profile_image JSON;
  v_faction JSON;
BEGIN
  SELECT * INTO v_user FROM users WHERE id = p_user_id;
  IF v_user IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- Photo de profil : avatar_url prioritaire, fallback image_media
  IF v_user.avatar_url IS NOT NULL THEN
    v_profile_image := json_build_object('url', v_user.avatar_url);
  ELSIF v_user.profile_image_id IS NOT NULL THEN
    SELECT json_build_object(
      'id', im.id,
      'url', COALESCE(
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
      )
    ) INTO v_profile_image
    FROM image_media im
    WHERE im.id = v_user.profile_image_id;
  ELSE
    v_profile_image := NULL;
  END IF;

  -- Faction
  IF v_user.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'id', f.id,
      'title', f.title,
      'color', f.color,
      'pattern', f.pattern
    ) INTO v_faction
    FROM factions f
    WHERE f.id = v_user.faction_id;
  ELSE
    v_faction := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_user.id,
    'emailAddress', v_user.email_address,
    'role', COALESCE(v_user.role, 'user'),
    'rank', COALESCE(v_user.rank, 'guest'),
    'gender', v_user.gender,
    'lastName', COALESCE(v_user.display_name, v_user.first_name, 'Aventurier'),
    'biography', COALESCE(v_user.bio, v_user.biography, ''),
    'instagramId', v_user.instagram_id,
    'websiteUrl', v_user.website_url,
    'profileImage', v_profile_image,
    'faction', v_faction
  );
END;
$$;

-- =============================================
-- 2. get_place_by_id (derniere version : 073)
-- =============================================
CREATE OR REPLACE FUNCTION public.get_place_by_id(
  p_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place RECORD;
  v_place_type RECORD;
  v_author RECORD;
  v_views_count INT;
  v_likes_count INT;
  v_explored_count INT;
  v_geocache_count INT;
  v_avg_score DOUBLE PRECISION;
  v_last_explorers JSON;
  v_requester JSON;
  v_author_profile_url TEXT;
  v_primary_tag JSON;
  v_all_tags JSON;
  v_claim JSON;
  v_zone_fort INT;
  v_target_score INT;
  v_target_radius DOUBLE PRECISION;
  v_claimer_name TEXT;
BEGIN
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT * INTO v_place_type FROM place_types WHERE id = v_place.place_type_id;
  SELECT * INTO v_author FROM users WHERE id = v_place.author_id;

  -- Photo de profil de l'auteur
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_author_profile_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = v_place.author_id;

  -- Metrics
  SELECT COUNT(*) INTO v_views_count FROM places_viewed WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_likes_count FROM places_liked WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_explored_count FROM places_explored WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_geocache_count FROM reviews WHERE place_id = p_id AND geocache = true;
  SELECT AVG(score) INTO v_avg_score FROM reviews WHERE place_id = p_id;

  -- Derniers explorateurs
  SELECT json_agg(explorer) INTO v_last_explorers
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'lastName', COALESCE(u.display_name, u.first_name, 'Aventurier'),
      'profileImageUrl', CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
    WHERE pe.place_id = p_id AND pe.user_id != v_place.author_id
    ORDER BY pe.updated_at DESC
  ) sub;

  -- Tag primaire
  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'color', t.color,
    'background', t.background
  ) INTO v_primary_tag
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_id AND ptag.is_primary = TRUE
  LIMIT 1;

  -- Tous les tags
  SELECT json_agg(tag_data) INTO v_all_tags
  FROM (
    SELECT json_build_object(
      'id', t.id,
      'title', t.title,
      'color', t.color,
      'background', t.background,
      'isPrimary', ptag.is_primary
    ) AS tag_data
    FROM place_tags ptag
    JOIN tags t ON t.id = ptag.tag_id
    WHERE ptag.place_id = p_id
    ORDER BY ptag.is_primary DESC, t."order"
  ) sub;

  -- Requester state
  IF p_user_id IS NOT NULL THEN
    v_requester := json_build_object(
      'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked WHERE place_id = p_id AND user_id = p_user_id),
      'liked', EXISTS(SELECT 1 FROM places_liked WHERE place_id = p_id AND user_id = p_user_id),
      'explored', EXISTS(SELECT 1 FROM places_explored WHERE place_id = p_id AND user_id = p_user_id)
    );
  ELSE
    v_requester := NULL;
  END IF;

  -- Fortification de zone : seulement les voisins dont le territoire est fusionne
  v_zone_fort := 0;
  IF v_place.faction_id IS NOT NULL THEN
    v_target_score := place_influence_score(p_id);
    v_target_radius := territory_radius_km(v_target_score);

    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_zone_fort
    FROM places p2
    WHERE p2.faction_id = v_place.faction_id
      AND p2.id != p_id
      AND p2.fortification_level > 0
      AND ABS(p2.latitude - v_place.latitude) < 0.09
      AND ABS(p2.longitude - v_place.longitude) < 0.127
      AND (v_target_radius + territory_radius_km(place_influence_score(p2.id)))
          >= sqrt(
            pow((p2.latitude - v_place.latitude) * 111, 2)
            + pow((p2.longitude - v_place.longitude) * 79, 2)
          );
  END IF;

  -- Nom du joueur qui a revendique
  IF v_place.claimed_by IS NOT NULL THEN
    SELECT COALESCE(display_name, first_name, 'Inconnu')
    INTO v_claimer_name
    FROM users WHERE id = v_place.claimed_by;
  END IF;

  -- Claim info
  IF v_place.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'factionId', f.id,
      'factionTitle', f.title,
      'factionColor', f.color,
      'factionPattern', f.pattern,
      'claimedBy', v_place.claimed_by,
      'claimedByName', COALESCE(v_claimer_name, 'Inconnu'),
      'claimedAt', v_place.claimed_at,
      'fortificationLevel', v_place.fortification_level,
      'zoneFortification', v_zone_fort
    ) INTO v_claim
    FROM factions f
    WHERE f.id = v_place.faction_id;
  ELSE
    v_claim := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_place.id,
    'title', v_place.title,
    'text', v_place.text,
    'address', v_place.address,
    'accessibility', v_place.accessibility,
    'sensible', COALESCE(v_place.sensible, false),
    'geocaching', v_geocache_count > 0,
    'images', v_place.images,
    'author', json_build_object(
      'id', COALESCE(v_author.id, v_place.author_id),
      'lastName', COALESCE(v_author.display_name, v_author.first_name, 'Utilisateur inconnu'),
      'profileImageUrl', v_author_profile_url
    ),
    'type', json_build_object(
      'id', v_place_type.id,
      'title', v_place_type.title
    ),
    'primaryTag', v_primary_tag,
    'tags', COALESCE(v_all_tags, '[]'::json),
    'location', json_build_object(
      'latitude', v_place.latitude,
      'longitude', v_place.longitude
    ),
    'metrics', json_build_object(
      'views', v_views_count,
      'likes', v_likes_count,
      'explored', v_explored_count,
      'note', v_avg_score
    ),
    'claim', v_claim,
    'requester', v_requester,
    'lastExplorers', COALESCE(v_last_explorers, '[]'::json),
    'beginAt', v_place.begin_at,
    'endAt', v_place.end_at,
    'createdAt', v_place.created_at
  );
END;
$$;

-- =============================================
-- 3. handle_new_user (derniere version : 074)
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_err TEXT;
BEGIN
  SELECT * INTO v_existing
  FROM public.users
  WHERE LOWER(email_address) = LOWER(COALESCE(NEW.email, ''))
  LIMIT 1;

  IF v_existing.id IS NOT NULL AND v_existing.id != NEW.id::TEXT THEN
    BEGIN
      UPDATE public.users SET email_address = '' WHERE id = v_existing.id;

      INSERT INTO public.users (
        id, email_address, first_name, gender, rank, role, bio,
        avatar_url, display_name, instagram, location_name, location_zip,
        faction_id, energy_points, energy_reset_at,
        conquest_points, conquest_reset_at,
        construction_points, construction_reset_at,
        max_energy, max_conquest, max_construction,
        notoriety_points, displayed_general_title_ids,
        is_active, website_url, profile_image_id,
        created_at, updated_at
      )
      SELECT
        NEW.id::TEXT,
        v_existing.email_address,
        v_existing.first_name,
        v_existing.gender,
        v_existing.rank,
        v_existing.role,
        v_existing.bio,
        v_existing.avatar_url,
        v_existing.display_name,
        v_existing.instagram,
        v_existing.location_name,
        v_existing.location_zip,
        v_existing.faction_id,
        v_existing.energy_points,
        v_existing.energy_reset_at,
        v_existing.conquest_points,
        v_existing.conquest_reset_at,
        v_existing.construction_points,
        v_existing.construction_reset_at,
        v_existing.max_energy,
        v_existing.max_conquest,
        v_existing.max_construction,
        v_existing.notoriety_points,
        v_existing.displayed_general_title_ids,
        v_existing.is_active,
        v_existing.website_url,
        v_existing.profile_image_id,
        v_existing.created_at,
        NOW()
      ON CONFLICT (id) DO NOTHING;

      UPDATE places_discovered SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE place_claims SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE chat_messages SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_viewed SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_liked SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_explored SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_bookmarked SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE reviews SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE image_media SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE member_codes SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_community_photos SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_photo_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_review_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_community_photos SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE hub_photo_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE hub_review_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE places SET author_id = NEW.id::TEXT WHERE author_id = v_existing.id;
      UPDATE places SET claimed_by = NEW.id::TEXT WHERE claimed_by = v_existing.id;
      UPDATE activity_log SET actor_id = NEW.id::TEXT WHERE actor_id = v_existing.id;
      UPDATE place_claims SET previous_claimed_by = NEW.id::TEXT WHERE previous_claimed_by = v_existing.id;

      DELETE FROM public.users WHERE id = v_existing.id;

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE WARNING '[handle_new_user] Migration failed for % (old_id=%, new_id=%): %',
        NEW.email, v_existing.id, NEW.id, v_err;

      INSERT INTO public.users (id, email_address, first_name, gender, rank, role, bio, created_at, updated_at)
      VALUES (
        NEW.id::TEXT,
        '',
        COALESCE(v_existing.first_name, 'Aventurier'),
        COALESCE(v_existing.gender, 'unknown'),
        COALESCE(v_existing.rank, 'guest'),
        COALESCE(v_existing.role, 'user'),
        COALESCE(v_existing.bio, ''),
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    END;

  ELSE
    INSERT INTO public.users (id, email_address, gender, rank, role, bio, created_at, updated_at)
    VALUES (
      NEW.id::TEXT,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'gender', 'unknown'),
      'guest', 'user', '',
      NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email_address = COALESCE(EXCLUDED.email_address, public.users.email_address),
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================
-- 4. create_user_from_submission (derniere version : 004)
-- =============================================
DROP FUNCTION IF EXISTS public.create_user_from_submission(VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_user_from_submission(VARCHAR, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.create_user_from_submission(
  p_id VARCHAR(255),
  p_email TEXT,
  p_first_name TEXT,
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
  INSERT INTO users (id, email_address, first_name, instagram, location_name, location_zip, role, is_active, rank, biography)
  VALUES (p_id, p_email, p_first_name, p_instagram, p_location_name, p_location_zip, 'user', true, 0, '');
  RETURN p_id;
END;
$$;

-- =============================================
-- 5. ENFIN : Supprimer la colonne last_name
-- =============================================
ALTER TABLE public.users DROP COLUMN IF EXISTS last_name;
-- ============================================
-- MIGRATION 077 : game_mode (exploration / conquest)
-- ============================================
-- Ajout d'une colonne game_mode sur users.
-- Par defaut 'exploration'. Les joueurs existants restent en exploration.
-- MAJ de get_my_informations pour retourner gameMode.
-- MAJ de update_my_profile pour accepter p_game_mode.
-- ============================================

-- 1. Colonne
ALTER TABLE users ADD COLUMN IF NOT EXISTS game_mode VARCHAR(20) DEFAULT 'exploration';

-- 2. get_my_informations : ajouter gameMode dans le retour
CREATE OR REPLACE FUNCTION public.get_my_informations(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_profile_image JSON;
  v_faction JSON;
BEGIN
  SELECT * INTO v_user FROM users WHERE id = p_user_id;
  IF v_user IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- Photo de profil : avatar_url prioritaire, fallback image_media
  IF v_user.avatar_url IS NOT NULL THEN
    v_profile_image := json_build_object('url', v_user.avatar_url);
  ELSIF v_user.profile_image_id IS NOT NULL THEN
    SELECT json_build_object(
      'id', im.id,
      'url', COALESCE(
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
      )
    ) INTO v_profile_image
    FROM image_media im
    WHERE im.id = v_user.profile_image_id;
  ELSE
    v_profile_image := NULL;
  END IF;

  -- Faction
  IF v_user.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'id', f.id,
      'title', f.title,
      'color', f.color,
      'pattern', f.pattern
    ) INTO v_faction
    FROM factions f
    WHERE f.id = v_user.faction_id;
  ELSE
    v_faction := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_user.id,
    'emailAddress', v_user.email_address,
    'role', COALESCE(v_user.role, 'user'),
    'rank', COALESCE(v_user.rank, 'guest'),
    'gender', v_user.gender,
    'lastName', COALESCE(v_user.display_name, v_user.first_name, 'Aventurier'),
    'biography', COALESCE(v_user.bio, v_user.biography, ''),
    'instagramId', v_user.instagram_id,
    'websiteUrl', v_user.website_url,
    'profileImage', v_profile_image,
    'faction', v_faction,
    'gameMode', COALESCE(v_user.game_mode, 'exploration')
  );
END;
$$;

-- 3. update_my_profile : accepter p_game_mode
-- Dropper l'ancienne signature (5 params) pour eviter l'ambiguite PostgREST
DROP FUNCTION IF EXISTS public.update_my_profile(TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_user_id TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_instagram TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_game_mode TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET first_name = COALESCE(p_first_name, first_name),
      bio = p_bio,
      instagram = p_instagram,
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      game_mode = COALESCE(p_game_mode, game_mode),
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;
-- ============================================
-- MIGRATION 078 : Nouveaux users heritent les max jauges du role
-- ============================================
-- Bug : les nouveaux comptes recevaient energy/conquest/construction = 5
-- (valeur DEFAULT SQL) au lieu des max configures dans le Hub.
-- Fix : apres l'INSERT, copier les max d'un user existant du meme role
-- et demarrer avec les jauges pleines.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_err TEXT;
  v_max_e NUMERIC(4,1);
  v_max_c NUMERIC(6,1);
  v_max_b NUMERIC(6,1);
BEGIN
  -- Chercher si un user avec cet email existe deja
  SELECT * INTO v_existing
  FROM public.users
  WHERE LOWER(email_address) = LOWER(COALESCE(NEW.email, ''))
  LIMIT 1;

  IF v_existing.id IS NOT NULL AND v_existing.id != NEW.id::TEXT THEN
    -- Ancien compte pre-Supabase : migrer vers le nouvel auth ID
    BEGIN
      -- 0) Vider l'email de l'ancien user pour liberer l'index unique
      UPDATE public.users SET email_address = '' WHERE id = v_existing.id;

      -- 1) Creer un nouveau user avec le nouvel ID (copie de l'ancien)
      INSERT INTO public.users (
        id, email_address, first_name, gender, rank, role, bio,
        avatar_url, display_name, instagram, location_name, location_zip,
        faction_id, energy_points, energy_reset_at,
        conquest_points, conquest_reset_at,
        construction_points, construction_reset_at,
        max_energy, max_conquest, max_construction,
        notoriety_points, displayed_general_title_ids,
        is_active, website_url, profile_image_id,
        created_at, updated_at
      )
      SELECT
        NEW.id::TEXT,
        v_existing.email_address,
        v_existing.first_name,
        v_existing.gender,
        v_existing.rank,
        v_existing.role,
        v_existing.bio,
        v_existing.avatar_url,
        v_existing.display_name,
        v_existing.instagram,
        v_existing.location_name,
        v_existing.location_zip,
        v_existing.faction_id,
        v_existing.energy_points,
        v_existing.energy_reset_at,
        v_existing.conquest_points,
        v_existing.conquest_reset_at,
        v_existing.construction_points,
        v_existing.construction_reset_at,
        v_existing.max_energy,
        v_existing.max_conquest,
        v_existing.max_construction,
        v_existing.notoriety_points,
        v_existing.displayed_general_title_ids,
        v_existing.is_active,
        v_existing.website_url,
        v_existing.profile_image_id,
        v_existing.created_at,
        NOW()
      ON CONFLICT (id) DO NOTHING;

      -- 2) Migrer toutes les FK de l'ancien ID vers le nouveau
      UPDATE places_discovered SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE place_claims SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE chat_messages SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_viewed SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_liked SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_explored SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_bookmarked SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE reviews SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE image_media SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE member_codes SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_community_photos SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_photo_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_review_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_community_photos SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE hub_photo_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE hub_review_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE places SET author_id = NEW.id::TEXT WHERE author_id = v_existing.id;
      UPDATE places SET claimed_by = NEW.id::TEXT WHERE claimed_by = v_existing.id;
      UPDATE activity_log SET actor_id = NEW.id::TEXT WHERE actor_id = v_existing.id;
      UPDATE place_claims SET previous_claimed_by = NEW.id::TEXT WHERE previous_claimed_by = v_existing.id;

      -- 3) Supprimer l'ancien doublon (email deja vide, FKs migrees)
      DELETE FROM public.users WHERE id = v_existing.id;

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE WARNING '[handle_new_user] Migration failed for % (old_id=%, new_id=%): %',
        NEW.email, v_existing.id, NEW.id, v_err;

      INSERT INTO public.users (id, email_address, first_name, gender, rank, role, bio, created_at, updated_at)
      VALUES (
        NEW.id::TEXT,
        '',
        COALESCE(v_existing.first_name, 'Aventurier'),
        COALESCE(v_existing.gender, 'unknown'),
        COALESCE(v_existing.rank, 'guest'),
        COALESCE(v_existing.role, 'user'),
        COALESCE(v_existing.bio, ''),
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    END;

  ELSE
    -- Pas de doublon : insert normal
    -- Lire les max jauges d'un user existant du role 'user' (source de verite = Hub Reglages)
    SELECT max_energy, max_conquest, max_construction
    INTO v_max_e, v_max_c, v_max_b
    FROM public.users
    WHERE role = 'user'
    ORDER BY created_at ASC
    LIMIT 1;

    -- Fallback : si aucun user n'existe encore, utiliser les DEFAULT SQL
    v_max_e := COALESCE(v_max_e, 5.0);
    v_max_c := COALESCE(v_max_c, 5.0);
    v_max_b := COALESCE(v_max_b, 5.0);

    INSERT INTO public.users (
      id, email_address, gender, rank, role, bio,
      max_energy, max_conquest, max_construction,
      energy_points, conquest_points, construction_points,
      energy_reset_at, conquest_reset_at, construction_reset_at,
      created_at, updated_at
    )
    VALUES (
      NEW.id::TEXT,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'gender', 'unknown'),
      'guest', 'user', '',
      v_max_e, v_max_c, v_max_b,
      v_max_e, v_max_c, v_max_b,
      NOW(), NOW(), NOW(),
      NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email_address = COALESCE(EXCLUDED.email_address, public.users.email_address),
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;
-- ============================================
-- MIGRATION 079 : Identite des Territoires
-- ============================================
-- 1. Table territory_tiers (titres progressifs configurables)
-- 2. Table territory_names (noms custom par le top contributeur)
-- 3. RPC name_territory
-- 4. MAJ get_map_places : ajouter claimedById
-- ============================================

-- =========================================
-- 1. territory_tiers
-- =========================================
CREATE TABLE IF NOT EXISTS territory_tiers (
  id SERIAL PRIMARY KEY,
  min_places INT NOT NULL UNIQUE,
  title VARCHAR(50) NOT NULL
);

INSERT INTO territory_tiers (min_places, title) VALUES
  (3,  'Campement'),
  (5,  'Avant-Poste'),
  (8,  'Domaine'),
  (12, 'Seigneurie'),
  (17, 'Baronnie'),
  (22, 'Comté'),
  (30, 'Duché'),
  (45, 'Royaume'),
  (70, 'Empire')
ON CONFLICT (min_places) DO NOTHING;

-- RLS : lecture publique, ecriture admin
ALTER TABLE territory_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "territory_tiers_read" ON territory_tiers
  FOR SELECT USING (true);

CREATE POLICY "territory_tiers_write" ON territory_tiers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::TEXT AND u.role = 'admin'
    )
  );

-- =========================================
-- 2. territory_names
-- =========================================
CREATE TABLE IF NOT EXISTS territory_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faction_id VARCHAR(255) NOT NULL,
  anchor_place_id VARCHAR(255) NOT NULL UNIQUE,
  custom_name VARCHAR(100) NOT NULL,
  named_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE territory_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY "territory_names_read" ON territory_names
  FOR SELECT USING (true);

CREATE POLICY "territory_names_insert" ON territory_names
  FOR INSERT WITH CHECK (named_by = auth.uid()::TEXT);

CREATE POLICY "territory_names_update" ON territory_names
  FOR UPDATE USING (named_by = auth.uid()::TEXT);

-- =========================================
-- 3. RPC name_territory
-- =========================================
CREATE OR REPLACE FUNCTION public.name_territory(
  p_user_id TEXT,
  p_anchor_place_id TEXT,
  p_custom_name TEXT,
  p_blob_place_ids TEXT[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_anchor_faction TEXT;
  v_top_user TEXT;
  v_result JSON;
BEGIN
  -- 1. Verifier que le user a une faction
  SELECT faction_id INTO v_faction_id
  FROM users WHERE id = p_user_id;

  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- 2. Verifier que l'anchor appartient a la meme faction
  SELECT faction_id INTO v_anchor_faction
  FROM places WHERE id = p_anchor_place_id;

  IF v_anchor_faction IS NULL OR v_anchor_faction != v_faction_id THEN
    RETURN json_build_object('error', 'anchor_not_owned');
  END IF;

  -- 3. Trouver le top contributeur parmi les lieux du blob
  SELECT claimed_by INTO v_top_user
  FROM places
  WHERE id = ANY(p_blob_place_ids)
    AND faction_id = v_faction_id
    AND claimed_by IS NOT NULL
  GROUP BY claimed_by
  ORDER BY COUNT(*) DESC, MIN(claimed_at) ASC
  LIMIT 1;

  -- 4. Verifier que le user est le top contributeur (ou egalite)
  IF v_top_user IS NULL OR v_top_user != p_user_id THEN
    RETURN json_build_object('error', 'not_top_contributor');
  END IF;

  -- 5. Upsert dans territory_names
  INSERT INTO territory_names (faction_id, anchor_place_id, custom_name, named_by)
  VALUES (v_faction_id, p_anchor_place_id, p_custom_name, p_user_id)
  ON CONFLICT (anchor_place_id) DO UPDATE SET
    custom_name = EXCLUDED.custom_name,
    named_by = EXCLUDED.named_by,
    updated_at = NOW();

  RETURN json_build_object('ok', true);
END;
$$;

-- =========================================
-- 4. get_map_places — ajouter claimedById
-- =========================================
CREATE OR REPLACE FUNCTION public.get_map_places(
  p_type TEXT DEFAULT 'all',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_latitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_longitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', COALESCE(claimer.first_name, claimer.email_address),
        'claimedById', p.claimed_by,
        'fortificationLevel', p.fortification_level,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id, f.id, claimer.first_name, claimer.email_address, lk.likes_count, vw.views_count, ex.explored_count
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'latest' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', COALESCE(claimer.first_name, claimer.email_address),
        'claimedById', p.claimed_by,
        'fortificationLevel', p.fortification_level,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;

  ELSE
    -- type = 'all' avec viewport optionnel
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', COALESCE(claimer.first_name, claimer.email_address),
        'claimedById', p.claimed_by,
        'fortificationLevel', p.fortification_level,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
        AND (
          p_latitude IS NULL
          OR (
            p.latitude >= (p_latitude - p_latitude_delta)
            AND p.latitude <= (p_latitude + p_latitude_delta)
            AND p.longitude >= (p_longitude - p_longitude_delta)
            AND p.longitude <= (p_longitude + p_longitude_delta)
          )
        )
      ORDER BY p.created_at
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
-- ============================================
-- MIGRATION 080 : Vote de Noms de Territoires
-- ============================================
-- Remplace le systeme "top contributeur nomme" par un vote democratique.
-- Tout joueur ayant >= 1 lieu revendique dans un blob peut proposer un nom
-- et voter. Pouvoir de vote = nombre de lieux revendiques dans le blob.
-- ============================================


-- ============================================
-- 1. DROP ANCIEN SYSTEME
-- ============================================

DROP TABLE IF EXISTS territory_names CASCADE;
DROP FUNCTION IF EXISTS public.name_territory;


-- ============================================
-- 2. NOUVELLES TABLES
-- ============================================

CREATE TABLE territory_name_proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_place_id VARCHAR(255) NOT NULL,
  proposed_by     VARCHAR(255) NOT NULL REFERENCES users(id),
  name            VARCHAR(50)  NOT NULL CHECK (length(trim(name)) >= 3),
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (anchor_place_id, proposed_by, name)
);

CREATE INDEX idx_proposals_anchor ON territory_name_proposals(anchor_place_id);

CREATE TABLE territory_name_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID         NOT NULL REFERENCES territory_name_proposals(id) ON DELETE CASCADE,
  voter_id    VARCHAR(255) NOT NULL REFERENCES users(id),
  value       SMALLINT     NOT NULL CHECK (value IN (1, -1)),
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (proposal_id, voter_id)
);

CREATE INDEX idx_votes_proposal ON territory_name_votes(proposal_id);


-- ============================================
-- 3. RLS
-- ============================================

ALTER TABLE territory_name_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE territory_name_votes ENABLE ROW LEVEL SECURITY;

-- Proposals: lecture publique, insertion par le proposeur
CREATE POLICY "proposals_select" ON territory_name_proposals FOR SELECT USING (true);
CREATE POLICY "proposals_insert" ON territory_name_proposals FOR INSERT WITH CHECK (proposed_by = auth.uid()::text);

-- Votes: lecture publique, insert/update/delete par le voteur
CREATE POLICY "votes_select" ON territory_name_votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON territory_name_votes FOR INSERT WITH CHECK (voter_id = auth.uid()::text);
CREATE POLICY "votes_update" ON territory_name_votes FOR UPDATE USING (voter_id = auth.uid()::text);
CREATE POLICY "votes_delete" ON territory_name_votes FOR DELETE USING (voter_id = auth.uid()::text);


-- ============================================
-- 4. RPC: get_winning_territory_names()
-- ============================================
-- Retourne le nom gagnant par territoire (NULL si ex-aequo ou aucune proposition)

CREATE OR REPLACE FUNCTION public.get_winning_territory_names()
RETURNS TABLE(anchor_place_id TEXT, winning_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH scores AS (
    SELECT
      p.anchor_place_id,
      p.name,
      COALESCE(SUM(v.value), 0) AS net_score
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    GROUP BY p.anchor_place_id, p.id, p.name
  ),
  ranked AS (
    SELECT
      anchor_place_id,
      name,
      net_score,
      RANK() OVER (PARTITION BY anchor_place_id ORDER BY net_score DESC) AS rnk
    FROM scores
  ),
  top_ranked AS (
    SELECT
      anchor_place_id,
      name,
      COUNT(*) OVER (PARTITION BY anchor_place_id) AS tied_count
    FROM ranked
    WHERE rnk = 1
  )
  SELECT
    anchor_place_id,
    CASE WHEN tied_count > 1 THEN NULL ELSE name END AS winning_name
  FROM top_ranked
  GROUP BY anchor_place_id, tied_count, name;
$$;


-- ============================================
-- 5. RPC: get_territory_votes(p_anchor, p_user, p_blob_ids)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_territory_votes(
  p_anchor_place_id TEXT,
  p_user_id         TEXT,
  p_blob_place_ids  TEXT[]
)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_vote_power      INT;
  v_proposals       JSON;
  v_used_votes      INT;
  v_proposals_count INT;
BEGIN
  -- Pouvoir de vote = lieux revendiques dans le blob
  SELECT COUNT(*) INTO v_vote_power
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

  -- Nombre de propositions du joueur pour ce territoire
  SELECT COUNT(*) INTO v_proposals_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  -- Liste des propositions avec score net et vote du joueur
  SELECT json_agg(row_data ORDER BY net_score DESC, created_at ASC) INTO v_proposals
  FROM (
    SELECT
      json_build_object(
        'id',         p.id,
        'name',       p.name,
        'proposedBy', p.proposed_by,
        'netScore',   COALESCE(SUM(v.value), 0),
        'myVote',     MAX(CASE WHEN v.voter_id = p_user_id THEN v.value ELSE NULL END)
      ) AS row_data,
      COALESCE(SUM(v.value), 0) AS net_score,
      p.created_at
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name, p.proposed_by, p.created_at
  ) sub;

  -- Votes utilises = nombre de lignes de vote du joueur pour ce territoire
  SELECT COUNT(*) INTO v_used_votes
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  RETURN json_build_object(
    'votePower',      v_vote_power,
    'usedVotes',      v_used_votes,
    'proposalsCount', v_proposals_count,
    'proposals',      COALESCE(v_proposals, '[]'::json)
  );
END;
$$;


-- ============================================
-- 6. RPC: propose_territory_name(...)
-- ============================================

CREATE OR REPLACE FUNCTION public.propose_territory_name(
  p_user_id         TEXT,
  p_anchor_place_id TEXT,
  p_name            TEXT,
  p_blob_place_ids  TEXT[]
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trimmed    TEXT := trim(p_name);
  v_power      INT;
  v_count      INT;
  v_insults    TEXT[] := ARRAY[
    'connard','merde','putain','salope','encule','enculé',
    'con','pute','bite','couille','nique','ntm','fdp','pd',
    'batard','bâtard','salaud','conne','petasse','pétasse',
    'bordel','chiasse','chier','branleur','branleuse','bouffon',
    'abruti','debile','débile','gogol','mongol','trisomique',
    'nazi','hitler','negre','nègre','bougnoule','arabe de merde',
    'sale juif','youpin','bamboula','macaque'
  ];
  v_word       TEXT;
BEGIN
  -- Validation longueur
  IF length(v_trimmed) < 3 OR length(v_trimmed) > 50 THEN
    RETURN json_build_object('error', 'invalid_length');
  END IF;

  -- Blocklist (insensible a la casse)
  FOREACH v_word IN ARRAY v_insults LOOP
    IF lower(v_trimmed) LIKE '%' || v_word || '%' THEN
      RETURN json_build_object('error', 'inappropriate');
    END IF;
  END LOOP;

  -- Eligibilite : au moins 1 lieu revendique dans le blob
  SELECT COUNT(*) INTO v_power
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

  IF v_power < 1 THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Rate limit : max 3 propositions par joueur par territoire
  SELECT COUNT(*) INTO v_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  IF v_count >= 3 THEN
    RETURN json_build_object('error', 'max_proposals');
  END IF;

  INSERT INTO territory_name_proposals (anchor_place_id, proposed_by, name)
  VALUES (p_anchor_place_id, p_user_id, v_trimmed);

  RETURN json_build_object('ok', true);
END;
$$;


-- ============================================
-- 7. RPC: vote_territory_name(...)
-- ============================================

CREATE OR REPLACE FUNCTION public.vote_territory_name(
  p_user_id         TEXT,
  p_proposal_id     UUID,
  p_value           SMALLINT,       -- 1, -1, ou 0 pour annuler
  p_blob_place_ids  TEXT[],
  p_anchor_place_id TEXT
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_power       INT;
  v_winning     TEXT;
  v_tied        BOOLEAN;
  v_net         INT;
BEGIN
  -- Eligibilite
  SELECT COUNT(*) INTO v_power
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

  IF v_power < 1 THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Upsert ou suppression du vote
  IF p_value = 0 THEN
    DELETE FROM territory_name_votes
    WHERE proposal_id = p_proposal_id AND voter_id = p_user_id;
  ELSE
    INSERT INTO territory_name_votes (proposal_id, voter_id, value)
    VALUES (p_proposal_id, p_user_id, p_value)
    ON CONFLICT (proposal_id, voter_id) DO UPDATE SET value = EXCLUDED.value;
  END IF;

  -- Recalculer le gagnant pour ce territoire
  WITH scores AS (
    SELECT p.name, COALESCE(SUM(v.value), 0) AS net_score
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name
    ORDER BY net_score DESC
  ),
  top_score AS (SELECT MAX(net_score) AS mx FROM scores),
  winners AS (SELECT name FROM scores, top_score WHERE net_score = mx)
  SELECT
    CASE WHEN (SELECT COUNT(*) FROM winners) > 1 THEN NULL
         ELSE (SELECT name FROM winners LIMIT 1) END,
    (SELECT COUNT(*) FROM winners) > 1
  INTO v_winning, v_tied;

  -- Score net de la proposition votee
  SELECT COALESCE(SUM(value), 0) INTO v_net
  FROM territory_name_votes WHERE proposal_id = p_proposal_id;

  RETURN json_build_object(
    'ok',          true,
    'winningName', v_winning,
    'isTie',       v_tied,
    'proposalNet', v_net
  );
END;
$$;
-- ============================================
-- MIGRATION 081 : Multiplicateur de zone fortification configurable
-- ============================================
-- Le multiplicateur etait hardcode a 0.5 dans claim_place.
-- On le stocke dans app_settings pour le rendre configurable depuis le Hub.
-- ============================================

INSERT INTO public.app_settings (key, value)
VALUES ('zone_fort_multiplier', '0.5')
ON CONFLICT (key) DO NOTHING;

-- Mettre a jour claim_place pour lire le multiplicateur depuis app_settings
CREATE OR REPLACE FUNCTION public.claim_place(p_user_id TEXT, p_place_id TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_faction_id TEXT;
  v_fortification INT;
  v_neighbor_fort INT;
  v_claim_cost NUMERIC(6,1);
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1);
  v_bonus_conquest NUMERIC(6,1);
  v_current_faction TEXT;
  v_current_claimer TEXT;
  v_notoriety NUMERIC(10,2);
  v_role TEXT;
  v_score INT;
  v_lat DOUBLE PRECISION;
  v_lon DOUBLE PRECISION;
  v_target_score INT;
  v_target_radius DOUBLE PRECISION;
  v_zone_multiplier NUMERIC(4,2);
BEGIN
  -- Faction du joueur
  SELECT faction_id, role INTO v_faction_id, v_role FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Info du lieu
  SELECT faction_id, claimed_by, fortification_level, latitude, longitude
  INTO v_current_faction, v_current_claimer, v_fortification, v_lat, v_lon
  FROM places WHERE id = p_place_id;

  IF v_lat IS NULL THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  -- Deja possede par la meme faction
  IF v_current_faction = v_faction_id THEN
    RETURN json_build_object('error', 'already_owned');
  END IF;

  -- Lire le multiplicateur depuis app_settings
  SELECT COALESCE(value, '0.5')::NUMERIC(4,2) INTO v_zone_multiplier
  FROM app_settings WHERE key = 'zone_fort_multiplier';
  IF v_zone_multiplier IS NULL THEN v_zone_multiplier := 0.5; END IF;

  -- Fortification des voisins dont le territoire est fusionne (cercles qui se touchent)
  v_neighbor_fort := 0;
  IF v_current_faction IS NOT NULL THEN
    v_target_score := place_influence_score(p_place_id);
    v_target_radius := territory_radius_km(v_target_score);

    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_neighbor_fort
    FROM places p2
    WHERE p2.faction_id = v_current_faction
      AND p2.id != p_place_id
      AND ABS(p2.latitude - v_lat) < 0.09
      AND ABS(p2.longitude - v_lon) < 0.127
      AND (
        territory_radius_km(place_influence_score(p2.id)) + v_target_radius
        >=
        sqrt(
          pow((p2.latitude - v_lat) * 111, 2)
          + pow((p2.longitude - v_lon) * 79, 2)
        )
      );
  END IF;

  -- Cout dynamique : 1 + fort du lieu + bonus zone (multiplicateur configurable)
  v_claim_cost := 1 + COALESCE(v_fortification, 0) + FLOOR(v_neighbor_fort * v_zone_multiplier);

  -- Verifier les points de conquete
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost,
      'neighborFort', v_neighbor_fort
    );
  END IF;

  -- Max conquete (avec bonus faction)
  SELECT max_conquest INTO v_max_conquest FROM users WHERE id = p_user_id;
  SELECT COALESCE(bonus_conquest, 0) INTO v_bonus_conquest FROM factions WHERE id = v_faction_id;
  v_max_conquest := GREATEST(1, v_max_conquest + v_bonus_conquest);

  -- Deduire les points
  UPDATE users
  SET conquest_points = GREATEST(0, conquest_points - v_claim_cost)
  WHERE id = p_user_id
  RETURNING conquest_points INTO v_conquest;

  -- Reset fortification si changement de faction
  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN
    v_fortification := 0;
  END IF;

  -- Mettre a jour le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = COALESCE(v_fortification, 0)
  WHERE id = p_place_id;

  -- Notoriete
  UPDATE users
  SET notoriety_points = notoriety_points + 10
  WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  -- Log activite
  INSERT INTO activity_log (user_id, action, data)
  VALUES (
    p_user_id,
    'claim',
    json_build_object(
      'placeId', p_place_id,
      'factionId', v_faction_id,
      'previousFaction', v_current_faction,
      'actorName', (SELECT COALESCE(first_name, 'Quelqu''un') FROM users WHERE id = p_user_id)
    )
  );

  RETURN json_build_object(
    'ok', true,
    'conquestPoints', v_conquest,
    'maxConquest', v_max_conquest,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', 0,
    'claimCost', v_claim_cost,
    'neighborFort', v_neighbor_fort
  );
END;
$$;
-- ============================================
-- MIGRATION 082 : Bonus taille de territoire + rayon configurable
-- ============================================
-- 1. territory_size_defense_mult : bonus au cout de conquete base sur le nombre de voisins fusionnes
-- 2. zone_detection_radius_km : rayon de detection des voisins fortifies (defaut 10km)
-- ============================================

INSERT INTO public.app_settings (key, value)
VALUES ('territory_size_defense_mult', '0')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES ('zone_detection_radius_km', '10')
ON CONFLICT (key) DO NOTHING;


-- ============================================
-- Mise a jour de claim_place : lit les 3 settings + bonus taille
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(p_user_id TEXT, p_place_id TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_faction_id TEXT;
  v_fortification INT;
  v_neighbor_fort INT;
  v_neighbor_count INT;
  v_claim_cost NUMERIC(6,1);
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1);
  v_bonus_conquest NUMERIC(6,1);
  v_current_faction TEXT;
  v_current_claimer TEXT;
  v_notoriety NUMERIC(10,2);
  v_role TEXT;
  v_score INT;
  v_lat DOUBLE PRECISION;
  v_lon DOUBLE PRECISION;
  v_target_score INT;
  v_target_radius DOUBLE PRECISION;
  v_zone_multiplier NUMERIC(4,2);
  v_size_multiplier NUMERIC(4,2);
  v_radius_km NUMERIC(6,1);
  v_lat_delta NUMERIC(8,5);
  v_lon_delta NUMERIC(8,5);
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  -- Faction du joueur
  SELECT faction_id, role INTO v_faction_id, v_role FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Info du lieu
  SELECT faction_id, claimed_by, fortification_level, latitude, longitude
  INTO v_current_faction, v_current_claimer, v_fortification, v_lat, v_lon
  FROM places WHERE id = p_place_id;

  IF v_lat IS NULL THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  -- Deja possede par la meme faction
  IF v_current_faction = v_faction_id THEN
    RETURN json_build_object('error', 'already_owned');
  END IF;

  -- Lire les settings
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_fort_multiplier'), '0.5')::NUMERIC(4,2) INTO v_zone_multiplier;
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'territory_size_defense_mult'), '0')::NUMERIC(4,2) INTO v_size_multiplier;
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_detection_radius_km'), '10')::NUMERIC(6,1) INTO v_radius_km;

  -- Convertir le rayon en delta de coordonnees
  v_lat_delta := v_radius_km / 111.0;
  v_lon_delta := v_radius_km / 79.0;

  -- Fortification voisins (limitee par rayon configurable)
  v_neighbor_fort := 0;
  v_neighbor_count := 0;
  IF v_current_faction IS NOT NULL THEN
    v_target_score := place_influence_score(p_place_id);
    v_target_radius := territory_radius_km(v_target_score);

    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_neighbor_fort
    FROM places p2
    WHERE p2.faction_id = v_current_faction
      AND p2.id != p_place_id
      AND ABS(p2.latitude - v_lat) < v_lat_delta
      AND ABS(p2.longitude - v_lon) < v_lon_delta
      AND (
        territory_radius_km(place_influence_score(p2.id)) + v_target_radius
        >=
        sqrt(
          pow((p2.latitude - v_lat) * 111, 2)
          + pow((p2.longitude - v_lon) * 79, 2)
        )
      );

    -- Taille du territoire (blob entier via boucle iterative)
    v_blob_ids := ARRAY[p_place_id];
    LOOP
      SELECT array_agg(p2.id) INTO v_new_ids
      FROM places p2
      WHERE p2.faction_id = v_current_faction
        AND NOT (p2.id = ANY(v_blob_ids))
        AND EXISTS (
          SELECT 1 FROM places pb
          WHERE pb.id = ANY(v_blob_ids)
            AND territory_radius_km(place_influence_score(p2.id))
              + territory_radius_km(place_influence_score(pb.id))
              >= sqrt(
                pow((p2.latitude - pb.latitude) * 111, 2)
                + pow((p2.longitude - pb.longitude) * 79, 2)
              )
        );
      EXIT WHEN v_new_ids IS NULL;
      v_blob_ids := v_blob_ids || v_new_ids;
    END LOOP;
    v_neighbor_count := array_length(v_blob_ids, 1) - 1;
  END IF;

  -- Cout dynamique : base + fort + zone bonus + territory size bonus
  v_claim_cost := 1
    + COALESCE(v_fortification, 0)
    + FLOOR(v_neighbor_fort * v_zone_multiplier)
    + FLOOR(v_neighbor_count * v_size_multiplier);

  -- Verifier les points de conquete
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost,
      'neighborFort', v_neighbor_fort,
      'neighborCount', v_neighbor_count
    );
  END IF;

  -- Max conquete (avec bonus faction)
  SELECT max_conquest INTO v_max_conquest FROM users WHERE id = p_user_id;
  SELECT COALESCE(bonus_conquest, 0) INTO v_bonus_conquest FROM factions WHERE id = v_faction_id;
  v_max_conquest := GREATEST(1, v_max_conquest + v_bonus_conquest);

  -- Deduire les points
  UPDATE users
  SET conquest_points = GREATEST(0, conquest_points - v_claim_cost)
  WHERE id = p_user_id
  RETURNING conquest_points INTO v_conquest;

  -- Reset fortification si changement de faction
  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN
    v_fortification := 0;
  END IF;

  -- Mettre a jour le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = COALESCE(v_fortification, 0)
  WHERE id = p_place_id;

  -- Notoriete
  UPDATE users
  SET notoriety_points = notoriety_points + 10
  WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  -- Log activite
  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'claim',
    p_user_id,
    p_place_id,
    v_faction_id,
    jsonb_build_object(
      'previousFaction', v_current_faction,
      'actorName', (SELECT COALESCE(first_name, 'Quelqu''un') FROM users WHERE id = p_user_id)
    )
  );

  RETURN json_build_object(
    'ok', true,
    'conquestPoints', v_conquest,
    'maxConquest', v_max_conquest,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', 0,
    'claimCost', v_claim_cost,
    'neighborFort', v_neighbor_fort,
    'neighborCount', v_neighbor_count
  );
END;
$$;


-- ============================================
-- Mise a jour de get_place_by_id : rayon configurable + retourne zoneNeighborCount
-- Base = version 076 (qui fonctionnait) + ajouts 082
-- ============================================

CREATE OR REPLACE FUNCTION public.get_place_by_id(
  p_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place RECORD;
  v_place_type RECORD;
  v_author RECORD;
  v_views_count INT;
  v_likes_count INT;
  v_explored_count INT;
  v_geocache_count INT;
  v_avg_score DOUBLE PRECISION;
  v_last_explorers JSON;
  v_requester JSON;
  v_author_profile_url TEXT;
  v_primary_tag JSON;
  v_all_tags JSON;
  v_claim JSON;
  v_zone_fort INT;
  v_zone_count INT;
  v_target_score INT;
  v_target_radius DOUBLE PRECISION;
  v_claimer_name TEXT;
  v_radius_km NUMERIC(6,1);
  v_lat_delta NUMERIC(8,5);
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
  v_lon_delta NUMERIC(8,5);
BEGIN
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT * INTO v_place_type FROM place_types WHERE id = v_place.place_type_id;
  SELECT * INTO v_author FROM users WHERE id = v_place.author_id;

  -- Photo de profil de l'auteur
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_author_profile_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = v_place.author_id;

  -- Metrics
  SELECT COUNT(*) INTO v_views_count FROM places_viewed WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_likes_count FROM places_liked WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_explored_count FROM places_explored WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_geocache_count FROM reviews WHERE place_id = p_id AND geocache = true;
  SELECT AVG(score) INTO v_avg_score FROM reviews WHERE place_id = p_id;

  -- Derniers explorateurs
  SELECT json_agg(explorer) INTO v_last_explorers
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'lastName', COALESCE(u.display_name, u.first_name, 'Aventurier'),
      'profileImageUrl', CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
    WHERE pe.place_id = p_id AND pe.user_id != v_place.author_id
    ORDER BY pe.updated_at DESC
  ) sub;

  -- Tag primaire
  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'color', t.color,
    'background', t.background
  ) INTO v_primary_tag
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_id AND ptag.is_primary = TRUE
  LIMIT 1;

  -- Tous les tags
  SELECT json_agg(tag_data) INTO v_all_tags
  FROM (
    SELECT json_build_object(
      'id', t.id,
      'title', t.title,
      'color', t.color,
      'background', t.background,
      'isPrimary', ptag.is_primary
    ) AS tag_data
    FROM place_tags ptag
    JOIN tags t ON t.id = ptag.tag_id
    WHERE ptag.place_id = p_id
    ORDER BY ptag.is_primary DESC, t."order"
  ) sub;

  -- Requester state
  IF p_user_id IS NOT NULL THEN
    v_requester := json_build_object(
      'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked WHERE place_id = p_id AND user_id = p_user_id),
      'liked', EXISTS(SELECT 1 FROM places_liked WHERE place_id = p_id AND user_id = p_user_id),
      'explored', EXISTS(SELECT 1 FROM places_explored WHERE place_id = p_id AND user_id = p_user_id)
    );
  ELSE
    v_requester := NULL;
  END IF;

  -- Lire le rayon configurable
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_detection_radius_km'), '10')::NUMERIC(6,1) INTO v_radius_km;
  v_lat_delta := v_radius_km / 111.0;
  v_lon_delta := v_radius_km / 79.0;

  -- Fortification voisins (limitee par rayon configurable)
  v_zone_fort := 0;
  v_zone_count := 0;
  IF v_place.faction_id IS NOT NULL THEN
    v_target_score := place_influence_score(p_id);
    v_target_radius := territory_radius_km(v_target_score);

    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_zone_fort
    FROM places p2
    WHERE p2.faction_id = v_place.faction_id
      AND p2.id != p_id
      AND ABS(p2.latitude - v_place.latitude) < v_lat_delta
      AND ABS(p2.longitude - v_place.longitude) < v_lon_delta
      AND (v_target_radius + territory_radius_km(place_influence_score(p2.id)))
          >= sqrt(
            pow((p2.latitude - v_place.latitude) * 111, 2)
            + pow((p2.longitude - v_place.longitude) * 79, 2)
          );

    -- Taille du territoire (blob entier via boucle iterative)
    v_blob_ids := ARRAY[p_id];
    LOOP
      SELECT array_agg(p2.id) INTO v_new_ids
      FROM places p2
      WHERE p2.faction_id = v_place.faction_id
        AND NOT (p2.id = ANY(v_blob_ids))
        AND EXISTS (
          SELECT 1 FROM places pb
          WHERE pb.id = ANY(v_blob_ids)
            AND territory_radius_km(place_influence_score(p2.id))
              + territory_radius_km(place_influence_score(pb.id))
              >= sqrt(
                pow((p2.latitude - pb.latitude) * 111, 2)
                + pow((p2.longitude - pb.longitude) * 79, 2)
              )
        );
      EXIT WHEN v_new_ids IS NULL;
      v_blob_ids := v_blob_ids || v_new_ids;
    END LOOP;
    v_zone_count := array_length(v_blob_ids, 1) - 1;
  END IF;

  -- Nom du joueur qui a revendique
  IF v_place.claimed_by IS NOT NULL THEN
    SELECT COALESCE(display_name, first_name, 'Inconnu')
    INTO v_claimer_name
    FROM users WHERE id = v_place.claimed_by;
  END IF;

  -- Claim info
  IF v_place.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'factionId', f.id,
      'factionTitle', f.title,
      'factionColor', f.color,
      'factionPattern', f.pattern,
      'claimedBy', v_place.claimed_by,
      'claimedByName', COALESCE(v_claimer_name, 'Inconnu'),
      'claimedAt', v_place.claimed_at,
      'fortificationLevel', v_place.fortification_level,
      'zoneFortification', v_zone_fort,
      'zoneNeighborCount', v_zone_count
    ) INTO v_claim
    FROM factions f
    WHERE f.id = v_place.faction_id;
  ELSE
    v_claim := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_place.id,
    'title', v_place.title,
    'text', v_place.text,
    'address', v_place.address,
    'accessibility', v_place.accessibility,
    'sensible', COALESCE(v_place.sensible, false),
    'geocaching', v_geocache_count > 0,
    'images', v_place.images,
    'author', json_build_object(
      'id', COALESCE(v_author.id, v_place.author_id),
      'lastName', COALESCE(v_author.display_name, v_author.first_name, 'Utilisateur inconnu'),
      'profileImageUrl', v_author_profile_url
    ),
    'type', json_build_object(
      'id', v_place_type.id,
      'title', v_place_type.title
    ),
    'primaryTag', v_primary_tag,
    'tags', COALESCE(v_all_tags, '[]'::json),
    'location', json_build_object(
      'latitude', v_place.latitude,
      'longitude', v_place.longitude
    ),
    'metrics', json_build_object(
      'views', v_views_count,
      'likes', v_likes_count,
      'explored', v_explored_count,
      'note', v_avg_score
    ),
    'claim', v_claim,
    'requester', v_requester,
    'lastExplorers', COALESCE(v_last_explorers, '[]'::json),
    'beginAt', v_place.begin_at,
    'endAt', v_place.end_at,
    'createdAt', v_place.created_at
  );
END;
$$;
-- ============================================
-- MIGRATION 083 : Fix blob traversal — PL/pgSQL loop au lieu de CTE
-- ============================================
-- Le WITH RECURSIVE causait une erreur 400 dans PL/pgSQL.
-- On utilise maintenant une boucle iterative avec des arrays.
-- Cette migration re-declare claim_place et get_place_by_id.
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(p_user_id TEXT, p_place_id TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_faction_id TEXT;
  v_fortification INT;
  v_neighbor_fort INT;
  v_neighbor_count INT;
  v_claim_cost NUMERIC(6,1);
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1);
  v_bonus_conquest NUMERIC(6,1);
  v_current_faction TEXT;
  v_current_claimer TEXT;
  v_notoriety NUMERIC(10,2);
  v_role TEXT;
  v_score INT;
  v_lat DOUBLE PRECISION;
  v_lon DOUBLE PRECISION;
  v_target_score INT;
  v_target_radius DOUBLE PRECISION;
  v_zone_multiplier NUMERIC(4,2);
  v_size_multiplier NUMERIC(4,2);
  v_radius_km NUMERIC(6,1);
  v_lat_delta NUMERIC(8,5);
  v_lon_delta NUMERIC(8,5);
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  -- Faction du joueur
  SELECT faction_id, role INTO v_faction_id, v_role FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Info du lieu
  SELECT faction_id, claimed_by, fortification_level, latitude, longitude
  INTO v_current_faction, v_current_claimer, v_fortification, v_lat, v_lon
  FROM places WHERE id = p_place_id;

  IF v_lat IS NULL THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  -- Deja possede par la meme faction
  IF v_current_faction = v_faction_id THEN
    RETURN json_build_object('error', 'already_owned');
  END IF;

  -- Lire les settings
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_fort_multiplier'), '0.5')::NUMERIC(4,2) INTO v_zone_multiplier;
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'territory_size_defense_mult'), '0')::NUMERIC(4,2) INTO v_size_multiplier;
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_detection_radius_km'), '10')::NUMERIC(6,1) INTO v_radius_km;

  -- Convertir le rayon en delta de coordonnees
  v_lat_delta := v_radius_km / 111.0;
  v_lon_delta := v_radius_km / 79.0;

  -- Fortification voisins (limitee par rayon configurable)
  v_neighbor_fort := 0;
  v_neighbor_count := 0;
  IF v_current_faction IS NOT NULL THEN
    v_target_score := place_influence_score(p_place_id);
    v_target_radius := territory_radius_km(v_target_score);

    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_neighbor_fort
    FROM places p2
    WHERE p2.faction_id = v_current_faction
      AND p2.id != p_place_id
      AND ABS(p2.latitude - v_lat) < v_lat_delta
      AND ABS(p2.longitude - v_lon) < v_lon_delta
      AND (
        territory_radius_km(place_influence_score(p2.id)) + v_target_radius
        >=
        sqrt(
          pow((p2.latitude - v_lat) * 111, 2)
          + pow((p2.longitude - v_lon) * 79, 2)
        )
      );

    -- Taille du territoire (blob entier via boucle iterative)
    v_blob_ids := ARRAY[p_place_id];
    LOOP
      SELECT array_agg(p2.id) INTO v_new_ids
      FROM places p2
      WHERE p2.faction_id = v_current_faction
        AND NOT (p2.id = ANY(v_blob_ids))
        AND EXISTS (
          SELECT 1 FROM places pb
          WHERE pb.id = ANY(v_blob_ids)
            AND territory_radius_km(place_influence_score(p2.id))
              + territory_radius_km(place_influence_score(pb.id))
              >= sqrt(
                pow((p2.latitude - pb.latitude) * 111, 2)
                + pow((p2.longitude - pb.longitude) * 79, 2)
              )
        );
      EXIT WHEN v_new_ids IS NULL;
      v_blob_ids := v_blob_ids || v_new_ids;
    END LOOP;
    v_neighbor_count := array_length(v_blob_ids, 1) - 1;
  END IF;

  -- Cout dynamique : base + fort + zone bonus + territory size bonus
  v_claim_cost := 1
    + COALESCE(v_fortification, 0)
    + FLOOR(v_neighbor_fort * v_zone_multiplier)
    + FLOOR(v_neighbor_count * v_size_multiplier);

  -- Verifier les points de conquete
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost,
      'neighborFort', v_neighbor_fort,
      'neighborCount', v_neighbor_count
    );
  END IF;

  -- Max conquete (avec bonus faction)
  SELECT max_conquest INTO v_max_conquest FROM users WHERE id = p_user_id;
  SELECT COALESCE(bonus_conquest, 0) INTO v_bonus_conquest FROM factions WHERE id = v_faction_id;
  v_max_conquest := GREATEST(1, v_max_conquest + v_bonus_conquest);

  -- Deduire les points
  UPDATE users
  SET conquest_points = GREATEST(0, conquest_points - v_claim_cost)
  WHERE id = p_user_id
  RETURNING conquest_points INTO v_conquest;

  -- Reset fortification si changement de faction
  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN
    v_fortification := 0;
  END IF;

  -- Mettre a jour le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = COALESCE(v_fortification, 0)
  WHERE id = p_place_id;

  -- Notoriete
  UPDATE users
  SET notoriety_points = notoriety_points + 10
  WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  -- Log activite
  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'claim',
    p_user_id,
    p_place_id,
    v_faction_id,
    jsonb_build_object(
      'previousFaction', v_current_faction,
      'actorName', (SELECT COALESCE(first_name, 'Quelqu''un') FROM users WHERE id = p_user_id)
    )
  );

  RETURN json_build_object(
    'ok', true,
    'conquestPoints', v_conquest,
    'maxConquest', v_max_conquest,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', 0,
    'claimCost', v_claim_cost,
    'neighborFort', v_neighbor_fort,
    'neighborCount', v_neighbor_count
  );
END;
$$;


-- ============================================
-- get_place_by_id : blob loop version
-- ============================================

CREATE OR REPLACE FUNCTION public.get_place_by_id(
  p_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place RECORD;
  v_place_type RECORD;
  v_author RECORD;
  v_views_count INT;
  v_likes_count INT;
  v_explored_count INT;
  v_geocache_count INT;
  v_avg_score DOUBLE PRECISION;
  v_last_explorers JSON;
  v_requester JSON;
  v_author_profile_url TEXT;
  v_primary_tag JSON;
  v_all_tags JSON;
  v_claim JSON;
  v_zone_fort INT;
  v_zone_count INT;
  v_target_score INT;
  v_target_radius DOUBLE PRECISION;
  v_claimer_name TEXT;
  v_radius_km NUMERIC(6,1);
  v_lat_delta NUMERIC(8,5);
  v_lon_delta NUMERIC(8,5);
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT * INTO v_place_type FROM place_types WHERE id = v_place.place_type_id;
  SELECT * INTO v_author FROM users WHERE id = v_place.author_id;

  -- Photo de profil de l'auteur
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_author_profile_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = v_place.author_id;

  -- Metrics
  SELECT COUNT(*) INTO v_views_count FROM places_viewed WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_likes_count FROM places_liked WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_explored_count FROM places_explored WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_geocache_count FROM reviews WHERE place_id = p_id AND geocache = true;
  SELECT AVG(score) INTO v_avg_score FROM reviews WHERE place_id = p_id;

  -- Derniers explorateurs
  SELECT json_agg(explorer) INTO v_last_explorers
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'lastName', COALESCE(u.display_name, u.first_name, 'Aventurier'),
      'profileImageUrl', CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
    WHERE pe.place_id = p_id AND pe.user_id != v_place.author_id
    ORDER BY pe.updated_at DESC
  ) sub;

  -- Tag primaire
  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'color', t.color,
    'background', t.background
  ) INTO v_primary_tag
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_id AND ptag.is_primary = TRUE
  LIMIT 1;

  -- Tous les tags
  SELECT json_agg(tag_data) INTO v_all_tags
  FROM (
    SELECT json_build_object(
      'id', t.id,
      'title', t.title,
      'color', t.color,
      'background', t.background,
      'isPrimary', ptag.is_primary
    ) AS tag_data
    FROM place_tags ptag
    JOIN tags t ON t.id = ptag.tag_id
    WHERE ptag.place_id = p_id
    ORDER BY ptag.is_primary DESC, t."order"
  ) sub;

  -- Requester state
  IF p_user_id IS NOT NULL THEN
    v_requester := json_build_object(
      'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked WHERE place_id = p_id AND user_id = p_user_id),
      'liked', EXISTS(SELECT 1 FROM places_liked WHERE place_id = p_id AND user_id = p_user_id),
      'explored', EXISTS(SELECT 1 FROM places_explored WHERE place_id = p_id AND user_id = p_user_id)
    );
  ELSE
    v_requester := NULL;
  END IF;

  -- Lire le rayon configurable
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_detection_radius_km'), '10')::NUMERIC(6,1) INTO v_radius_km;
  v_lat_delta := v_radius_km / 111.0;
  v_lon_delta := v_radius_km / 79.0;

  -- Fortification voisins (limitee par rayon configurable)
  v_zone_fort := 0;
  v_zone_count := 0;
  IF v_place.faction_id IS NOT NULL THEN
    v_target_score := place_influence_score(p_id);
    v_target_radius := territory_radius_km(v_target_score);

    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_zone_fort
    FROM places p2
    WHERE p2.faction_id = v_place.faction_id
      AND p2.id != p_id
      AND ABS(p2.latitude - v_place.latitude) < v_lat_delta
      AND ABS(p2.longitude - v_place.longitude) < v_lon_delta
      AND (v_target_radius + territory_radius_km(place_influence_score(p2.id)))
          >= sqrt(
            pow((p2.latitude - v_place.latitude) * 111, 2)
            + pow((p2.longitude - v_place.longitude) * 79, 2)
          );

    -- Taille du territoire (blob entier via boucle iterative)
    v_blob_ids := ARRAY[p_id];
    LOOP
      SELECT array_agg(p2.id) INTO v_new_ids
      FROM places p2
      WHERE p2.faction_id = v_place.faction_id
        AND NOT (p2.id = ANY(v_blob_ids))
        AND EXISTS (
          SELECT 1 FROM places pb
          WHERE pb.id = ANY(v_blob_ids)
            AND territory_radius_km(place_influence_score(p2.id))
              + territory_radius_km(place_influence_score(pb.id))
              >= sqrt(
                pow((p2.latitude - pb.latitude) * 111, 2)
                + pow((p2.longitude - pb.longitude) * 79, 2)
              )
        );
      EXIT WHEN v_new_ids IS NULL;
      v_blob_ids := v_blob_ids || v_new_ids;
    END LOOP;
    v_zone_count := array_length(v_blob_ids, 1) - 1;
  END IF;

  -- Nom du joueur qui a revendique
  IF v_place.claimed_by IS NOT NULL THEN
    SELECT COALESCE(display_name, first_name, 'Inconnu')
    INTO v_claimer_name
    FROM users WHERE id = v_place.claimed_by;
  END IF;

  -- Claim info
  IF v_place.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'factionId', f.id,
      'factionTitle', f.title,
      'factionColor', f.color,
      'factionPattern', f.pattern,
      'claimedBy', v_place.claimed_by,
      'claimedByName', COALESCE(v_claimer_name, 'Inconnu'),
      'claimedAt', v_place.claimed_at,
      'fortificationLevel', v_place.fortification_level,
      'zoneFortification', v_zone_fort,
      'zoneNeighborCount', v_zone_count
    ) INTO v_claim
    FROM factions f
    WHERE f.id = v_place.faction_id;
  ELSE
    v_claim := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_place.id,
    'title', v_place.title,
    'text', v_place.text,
    'address', v_place.address,
    'accessibility', v_place.accessibility,
    'sensible', COALESCE(v_place.sensible, false),
    'geocaching', v_geocache_count > 0,
    'images', v_place.images,
    'author', json_build_object(
      'id', COALESCE(v_author.id, v_place.author_id),
      'lastName', COALESCE(v_author.display_name, v_author.first_name, 'Utilisateur inconnu'),
      'profileImageUrl', v_author_profile_url
    ),
    'type', json_build_object(
      'id', v_place_type.id,
      'title', v_place_type.title
    ),
    'primaryTag', v_primary_tag,
    'tags', COALESCE(v_all_tags, '[]'::json),
    'location', json_build_object(
      'latitude', v_place.latitude,
      'longitude', v_place.longitude
    ),
    'metrics', json_build_object(
      'views', v_views_count,
      'likes', v_likes_count,
      'explored', v_explored_count,
      'note', v_avg_score
    ),
    'claim', v_claim,
    'requester', v_requester,
    'lastExplorers', COALESCE(v_last_explorers, '[]'::json),
    'beginAt', v_place.begin_at,
    'endAt', v_place.end_at,
    'createdAt', v_place.created_at
  );
END;
$$;
-- ============================================
-- MIGRATION 084 : Fix colonnes activity_log dans claim_place
-- ============================================
-- La table activity_log utilise (type, actor_id, place_id, faction_id, data)
-- mais claim_place utilisait (user_id, action, data) qui n'existent pas.
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(p_user_id TEXT, p_place_id TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_faction_id TEXT;
  v_fortification INT;
  v_neighbor_fort INT;
  v_neighbor_count INT;
  v_claim_cost NUMERIC(6,1);
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1);
  v_bonus_conquest NUMERIC(6,1);
  v_current_faction TEXT;
  v_current_claimer TEXT;
  v_notoriety NUMERIC(10,2);
  v_role TEXT;
  v_score INT;
  v_lat DOUBLE PRECISION;
  v_lon DOUBLE PRECISION;
  v_target_score INT;
  v_target_radius DOUBLE PRECISION;
  v_zone_multiplier NUMERIC(4,2);
  v_size_multiplier NUMERIC(4,2);
  v_radius_km NUMERIC(6,1);
  v_lat_delta NUMERIC(8,5);
  v_lon_delta NUMERIC(8,5);
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  -- Faction du joueur
  SELECT faction_id, role INTO v_faction_id, v_role FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Info du lieu
  SELECT faction_id, claimed_by, fortification_level, latitude, longitude
  INTO v_current_faction, v_current_claimer, v_fortification, v_lat, v_lon
  FROM places WHERE id = p_place_id;

  IF v_lat IS NULL THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  -- Deja possede par la meme faction
  IF v_current_faction = v_faction_id THEN
    RETURN json_build_object('error', 'already_owned');
  END IF;

  -- Lire les settings
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_fort_multiplier'), '0.5')::NUMERIC(4,2) INTO v_zone_multiplier;
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'territory_size_defense_mult'), '0')::NUMERIC(4,2) INTO v_size_multiplier;
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_detection_radius_km'), '10')::NUMERIC(6,1) INTO v_radius_km;

  -- Convertir le rayon en delta de coordonnees
  v_lat_delta := v_radius_km / 111.0;
  v_lon_delta := v_radius_km / 79.0;

  -- Fortification voisins (limitee par rayon configurable)
  v_neighbor_fort := 0;
  v_neighbor_count := 0;
  IF v_current_faction IS NOT NULL THEN
    v_target_score := place_influence_score(p_place_id);
    v_target_radius := territory_radius_km(v_target_score);

    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_neighbor_fort
    FROM places p2
    WHERE p2.faction_id = v_current_faction
      AND p2.id != p_place_id
      AND ABS(p2.latitude - v_lat) < v_lat_delta
      AND ABS(p2.longitude - v_lon) < v_lon_delta
      AND (
        territory_radius_km(place_influence_score(p2.id)) + v_target_radius
        >=
        sqrt(
          pow((p2.latitude - v_lat) * 111, 2)
          + pow((p2.longitude - v_lon) * 79, 2)
        )
      );

    -- Taille du territoire (blob entier via boucle iterative)
    v_blob_ids := ARRAY[p_place_id];
    LOOP
      SELECT array_agg(p2.id) INTO v_new_ids
      FROM places p2
      WHERE p2.faction_id = v_current_faction
        AND NOT (p2.id = ANY(v_blob_ids))
        AND EXISTS (
          SELECT 1 FROM places pb
          WHERE pb.id = ANY(v_blob_ids)
            AND territory_radius_km(place_influence_score(p2.id))
              + territory_radius_km(place_influence_score(pb.id))
              >= sqrt(
                pow((p2.latitude - pb.latitude) * 111, 2)
                + pow((p2.longitude - pb.longitude) * 79, 2)
              )
        );
      EXIT WHEN v_new_ids IS NULL;
      v_blob_ids := v_blob_ids || v_new_ids;
    END LOOP;
    v_neighbor_count := array_length(v_blob_ids, 1) - 1;
  END IF;

  -- Cout dynamique : base + fort + zone bonus + territory size bonus
  v_claim_cost := 1
    + COALESCE(v_fortification, 0)
    + FLOOR(v_neighbor_fort * v_zone_multiplier)
    + FLOOR(v_neighbor_count * v_size_multiplier);

  -- Verifier les points de conquete
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost,
      'neighborFort', v_neighbor_fort,
      'neighborCount', v_neighbor_count
    );
  END IF;

  -- Max conquete (avec bonus faction)
  SELECT max_conquest INTO v_max_conquest FROM users WHERE id = p_user_id;
  SELECT COALESCE(bonus_conquest, 0) INTO v_bonus_conquest FROM factions WHERE id = v_faction_id;
  v_max_conquest := GREATEST(1, v_max_conquest + v_bonus_conquest);

  -- Deduire les points
  UPDATE users
  SET conquest_points = GREATEST(0, conquest_points - v_claim_cost)
  WHERE id = p_user_id
  RETURNING conquest_points INTO v_conquest;

  -- Reset fortification si changement de faction
  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN
    v_fortification := 0;
  END IF;

  -- Mettre a jour le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = COALESCE(v_fortification, 0)
  WHERE id = p_place_id;

  -- Notoriete
  UPDATE users
  SET notoriety_points = notoriety_points + 10
  WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  -- Log activite
  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'claim',
    p_user_id,
    p_place_id,
    v_faction_id,
    jsonb_build_object(
      'previousFaction', v_current_faction,
      'actorName', (SELECT COALESCE(first_name, 'Quelqu''un') FROM users WHERE id = p_user_id)
    )
  );

  RETURN json_build_object(
    'ok', true,
    'conquestPoints', v_conquest,
    'maxConquest', v_max_conquest,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', 0,
    'claimCost', v_claim_cost,
    'neighborFort', v_neighbor_fort,
    'neighborCount', v_neighbor_count
  );
END;
$$;
-- ============================================
-- MIGRATION 085 : Fix votes territoire — chercher par blob, pas par anchor
-- ============================================
-- Quand un blob fusionne, l'anchorPlaceId change. Les anciennes propositions
-- liees a l'ancien anchor ne sont plus trouvees.
-- On cherche maintenant les propositions dont anchor_place_id est dans le blob.
-- On migre aussi les anciennes propositions vers l'anchor actuel.
-- ============================================


-- ============================================
-- get_territory_votes : cherche dans tout le blob + migre l'anchor
-- ============================================

CREATE OR REPLACE FUNCTION public.get_territory_votes(
  p_anchor_place_id TEXT,
  p_user_id         TEXT,
  p_blob_place_ids  TEXT[]
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_vote_power      INT;
  v_proposals       JSON;
  v_used_votes      INT;
  v_proposals_count INT;
BEGIN
  -- Migrer les propositions avec un ancien anchor vers le nouvel anchor
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Pouvoir de vote = lieux revendiques dans le blob
  SELECT COUNT(*) INTO v_vote_power
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

  -- Nombre de propositions du joueur pour ce territoire
  SELECT COUNT(*) INTO v_proposals_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  -- Liste des propositions avec score net et vote du joueur
  SELECT json_agg(row_data ORDER BY net_score DESC, created_at ASC) INTO v_proposals
  FROM (
    SELECT
      json_build_object(
        'id',         p.id,
        'name',       p.name,
        'proposedBy', p.proposed_by,
        'netScore',   COALESCE(SUM(v.value), 0),
        'myVote',     MAX(CASE WHEN v.voter_id = p_user_id THEN v.value ELSE NULL END)
      ) AS row_data,
      COALESCE(SUM(v.value), 0) AS net_score,
      p.created_at
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name, p.proposed_by, p.created_at
  ) sub;

  -- Votes utilises
  SELECT COUNT(*) INTO v_used_votes
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  RETURN json_build_object(
    'votePower',      v_vote_power,
    'usedVotes',      v_used_votes,
    'proposalsCount', v_proposals_count,
    'proposals',      COALESCE(v_proposals, '[]'::json)
  );
END;
$$;


-- ============================================
-- propose_territory_name : migre l'anchor avant d'inserer
-- ============================================

CREATE OR REPLACE FUNCTION public.propose_territory_name(
  p_user_id         TEXT,
  p_anchor_place_id TEXT,
  p_name            TEXT,
  p_blob_place_ids  TEXT[]
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trimmed    TEXT := trim(p_name);
  v_power      INT;
  v_count      INT;
  v_insults    TEXT[] := ARRAY[
    'connard','merde','putain','salope','encule','enculé',
    'con','pute','bite','couille','nique','ntm','fdp','pd',
    'batard','bâtard','salaud','conne','petasse','pétasse',
    'bordel','chiasse','chier','branleur','branleuse','bouffon',
    'abruti','debile','débile','gogol','mongol','trisomique',
    'nazi','hitler','negre','nègre','bougnoule','arabe de merde',
    'sale juif','youpin','bamboula','macaque'
  ];
  v_word       TEXT;
BEGIN
  -- Validation longueur
  IF length(v_trimmed) < 3 OR length(v_trimmed) > 50 THEN
    RETURN json_build_object('error', 'invalid_length');
  END IF;

  -- Blocklist
  FOREACH v_word IN ARRAY v_insults LOOP
    IF lower(v_trimmed) LIKE '%' || v_word || '%' THEN
      RETURN json_build_object('error', 'inappropriate');
    END IF;
  END LOOP;

  -- Eligibilite
  SELECT COUNT(*) INTO v_power
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

  IF v_power < 1 THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Migrer les anciennes propositions vers l'anchor actuel
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Rate limit : max 3 propositions par joueur par territoire
  SELECT COUNT(*) INTO v_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  IF v_count >= 3 THEN
    RETURN json_build_object('error', 'max_proposals');
  END IF;

  INSERT INTO territory_name_proposals (anchor_place_id, proposed_by, name)
  VALUES (p_anchor_place_id, p_user_id, v_trimmed);

  RETURN json_build_object('ok', true);
END;
$$;


-- ============================================
-- vote_territory_name : migre l'anchor avant de voter
-- ============================================

CREATE OR REPLACE FUNCTION public.vote_territory_name(
  p_user_id         TEXT,
  p_proposal_id     UUID,
  p_value           SMALLINT,
  p_blob_place_ids  TEXT[],
  p_anchor_place_id TEXT
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_power       INT;
  v_winning     TEXT;
  v_tied        BOOLEAN;
  v_net         INT;
BEGIN
  -- Eligibilite
  SELECT COUNT(*) INTO v_power
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

  IF v_power < 1 THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Migrer les anciennes propositions vers l'anchor actuel
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Upsert ou suppression du vote
  IF p_value = 0 THEN
    DELETE FROM territory_name_votes
    WHERE proposal_id = p_proposal_id AND voter_id = p_user_id;
  ELSE
    INSERT INTO territory_name_votes (proposal_id, voter_id, value)
    VALUES (p_proposal_id, p_user_id, p_value)
    ON CONFLICT (proposal_id, voter_id) DO UPDATE SET value = EXCLUDED.value;
  END IF;

  -- Recalculer le gagnant
  WITH scores AS (
    SELECT p.name, COALESCE(SUM(v.value), 0) AS net_score
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name
    ORDER BY net_score DESC
  ),
  top_score AS (SELECT MAX(net_score) AS mx FROM scores),
  winners AS (SELECT name FROM scores, top_score WHERE net_score = mx)
  SELECT
    CASE WHEN (SELECT COUNT(*) FROM winners) > 1 THEN NULL
         ELSE (SELECT name FROM winners LIMIT 1) END,
    (SELECT COUNT(*) FROM winners) > 1
  INTO v_winning, v_tied;

  -- Score net de la proposition votee
  SELECT COALESCE(SUM(value), 0) INTO v_net
  FROM territory_name_votes WHERE proposal_id = p_proposal_id;

  RETURN json_build_object(
    'ok',          true,
    'winningName', v_winning,
    'isTie',       v_tied,
    'proposalNet', v_net
  );
END;
$$;


-- ============================================
-- get_winning_territory_names : inchange (pas de blob dispo ici)
-- La migration des anchors par get_territory_votes suffit
-- ============================================
-- ============================================
-- MIGRATION 086 : Fix get_territory_votes — retirer STABLE pour permettre UPDATE
-- ============================================
-- La 085 marquait get_territory_votes comme STABLE mais elle fait un UPDATE.
-- PostgreSQL interdit les ecritures dans les fonctions STABLE.
-- On re-declare sans STABLE (= VOLATILE par defaut).
-- ============================================

CREATE OR REPLACE FUNCTION public.get_territory_votes(
  p_anchor_place_id TEXT,
  p_user_id         TEXT,
  p_blob_place_ids  TEXT[]
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_vote_power      INT;
  v_proposals       JSON;
  v_used_votes      INT;
  v_proposals_count INT;
BEGIN
  -- Migrer les propositions avec un ancien anchor vers le nouvel anchor
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Pouvoir de vote = lieux revendiques dans le blob
  SELECT COUNT(*) INTO v_vote_power
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

  -- Nombre de propositions du joueur pour ce territoire
  SELECT COUNT(*) INTO v_proposals_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  -- Liste des propositions avec score net et vote du joueur
  SELECT json_agg(row_data ORDER BY net_score DESC, created_at ASC) INTO v_proposals
  FROM (
    SELECT
      json_build_object(
        'id',         p.id,
        'name',       p.name,
        'proposedBy', p.proposed_by,
        'netScore',   COALESCE(SUM(v.value), 0),
        'myVote',     MAX(CASE WHEN v.voter_id = p_user_id THEN v.value ELSE NULL END)
      ) AS row_data,
      COALESCE(SUM(v.value), 0) AS net_score,
      p.created_at
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name, p.proposed_by, p.created_at
  ) sub;

  -- Votes utilises
  SELECT COUNT(*) INTO v_used_votes
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  RETURN json_build_object(
    'votePower',      v_vote_power,
    'usedVotes',      v_used_votes,
    'proposalsCount', v_proposals_count,
    'proposals',      COALESCE(v_proposals, '[]'::json)
  );
END;
$$;
-- ============================================
-- MIGRATION 087 : Fix fortify_place — bonus faction + notoriete
-- ============================================
-- Bugs corriges :
-- 1. max_construction et construction_cycle etaient hardcodes (5.0 / 14400)
--    au lieu de lire les bonus faction (bonus_construction, bonus_regen_construction).
--    => Les factions avec bonus construction ne beneficiaient pas de leurs bonus.
-- 2. La notoriete (+5 par niveau) avait ete supprimee par accident dans la migration 061.
--    Le toast frontend affichait "+5 Notoriete" mais rien ne se passait cote serveur.
-- 3. notorietyPoints n'etait pas retourne dans la reponse JSON.
-- ============================================

CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_max_level INT;
  v_cost INT;
  v_next_name TEXT;
  v_construction NUMERIC(6,1);
  v_notoriety INT;
  v_max_construction NUMERIC(6,1);
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
  v_place_tags TEXT[];
  -- Pour le log d'activite
  v_actor_name TEXT;
  v_place_title TEXT;
  v_place_lat DOUBLE PRECISION;
  v_place_lng DOUBLE PRECISION;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  -- Verifier faction du user + lire max et cycle avec bonus faction
  SELECT u.faction_id,
         GREATEST(1, u.max_construction + COALESCE(f.bonus_construction, 0)),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_construction, 0)) / 100)::INT)
  INTO v_user_faction, v_max_construction, v_construction_cycle
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  IF v_user_faction IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe et est revendique par la faction du user
  SELECT faction_id, fortification_level
  INTO v_place_faction, v_current_level
  FROM places WHERE id = p_place_id;

  IF v_place_faction IS NULL THEN
    RETURN json_build_object('error', 'Place not claimed');
  END IF;

  IF v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'Not your faction territory');
  END IF;

  -- Max level depuis la table
  SELECT MAX(level) INTO v_max_level FROM construction_types;
  IF v_max_level IS NULL THEN v_max_level := 0; END IF;

  IF v_current_level >= v_max_level THEN
    RETURN json_build_object('error', 'Max fortification reached');
  END IF;

  -- Tags du lieu (pour filtrage optionnel)
  SELECT ARRAY_AGG(tag_id) INTO v_place_tags
  FROM place_tags WHERE place_id = p_place_id;

  -- Cout et nom du prochain niveau
  SELECT ct.cost, ct.name INTO v_cost, v_next_name
  FROM construction_types ct
  WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_cost IS NULL THEN
    RETURN json_build_object('error', 'No construction type available for this level');
  END IF;

  -- Verifier les points de construction
  SELECT construction_points INTO v_construction FROM users WHERE id = p_user_id;
  IF v_construction < v_cost THEN
    RETURN json_build_object(
      'error', 'Not enough construction points',
      'constructionPoints', v_construction,
      'cost', v_cost
    );
  END IF;

  -- Deduire les points + ajouter notoriete
  UPDATE users
  SET construction_points = construction_points - v_cost,
      notoriety_points = notoriety_points + 5
  WHERE id = p_user_id;

  -- Incrementer le niveau
  UPDATE places
  SET fortification_level = v_current_level + 1,
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Logger l'activite avec le VRAI acteur (p_user_id, pas claimed_by)
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = p_user_id;
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  SELECT color, pattern INTO v_faction_color, v_faction_pattern FROM factions WHERE id = v_user_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'fortify',
    p_user_id,
    p_place_id,
    v_user_faction,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'fortificationLevel', v_current_level + 1
    )
  );

  -- Recuperer l'etat final
  SELECT construction_points, construction_reset_at, notoriety_points
  INTO v_construction, v_construction_reset_at, v_notoriety
  FROM users WHERE id = p_user_id;

  -- Construction next point
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', v_current_level + 1,
    'fortificationName', v_next_name,
    'cost', v_cost
  );
END;
$$;
-- ============================================
-- MIGRATION 088 : Votes territoire — faction + stacking
-- ============================================
-- Changements :
-- 1. Tout membre de la faction peut voter (1 vote de base), plus +1 par lieu revendique.
--    Avant : seuls les joueurs ayant revendique des lieux pouvaient voter (vote power = claimed count).
-- 2. On peut empiler plusieurs votes sur une seule proposition (value peut etre > 1 ou < -1).
--    Avant : value etait contraint a 1 ou -1.
-- 3. usedVotes = SUM(ABS(value)) au lieu de COUNT(*).
-- ============================================


-- ============================================
-- 1. Relacher la contrainte value IN (1, -1) → value != 0
-- ============================================

ALTER TABLE territory_name_votes DROP CONSTRAINT IF EXISTS territory_name_votes_value_check;
ALTER TABLE territory_name_votes ADD CONSTRAINT territory_name_votes_value_check CHECK (value != 0);


-- ============================================
-- 2. get_territory_votes — eligibilite par faction + usedVotes par somme
-- ============================================

CREATE OR REPLACE FUNCTION public.get_territory_votes(
  p_anchor_place_id TEXT,
  p_user_id         TEXT,
  p_blob_place_ids  TEXT[]
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_faction    TEXT;
  v_territory_faction TEXT;
  v_claimed_count   INT;
  v_vote_power      INT;
  v_proposals       JSON;
  v_used_votes      INT;
  v_proposals_count INT;
BEGIN
  -- Migrer les propositions avec un ancien anchor vers le nouvel anchor
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Faction du user
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  -- Faction du territoire (depuis n'importe quel lieu du blob)
  SELECT faction_id INTO v_territory_faction
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
  LIMIT 1;

  -- Eligibilite : meme faction = 1 vote de base, sinon 0
  IF v_user_faction IS NOT NULL AND v_user_faction = v_territory_faction THEN
    -- Lieux revendiques dans le blob
    SELECT COUNT(*) INTO v_claimed_count
    FROM places
    WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

    v_vote_power := 1 + v_claimed_count;
  ELSE
    v_vote_power := 0;
  END IF;

  -- Nombre de propositions du joueur pour ce territoire
  SELECT COUNT(*) INTO v_proposals_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  -- Liste des propositions avec score net et vote du joueur
  SELECT json_agg(row_data ORDER BY net_score DESC, created_at ASC) INTO v_proposals
  FROM (
    SELECT
      json_build_object(
        'id',         p.id,
        'name',       p.name,
        'proposedBy', p.proposed_by,
        'netScore',   COALESCE(SUM(v.value), 0),
        'myVote',     MAX(CASE WHEN v.voter_id = p_user_id THEN v.value ELSE NULL END)
      ) AS row_data,
      COALESCE(SUM(v.value), 0) AS net_score,
      p.created_at
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name, p.proposed_by, p.created_at
  ) sub;

  -- Votes utilises = SUM(ABS(value)) au lieu de COUNT(*)
  SELECT COALESCE(SUM(ABS(tv.value)), 0) INTO v_used_votes
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  RETURN json_build_object(
    'votePower',      v_vote_power,
    'usedVotes',      v_used_votes,
    'proposalsCount', v_proposals_count,
    'proposals',      COALESCE(v_proposals, '[]'::json)
  );
END;
$$;


-- ============================================
-- 3. propose_territory_name — eligibilite par faction
-- ============================================

CREATE OR REPLACE FUNCTION public.propose_territory_name(
  p_user_id         TEXT,
  p_anchor_place_id TEXT,
  p_name            TEXT,
  p_blob_place_ids  TEXT[]
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trimmed    TEXT := trim(p_name);
  v_user_faction TEXT;
  v_territory_faction TEXT;
  v_count      INT;
  v_insults    TEXT[] := ARRAY[
    'connard','merde','putain','salope','encule','enculé',
    'con','pute','bite','couille','nique','ntm','fdp','pd',
    'batard','bâtard','salaud','conne','petasse','pétasse',
    'bordel','chiasse','chier','branleur','branleuse','bouffon',
    'abruti','debile','débile','gogol','mongol','trisomique',
    'nazi','hitler','negre','nègre','bougnoule','arabe de merde',
    'sale juif','youpin','bamboula','macaque'
  ];
  v_word       TEXT;
BEGIN
  -- Validation longueur
  IF length(v_trimmed) < 3 OR length(v_trimmed) > 50 THEN
    RETURN json_build_object('error', 'invalid_length');
  END IF;

  -- Blocklist
  FOREACH v_word IN ARRAY v_insults LOOP
    IF lower(v_trimmed) LIKE '%' || v_word || '%' THEN
      RETURN json_build_object('error', 'inappropriate');
    END IF;
  END LOOP;

  -- Eligibilite par faction
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  SELECT faction_id INTO v_territory_faction
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
  LIMIT 1;

  IF v_user_faction IS NULL OR v_user_faction != v_territory_faction THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Migrer les anciennes propositions vers l'anchor actuel
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Rate limit : max 3 propositions par joueur par territoire
  SELECT COUNT(*) INTO v_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  IF v_count >= 3 THEN
    RETURN json_build_object('error', 'max_proposals');
  END IF;

  INSERT INTO territory_name_proposals (anchor_place_id, proposed_by, name)
  VALUES (p_anchor_place_id, p_user_id, v_trimmed);

  RETURN json_build_object('ok', true);
END;
$$;


-- ============================================
-- 4. vote_territory_name — stacking + validation
-- ============================================

CREATE OR REPLACE FUNCTION public.vote_territory_name(
  p_user_id         TEXT,
  p_proposal_id     UUID,
  p_value           SMALLINT,       -- valeur totale souhaitee (>0, <0, ou 0 pour annuler)
  p_blob_place_ids  TEXT[],
  p_anchor_place_id TEXT
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_faction    TEXT;
  v_territory_faction TEXT;
  v_claimed_count   INT;
  v_vote_power      INT;
  v_total_used      INT;
  v_winning         TEXT;
  v_tied            BOOLEAN;
  v_net             INT;
BEGIN
  -- Eligibilite par faction
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  SELECT faction_id INTO v_territory_faction
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
  LIMIT 1;

  IF v_user_faction IS NULL OR v_user_faction != v_territory_faction THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Vote power = 1 (base faction) + lieux revendiques
  SELECT COUNT(*) INTO v_claimed_count
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

  v_vote_power := 1 + v_claimed_count;

  -- Migrer les anciennes propositions vers l'anchor actuel
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Upsert ou suppression du vote
  IF p_value = 0 THEN
    DELETE FROM territory_name_votes
    WHERE proposal_id = p_proposal_id AND voter_id = p_user_id;
  ELSE
    INSERT INTO territory_name_votes (proposal_id, voter_id, value)
    VALUES (p_proposal_id, p_user_id, p_value)
    ON CONFLICT (proposal_id, voter_id) DO UPDATE SET value = EXCLUDED.value;
  END IF;

  -- Valider que le total utilise ne depasse pas le vote power
  SELECT COALESCE(SUM(ABS(tv.value)), 0) INTO v_total_used
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  IF v_total_used > v_vote_power THEN
    -- Rollback : remettre l'ancien vote ou supprimer
    -- On supprime le vote qu'on vient de mettre pour revenir a l'etat precedent
    DELETE FROM territory_name_votes
    WHERE proposal_id = p_proposal_id AND voter_id = p_user_id;

    RETURN json_build_object('error', 'not_enough_votes', 'votePower', v_vote_power, 'usedVotes', v_total_used - ABS(p_value));
  END IF;

  -- Recalculer le gagnant pour ce territoire
  WITH scores AS (
    SELECT p.name, COALESCE(SUM(v.value), 0) AS net_score
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name
    ORDER BY net_score DESC
  ),
  top_score AS (SELECT MAX(net_score) AS mx FROM scores),
  winners AS (SELECT name FROM scores, top_score WHERE net_score = mx)
  SELECT
    CASE WHEN (SELECT COUNT(*) FROM winners) > 1 THEN NULL
         ELSE (SELECT name FROM winners LIMIT 1) END,
    (SELECT COUNT(*) FROM winners) > 1
  INTO v_winning, v_tied;

  -- Score net de la proposition votee
  SELECT COALESCE(SUM(value), 0) INTO v_net
  FROM territory_name_votes WHERE proposal_id = p_proposal_id;

  RETURN json_build_object(
    'ok',          true,
    'winningName', v_winning,
    'isTie',       v_tied,
    'proposalNet', v_net
  );
END;
$$;
-- ============================================
-- MIGRATION 089 : Afficher les votants par proposition
-- ============================================
-- Changement : get_territory_votes retourne maintenant un array 'voters'
-- par proposition, avec le nom du joueur et la valeur de son vote.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_territory_votes(
  p_anchor_place_id TEXT,
  p_user_id         TEXT,
  p_blob_place_ids  TEXT[]
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_faction    TEXT;
  v_territory_faction TEXT;
  v_claimed_count   INT;
  v_vote_power      INT;
  v_proposals       JSON;
  v_used_votes      INT;
  v_proposals_count INT;
BEGIN
  -- Migrer les propositions avec un ancien anchor vers le nouvel anchor
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Faction du user
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  -- Faction du territoire (depuis n'importe quel lieu du blob)
  SELECT faction_id INTO v_territory_faction
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
  LIMIT 1;

  -- Eligibilite : meme faction = 1 vote de base, sinon 0
  IF v_user_faction IS NOT NULL AND v_user_faction = v_territory_faction THEN
    SELECT COUNT(*) INTO v_claimed_count
    FROM places
    WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

    v_vote_power := 1 + v_claimed_count;
  ELSE
    v_vote_power := 0;
  END IF;

  -- Nombre de propositions du joueur pour ce territoire
  SELECT COUNT(*) INTO v_proposals_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  -- Liste des propositions avec score net, vote du joueur, et liste des votants
  SELECT json_agg(row_data ORDER BY net_score DESC, created_at ASC) INTO v_proposals
  FROM (
    SELECT
      json_build_object(
        'id',         p.id,
        'name',       p.name,
        'proposedBy', p.proposed_by,
        'netScore',   COALESCE(SUM(v.value), 0),
        'myVote',     MAX(CASE WHEN v.voter_id = p_user_id THEN v.value ELSE NULL END),
        'voters',     COALESCE(
          (SELECT json_agg(json_build_object('name', u.name, 'value', v2.value) ORDER BY ABS(v2.value) DESC)
           FROM territory_name_votes v2
           JOIN users u ON u.id = v2.voter_id
           WHERE v2.proposal_id = p.id),
          '[]'::json
        )
      ) AS row_data,
      COALESCE(SUM(v.value), 0) AS net_score,
      p.created_at
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name, p.proposed_by, p.created_at
  ) sub;

  -- Votes utilises = SUM(ABS(value))
  SELECT COALESCE(SUM(ABS(tv.value)), 0) INTO v_used_votes
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  RETURN json_build_object(
    'votePower',      v_vote_power,
    'usedVotes',      v_used_votes,
    'proposalsCount', v_proposals_count,
    'proposals',      COALESCE(v_proposals, '[]'::json)
  );
END;
$$;
-- ============================================
-- MIGRATION 090 : Toast new_user apres onboarding, pas apres signup
-- ============================================
-- Probleme : le trigger trg_log_new_user se declenchait sur INSERT users,
-- AVANT l'onboarding. Le first_name etait NULL, donc le toast affichait
-- l'email du joueur (COALESCE(first_name, email_address)).
--
-- Fix : supprimer le trigger. A la place, inserer dans activity_log
-- depuis update_my_profile, uniquement la premiere fois que le joueur
-- choisit son nom (first_name passe de NULL a une valeur).
-- ============================================

-- 1. Supprimer le trigger qui se declenchait trop tot
DROP TRIGGER IF EXISTS trg_log_new_user ON users;
DROP FUNCTION IF EXISTS log_new_user_activity();

-- 2. update_my_profile : ajouter le log new_user au premier onboarding
DROP FUNCTION IF EXISTS public.update_my_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_user_id TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_instagram TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_game_mode TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_name TEXT;
BEGIN
  -- Verifier si c'est le premier onboarding (first_name etait NULL)
  SELECT first_name INTO v_old_name FROM users WHERE id = p_user_id;

  UPDATE users
  SET first_name = COALESCE(p_first_name, first_name),
      bio = p_bio,
      instagram = p_instagram,
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      game_mode = COALESCE(p_game_mode, game_mode),
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Premier onboarding : notifier les autres joueurs avec le vrai nom
  IF v_old_name IS NULL AND p_first_name IS NOT NULL THEN
    INSERT INTO activity_log (type, actor_id, data)
    VALUES (
      'new_user',
      p_user_id,
      jsonb_build_object('actorName', p_first_name)
    );
  END IF;

  RETURN json_build_object('success', true);
END;
$$;
-- ============================================
-- MIGRATION 091 : Fix claim_place return key 'ok' → 'success'
-- ============================================
-- Migration 082/083 a change 'success' en 'ok' dans le retour de claim_place,
-- mais le front-end attend 'success'. Le claim reussissait cote serveur
-- mais le front-end ne le detectait pas → le joueur recliquait → "already_owned".
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(p_user_id TEXT, p_place_id TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_faction_id TEXT;
  v_fortification INT;
  v_neighbor_fort INT;
  v_neighbor_count INT;
  v_claim_cost NUMERIC(6,1);
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1);
  v_bonus_conquest NUMERIC(6,1);
  v_current_faction TEXT;
  v_current_claimer TEXT;
  v_notoriety NUMERIC(10,2);
  v_role TEXT;
  v_score INT;
  v_lat DOUBLE PRECISION;
  v_lon DOUBLE PRECISION;
  v_target_score INT;
  v_target_radius DOUBLE PRECISION;
  v_zone_multiplier NUMERIC(4,2);
  v_size_multiplier NUMERIC(4,2);
  v_radius_km NUMERIC(6,1);
  v_lat_delta NUMERIC(8,5);
  v_lon_delta NUMERIC(8,5);
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  -- Faction du joueur
  SELECT faction_id, role INTO v_faction_id, v_role FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Info du lieu
  SELECT faction_id, claimed_by, fortification_level, latitude, longitude
  INTO v_current_faction, v_current_claimer, v_fortification, v_lat, v_lon
  FROM places WHERE id = p_place_id;

  IF v_lat IS NULL THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  -- Deja possede par la meme faction
  IF v_current_faction = v_faction_id THEN
    RETURN json_build_object('error', 'already_owned');
  END IF;

  -- Lire les settings
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_fort_multiplier'), '0.5')::NUMERIC(4,2) INTO v_zone_multiplier;
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'territory_size_defense_mult'), '0')::NUMERIC(4,2) INTO v_size_multiplier;
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_detection_radius_km'), '10')::NUMERIC(6,1) INTO v_radius_km;

  -- Convertir le rayon en delta de coordonnees
  v_lat_delta := v_radius_km / 111.0;
  v_lon_delta := v_radius_km / 79.0;

  -- Fortification voisins (limitee par rayon configurable)
  v_neighbor_fort := 0;
  v_neighbor_count := 0;
  IF v_current_faction IS NOT NULL THEN
    v_target_score := place_influence_score(p_place_id);
    v_target_radius := territory_radius_km(v_target_score);

    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_neighbor_fort
    FROM places p2
    WHERE p2.faction_id = v_current_faction
      AND p2.id != p_place_id
      AND ABS(p2.latitude - v_lat) < v_lat_delta
      AND ABS(p2.longitude - v_lon) < v_lon_delta
      AND (
        territory_radius_km(place_influence_score(p2.id)) + v_target_radius
        >=
        sqrt(
          pow((p2.latitude - v_lat) * 111, 2)
          + pow((p2.longitude - v_lon) * 79, 2)
        )
      );

    -- Taille du territoire (blob entier via boucle iterative)
    v_blob_ids := ARRAY[p_place_id];
    LOOP
      SELECT array_agg(p2.id) INTO v_new_ids
      FROM places p2
      WHERE p2.faction_id = v_current_faction
        AND NOT (p2.id = ANY(v_blob_ids))
        AND EXISTS (
          SELECT 1 FROM places pb
          WHERE pb.id = ANY(v_blob_ids)
            AND territory_radius_km(place_influence_score(p2.id))
              + territory_radius_km(place_influence_score(pb.id))
              >= sqrt(
                pow((p2.latitude - pb.latitude) * 111, 2)
                + pow((p2.longitude - pb.longitude) * 79, 2)
              )
        );
      EXIT WHEN v_new_ids IS NULL;
      v_blob_ids := v_blob_ids || v_new_ids;
    END LOOP;
    v_neighbor_count := array_length(v_blob_ids, 1) - 1;
  END IF;

  -- Cout dynamique : base + fort + zone bonus + territory size bonus
  v_claim_cost := 1
    + COALESCE(v_fortification, 0)
    + FLOOR(v_neighbor_fort * v_zone_multiplier)
    + FLOOR(v_neighbor_count * v_size_multiplier);

  -- Verifier les points de conquete
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost,
      'neighborFort', v_neighbor_fort,
      'neighborCount', v_neighbor_count
    );
  END IF;

  -- Max conquete (avec bonus faction)
  SELECT max_conquest INTO v_max_conquest FROM users WHERE id = p_user_id;
  SELECT COALESCE(bonus_conquest, 0) INTO v_bonus_conquest FROM factions WHERE id = v_faction_id;
  v_max_conquest := GREATEST(1, v_max_conquest + v_bonus_conquest);

  -- Deduire les points
  UPDATE users
  SET conquest_points = GREATEST(0, conquest_points - v_claim_cost)
  WHERE id = p_user_id
  RETURNING conquest_points INTO v_conquest;

  -- Reset fortification si changement de faction
  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN
    v_fortification := 0;
  END IF;

  -- Mettre a jour le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = COALESCE(v_fortification, 0)
  WHERE id = p_place_id;

  -- Notoriete
  UPDATE users
  SET notoriety_points = notoriety_points + 10
  WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  -- Log activite
  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'claim',
    p_user_id,
    p_place_id,
    v_faction_id,
    jsonb_build_object(
      'previousFaction', v_current_faction,
      'actorName', (SELECT COALESCE(first_name, 'Quelqu''un') FROM users WHERE id = p_user_id)
    )
  );

  RETURN json_build_object(
    'success', true,
    'conquestPoints', v_conquest,
    'maxConquest', v_max_conquest,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', 0,
    'claimCost', v_claim_cost,
    'neighborFort', v_neighbor_fort,
    'neighborCount', v_neighbor_count
  );
END;
$$;
-- ============================================
-- MIGRATION 092 : Fix u.name → first_name dans get_territory_votes
-- ============================================
-- Migration 089 utilisait u.name dans la sous-requete voters,
-- mais la table users n'a pas de colonne 'name'. Les colonnes
-- sont first_name et display_name. La fonction crashait a l'execution,
-- renvoyant null → votePower restait a 0 → UI "Rejoignez la faction...".
-- ============================================

CREATE OR REPLACE FUNCTION public.get_territory_votes(
  p_anchor_place_id TEXT,
  p_user_id         TEXT,
  p_blob_place_ids  TEXT[]
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_faction    TEXT;
  v_territory_faction TEXT;
  v_claimed_count   INT;
  v_vote_power      INT;
  v_proposals       JSON;
  v_used_votes      INT;
  v_proposals_count INT;
BEGIN
  -- Migrer les propositions avec un ancien anchor vers le nouvel anchor
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Faction du user
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  -- Faction du territoire (depuis n'importe quel lieu du blob)
  SELECT faction_id INTO v_territory_faction
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
  LIMIT 1;

  -- Eligibilite : meme faction = 1 vote de base, sinon 0
  IF v_user_faction IS NOT NULL AND v_user_faction = v_territory_faction THEN
    SELECT COUNT(*) INTO v_claimed_count
    FROM places
    WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

    v_vote_power := 1 + v_claimed_count;
  ELSE
    v_vote_power := 0;
  END IF;

  -- Nombre de propositions du joueur pour ce territoire
  SELECT COUNT(*) INTO v_proposals_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  -- Liste des propositions avec score net, vote du joueur, et liste des votants
  SELECT json_agg(row_data ORDER BY net_score DESC, created_at ASC) INTO v_proposals
  FROM (
    SELECT
      json_build_object(
        'id',         p.id,
        'name',       p.name,
        'proposedBy', p.proposed_by,
        'netScore',   COALESCE(SUM(v.value), 0),
        'myVote',     MAX(CASE WHEN v.voter_id = p_user_id THEN v.value ELSE NULL END),
        'voters',     COALESCE(
          (SELECT json_agg(json_build_object(
              'name', COALESCE(u.display_name, u.first_name, 'Inconnu'),
              'value', v2.value
            ) ORDER BY ABS(v2.value) DESC)
           FROM territory_name_votes v2
           JOIN users u ON u.id = v2.voter_id
           WHERE v2.proposal_id = p.id),
          '[]'::json
        )
      ) AS row_data,
      COALESCE(SUM(v.value), 0) AS net_score,
      p.created_at
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name, p.proposed_by, p.created_at
  ) sub;

  -- Votes utilises = SUM(ABS(value))
  SELECT COALESCE(SUM(ABS(tv.value)), 0) INTO v_used_votes
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  RETURN json_build_object(
    'votePower',      v_vote_power,
    'usedVotes',      v_used_votes,
    'proposalsCount', v_proposals_count,
    'proposals',      COALESCE(v_proposals, '[]'::json)
  );
END;
$$;
-- Fix: avatars missing for users who set avatar_url (onboarding flow)
-- get_leaderboard() and get_place_by_id() only checked image_media variants,
-- ignoring users.avatar_url which is set by the onboarding avatar upload.
-- Now: avatar_url is checked first, then image_media variants as fallback.

-- ============================================================
-- 1. Fix get_leaderboard
-- ============================================================
DROP FUNCTION IF EXISTS get_leaderboard(TEXT, INT);
CREATE OR REPLACE FUNCTION get_leaderboard(p_type TEXT, p_limit INT DEFAULT 50)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'notoriety' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COALESCE(u.notoriety_points, 0) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', COALESCE(
          u.avatar_url,
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'png_small' LIMIT 1),
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'webp_small' LIMIT 1),
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'original' LIMIT 1)
        ),
        'factionColor', f.color,
        'value', COALESCE(u.notoriety_points, 0)
      ) AS row_data
      FROM users u
      LEFT JOIN factions f ON f.id = u.faction_id
      WHERE COALESCE(u.notoriety_points, 0) > 0
      ORDER BY COALESCE(u.notoriety_points, 0) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'authored' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', COALESCE(
          u.avatar_url,
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'png_small' LIMIT 1),
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'webp_small' LIMIT 1),
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'original' LIMIT 1)
        ),
        'factionColor', f.color,
        'value', COUNT(*)::INT
      ) AS row_data
      FROM users u
      JOIN places p ON p.author_id = u.id
      LEFT JOIN factions f ON f.id = u.faction_id
      GROUP BY u.id, u.first_name, u.email_address, u.profile_image_id, u.avatar_url, f.color
      ORDER BY COUNT(*) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'explored' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', COALESCE(
          u.avatar_url,
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'png_small' LIMIT 1),
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'webp_small' LIMIT 1),
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'original' LIMIT 1)
        ),
        'factionColor', f.color,
        'value', COUNT(*)::INT
      ) AS row_data
      FROM users u
      JOIN places_explored pe ON pe.user_id = u.id
      LEFT JOIN factions f ON f.id = u.faction_id
      GROUP BY u.id, u.first_name, u.email_address, u.profile_image_id, u.avatar_url, f.color
      ORDER BY COUNT(*) DESC
      LIMIT p_limit
    ) sub;

  ELSE
    v_result := '[]'::json;
  END IF;

  RETURN v_result;
END;
$$;
-- Fix: get_place_by_id ignores users.avatar_url for author & explorers
-- avatar_url (set during onboarding) takes priority over image_media variants.

CREATE OR REPLACE FUNCTION public.get_place_by_id(
  p_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place RECORD;
  v_place_type RECORD;
  v_author RECORD;
  v_views_count INT;
  v_likes_count INT;
  v_explored_count INT;
  v_geocache_count INT;
  v_avg_score DOUBLE PRECISION;
  v_last_explorers JSON;
  v_requester JSON;
  v_author_profile_url TEXT;
  v_primary_tag JSON;
  v_all_tags JSON;
  v_claim JSON;
  v_zone_fort INT;
  v_zone_count INT;
  v_target_score INT;
  v_target_radius DOUBLE PRECISION;
  v_claimer_name TEXT;
  v_radius_km NUMERIC(6,1);
  v_lat_delta NUMERIC(8,5);
  v_lon_delta NUMERIC(8,5);
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT * INTO v_place_type FROM place_types WHERE id = v_place.place_type_id;
  SELECT * INTO v_author FROM users WHERE id = v_place.author_id;

  -- Photo de profil de l'auteur : avatar_url prioritaire
  SELECT COALESCE(
    u2.avatar_url,
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_author_profile_url
  FROM users u2
  LEFT JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = v_place.author_id;

  -- Metrics
  SELECT COUNT(*) INTO v_views_count FROM places_viewed WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_likes_count FROM places_liked WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_explored_count FROM places_explored WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_geocache_count FROM reviews WHERE place_id = p_id AND geocache = true;
  SELECT AVG(score) INTO v_avg_score FROM reviews WHERE place_id = p_id;

  -- Derniers explorateurs : avatar_url prioritaire
  SELECT json_agg(explorer) INTO v_last_explorers
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'lastName', COALESCE(u.display_name, u.first_name, 'Aventurier'),
      'profileImageUrl', COALESCE(
        u.avatar_url,
        CASE
          WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
            COALESCE(
              (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
              (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
              (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
            )
          ELSE NULL
        END
      )
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
    WHERE pe.place_id = p_id AND pe.user_id != v_place.author_id
    ORDER BY pe.updated_at DESC
  ) sub;

  -- Tag primaire
  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'color', t.color,
    'background', t.background
  ) INTO v_primary_tag
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_id AND ptag.is_primary = TRUE
  LIMIT 1;

  -- Tous les tags
  SELECT json_agg(tag_data) INTO v_all_tags
  FROM (
    SELECT json_build_object(
      'id', t.id,
      'title', t.title,
      'color', t.color,
      'background', t.background,
      'isPrimary', ptag.is_primary
    ) AS tag_data
    FROM place_tags ptag
    JOIN tags t ON t.id = ptag.tag_id
    WHERE ptag.place_id = p_id
    ORDER BY ptag.is_primary DESC, t."order"
  ) sub;

  -- Requester state
  IF p_user_id IS NOT NULL THEN
    v_requester := json_build_object(
      'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked WHERE place_id = p_id AND user_id = p_user_id),
      'liked', EXISTS(SELECT 1 FROM places_liked WHERE place_id = p_id AND user_id = p_user_id),
      'explored', EXISTS(SELECT 1 FROM places_explored WHERE place_id = p_id AND user_id = p_user_id)
    );
  ELSE
    v_requester := NULL;
  END IF;

  -- Lire le rayon configurable
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_detection_radius_km'), '10')::NUMERIC(6,1) INTO v_radius_km;
  v_lat_delta := v_radius_km / 111.0;
  v_lon_delta := v_radius_km / 79.0;

  -- Fortification voisins (limitee par rayon configurable)
  v_zone_fort := 0;
  v_zone_count := 0;
  IF v_place.faction_id IS NOT NULL THEN
    v_target_score := place_influence_score(p_id);
    v_target_radius := territory_radius_km(v_target_score);

    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_zone_fort
    FROM places p2
    WHERE p2.faction_id = v_place.faction_id
      AND p2.id != p_id
      AND ABS(p2.latitude - v_place.latitude) < v_lat_delta
      AND ABS(p2.longitude - v_place.longitude) < v_lon_delta
      AND (v_target_radius + territory_radius_km(place_influence_score(p2.id)))
          >= sqrt(
            pow((p2.latitude - v_place.latitude) * 111, 2)
            + pow((p2.longitude - v_place.longitude) * 79, 2)
          );

    -- Taille du territoire (blob entier via boucle iterative)
    v_blob_ids := ARRAY[p_id];
    LOOP
      SELECT array_agg(p2.id) INTO v_new_ids
      FROM places p2
      WHERE p2.faction_id = v_place.faction_id
        AND NOT (p2.id = ANY(v_blob_ids))
        AND EXISTS (
          SELECT 1 FROM places pb
          WHERE pb.id = ANY(v_blob_ids)
            AND territory_radius_km(place_influence_score(p2.id))
              + territory_radius_km(place_influence_score(pb.id))
              >= sqrt(
                pow((p2.latitude - pb.latitude) * 111, 2)
                + pow((p2.longitude - pb.longitude) * 79, 2)
              )
        );
      EXIT WHEN v_new_ids IS NULL;
      v_blob_ids := v_blob_ids || v_new_ids;
    END LOOP;
    v_zone_count := array_length(v_blob_ids, 1) - 1;
  END IF;

  -- Nom du joueur qui a revendique
  IF v_place.claimed_by IS NOT NULL THEN
    SELECT COALESCE(display_name, first_name, 'Inconnu')
    INTO v_claimer_name
    FROM users WHERE id = v_place.claimed_by;
  END IF;

  -- Claim info
  IF v_place.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'factionId', f.id,
      'factionTitle', f.title,
      'factionColor', f.color,
      'factionPattern', f.pattern,
      'claimedBy', v_place.claimed_by,
      'claimedByName', COALESCE(v_claimer_name, 'Inconnu'),
      'claimedAt', v_place.claimed_at,
      'fortificationLevel', v_place.fortification_level,
      'zoneFortification', v_zone_fort,
      'zoneNeighborCount', v_zone_count
    ) INTO v_claim
    FROM factions f
    WHERE f.id = v_place.faction_id;
  ELSE
    v_claim := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_place.id,
    'title', v_place.title,
    'text', v_place.text,
    'address', v_place.address,
    'accessibility', v_place.accessibility,
    'sensible', COALESCE(v_place.sensible, false),
    'geocaching', v_geocache_count > 0,
    'images', v_place.images,
    'author', json_build_object(
      'id', COALESCE(v_author.id, v_place.author_id),
      'lastName', COALESCE(v_author.display_name, v_author.first_name, 'Utilisateur inconnu'),
      'profileImageUrl', v_author_profile_url
    ),
    'type', json_build_object(
      'id', v_place_type.id,
      'title', v_place_type.title
    ),
    'primaryTag', v_primary_tag,
    'tags', COALESCE(v_all_tags, '[]'::json),
    'location', json_build_object(
      'latitude', v_place.latitude,
      'longitude', v_place.longitude
    ),
    'metrics', json_build_object(
      'views', v_views_count,
      'likes', v_likes_count,
      'explored', v_explored_count,
      'note', v_avg_score
    ),
    'claim', v_claim,
    'requester', v_requester,
    'lastExplorers', COALESCE(v_last_explorers, '[]'::json),
    'beginAt', v_place.begin_at,
    'endAt', v_place.end_at,
    'createdAt', v_place.created_at
  );
END;
$$;
-- ============================================================
-- MIGRATION 095 : Harmoniser les colonnes avatar
-- ============================================================
-- Problème : deux systèmes coexistent pour les photos de profil :
--   1. profile_image_id → image_media.variants (ancien, onboarding legacy)
--   2. avatar_url (nouveau, onboarding actuel depuis migration 057)
-- Les anciens users ont profile_image_id mais pas avatar_url.
-- Les nouveaux users ont avatar_url mais pas profile_image_id.
-- Résultat : certaines RPCs ne trouvent pas l'avatar selon le système utilisé.
--
-- Solution :
--   1. Backfill avatar_url pour les anciens users depuis image_media
--   2. Simplifier TOUTES les RPCs pour n'utiliser QUE avatar_url
-- ============================================================

-- 1. Backfill avatar_url depuis image_media pour les anciens users
UPDATE users
SET avatar_url = COALESCE(
  (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v
   WHERE im.id = users.profile_image_id AND v->>'name' = 'png_small' LIMIT 1),
  (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v
   WHERE im.id = users.profile_image_id AND v->>'name' = 'webp_small' LIMIT 1),
  (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v
   WHERE im.id = users.profile_image_id AND v->>'name' = 'original' LIMIT 1)
)
WHERE profile_image_id IS NOT NULL
  AND avatar_url IS NULL;

-- ============================================================
-- 2. Simplifier get_leaderboard — avatar_url uniquement
-- ============================================================
DROP FUNCTION IF EXISTS get_leaderboard(TEXT, INT);
CREATE OR REPLACE FUNCTION get_leaderboard(p_type TEXT, p_limit INT DEFAULT 50)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'notoriety' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COALESCE(u.notoriety_points, 0) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value', COALESCE(u.notoriety_points, 0)
      ) AS row_data
      FROM users u
      LEFT JOIN factions f ON f.id = u.faction_id
      WHERE COALESCE(u.notoriety_points, 0) > 0
      ORDER BY COALESCE(u.notoriety_points, 0) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'authored' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value', COUNT(*)::INT
      ) AS row_data
      FROM users u
      JOIN places p ON p.author_id = u.id
      LEFT JOIN factions f ON f.id = u.faction_id
      GROUP BY u.id, u.first_name, u.email_address, u.avatar_url, f.color
      ORDER BY COUNT(*) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'explored' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value', COUNT(*)::INT
      ) AS row_data
      FROM users u
      JOIN places_explored pe ON pe.user_id = u.id
      LEFT JOIN factions f ON f.id = u.faction_id
      GROUP BY u.id, u.first_name, u.email_address, u.avatar_url, f.color
      ORDER BY COUNT(*) DESC
      LIMIT p_limit
    ) sub;

  ELSE
    v_result := '[]'::json;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard TO anon;

-- ============================================================
-- 3. Simplifier get_place_by_id — avatar_url uniquement
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_place_by_id(
  p_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place RECORD;
  v_place_type RECORD;
  v_author RECORD;
  v_views_count INT;
  v_likes_count INT;
  v_explored_count INT;
  v_geocache_count INT;
  v_avg_score DOUBLE PRECISION;
  v_last_explorers JSON;
  v_requester JSON;
  v_primary_tag JSON;
  v_all_tags JSON;
  v_claim JSON;
  v_zone_fort INT;
  v_zone_count INT;
  v_target_score INT;
  v_target_radius DOUBLE PRECISION;
  v_claimer_name TEXT;
  v_radius_km NUMERIC(6,1);
  v_lat_delta NUMERIC(8,5);
  v_lon_delta NUMERIC(8,5);
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT * INTO v_place_type FROM place_types WHERE id = v_place.place_type_id;
  SELECT * INTO v_author FROM users WHERE id = v_place.author_id;

  -- Metrics
  SELECT COUNT(*) INTO v_views_count FROM places_viewed WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_likes_count FROM places_liked WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_explored_count FROM places_explored WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_geocache_count FROM reviews WHERE place_id = p_id AND geocache = true;
  SELECT AVG(score) INTO v_avg_score FROM reviews WHERE place_id = p_id;

  -- Derniers explorateurs — avatar_url uniquement
  SELECT json_agg(explorer) INTO v_last_explorers
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'lastName', COALESCE(u.display_name, u.first_name, 'Aventurier'),
      'profileImageUrl', u.avatar_url
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    WHERE pe.place_id = p_id AND pe.user_id != v_place.author_id
    ORDER BY pe.updated_at DESC
  ) sub;

  -- Tag primaire
  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'color', t.color,
    'background', t.background
  ) INTO v_primary_tag
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_id AND ptag.is_primary = TRUE
  LIMIT 1;

  -- Tous les tags
  SELECT json_agg(tag_data) INTO v_all_tags
  FROM (
    SELECT json_build_object(
      'id', t.id,
      'title', t.title,
      'color', t.color,
      'background', t.background,
      'isPrimary', ptag.is_primary
    ) AS tag_data
    FROM place_tags ptag
    JOIN tags t ON t.id = ptag.tag_id
    WHERE ptag.place_id = p_id
    ORDER BY ptag.is_primary DESC, t."order"
  ) sub;

  -- Requester state
  IF p_user_id IS NOT NULL THEN
    v_requester := json_build_object(
      'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked WHERE place_id = p_id AND user_id = p_user_id),
      'liked', EXISTS(SELECT 1 FROM places_liked WHERE place_id = p_id AND user_id = p_user_id),
      'explored', EXISTS(SELECT 1 FROM places_explored WHERE place_id = p_id AND user_id = p_user_id)
    );
  ELSE
    v_requester := NULL;
  END IF;

  -- Lire le rayon configurable
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_detection_radius_km'), '10')::NUMERIC(6,1) INTO v_radius_km;
  v_lat_delta := v_radius_km / 111.0;
  v_lon_delta := v_radius_km / 79.0;

  -- Fortification voisins
  v_zone_fort := 0;
  v_zone_count := 0;
  IF v_place.faction_id IS NOT NULL THEN
    v_target_score := place_influence_score(p_id);
    v_target_radius := territory_radius_km(v_target_score);

    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_zone_fort
    FROM places p2
    WHERE p2.faction_id = v_place.faction_id
      AND p2.id != p_id
      AND ABS(p2.latitude - v_place.latitude) < v_lat_delta
      AND ABS(p2.longitude - v_place.longitude) < v_lon_delta
      AND (v_target_radius + territory_radius_km(place_influence_score(p2.id)))
          >= sqrt(
            pow((p2.latitude - v_place.latitude) * 111, 2)
            + pow((p2.longitude - v_place.longitude) * 79, 2)
          );

    -- Taille du territoire (blob entier via boucle iterative)
    v_blob_ids := ARRAY[p_id];
    LOOP
      SELECT array_agg(p2.id) INTO v_new_ids
      FROM places p2
      WHERE p2.faction_id = v_place.faction_id
        AND NOT (p2.id = ANY(v_blob_ids))
        AND EXISTS (
          SELECT 1 FROM places pb
          WHERE pb.id = ANY(v_blob_ids)
            AND territory_radius_km(place_influence_score(p2.id))
              + territory_radius_km(place_influence_score(pb.id))
              >= sqrt(
                pow((p2.latitude - pb.latitude) * 111, 2)
                + pow((p2.longitude - pb.longitude) * 79, 2)
              )
        );
      EXIT WHEN v_new_ids IS NULL;
      v_blob_ids := v_blob_ids || v_new_ids;
    END LOOP;
    v_zone_count := array_length(v_blob_ids, 1) - 1;
  END IF;

  -- Nom du joueur qui a revendique
  IF v_place.claimed_by IS NOT NULL THEN
    SELECT COALESCE(display_name, first_name, 'Inconnu')
    INTO v_claimer_name
    FROM users WHERE id = v_place.claimed_by;
  END IF;

  -- Claim info
  IF v_place.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'factionId', f.id,
      'factionTitle', f.title,
      'factionColor', f.color,
      'factionPattern', f.pattern,
      'claimedBy', v_place.claimed_by,
      'claimedByName', COALESCE(v_claimer_name, 'Inconnu'),
      'claimedAt', v_place.claimed_at,
      'fortificationLevel', v_place.fortification_level,
      'zoneFortification', v_zone_fort,
      'zoneNeighborCount', v_zone_count
    ) INTO v_claim
    FROM factions f
    WHERE f.id = v_place.faction_id;
  ELSE
    v_claim := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_place.id,
    'title', v_place.title,
    'text', v_place.text,
    'address', v_place.address,
    'accessibility', v_place.accessibility,
    'sensible', COALESCE(v_place.sensible, false),
    'geocaching', v_geocache_count > 0,
    'images', v_place.images,
    'author', json_build_object(
      'id', COALESCE(v_author.id, v_place.author_id),
      'lastName', COALESCE(v_author.display_name, v_author.first_name, 'Utilisateur inconnu'),
      'profileImageUrl', v_author.avatar_url
    ),
    'type', json_build_object(
      'id', v_place_type.id,
      'title', v_place_type.title
    ),
    'primaryTag', v_primary_tag,
    'tags', COALESCE(v_all_tags, '[]'::json),
    'location', json_build_object(
      'latitude', v_place.latitude,
      'longitude', v_place.longitude
    ),
    'metrics', json_build_object(
      'views', v_views_count,
      'likes', v_likes_count,
      'explored', v_explored_count,
      'note', v_avg_score
    ),
    'claim', v_claim,
    'requester', v_requester,
    'lastExplorers', COALESCE(v_last_explorers, '[]'::json),
    'beginAt', v_place.begin_at,
    'endAt', v_place.end_at,
    'createdAt', v_place.created_at
  );
END;
$$;

-- ============================================================
-- 4. Simplifier get_place_likers — avatar_url uniquement
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_place_likers(
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(liker) INTO v_result
  FROM (
    SELECT json_build_object(
      'userId', u.id,
      'name', COALESCE(u.first_name, u.email_address),
      'factionColor', f.color,
      'profileImage', u.avatar_url
    ) AS liker
    FROM places_liked pl
    JOIN users u ON u.id = pl.user_id
    LEFT JOIN factions f ON f.id = u.faction_id
    WHERE pl.place_id = p_place_id
    ORDER BY pl.created_at DESC
  ) sub;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_likers TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_likers TO anon;

-- ============================================================
-- 5. Simplifier get_place_explorers — avatar_url uniquement
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_place_explorers(
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(explorer) INTO v_result
  FROM (
    SELECT json_build_object(
      'userId', u.id,
      'name', COALESCE(u.first_name, u.email_address),
      'factionColor', f.color,
      'profileImage', u.avatar_url,
      'exploredAt', pe.created_at
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    LEFT JOIN factions f ON f.id = u.faction_id
    WHERE pe.place_id = p_place_id
    ORDER BY pe.created_at DESC
  ) sub;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_explorers TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_explorers TO anon;

-- ============================================================
-- 6. Simplifier get_faction_members — avatar_url uniquement
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_faction_members(p_faction_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT COALESCE(json_agg(member), '[]'::json) INTO v_result
  FROM (
    SELECT json_build_object(
      'userId', u.id,
      'name', COALESCE(u.first_name, u.email_address),
      'profileImage', u.avatar_url,
      'notorietyPoints', COALESCE(u.notoriety_points, 0),
      'displayedGeneralTitles', (
        SELECT COALESCE(json_agg(
          json_build_object('id', t.id, 'name', t.name, 'icon', t.icon)
        ), '[]'::json)
        FROM titles t
        WHERE t.id = ANY(COALESCE(u.displayed_general_title_ids, '{}'))
          AND t.type = 'general'
      ),
      'factionTitle2', (SELECT get_user_titles(u.id)->'factionTitle')
    ) AS member
    FROM users u
    WHERE u.faction_id = p_faction_id
    ORDER BY u.notoriety_points DESC NULLS LAST
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_faction_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_faction_members TO anon;

-- ============================================================
-- 7. Simplifier get_player_profile — avatar_url uniquement
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_titles_data JSON;
  v_displayed_ids INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_claimed_places JSON;
BEGIN
  -- Charger titres via get_user_titles
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  -- Selection du joueur
  SELECT COALESCE(displayed_general_title_ids, '{}')
  INTO v_displayed_ids
  FROM users WHERE id = p_user_id;

  -- Filtrer les titres generaux affiches
  IF array_length(v_displayed_ids, 1) > 0 THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
    WHERE (elem->>'id')::INT = ANY(v_displayed_ids);
  END IF;

  -- Fallback : titre le plus haut (premier element, tri DESC)
  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM (
      SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
      LIMIT 1
    ) sub;
  END IF;

  -- Lieux ajoutes par le joueur (max 50)
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_authored_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'createdAt', p.created_at,
      'imageUrl', CASE
        WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
        THEN p.images->0->>'url'
        ELSE NULL
      END
    ) AS place_data
    FROM places p
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.author_id = p_user_id
    ORDER BY p.created_at DESC
    LIMIT 50
  ) sub;

  -- Lieux explores par le joueur (max 50)
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_discovered_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE
        WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
        THEN p.images->0->>'url'
        ELSE NULL
      END
    ) AS place_data
    FROM places_explored pe
    JOIN places p ON p.id = pe.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE pe.user_id = p_user_id
    ORDER BY pe.created_at DESC
    LIMIT 50
  ) sub;

  -- Lieux conquis par le joueur (max 50)
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_claimed_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE
        WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
        THEN p.images->0->>'url'
        ELSE NULL
      END
    ) AS place_data
    FROM places p
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.claimed_by = p_user_id
    ORDER BY p.claimed_at DESC
    LIMIT 50
  ) sub;

  -- Resultat complet — avatar_url uniquement
  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', u.avatar_url,
    'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places,
    'discoveredPlaces', v_discovered_places,
    'claimedPlaces', v_claimed_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;
-- ============================================================
-- MIGRATION 096 : Supprimer la colonne profile_image_id
-- ============================================================
-- Après migration 095 (backfill avatar_url + simplification RPCs),
-- profile_image_id n'est plus référencé nulle part.
-- On le supprime pour éviter toute confusion future.
-- ============================================================

ALTER TABLE users DROP COLUMN IF EXISTS profile_image_id;
-- ============================================================
-- MIGRATION 097 : Auto-claim à la création d'un lieu
-- ============================================================
-- Si le joueur a une faction, le lieu est automatiquement
-- revendiqué pour sa faction à la création. Gratuit (pas de coût).
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_place(
  p_user_id    TEXT,
  p_title      TEXT,
  p_latitude   REAL,
  p_longitude  REAL,
  p_tag_id     TEXT,
  p_image_url  TEXT DEFAULT NULL,
  p_thumb_url  TEXT DEFAULT NULL,
  p_address    TEXT DEFAULT '',
  p_text       TEXT DEFAULT ''
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id     TEXT;
  v_actor_name TEXT;
  v_images     JSONB;
  v_img_obj    JSONB;
  v_faction_id TEXT;
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Verify user exists + récupérer faction
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- Verify tag exists
  IF NOT EXISTS(SELECT 1 FROM tags WHERE id = p_tag_id) THEN
    RETURN json_build_object('error', 'Tag not found');
  END IF;

  -- Generate place ID
  v_new_id := gen_random_uuid()::TEXT;

  -- Build images JSONB (avec thumb si fourni)
  IF p_image_url IS NOT NULL AND p_image_url <> '' THEN
    v_img_obj := jsonb_build_object('id', gen_random_uuid()::TEXT, 'url', p_image_url);
    IF p_thumb_url IS NOT NULL AND p_thumb_url <> '' THEN
      v_img_obj := v_img_obj || jsonb_build_object('thumb', p_thumb_url);
    END IF;
    v_images := jsonb_build_array(v_img_obj);
  ELSE
    v_images := '[]'::JSONB;
  END IF;

  -- Insert place (auto-claim si faction)
  INSERT INTO places (
    id, created_at, updated_at,
    author_id, place_type_id,
    title, text, address,
    latitude, longitude,
    images, private, masked,
    faction_id, claimed_by, claimed_at
  ) VALUES (
    v_new_id, NOW(), NOW(),
    p_user_id, 'lieu',
    p_title, p_text, p_address,
    p_latitude, p_longitude,
    v_images, false, false,
    v_faction_id, CASE WHEN v_faction_id IS NOT NULL THEN p_user_id ELSE NULL END,
    CASE WHEN v_faction_id IS NOT NULL THEN NOW() ELSE NULL END
  );

  -- Insert primary tag
  INSERT INTO place_tags (place_id, tag_id, is_primary)
  VALUES (v_new_id, p_tag_id, true);

  -- Auto-discover (author discovers their own place)
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, v_new_id, 'gps')
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Historique claim (si faction) — déclenche le trigger trg_log_claim
  IF v_faction_id IS NOT NULL THEN
    INSERT INTO place_claims (place_id, user_id, faction_id)
    VALUES (v_new_id, p_user_id, v_faction_id);
  END IF;

  -- Activity log new_place
  SELECT COALESCE(first_name, email_address) INTO v_actor_name
  FROM users WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'new_place',
    p_user_id,
    v_new_id,
    jsonb_build_object(
      'placeTitle', p_title,
      'placeLatitude', p_latitude,
      'placeLongitude', p_longitude,
      'actorName', v_actor_name
    )
  );

  RETURN json_build_object(
    'success', true,
    'placeId', v_new_id,
    'claimed', v_faction_id IS NOT NULL,
    'factionId', v_faction_id
  );
END;
$$;
-- Fix: bio et instagram étaient écrasés à NULL par GameModeModal/ConquestToggle
-- car update_my_profile ne les protégeait pas avec COALESCE.

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_user_id TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_instagram TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_game_mode TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_name TEXT;
BEGIN
  SELECT first_name INTO v_old_name FROM users WHERE id = p_user_id;

  UPDATE users
  SET first_name  = COALESCE(p_first_name, first_name),
      bio         = COALESCE(p_bio, bio),
      instagram   = COALESCE(p_instagram, instagram),
      avatar_url  = COALESCE(p_avatar_url, avatar_url),
      game_mode   = COALESCE(p_game_mode, game_mode),
      updated_at  = NOW()
  WHERE id = p_user_id;

  IF v_old_name IS NULL AND p_first_name IS NOT NULL THEN
    INSERT INTO activity_log (type, actor_id, data)
    VALUES (
      'new_user',
      p_user_id,
      jsonb_build_object('actorName', p_first_name)
    );
  END IF;

  RETURN json_build_object('success', true);
END;
$$;
-- ============================================
-- MIGRATION 099 : Bonus territoire par fortification + nouveaux poids
-- ============================================
-- Likes ×5, Vues ×0.1, Explorations ×10
-- Fortifications: Tour +10, Défense +20, Bastion +50, Forteresse +100
-- ============================================

CREATE OR REPLACE FUNCTION public.place_influence_score(p_place_id TEXT)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT GREATEST(0, ROUND(
    COALESCE((SELECT COUNT(*) FROM places_liked WHERE place_id = p_place_id), 0) * 5
    + COALESCE((SELECT COUNT(*) FROM places_viewed WHERE place_id = p_place_id), 0) * 0.1
    + COALESCE((SELECT COUNT(*) FROM places_explored WHERE place_id = p_place_id), 0) * 10
    + CASE COALESCE((SELECT fortification_level FROM places WHERE id = p_place_id), 0)
        WHEN 1 THEN 10
        WHEN 2 THEN 20
        WHEN 3 THEN 50
        WHEN 4 THEN 100
        ELSE 0
      END
  ))::int;
$$;
-- Remove the 50 limit on player profile places — frontend handles pagination
-- Replace LIMIT 50 with LIMIT 500 to cover all players

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_titles_data JSON;
  v_displayed_ids INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_claimed_places JSON;
BEGIN
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  SELECT COALESCE(displayed_general_title_ids, '{}')
  INTO v_displayed_ids
  FROM users WHERE id = p_user_id;

  IF array_length(v_displayed_ids, 1) > 0 THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
    WHERE (elem->>'id')::INT = ANY(v_displayed_ids);
  END IF;

  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM (
      SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
      LIMIT 1
    ) sub;
  END IF;

  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_authored_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title,
      'type', COALESCE(pt.title, ''),
      'createdAt', p.created_at,
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
    ) AS place_data
    FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.author_id = p_user_id ORDER BY p.created_at DESC LIMIT 500
  ) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_discovered_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
    ) AS place_data
    FROM places_explored pe JOIN places p ON p.id = pe.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE pe.user_id = p_user_id ORDER BY pe.created_at DESC LIMIT 500
  ) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_claimed_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
    ) AS place_data
    FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.claimed_by = p_user_id ORDER BY p.claimed_at DESC LIMIT 500
  ) sub;

  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', u.avatar_url,
    'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places,
    'discoveredPlaces', v_discovered_places,
    'claimedPlaces', v_claimed_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_profile TO anon;
-- Rebalance influence score weights
-- Likes ×1, Vues ×0.1, Explorations ×3
-- Fortifications: 10, 20, 30, 60

CREATE OR REPLACE FUNCTION public.place_influence_score(p_place_id TEXT)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT GREATEST(0, ROUND(
    COALESCE((SELECT COUNT(*) FROM places_liked WHERE place_id = p_place_id), 0) * 1
    + COALESCE((SELECT COUNT(*) FROM places_viewed WHERE place_id = p_place_id), 0) * 0.1
    + COALESCE((SELECT COUNT(*) FROM places_explored WHERE place_id = p_place_id), 0) * 3
    + CASE COALESCE((SELECT fortification_level FROM places WHERE id = p_place_id), 0)
        WHEN 1 THEN 10
        WHEN 2 THEN 20
        WHEN 3 THEN 30
        WHEN 4 THEN 60
        ELSE 0
      END
  ))::int;
$$;
-- Reduce max proposals per player per territory from 3 to 2
-- Also allow players to delete their own proposals

CREATE OR REPLACE FUNCTION public.propose_territory_name(
  p_user_id TEXT,
  p_anchor_place_id TEXT,
  p_name TEXT,
  p_blob_place_ids TEXT[] DEFAULT '{}'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_trimmed TEXT;
  v_faction_id TEXT;
  v_place_faction TEXT;
BEGIN
  v_trimmed := trim(p_name);

  IF length(v_trimmed) < 3 OR length(v_trimmed) > 50 THEN
    RETURN json_build_object('error', 'invalid_length');
  END IF;

  -- Vérifier que le joueur appartient à la faction du territoire
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  SELECT faction_id INTO v_place_faction FROM places WHERE id = p_anchor_place_id;

  IF v_faction_id IS NULL OR v_faction_id != v_place_faction THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Migrer les anciennes propositions vers le nouvel anchor si nécessaire
  IF array_length(p_blob_place_ids, 1) > 0 THEN
    UPDATE territory_name_proposals
    SET anchor_place_id = p_anchor_place_id
    WHERE anchor_place_id = ANY(p_blob_place_ids)
      AND anchor_place_id != p_anchor_place_id;
  END IF;

  -- Rate limit : max 2 propositions par joueur par territoire
  SELECT COUNT(*) INTO v_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  IF v_count >= 2 THEN
    RETURN json_build_object('error', 'max_proposals');
  END IF;

  INSERT INTO territory_name_proposals (anchor_place_id, proposed_by, name)
  VALUES (p_anchor_place_id, p_user_id, v_trimmed);

  RETURN json_build_object('ok', true);
END;
$$;

-- Allow players to delete their own proposals
CREATE POLICY "proposals_delete" ON territory_name_proposals
  FOR DELETE USING (proposed_by = auth.uid()::text);
-- Fix blob calculation: reduce effective radius by 60% to compensate for Voronoi clipping
-- The backend uses raw circle radius but the frontend clips circles to Voronoi cells,
-- so the visual territory is smaller than the theoretical circle.
-- This caused blobs to include distant places that don't visually touch.

CREATE OR REPLACE FUNCTION public.territory_radius_km(p_score INT)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_score <= 0 THEN 0.0
    WHEN p_score <= 1 THEN 0.25 * 0.6
    ELSE (0.25 + sqrt(p_score - 1) * 0.65) * 0.6
  END;
$$;
-- ============================================
-- MIGRATION 104 : Bonus Underdog (Baroud d'Honneur)
-- ============================================
-- La faction avec le score de notoriete le plus bas recoit un
-- multiplicateur sur la vitesse de regen de toutes ses ressources.
-- Configurable via app_settings (Hub > Factions).
-- ============================================

-- 1. Settings par defaut
INSERT INTO app_settings (key, value)
VALUES ('underdog_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value)
VALUES ('underdog_multiplier', '2')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 2. get_underdog_faction_id()
-- Retourne l'ID de la faction avec le score de notoriete le plus bas
-- parmi celles qui ont au moins 1 lieu revendique.
-- Retourne NULL si underdog desactive ou < 2 factions actives.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_underdog_faction_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_faction_id TEXT;
  v_active_count INT;
BEGIN
  -- Verifier si le systeme est active
  SELECT (value = 'true') INTO v_enabled
  FROM app_settings WHERE key = 'underdog_enabled';

  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NULL;
  END IF;

  -- Compter les factions actives (au moins 1 lieu)
  SELECT COUNT(DISTINCT faction_id) INTO v_active_count
  FROM places
  WHERE faction_id IS NOT NULL AND claimed_at IS NOT NULL;

  IF v_active_count < 2 THEN
    RETURN NULL;
  END IF;

  -- Faction avec le score le plus bas
  SELECT f.id INTO v_faction_id
  FROM factions f
  INNER JOIN places p ON p.faction_id = f.id AND p.claimed_at IS NOT NULL
  GROUP BY f.id
  ORDER BY COALESCE(SUM(
    FLOOR(EXTRACT(EPOCH FROM (NOW() - p.claimed_at)) / 3600)
    * (1 + p.fortification_level * 0.5)
  ), 0) ASC
  LIMIT 1;

  RETURN v_faction_id;
END;
$$;

-- ============================================
-- 3. get_user_energy — appliquer le bonus underdog
-- Divise les cycles de regen par le multiplicateur si le joueur
-- est dans la faction underdog.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy NUMERIC(4,1);
  v_energy_reset_at TIMESTAMPTZ;
  v_max_energy NUMERIC(4,1);
  v_energy_cycle INT := 7200;
  v_energy_elapsed FLOAT;
  v_energy_ticks INT;
  v_energy_add NUMERIC(4,1);
  v_energy_next_in INT;
  v_conquest NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_max_conquest NUMERIC(6,1);
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_add NUMERIC(6,1);
  v_conquest_next_in INT;
  v_construction NUMERIC(6,1);
  v_construction_reset_at TIMESTAMPTZ;
  v_max_construction NUMERIC(6,1);
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_add NUMERIC(6,1);
  v_construction_next_in INT;
  v_notoriety INT;
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
  v_user_faction TEXT;
  v_underdog_id TEXT;
  v_underdog_mult NUMERIC(4,1) := 1;
  v_is_underdog BOOLEAN := false;
BEGIN
  SELECT u.energy_points, u.energy_reset_at,
         GREATEST(1, u.max_energy + COALESCE(f.bonus_energy, 0)),
         u.conquest_points, u.conquest_reset_at,
         GREATEST(1, u.max_conquest + COALESCE(f.bonus_conquest, 0)),
         u.construction_points, u.construction_reset_at,
         GREATEST(1, u.max_construction + COALESCE(f.bonus_construction, 0)),
         u.notoriety_points,
         GREATEST(600, (7200 * (100 - COALESCE(f.bonus_regen_energy, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_conquest, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_construction, 0)) / 100)::INT),
         COALESCE(f.bonus_energy, 0),
         COALESCE(f.bonus_conquest, 0),
         COALESCE(f.bonus_construction, 0),
         u.faction_id
  INTO v_energy, v_energy_reset_at, v_max_energy,
       v_conquest, v_conquest_reset_at, v_max_conquest,
       v_construction, v_construction_reset_at, v_max_construction,
       v_notoriety,
       v_energy_cycle, v_conquest_cycle, v_construction_cycle,
       v_bonus_energy, v_bonus_conquest, v_bonus_construction,
       v_user_faction
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  -- Verifier le bonus underdog
  IF v_user_faction IS NOT NULL THEN
    v_underdog_id := get_underdog_faction_id();
    IF v_underdog_id IS NOT NULL AND v_underdog_id = v_user_faction THEN
      v_is_underdog := true;
      SELECT COALESCE(value::NUMERIC, 2) INTO v_underdog_mult
      FROM app_settings WHERE key = 'underdog_multiplier';
      -- Diviser les cycles par le multiplicateur (regen plus rapide)
      v_energy_cycle := GREATEST(300, (v_energy_cycle / v_underdog_mult)::INT);
      v_conquest_cycle := GREATEST(300, (v_conquest_cycle / v_underdog_mult)::INT);
      v_construction_cycle := GREATEST(300, (v_construction_cycle / v_underdog_mult)::INT);
    END IF;
  END IF;

  -- ---- ENERGIE ----
  v_energy_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset_at));
  v_energy_ticks := GREATEST(0, floor(v_energy_elapsed / v_energy_cycle)::int);
  v_energy_add := LEAST(v_energy_ticks * 1, v_max_energy - v_energy);

  IF v_energy_add > 0 THEN
    v_energy := v_energy + v_energy_add;
    UPDATE users
    SET energy_points = v_energy,
        energy_reset_at = energy_reset_at + make_interval(secs := v_energy_ticks * v_energy_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_energy >= v_max_energy THEN
    v_energy_next_in := 0;
  ELSE
    v_energy_next_in := GREATEST(0, (v_energy_cycle - (v_energy_elapsed - v_energy_ticks * v_energy_cycle))::int);
  END IF;

  -- ---- CONQUETE ----
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  v_conquest_add := LEAST(v_conquest_ticks * 1, v_max_conquest - v_conquest);

  IF v_conquest_add > 0 THEN
    v_conquest := v_conquest + v_conquest_add;
    UPDATE users
    SET conquest_points = v_conquest,
        conquest_reset_at = conquest_reset_at + make_interval(secs := v_conquest_ticks * v_conquest_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- ---- CONSTRUCTION ----
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  v_construction_add := LEAST(v_construction_ticks * 1, v_max_construction - v_construction);

  IF v_construction_add > 0 THEN
    v_construction := v_construction + v_construction_add;
    UPDATE users
    SET construction_points = v_construction,
        construction_reset_at = construction_reset_at + make_interval(secs := v_construction_ticks * v_construction_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'nextPointIn', v_energy_next_in,
    'energyCycle', v_energy_cycle,
    'conquestPoints', COALESCE(v_conquest, 0),
    'maxConquest', v_max_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'conquestCycle', v_conquest_cycle,
    'constructionPoints', COALESCE(v_construction, 0),
    'maxConstruction', v_max_construction,
    'constructionNextPointIn', v_construction_next_in,
    'constructionCycle', v_construction_cycle,
    'notorietyPoints', COALESCE(v_notoriety, 0),
    'bonusEnergy', v_bonus_energy,
    'bonusConquest', v_bonus_conquest,
    'bonusConstruction', v_bonus_construction,
    'isUnderdog', v_is_underdog,
    'underdogMultiplier', v_underdog_mult
  );
END;
$$;

-- ============================================
-- 4. get_faction_notoriety — retourner underdogFactionId
-- ============================================

CREATE OR REPLACE FUNCTION public.get_faction_notoriety()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_underdog_id TEXT;
BEGIN
  v_underdog_id := get_underdog_faction_id();

  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT
      f.id AS "factionId",
      f.title,
      f.color,
      f.pattern,
      COUNT(p.id)::INT AS "placesCount",
      COALESCE(SUM(
        FLOOR(EXTRACT(EPOCH FROM (NOW() - p.claimed_at)) / 3600)
        * (1 + p.fortification_level * 0.5)
      ), 0)::INT AS notoriety,
      COALESCE(SUM(1 + p.fortification_level * 0.5), 0)::NUMERIC(10,1) AS "hourlyRate",
      (f.id = v_underdog_id) AS "isUnderdog"
    FROM factions f
    LEFT JOIN places p ON p.faction_id = f.id AND p.claimed_at IS NOT NULL
    GROUP BY f.id, f.title, f.color, f.pattern, f."order"
    ORDER BY notoriety DESC
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
-- ============================================
-- MIGRATION 105 : Systeme de Fragments & Titres Composes
-- ============================================
-- Chaque achat boutique ou exploit debloque un "fragment" qui donne :
-- 1. Des mots pour composer une phrase-titre (vanite)
-- 2. Un bonus gameplay optionnel (ressources, stats)
--
-- Tables : title_fragments, fragment_words, user_fragments,
--          shopify_unlocks, purchase_log
-- Colonne : users.composed_title_words
-- ============================================

-- ============================================
-- 1. title_fragments — Les packs de mots
-- ============================================

CREATE TABLE IF NOT EXISTS title_fragments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  collection VARCHAR(50),              -- "celtique", "nordique", etc. (set bonus futur)
  bonus_type VARCHAR(50),              -- "max_energy", "regen_conquest", null
  bonus_value NUMERIC(6,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE title_fragments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view title_fragments"
  ON title_fragments FOR SELECT USING (true);

CREATE POLICY "Service role can manage title_fragments"
  ON title_fragments FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 2. fragment_words — Les mots de chaque fragment
-- ============================================

CREATE TABLE IF NOT EXISTS fragment_words (
  id SERIAL PRIMARY KEY,
  fragment_id INT NOT NULL REFERENCES title_fragments(id) ON DELETE CASCADE,
  word VARCHAR(100) NOT NULL,
  slot VARCHAR(30) NOT NULL CHECK (slot IN ('nom', 'epithete', 'connecteur')),
  gender VARCHAR(10) DEFAULT 'n' CHECK (gender IN ('m', 'f', 'n')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fragment_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view fragment_words"
  ON fragment_words FOR SELECT USING (true);

CREATE POLICY "Service role can manage fragment_words"
  ON fragment_words FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 3. user_fragments — Collection du joueur
-- ============================================

CREATE TABLE IF NOT EXISTS user_fragments (
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fragment_id INT NOT NULL REFERENCES title_fragments(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  source VARCHAR(30) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'shopify', 'achievement')),
  PRIMARY KEY (user_id, fragment_id)
);

ALTER TABLE user_fragments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fragments"
  ON user_fragments FOR SELECT USING (user_id = auth.uid()::TEXT);

CREATE POLICY "Service role can manage user_fragments"
  ON user_fragments FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 4. shopify_unlocks — Mapping tag Shopify → unlock jeu
-- ============================================

CREATE TABLE IF NOT EXISTS shopify_unlocks (
  id SERIAL PRIMARY KEY,
  shopify_tag VARCHAR(100) NOT NULL,
  unlock_type VARCHAR(30) NOT NULL DEFAULT 'fragment' CHECK (unlock_type IN ('fragment', 'item', 'boost')),
  unlock_ref_id INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shopify_tag, unlock_type, unlock_ref_id)
);

ALTER TABLE shopify_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shopify_unlocks"
  ON shopify_unlocks FOR SELECT USING (true);

CREATE POLICY "Service role can manage shopify_unlocks"
  ON shopify_unlocks FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 5. purchase_log — Audit trail
-- ============================================

CREATE TABLE IF NOT EXISTS purchase_log (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255),
  shopify_order_id VARCHAR(255),
  shopify_tag VARCHAR(100),
  unlock_type VARCHAR(30),
  unlock_ref_id INT,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('unlocked', 'pending', 'manual')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE purchase_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage purchase_log"
  ON purchase_log FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 6. users.composed_title_words — Phrase composee
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS composed_title_words INT[] DEFAULT '{}';

-- ============================================
-- 7. RPC get_user_composed_title — Reconstituer la phrase
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_composed_title(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_word_ids INT[];
  v_words JSON;
BEGIN
  SELECT COALESCE(composed_title_words, '{}')
  INTO v_word_ids
  FROM users WHERE id = p_user_id;

  IF array_length(v_word_ids, 1) IS NULL OR array_length(v_word_ids, 1) = 0 THEN
    RETURN json_build_object('words', '[]'::json, 'phrase', NULL);
  END IF;

  SELECT json_agg(
    json_build_object('id', fw.id, 'word', fw.word, 'slot', fw.slot, 'gender', fw.gender)
    ORDER BY array_position(v_word_ids, fw.id)
  )
  INTO v_words
  FROM fragment_words fw
  WHERE fw.id = ANY(v_word_ids);

  RETURN json_build_object('words', COALESCE(v_words, '[]'::json));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_composed_title TO authenticated;

-- ============================================
-- 8. RPC set_composed_title — Sauvegarder la phrase
-- ============================================

CREATE OR REPLACE FUNCTION public.set_composed_title(
  p_user_id TEXT,
  p_word_ids INT[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_valid_count INT;
  v_owned_count INT;
BEGIN
  -- Max 4 mots
  IF array_length(p_word_ids, 1) > 4 THEN
    RETURN json_build_object('error', 'Maximum 4 mots');
  END IF;

  -- Verifier que les mots existent
  SELECT COUNT(*) INTO v_valid_count
  FROM fragment_words WHERE id = ANY(p_word_ids);

  IF v_valid_count != array_length(p_word_ids, 1) THEN
    RETURN json_build_object('error', 'Mot invalide');
  END IF;

  -- Verifier que le joueur possede les fragments correspondants
  SELECT COUNT(DISTINCT fw.id) INTO v_owned_count
  FROM fragment_words fw
  JOIN user_fragments uf ON uf.fragment_id = fw.fragment_id AND uf.user_id = p_user_id
  WHERE fw.id = ANY(p_word_ids);

  IF v_owned_count != array_length(p_word_ids, 1) THEN
    RETURN json_build_object('error', 'Fragment non possede');
  END IF;

  UPDATE users
  SET composed_title_words = COALESCE(p_word_ids, '{}')
  WHERE id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_composed_title TO authenticated;

-- ============================================
-- 9. RPC get_user_fragments — Fragments du joueur
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_fragments(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT
      tf.id,
      tf.name,
      tf.icon,
      tf.collection,
      tf.bonus_type,
      tf.bonus_value,
      uf.unlocked_at,
      uf.source,
      (
        SELECT json_agg(json_build_object(
          'id', fw.id, 'word', fw.word, 'slot', fw.slot, 'gender', fw.gender
        ))
        FROM fragment_words fw WHERE fw.fragment_id = tf.id
      ) AS words
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    WHERE uf.user_id = p_user_id
    ORDER BY uf.unlocked_at DESC
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_fragments TO authenticated;
-- ============================================
-- MIGRATION 106 : Stocker la phrase composee en texte
-- ============================================
-- composed_title_words ne suffit pas : l'article et les connecteurs
-- libres ne sont pas des fragment_words. On ajoute un champ texte
-- pour la phrase complete.
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS composed_title_text TEXT;

-- Supprimer l'ancienne signature (2 params) avant de recreer avec 3 params
DROP FUNCTION IF EXISTS public.set_composed_title(TEXT, INT[]);

-- Mettre a jour set_composed_title pour accepter la phrase
CREATE OR REPLACE FUNCTION public.set_composed_title(
  p_user_id TEXT,
  p_word_ids INT[],
  p_phrase TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Max 6 mots fragment
  IF p_word_ids IS NOT NULL AND array_length(p_word_ids, 1) > 6 THEN
    RETURN json_build_object('error', 'Maximum 6 mots');
  END IF;

  UPDATE users
  SET composed_title_words = COALESCE(p_word_ids, '{}'),
      composed_title_text = p_phrase
  WHERE id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$$;

-- Mettre a jour get_user_composed_title pour retourner la phrase
CREATE OR REPLACE FUNCTION public.get_user_composed_title(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_word_ids INT[];
  v_phrase TEXT;
  v_words JSON;
BEGIN
  SELECT COALESCE(composed_title_words, '{}'), composed_title_text
  INTO v_word_ids, v_phrase
  FROM users WHERE id = p_user_id;

  -- Si phrase stockee, la retourner directement
  IF v_phrase IS NOT NULL AND v_phrase != '' THEN
    RETURN json_build_object('phrase', v_phrase, 'wordIds', v_word_ids);
  END IF;

  -- Fallback : reconstituer depuis les word IDs
  IF array_length(v_word_ids, 1) IS NULL OR array_length(v_word_ids, 1) = 0 THEN
    RETURN json_build_object('phrase', NULL, 'wordIds', '{}');
  END IF;

  SELECT json_agg(
    json_build_object('id', fw.id, 'word', fw.word, 'slot', fw.slot, 'gender', fw.gender)
    ORDER BY array_position(v_word_ids, fw.id)
  )
  INTO v_words
  FROM fragment_words fw
  WHERE fw.id = ANY(v_word_ids);

  RETURN json_build_object('phrase', NULL, 'words', COALESCE(v_words, '[]'::json), 'wordIds', v_word_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_composed_title(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_composed_title(TEXT, INT[], TEXT) TO authenticated;
-- ============================================
-- MIGRATION 107 : Image par fragment
-- ============================================

ALTER TABLE title_fragments ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Mettre a jour get_user_fragments pour retourner image_url
CREATE OR REPLACE FUNCTION public.get_user_fragments(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT
      tf.id,
      tf.name,
      tf.icon,
      tf.image_url,
      tf.collection,
      tf.bonus_type,
      tf.bonus_value,
      uf.unlocked_at,
      uf.source,
      (
        SELECT json_agg(json_build_object(
          'id', fw.id, 'word', fw.word, 'slot', fw.slot, 'gender', fw.gender
        ))
        FROM fragment_words fw WHERE fw.fragment_id = tf.id
      ) AS words
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    WHERE uf.user_id = p_user_id
    ORDER BY uf.unlocked_at DESC
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_fragments(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 108 : Lien URL par fragment
-- ============================================

ALTER TABLE title_fragments ADD COLUMN IF NOT EXISTS link_url TEXT;

-- Mettre a jour get_user_fragments pour retourner link_url
CREATE OR REPLACE FUNCTION public.get_user_fragments(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT
      tf.id,
      tf.name,
      tf.icon,
      tf.image_url,
      tf.link_url,
      tf.collection,
      tf.bonus_type,
      tf.bonus_value,
      uf.unlocked_at,
      uf.source,
      (
        SELECT json_agg(json_build_object(
          'id', fw.id, 'word', fw.word, 'slot', fw.slot, 'gender', fw.gender
        ))
        FROM fragment_words fw WHERE fw.fragment_id = tf.id
      ) AS words
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    WHERE uf.user_id = p_user_id
    ORDER BY uf.unlocked_at DESC
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_fragments(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 109 : Appliquer les bonus des fragments dans get_user_energy
-- ============================================
-- Les fragments possedes par le joueur cumulen leurs bonus sur
-- les max de ressources et les cycles de regen.
-- Pile : base user → bonus faction → bonus fragments → underdog
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy NUMERIC(4,1);
  v_energy_reset_at TIMESTAMPTZ;
  v_max_energy NUMERIC(4,1);
  v_energy_cycle INT := 7200;
  v_energy_elapsed FLOAT;
  v_energy_ticks INT;
  v_energy_add NUMERIC(4,1);
  v_energy_next_in INT;
  v_conquest NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_max_conquest NUMERIC(6,1);
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_add NUMERIC(6,1);
  v_conquest_next_in INT;
  v_construction NUMERIC(6,1);
  v_construction_reset_at TIMESTAMPTZ;
  v_max_construction NUMERIC(6,1);
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_add NUMERIC(6,1);
  v_construction_next_in INT;
  v_notoriety INT;
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
  v_user_faction TEXT;
  v_underdog_id TEXT;
  v_underdog_mult NUMERIC(4,1) := 1;
  v_is_underdog BOOLEAN := false;
  -- Fragment bonuses
  v_frag_max_energy NUMERIC := 0;
  v_frag_max_conquest NUMERIC := 0;
  v_frag_max_construction NUMERIC := 0;
  v_frag_regen_energy NUMERIC := 0;
  v_frag_regen_conquest NUMERIC := 0;
  v_frag_regen_construction NUMERIC := 0;
BEGIN
  -- ====== 1. Base user + bonus faction ======
  SELECT u.energy_points, u.energy_reset_at,
         GREATEST(1, u.max_energy + COALESCE(f.bonus_energy, 0)),
         u.conquest_points, u.conquest_reset_at,
         GREATEST(1, u.max_conquest + COALESCE(f.bonus_conquest, 0)),
         u.construction_points, u.construction_reset_at,
         GREATEST(1, u.max_construction + COALESCE(f.bonus_construction, 0)),
         u.notoriety_points,
         GREATEST(600, (7200 * (100 - COALESCE(f.bonus_regen_energy, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_conquest, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_construction, 0)) / 100)::INT),
         COALESCE(f.bonus_energy, 0),
         COALESCE(f.bonus_conquest, 0),
         COALESCE(f.bonus_construction, 0),
         u.faction_id
  INTO v_energy, v_energy_reset_at, v_max_energy,
       v_conquest, v_conquest_reset_at, v_max_conquest,
       v_construction, v_construction_reset_at, v_max_construction,
       v_notoriety,
       v_energy_cycle, v_conquest_cycle, v_construction_cycle,
       v_bonus_energy, v_bonus_conquest, v_bonus_construction,
       v_user_faction
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  -- ====== 2. Cumuler les bonus des fragments ======
  SELECT
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_construction' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_construction' THEN tf.bonus_value ELSE 0 END), 0)
  INTO v_frag_max_energy, v_frag_max_conquest, v_frag_max_construction,
       v_frag_regen_energy, v_frag_regen_conquest, v_frag_regen_construction
  FROM user_fragments uf
  JOIN title_fragments tf ON tf.id = uf.fragment_id
  WHERE uf.user_id = p_user_id AND tf.bonus_type IS NOT NULL AND tf.bonus_value != 0;

  -- Appliquer les bonus max des fragments
  v_max_energy := GREATEST(1, v_max_energy + v_frag_max_energy);
  v_max_conquest := GREATEST(1, v_max_conquest + v_frag_max_conquest);
  v_max_construction := GREATEST(1, v_max_construction + v_frag_max_construction);

  -- Appliquer les bonus regen des fragments (reduction du cycle en %)
  IF v_frag_regen_energy != 0 THEN
    v_energy_cycle := GREATEST(300, (v_energy_cycle * (100 - v_frag_regen_energy) / 100)::INT);
  END IF;
  IF v_frag_regen_conquest != 0 THEN
    v_conquest_cycle := GREATEST(300, (v_conquest_cycle * (100 - v_frag_regen_conquest) / 100)::INT);
  END IF;
  IF v_frag_regen_construction != 0 THEN
    v_construction_cycle := GREATEST(300, (v_construction_cycle * (100 - v_frag_regen_construction) / 100)::INT);
  END IF;

  -- ====== 3. Bonus underdog (applique en dernier) ======
  IF v_user_faction IS NOT NULL THEN
    v_underdog_id := get_underdog_faction_id();
    IF v_underdog_id IS NOT NULL AND v_underdog_id = v_user_faction THEN
      v_is_underdog := true;
      SELECT COALESCE(value::NUMERIC, 2) INTO v_underdog_mult
      FROM app_settings WHERE key = 'underdog_multiplier';
      v_energy_cycle := GREATEST(300, (v_energy_cycle / v_underdog_mult)::INT);
      v_conquest_cycle := GREATEST(300, (v_conquest_cycle / v_underdog_mult)::INT);
      v_construction_cycle := GREATEST(300, (v_construction_cycle / v_underdog_mult)::INT);
    END IF;
  END IF;

  -- ---- ENERGIE ----
  v_energy_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset_at));
  v_energy_ticks := GREATEST(0, floor(v_energy_elapsed / v_energy_cycle)::int);
  v_energy_add := LEAST(v_energy_ticks * 1, v_max_energy - v_energy);

  IF v_energy_add > 0 THEN
    v_energy := v_energy + v_energy_add;
    UPDATE users
    SET energy_points = v_energy,
        energy_reset_at = energy_reset_at + make_interval(secs := v_energy_ticks * v_energy_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_energy >= v_max_energy THEN
    v_energy_next_in := 0;
  ELSE
    v_energy_next_in := GREATEST(0, (v_energy_cycle - (v_energy_elapsed - v_energy_ticks * v_energy_cycle))::int);
  END IF;

  -- ---- CONQUETE ----
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  v_conquest_add := LEAST(v_conquest_ticks * 1, v_max_conquest - v_conquest);

  IF v_conquest_add > 0 THEN
    v_conquest := v_conquest + v_conquest_add;
    UPDATE users
    SET conquest_points = v_conquest,
        conquest_reset_at = conquest_reset_at + make_interval(secs := v_conquest_ticks * v_conquest_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- ---- CONSTRUCTION ----
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  v_construction_add := LEAST(v_construction_ticks * 1, v_max_construction - v_construction);

  IF v_construction_add > 0 THEN
    v_construction := v_construction + v_construction_add;
    UPDATE users
    SET construction_points = v_construction,
        construction_reset_at = construction_reset_at + make_interval(secs := v_construction_ticks * v_construction_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'nextPointIn', v_energy_next_in,
    'energyCycle', v_energy_cycle,
    'conquestPoints', COALESCE(v_conquest, 0),
    'maxConquest', v_max_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'conquestCycle', v_conquest_cycle,
    'constructionPoints', COALESCE(v_construction, 0),
    'maxConstruction', v_max_construction,
    'constructionNextPointIn', v_construction_next_in,
    'constructionCycle', v_construction_cycle,
    'notorietyPoints', COALESCE(v_notoriety, 0),
    'bonusEnergy', v_bonus_energy + v_frag_max_energy,
    'bonusConquest', v_bonus_conquest + v_frag_max_conquest,
    'bonusConstruction', v_bonus_construction + v_frag_max_construction,
    'isUnderdog', v_is_underdog,
    'underdogMultiplier', v_underdog_mult
  );
END;
$$;
-- ============================================
-- MIGRATION 110 : Deblocage automatique des fragments pending au signup
-- ============================================
-- Quand un joueur se connecte pour la premiere fois, on verifie
-- si des fragments sont en attente pour son email dans purchase_log.
-- Si oui, on les debloque automatiquement.
-- ============================================

CREATE OR REPLACE FUNCTION public.unlock_pending_fragments(p_user_id TEXT, p_email TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT id, unlock_ref_id
    FROM purchase_log
    WHERE email = p_email
      AND status = 'pending'
      AND unlock_type = 'fragment'
  LOOP
    -- Inserer le fragment (ignore si deja present)
    INSERT INTO user_fragments (user_id, fragment_id, source)
    VALUES (p_user_id, v_row.unlock_ref_id, 'shopify')
    ON CONFLICT (user_id, fragment_id) DO NOTHING;

    -- Mettre a jour le log
    UPDATE purchase_log
    SET user_id = p_user_id, status = 'unlocked'
    WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_pending_fragments(TEXT, TEXT) TO authenticated;
-- ============================================
-- MIGRATION 111 : Ecrans publicitaires (loading screens)
-- ============================================
-- Images de fond + astuces gameplay affiches au chargement.
-- Combines aleatoirement : 1 image random + 1 astuce random.
-- Le tag 'anecdote' est prevu pour plus tard (image liee).
-- ============================================

-- 1. Images de fond
CREATE TABLE IF NOT EXISTS ad_screens (
  id SERIAL PRIMARY KEY,
  image_url TEXT NOT NULL,
  product_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ad_screens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active ad_screens" ON ad_screens FOR SELECT USING (true);
CREATE POLICY "Service role can manage ad_screens" ON ad_screens FOR ALL USING (true) WITH CHECK (true);

-- 2. Astuces / textes overlay
CREATE TABLE IF NOT EXISTS ad_tips (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  tag VARCHAR(30) NOT NULL DEFAULT 'astuce' CHECK (tag IN ('astuce', 'anecdote')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ad_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active ad_tips" ON ad_tips FOR SELECT USING (true);
CREATE POLICY "Service role can manage ad_tips" ON ad_tips FOR ALL USING (true) WITH CHECK (true);

-- 3. Duree du timer (configurable via app_settings)
INSERT INTO app_settings (key, value)
VALUES ('ad_screen_duration', '5')
ON CONFLICT (key) DO NOTHING;

-- 4. RPC pour tirer un ecran aleatoire
CREATE OR REPLACE FUNCTION public.get_random_ad()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_screen JSON;
  v_tip JSON;
BEGIN
  -- Image aleatoire
  SELECT json_build_object('id', id, 'imageUrl', image_url, 'productUrl', product_url)
  INTO v_screen
  FROM ad_screens
  WHERE active = true
  ORDER BY random()
  LIMIT 1;

  -- Astuce aleatoire
  SELECT json_build_object('id', id, 'title', title, 'subtitle', subtitle, 'tag', tag)
  INTO v_tip
  FROM ad_tips
  WHERE active = true
  ORDER BY random()
  LIMIT 1;

  -- Si aucun ecran ou aucune astuce, retourner null
  IF v_screen IS NULL OR v_tip IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object('screen', v_screen, 'tip', v_tip);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_random_ad() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_random_ad() TO anon;
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
-- ============================================
-- MIGRATION 113 : Titre produit sur les ecrans pub
-- ============================================

ALTER TABLE ad_screens ADD COLUMN IF NOT EXISTS title TEXT;

-- Mettre a jour la RPC pour retourner le titre
CREATE OR REPLACE FUNCTION public.get_random_ad()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_screen JSON;
  v_tip JSON;
BEGIN
  SELECT json_build_object('id', id, 'imageUrl', image_url, 'productUrl', product_url, 'title', title)
  INTO v_screen
  FROM ad_screens
  WHERE active = true
  ORDER BY random()
  LIMIT 1;

  SELECT json_build_object('id', id, 'title', title, 'subtitle', subtitle, 'tag', tag)
  INTO v_tip
  FROM ad_tips
  WHERE active = true
  ORDER BY random()
  LIMIT 1;

  IF v_screen IS NULL OR v_tip IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object('screen', v_screen, 'tip', v_tip);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_random_ad() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_random_ad() TO anon;
-- ============================================
-- MIGRATION 114 : Titres v3 — Retour aux badges
-- ============================================
-- 3 catégories : titres de jeu, titres de faction, titres de fragment
-- Le joueur choisit max 3 à afficher, ordonnés par priorité.
-- Le premier = affiché sur la carte.
-- Les titres non débloqués sont grisés.
-- ============================================

-- 1. Nouveau champ : liste ordonnée d'IDs de titres affichés
-- IDs positifs = titles.id (exploits/faction), IDs négatifs = fragment_words.id * -1
ALTER TABLE users ADD COLUMN IF NOT EXISTS displayed_title_ids_v3 INT[] DEFAULT '{}';

-- 2. RPC pour sauvegarder les titres affichés (max 3, ordonnés)
CREATE OR REPLACE FUNCTION public.set_displayed_titles_v3(
  p_user_id TEXT,
  p_title_ids INT[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF array_length(p_title_ids, 1) > 3 THEN
    RETURN json_build_object('error', 'Maximum 3 titres');
  END IF;

  UPDATE users
  SET displayed_title_ids_v3 = COALESCE(p_title_ids, '{}')
  WHERE id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_displayed_titles_v3(TEXT, INT[]) TO authenticated;

-- 3. RPC pour récupérer TOUS les titres (débloqués + verrouillés) en 3 catégories
CREATE OR REPLACE FUNCTION public.get_all_player_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_displayed INT[];
  v_faction_id TEXT;
  v_game_titles JSON;
  v_faction_titles JSON;
  v_fragment_titles JSON;
  -- Stats pour vérifier les conditions
  v_titles_data JSON;
BEGIN
  SELECT COALESCE(displayed_title_ids_v3, '{}'), faction_id
  INTO v_displayed, v_faction_id
  FROM users WHERE id = p_user_id;

  -- Charger les titres via get_user_titles pour savoir lesquels sont débloqués
  v_titles_data := get_user_titles(p_user_id);

  -- Titres de jeu (type = general) — TOUS, avec flag unlocked
  SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_game_titles
  FROM (
    SELECT
      t.id,
      t.name,
      t.icon,
      t."order" AS t_order,
      EXISTS (
        SELECT 1 FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
        WHERE (elem->>'id')::INT = t.id
      ) AS unlocked
    FROM titles t
    WHERE t.type = 'general'
  ) row_data;

  -- Titres de faction — TOUS les titres de la faction du joueur, avec flag unlocked
  IF v_faction_id IS NOT NULL THEN
    SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_faction_titles
    FROM (
      SELECT
        t.id,
        t.name,
        t.icon,
        t."order" AS t_order,
        (v_titles_data->'factionTitle' IS NOT NULL AND (v_titles_data->'factionTitle'->>'id')::INT = t.id) AS unlocked
      FROM titles t
      WHERE t.type = 'faction' AND t.faction_id = v_faction_id
    ) row_data;
  END IF;

  -- Titres de fragment — TOUS les mots de tous les fragments, avec flag unlocked (possédé)
  SELECT json_agg(row_data ORDER BY frag_name, word) INTO v_fragment_titles
  FROM (
    SELECT
      fw.id * -1 AS id,
      fw.word AS name,
      tf.icon,
      tf.name AS frag_name,
      fw.word,
      EXISTS (
        SELECT 1 FROM user_fragments uf
        WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id
      ) AS unlocked,
      tf.name AS source_label
    FROM fragment_words fw
    JOIN title_fragments tf ON tf.id = fw.fragment_id
  ) row_data;

  RETURN json_build_object(
    'gameTitles', COALESCE(v_game_titles, '[]'::json),
    'factionTitles', COALESCE(v_faction_titles, '[]'::json),
    'fragmentTitles', COALESCE(v_fragment_titles, '[]'::json),
    'displayedIds', v_displayed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_player_titles(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 115 : Fix get_all_player_titles (3 catégories + unlocked flag)
-- ============================================
-- La 114 a été appliquée avec une ancienne version de la RPC.
-- Cette migration recrée les RPCs avec la bonne logique.
-- ============================================

-- set_displayed_titles_v3 déjà créé en 114, on le recrée au cas où
CREATE OR REPLACE FUNCTION public.set_displayed_titles_v3(
  p_user_id TEXT,
  p_title_ids INT[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF array_length(p_title_ids, 1) > 3 THEN
    RETURN json_build_object('error', 'Maximum 3 titres');
  END IF;

  UPDATE users
  SET displayed_title_ids_v3 = COALESCE(p_title_ids, '{}')
  WHERE id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_displayed_titles_v3(TEXT, INT[]) TO authenticated;

-- 3. RPC pour récupérer TOUS les titres (débloqués + verrouillés) en 3 catégories
CREATE OR REPLACE FUNCTION public.get_all_player_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_displayed INT[];
  v_faction_id TEXT;
  v_game_titles JSON;
  v_faction_titles JSON;
  v_fragment_titles JSON;
  -- Stats pour vérifier les conditions
  v_titles_data JSON;
BEGIN
  SELECT COALESCE(displayed_title_ids_v3, '{}'), faction_id
  INTO v_displayed, v_faction_id
  FROM users WHERE id = p_user_id;

  -- Charger les titres via get_user_titles pour savoir lesquels sont débloqués
  v_titles_data := get_user_titles(p_user_id);

  -- Titres de jeu (type = general) — TOUS, avec flag unlocked
  SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_game_titles
  FROM (
    SELECT
      t.id,
      t.name,
      t.icon,
      t."order" AS t_order,
      EXISTS (
        SELECT 1 FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
        WHERE (elem->>'id')::INT = t.id
      ) AS unlocked
    FROM titles t
    WHERE t.type = 'general'
  ) row_data;

  -- Titres de faction — TOUS les titres de la faction du joueur, avec flag unlocked
  IF v_faction_id IS NOT NULL THEN
    SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_faction_titles
    FROM (
      SELECT
        t.id,
        t.name,
        t.icon,
        t."order" AS t_order,
        (v_titles_data->'factionTitle' IS NOT NULL AND (v_titles_data->'factionTitle'->>'id')::INT = t.id) AS unlocked
      FROM titles t
      WHERE t.type = 'faction' AND t.faction_id = v_faction_id
    ) row_data;
  END IF;

  -- Titres de fragment — TOUS les mots de tous les fragments, avec flag unlocked (possédé)
  SELECT json_agg(row_data ORDER BY frag_name, word) INTO v_fragment_titles
  FROM (
    SELECT
      fw.id * -1 AS id,
      fw.word AS name,
      tf.icon,
      tf.name AS frag_name,
      fw.word,
      EXISTS (
        SELECT 1 FROM user_fragments uf
        WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id
      ) AS unlocked,
      tf.name AS source_label
    FROM fragment_words fw
    JOIN title_fragments tf ON tf.id = fw.fragment_id
  ) row_data;

  RETURN json_build_object(
    'gameTitles', COALESCE(v_game_titles, '[]'::json),
    'factionTitles', COALESCE(v_faction_titles, '[]'::json),
    'fragmentTitles', COALESCE(v_fragment_titles, '[]'::json),
    'displayedIds', v_displayed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_player_titles(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 116 : Fix get_player_profile pour lire displayed_title_ids_v3
-- ============================================
-- Le profil doit afficher les titres sélectionnés via le système v3.
-- IDs positifs = titles.id, IDs négatifs = fragment_words.id * -1
-- ============================================

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_avatar_url TEXT;
  v_titles_data JSON;
  v_displayed_ids INT[];
  v_displayed_titles JSON;
  v_faction_title JSON;
BEGIN
  -- Avatar
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_avatar_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = p_user_id;

  -- Charger titres via get_user_titles (pour faction title)
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  -- Lire les IDs v3
  SELECT COALESCE(displayed_title_ids_v3, '{}')
  INTO v_displayed_ids
  FROM users WHERE id = p_user_id;

  -- Construire les titres affiches depuis v3
  IF array_length(v_displayed_ids, 1) > 0 THEN
    SELECT json_agg(row_data ORDER BY pos) INTO v_displayed_titles
    FROM (
      -- Titres positifs = table titles
      SELECT t.id, t.name, t.icon, array_position(v_displayed_ids, t.id) AS pos
      FROM titles t
      WHERE t.id = ANY(v_displayed_ids) AND t.id > 0
      UNION ALL
      -- Titres negatifs = fragment_words (id * -1)
      SELECT fw.id * -1 AS id, fw.word AS name, tf.icon, array_position(v_displayed_ids, fw.id * -1) AS pos
      FROM fragment_words fw
      JOIN title_fragments tf ON tf.id = fw.fragment_id
      WHERE (fw.id * -1) = ANY(v_displayed_ids)
    ) row_data;
  END IF;

  -- Fallback : si pas de v3, utiliser l'ancien systeme
  IF v_displayed_titles IS NULL THEN
    SELECT json_agg(elem)
    INTO v_displayed_titles
    FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
    LIMIT 1;
  END IF;

  -- Resultat
  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', COALESCE(u.avatar_url, v_avatar_url),
    'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_titles, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, ''),
    'instagram', u.instagram,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;
-- ============================================
-- MIGRATION 117 : Fix complet get_player_profile avec titres v3
-- ============================================
-- La 116 avait cassé la RPC en perdant les sous-requêtes de lieux.
-- Cette version restaure tout + ajoute la lecture de displayed_title_ids_v3.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_titles_data JSON;
  v_displayed_v3 INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_claimed_places JSON;
BEGIN
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  -- Lire les IDs v3
  SELECT COALESCE(displayed_title_ids_v3, '{}')
  INTO v_displayed_v3
  FROM users WHERE id = p_user_id;

  -- Si v3 est rempli, utiliser le nouveau systeme
  IF array_length(v_displayed_v3, 1) > 0 THEN
    SELECT json_agg(row_data ORDER BY pos) INTO v_displayed_general
    FROM (
      -- Titres positifs = table titles
      SELECT t.id, t.name, t.icon, array_position(v_displayed_v3, t.id) AS pos
      FROM titles t
      WHERE t.id = ANY(v_displayed_v3) AND t.id > 0
      UNION ALL
      -- Titres negatifs = fragment_words (id * -1)
      SELECT fw.id * -1 AS id, fw.word AS name, tf.icon, array_position(v_displayed_v3, fw.id * -1) AS pos
      FROM fragment_words fw
      JOIN title_fragments tf ON tf.id = fw.fragment_id
      WHERE (fw.id * -1) = ANY(v_displayed_v3)
    ) row_data;
  END IF;

  -- Fallback : ancien systeme (displayed_general_title_ids)
  IF v_displayed_general IS NULL THEN
    DECLARE v_old_ids INT[];
    BEGIN
      SELECT COALESCE(displayed_general_title_ids, '{}')
      INTO v_old_ids
      FROM users WHERE id = p_user_id;

      IF array_length(v_old_ids, 1) > 0 THEN
        SELECT json_agg(elem)
        INTO v_displayed_general
        FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
        WHERE (elem->>'id')::INT = ANY(v_old_ids);
      END IF;
    END;
  END IF;

  -- Fallback final : premier titre debloque
  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM (
      SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
      LIMIT 1
    ) sub;
  END IF;

  -- Lieux authored
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_authored_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title,
      'type', COALESCE(pt.title, ''),
      'createdAt', p.created_at,
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
    ) AS place_data
    FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.author_id = p_user_id ORDER BY p.created_at DESC LIMIT 500
  ) sub;

  -- Lieux discovered
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_discovered_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
    ) AS place_data
    FROM places_explored pe JOIN places p ON p.id = pe.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE pe.user_id = p_user_id ORDER BY pe.created_at DESC LIMIT 500
  ) sub;

  -- Lieux claimed
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_claimed_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
    ) AS place_data
    FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.claimed_by = p_user_id ORDER BY p.claimed_at DESC LIMIT 500
  ) sub;

  -- Resultat final
  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', u.avatar_url,
    'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places,
    'discoveredPlaces', v_discovered_places,
    'claimedPlaces', v_claimed_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_profile TO anon;
-- ============================================
-- MIGRATION 118 : Description sur les titres
-- ============================================

ALTER TABLE titles ADD COLUMN IF NOT EXISTS description TEXT;
-- ============================================
-- MIGRATION 119 : Retourner description dans get_all_player_titles
-- ============================================

CREATE OR REPLACE FUNCTION public.get_all_player_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_displayed INT[];
  v_faction_id TEXT;
  v_game_titles JSON;
  v_faction_titles JSON;
  v_fragment_titles JSON;
  v_titles_data JSON;
BEGIN
  SELECT COALESCE(displayed_title_ids_v3, '{}'), faction_id
  INTO v_displayed, v_faction_id
  FROM users WHERE id = p_user_id;

  v_titles_data := get_user_titles(p_user_id);

  -- Titres de jeu avec description
  SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_game_titles
  FROM (
    SELECT
      t.id, t.name, t.icon, t.description, t."order" AS t_order,
      EXISTS (
        SELECT 1 FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
        WHERE (elem->>'id')::INT = t.id
      ) AS unlocked
    FROM titles t WHERE t.type = 'general'
  ) row_data;

  -- Titres de faction avec description
  IF v_faction_id IS NOT NULL THEN
    SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_faction_titles
    FROM (
      SELECT
        t.id, t.name, t.icon, t.description, t."order" AS t_order,
        (v_titles_data->'factionTitle' IS NOT NULL AND (v_titles_data->'factionTitle'->>'id')::INT = t.id) AS unlocked
      FROM titles t WHERE t.type = 'faction' AND t.faction_id = v_faction_id
    ) row_data;
  END IF;

  -- Titres de fragment (description = nom du fragment)
  SELECT json_agg(row_data ORDER BY frag_name, word) INTO v_fragment_titles
  FROM (
    SELECT
      fw.id * -1 AS id, fw.word AS name, tf.icon, tf.name AS frag_name, fw.word,
      COALESCE(tf.description, tf.name) AS description,
      EXISTS (
        SELECT 1 FROM user_fragments uf WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id
      ) AS unlocked,
      tf.name AS source_label
    FROM fragment_words fw
    JOIN title_fragments tf ON tf.id = fw.fragment_id
  ) row_data;

  RETURN json_build_object(
    'gameTitles', COALESCE(v_game_titles, '[]'::json),
    'factionTitles', COALESCE(v_faction_titles, '[]'::json),
    'fragmentTitles', COALESCE(v_fragment_titles, '[]'::json),
    'displayedIds', v_displayed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_player_titles(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 120 : Retourner description dans get_all_player_titles
-- ============================================

CREATE OR REPLACE FUNCTION public.get_all_player_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_displayed INT[];
  v_faction_id TEXT;
  v_game_titles JSON;
  v_faction_titles JSON;
  v_fragment_titles JSON;
  v_titles_data JSON;
BEGIN
  SELECT COALESCE(displayed_title_ids_v3, '{}'), faction_id
  INTO v_displayed, v_faction_id
  FROM users WHERE id = p_user_id;

  v_titles_data := get_user_titles(p_user_id);

  -- Titres de jeu avec description
  SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_game_titles
  FROM (
    SELECT
      t.id, t.name, t.icon, t.description, t."order" AS t_order,
      EXISTS (
        SELECT 1 FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
        WHERE (elem->>'id')::INT = t.id
      ) AS unlocked
    FROM titles t WHERE t.type = 'general'
  ) row_data;

  -- Titres de faction avec description
  IF v_faction_id IS NOT NULL THEN
    SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_faction_titles
    FROM (
      SELECT
        t.id, t.name, t.icon, t.description, t."order" AS t_order,
        (v_titles_data->'factionTitle' IS NOT NULL AND (v_titles_data->'factionTitle'->>'id')::INT = t.id) AS unlocked
      FROM titles t WHERE t.type = 'faction' AND t.faction_id = v_faction_id
    ) row_data;
  END IF;

  -- Titres de fragment (description = nom du fragment)
  SELECT json_agg(row_data ORDER BY frag_name, word) INTO v_fragment_titles
  FROM (
    SELECT
      fw.id * -1 AS id, fw.word AS name, tf.icon, tf.name AS frag_name, fw.word,
      COALESCE(tf.description, tf.name) AS description,
      EXISTS (
        SELECT 1 FROM user_fragments uf WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id
      ) AS unlocked,
      tf.name AS source_label
    FROM fragment_words fw
    JOIN title_fragments tf ON tf.id = fw.fragment_id
  ) row_data;

  RETURN json_build_object(
    'gameTitles', COALESCE(v_game_titles, '[]'::json),
    'factionTitles', COALESCE(v_faction_titles, '[]'::json),
    'fragmentTitles', COALESCE(v_fragment_titles, '[]'::json),
    'displayedIds', v_displayed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_player_titles(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 121 : RPC pour lister tous les fragments avec flag owned
-- ============================================

CREATE OR REPLACE FUNCTION public.get_all_fragments(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data ORDER BY owned DESC, name) INTO v_result
  FROM (
    SELECT
      tf.id,
      tf.name,
      tf.description,
      tf.icon,
      tf.image_url,
      tf.link_url,
      tf.bonus_type,
      tf.bonus_value,
      EXISTS (
        SELECT 1 FROM user_fragments uf
        WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id
      ) AS owned
    FROM title_fragments tf
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_fragments(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_fragments(TEXT) TO anon;
-- ============================================
-- MIGRATION 122 : Champ visible sur les fragments
-- ============================================

ALTER TABLE title_fragments ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT true;

-- Mettre a jour get_all_fragments pour filtrer
CREATE OR REPLACE FUNCTION public.get_all_fragments(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data ORDER BY owned DESC, name) INTO v_result
  FROM (
    SELECT
      tf.id, tf.name, tf.description, tf.icon, tf.image_url, tf.link_url,
      tf.bonus_type, tf.bonus_value,
      EXISTS (
        SELECT 1 FROM user_fragments uf
        WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id
      ) AS owned
    FROM title_fragments tf
    WHERE tf.visible = true
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_fragments(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_fragments(TEXT) TO anon;
-- ============================================
-- MIGRATION 123 : Filtrer les fragments non visibles dans get_user_fragments
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_fragments(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT
      tf.id, tf.name, tf.icon, tf.image_url, tf.link_url,
      tf.collection, tf.bonus_type, tf.bonus_value,
      uf.unlocked_at, uf.source,
      (
        SELECT json_agg(json_build_object(
          'id', fw.id, 'word', fw.word, 'slot', fw.slot, 'gender', fw.gender
        ))
        FROM fragment_words fw WHERE fw.fragment_id = tf.id
      ) AS words
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    WHERE uf.user_id = p_user_id AND tf.visible = true
    ORDER BY uf.unlocked_at DESC
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_fragments(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 124 : Retourner image_url du fragment dans get_all_player_titles
-- ============================================

CREATE OR REPLACE FUNCTION public.get_all_player_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_displayed INT[];
  v_faction_id TEXT;
  v_game_titles JSON;
  v_faction_titles JSON;
  v_fragment_titles JSON;
  v_titles_data JSON;
BEGIN
  SELECT COALESCE(displayed_title_ids_v3, '{}'), faction_id
  INTO v_displayed, v_faction_id
  FROM users WHERE id = p_user_id;

  v_titles_data := get_user_titles(p_user_id);

  SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_game_titles
  FROM (
    SELECT
      t.id, t.name, t.icon, t.description, NULL AS image_url, t."order" AS t_order,
      EXISTS (
        SELECT 1 FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
        WHERE (elem->>'id')::INT = t.id
      ) AS unlocked
    FROM titles t WHERE t.type = 'general'
  ) row_data;

  IF v_faction_id IS NOT NULL THEN
    SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_faction_titles
    FROM (
      SELECT
        t.id, t.name, t.icon, t.description, NULL AS image_url, t."order" AS t_order,
        (v_titles_data->'factionTitle' IS NOT NULL AND (v_titles_data->'factionTitle'->>'id')::INT = t.id) AS unlocked
      FROM titles t WHERE t.type = 'faction' AND t.faction_id = v_faction_id
    ) row_data;
  END IF;

  SELECT json_agg(row_data ORDER BY frag_name, word) INTO v_fragment_titles
  FROM (
    SELECT
      fw.id * -1 AS id, fw.word AS name, tf.icon,
      COALESCE(tf.description, tf.name) AS description,
      tf.image_url,
      tf.name AS frag_name, fw.word,
      EXISTS (
        SELECT 1 FROM user_fragments uf WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id
      ) AS unlocked,
      tf.name AS source_label
    FROM fragment_words fw
    JOIN title_fragments tf ON tf.id = fw.fragment_id
  ) row_data;

  RETURN json_build_object(
    'gameTitles', COALESCE(v_game_titles, '[]'::json),
    'factionTitles', COALESCE(v_faction_titles, '[]'::json),
    'fragmentTitles', COALESCE(v_fragment_titles, '[]'::json),
    'displayedIds', v_displayed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_player_titles(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 125 : Retourner image_url dans les titres affiches du profil
-- ============================================

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_titles_data JSON;
  v_displayed_v3 INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_claimed_places JSON;
BEGIN
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  SELECT COALESCE(displayed_title_ids_v3, '{}')
  INTO v_displayed_v3
  FROM users WHERE id = p_user_id;

  IF array_length(v_displayed_v3, 1) > 0 THEN
    SELECT json_agg(row_data ORDER BY pos) INTO v_displayed_general
    FROM (
      SELECT t.id, t.name, t.icon, NULL AS image_url, array_position(v_displayed_v3, t.id) AS pos
      FROM titles t
      WHERE t.id = ANY(v_displayed_v3) AND t.id > 0
      UNION ALL
      SELECT fw.id * -1 AS id, fw.word AS name, tf.icon, tf.image_url, array_position(v_displayed_v3, fw.id * -1) AS pos
      FROM fragment_words fw
      JOIN title_fragments tf ON tf.id = fw.fragment_id
      WHERE (fw.id * -1) = ANY(v_displayed_v3)
    ) row_data;
  END IF;

  IF v_displayed_general IS NULL THEN
    DECLARE v_old_ids INT[];
    BEGIN
      SELECT COALESCE(displayed_general_title_ids, '{}')
      INTO v_old_ids
      FROM users WHERE id = p_user_id;

      IF array_length(v_old_ids, 1) > 0 THEN
        SELECT json_agg(elem)
        INTO v_displayed_general
        FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
        WHERE (elem->>'id')::INT = ANY(v_old_ids);
      END IF;
    END;
  END IF;

  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM (
      SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
      LIMIT 1
    ) sub;
  END IF;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_authored_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'createdAt', p.created_at,
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
    ) AS place_data
    FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.author_id = p_user_id ORDER BY p.created_at DESC LIMIT 500
  ) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_discovered_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
    ) AS place_data
    FROM places_explored pe JOIN places p ON p.id = pe.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE pe.user_id = p_user_id ORDER BY pe.created_at DESC LIMIT 500
  ) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_claimed_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
    ) AS place_data
    FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.claimed_by = p_user_id ORDER BY p.claimed_at DESC LIMIT 500
  ) sub;

  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', u.avatar_url,
    'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places,
    'discoveredPlaces', v_discovered_places,
    'claimedPlaces', v_claimed_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_profile TO anon;
-- ============================================
-- MIGRATION 126 : Champ icon_url sur les fragments
-- ============================================

ALTER TABLE title_fragments ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- Mettre a jour get_all_player_titles pour retourner icon_url
CREATE OR REPLACE FUNCTION public.get_all_player_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_displayed INT[];
  v_faction_id TEXT;
  v_game_titles JSON;
  v_faction_titles JSON;
  v_fragment_titles JSON;
  v_titles_data JSON;
BEGIN
  SELECT COALESCE(displayed_title_ids_v3, '{}'), faction_id
  INTO v_displayed, v_faction_id
  FROM users WHERE id = p_user_id;

  v_titles_data := get_user_titles(p_user_id);

  SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_game_titles
  FROM (
    SELECT t.id, t.name, t.icon, t.description, NULL::TEXT AS icon_url, NULL::TEXT AS image_url, t."order" AS t_order,
      EXISTS (SELECT 1 FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem WHERE (elem->>'id')::INT = t.id) AS unlocked
    FROM titles t WHERE t.type = 'general'
  ) row_data;

  IF v_faction_id IS NOT NULL THEN
    SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_faction_titles
    FROM (
      SELECT t.id, t.name, t.icon, t.description, NULL::TEXT AS icon_url, NULL::TEXT AS image_url, t."order" AS t_order,
        (v_titles_data->'factionTitle' IS NOT NULL AND (v_titles_data->'factionTitle'->>'id')::INT = t.id) AS unlocked
      FROM titles t WHERE t.type = 'faction' AND t.faction_id = v_faction_id
    ) row_data;
  END IF;

  SELECT json_agg(row_data ORDER BY frag_name, word) INTO v_fragment_titles
  FROM (
    SELECT fw.id * -1 AS id, fw.word AS name, tf.icon,
      COALESCE(tf.description, tf.name) AS description,
      tf.icon_url, tf.image_url,
      tf.name AS frag_name, fw.word,
      EXISTS (SELECT 1 FROM user_fragments uf WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id) AS unlocked,
      tf.name AS source_label
    FROM fragment_words fw
    JOIN title_fragments tf ON tf.id = fw.fragment_id
  ) row_data;

  RETURN json_build_object(
    'gameTitles', COALESCE(v_game_titles, '[]'::json),
    'factionTitles', COALESCE(v_faction_titles, '[]'::json),
    'fragmentTitles', COALESCE(v_fragment_titles, '[]'::json),
    'displayedIds', v_displayed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_player_titles(TEXT) TO authenticated;

-- Mettre a jour get_player_profile pour retourner icon_url dans les titres
CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_titles_data JSON;
  v_displayed_v3 INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_claimed_places JSON;
BEGIN
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  SELECT COALESCE(displayed_title_ids_v3, '{}') INTO v_displayed_v3 FROM users WHERE id = p_user_id;

  IF array_length(v_displayed_v3, 1) > 0 THEN
    SELECT json_agg(row_data ORDER BY pos) INTO v_displayed_general
    FROM (
      SELECT t.id, t.name, t.icon, NULL::TEXT AS icon_url, array_position(v_displayed_v3, t.id) AS pos
      FROM titles t WHERE t.id = ANY(v_displayed_v3) AND t.id > 0
      UNION ALL
      SELECT fw.id * -1 AS id, fw.word AS name, tf.icon, tf.icon_url, array_position(v_displayed_v3, fw.id * -1) AS pos
      FROM fragment_words fw JOIN title_fragments tf ON tf.id = fw.fragment_id
      WHERE (fw.id * -1) = ANY(v_displayed_v3)
    ) row_data;
  END IF;

  IF v_displayed_general IS NULL THEN
    DECLARE v_old_ids INT[];
    BEGIN
      SELECT COALESCE(displayed_general_title_ids, '{}') INTO v_old_ids FROM users WHERE id = p_user_id;
      IF array_length(v_old_ids, 1) > 0 THEN
        SELECT json_agg(elem) INTO v_displayed_general
        FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
        WHERE (elem->>'id')::INT = ANY(v_old_ids);
      END IF;
    END;
  END IF;

  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem) INTO v_displayed_general
    FROM (SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem LIMIT 1) sub;
  END IF;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_authored_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''), 'createdAt', p.created_at,
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE p.author_id = p_user_id ORDER BY p.created_at DESC LIMIT 500) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_discovered_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places_explored pe JOIN places p ON p.id = pe.place_id LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE pe.user_id = p_user_id ORDER BY pe.created_at DESC LIMIT 500) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_claimed_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE p.claimed_by = p_user_id ORDER BY p.claimed_at DESC LIMIT 500) sub;

  SELECT json_build_object(
    'userId', u.id, 'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id, 'factionTitle', f.title, 'factionColor', f.color, 'factionPattern', f.pattern,
    'profileImage', u.avatar_url, 'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places, 'discoveredPlaces', v_discovered_places, 'claimedPlaces', v_claimed_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  ) INTO v_result FROM users u LEFT JOIN factions f ON f.id = u.faction_id WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_profile TO anon;
-- ============================================
-- MIGRATION 127 : Retourner icon_url dans get_user_fragments
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_fragments(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT
      tf.id, tf.name, tf.icon, tf.icon_url, tf.image_url, tf.link_url,
      tf.collection, tf.bonus_type, tf.bonus_value,
      uf.unlocked_at, uf.source,
      (
        SELECT json_agg(json_build_object(
          'id', fw.id, 'word', fw.word, 'slot', fw.slot, 'gender', fw.gender
        ))
        FROM fragment_words fw WHERE fw.fragment_id = tf.id
      ) AS words
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    WHERE uf.user_id = p_user_id AND tf.visible = true
    ORDER BY uf.unlocked_at DESC
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_fragments(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 128 : Nettoyage des objets morts
-- ============================================
-- Supprime les colonnes et fonctions liees au systeme de composer (remplace par titres v3)

-- Colonnes mortes sur users (ancien systeme composer)
ALTER TABLE users DROP COLUMN IF EXISTS composed_title_words;
ALTER TABLE users DROP COLUMN IF EXISTS composed_title_text;

-- RPCs mortes (ancien systeme composer)
DROP FUNCTION IF EXISTS public.get_user_composed_title(TEXT);
DROP FUNCTION IF EXISTS public.set_composed_title(TEXT, INT[], TEXT);
-- ============================================
-- MIGRATION 129 : Index de performance
-- ============================================
-- Ajout d'index sur les colonnes frequemment filtrees dans les RPCs

-- places.claimed_by — utilise dans get_player_profile, get_map_places
CREATE INDEX IF NOT EXISTS idx_places_claimed_by ON places(claimed_by);

-- user_fragments.user_id — utilise dans get_user_fragments, get_user_energy, get_all_player_titles
CREATE INDEX IF NOT EXISTS idx_user_fragments_user_id ON user_fragments(user_id);

-- activity_log.actor_id — utilise dans les requetes d'historique joueur
CREATE INDEX IF NOT EXISTS idx_activity_log_actor_id ON activity_log(actor_id);

-- fragment_words.fragment_id — utilise dans get_user_fragments, get_all_player_titles
CREATE INDEX IF NOT EXISTS idx_fragment_words_fragment_id ON fragment_words(fragment_id);

-- territory_name_votes.voter_id — utilise dans les requetes de vote
CREATE INDEX IF NOT EXISTS idx_territory_votes_voter ON territory_name_votes(voter_id);
-- ============================================
-- MIGRATION 130 : Progression des titres + admin visible
-- ============================================
-- Retourner les conditions de deblocage + stats du joueur
-- pour afficher la progression dans le title picker
-- Les admins voient aussi les fragments non visibles

CREATE OR REPLACE FUNCTION public.get_all_player_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_displayed INT[];
  v_faction_id TEXT;
  v_is_admin BOOLEAN;
  v_game_titles JSON;
  v_faction_titles JSON;
  v_fragment_titles JSON;
  v_titles_data JSON;
  v_stats JSON;
  v_discoveries INT;
  v_claims INT;
  v_notoriety INT;
  v_likes INT;
  v_fortifications INT;
BEGIN
  SELECT COALESCE(displayed_title_ids_v3, '{}'), faction_id, (role = 'admin')
  INTO v_displayed, v_faction_id, v_is_admin
  FROM users WHERE id = p_user_id;

  v_titles_data := get_user_titles(p_user_id);

  v_discoveries := COALESCE((v_titles_data->'stats'->>'discoveries')::INT, 0);
  v_claims := COALESCE((v_titles_data->'stats'->>'claims')::INT, 0);
  v_notoriety := COALESCE((v_titles_data->'stats'->>'notoriety')::INT, 0);
  v_likes := COALESCE((v_titles_data->'stats'->>'likes')::INT, 0);
  v_fortifications := COALESCE((v_titles_data->'stats'->>'fortifications')::INT, 0);

  v_stats := json_build_object(
    'discoveries', v_discoveries,
    'claims', v_claims,
    'notoriety', v_notoriety,
    'likes', v_likes,
    'fortifications', v_fortifications
  );

  SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_game_titles
  FROM (
    SELECT t.id, t.name, t.icon, t.description, NULL::TEXT AS icon_url, NULL::TEXT AS image_url, t."order" AS t_order,
      t.condition,
      EXISTS (SELECT 1 FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem WHERE (elem->>'id')::INT = t.id) AS unlocked
    FROM titles t WHERE t.type = 'general'
  ) row_data;

  IF v_faction_id IS NOT NULL THEN
    SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_faction_titles
    FROM (
      SELECT t.id, t.name, t.icon, t.description, NULL::TEXT AS icon_url, NULL::TEXT AS image_url, t."order" AS t_order,
        t.condition,
        (v_titles_data->'factionTitle' IS NOT NULL AND (v_titles_data->'factionTitle'->>'id')::INT = t.id) AS unlocked
      FROM titles t WHERE t.type = 'faction' AND t.faction_id = v_faction_id
    ) row_data;
  END IF;

  SELECT json_agg(row_data ORDER BY frag_name, word) INTO v_fragment_titles
  FROM (
    SELECT fw.id * -1 AS id, fw.word AS name, tf.icon,
      COALESCE(tf.description, tf.name) AS description,
      tf.icon_url, tf.image_url,
      tf.name AS frag_name, fw.word,
      EXISTS (SELECT 1 FROM user_fragments uf WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id) AS unlocked,
      tf.name AS source_label
    FROM fragment_words fw
    JOIN title_fragments tf ON tf.id = fw.fragment_id
    WHERE tf.visible = true OR v_is_admin = true
  ) row_data;

  RETURN json_build_object(
    'gameTitles', COALESCE(v_game_titles, '[]'::json),
    'factionTitles', COALESCE(v_faction_titles, '[]'::json),
    'fragmentTitles', COALESCE(v_fragment_titles, '[]'::json),
    'displayedIds', v_displayed,
    'stats', v_stats
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_player_titles(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 131 : Filtrer les votes par faction active
-- ============================================
-- Les votes des joueurs qui ne sont plus de la meme faction que le territoire
-- ne comptent plus dans le score. Les propositions de joueurs d'autres factions
-- sont aussi ignorees.

CREATE OR REPLACE FUNCTION public.get_territory_votes(
  p_anchor_place_id TEXT,
  p_user_id         TEXT,
  p_blob_place_ids  TEXT[]
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_faction    TEXT;
  v_territory_faction TEXT;
  v_claimed_count   INT;
  v_vote_power      INT;
  v_proposals       JSON;
  v_used_votes      INT;
  v_proposals_count INT;
BEGIN
  -- Migrer les propositions avec un ancien anchor vers le nouvel anchor
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Faction du user
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  -- Faction du territoire (la plus representee dans le blob)
  SELECT faction_id INTO v_territory_faction
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
  GROUP BY faction_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Eligibilite : meme faction = 1 vote de base + lieux claimed, sinon 0
  IF v_user_faction IS NOT NULL AND v_user_faction = v_territory_faction THEN
    SELECT COUNT(*) INTO v_claimed_count
    FROM places
    WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

    v_vote_power := 1 + v_claimed_count;
  ELSE
    v_vote_power := 0;
  END IF;

  -- Nombre de propositions du joueur pour ce territoire
  SELECT COUNT(*) INTO v_proposals_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  -- Liste des propositions avec score net (SEULEMENT les votes de la faction du territoire)
  SELECT json_agg(row_data ORDER BY net_score DESC, created_at ASC) INTO v_proposals
  FROM (
    SELECT
      json_build_object(
        'id',         p.id,
        'name',       p.name,
        'proposedBy', p.proposed_by,
        'netScore',   COALESCE(SUM(v.value) FILTER (WHERE u_voter.faction_id = v_territory_faction), 0),
        'myVote',     MAX(CASE WHEN v.voter_id = p_user_id THEN v.value ELSE NULL END),
        'isOrphan',   (u_proposer.faction_id IS DISTINCT FROM v_territory_faction),
        'voters',     COALESCE(
          (SELECT json_agg(json_build_object('name', COALESCE(u.first_name, u.email_address), 'value', v2.value) ORDER BY ABS(v2.value) DESC)
           FROM territory_name_votes v2
           JOIN users u ON u.id = v2.voter_id
           WHERE v2.proposal_id = p.id AND u.faction_id = v_territory_faction),
          '[]'::json
        )
      ) AS row_data,
      COALESCE(SUM(v.value) FILTER (WHERE u_voter.faction_id = v_territory_faction), 0) AS net_score,
      p.created_at
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    LEFT JOIN users u_voter ON u_voter.id = v.voter_id
    JOIN users u_proposer ON u_proposer.id = p.proposed_by
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name, p.proposed_by, p.created_at, u_proposer.faction_id
  ) sub;

  -- Votes utilises (seulement ceux qui comptent = meme faction)
  SELECT COALESCE(SUM(ABS(tv.value)), 0) INTO v_used_votes
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  RETURN json_build_object(
    'votePower',      v_vote_power,
    'usedVotes',      v_used_votes,
    'proposalsCount', v_proposals_count,
    'proposals',      COALESCE(v_proposals, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_territory_votes(TEXT, TEXT, TEXT[]) TO authenticated;

-- Fix propose_territory_name : meme bug, faction determinee par un seul lieu au hasard
CREATE OR REPLACE FUNCTION public.propose_territory_name(
  p_user_id TEXT,
  p_anchor_place_id TEXT,
  p_name TEXT,
  p_blob_place_ids TEXT[] DEFAULT '{}'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_trimmed TEXT;
  v_faction_id TEXT;
  v_place_faction TEXT;
BEGIN
  v_trimmed := trim(p_name);

  IF length(v_trimmed) < 3 OR length(v_trimmed) > 50 THEN
    RETURN json_build_object('error', 'invalid_length');
  END IF;

  -- Faction du joueur
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;

  -- Faction du territoire (la plus representee dans le blob)
  IF array_length(p_blob_place_ids, 1) > 0 THEN
    SELECT faction_id INTO v_place_faction
    FROM places
    WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
    GROUP BY faction_id
    ORDER BY COUNT(*) DESC
    LIMIT 1;
  ELSE
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_anchor_place_id;
  END IF;

  IF v_faction_id IS NULL OR v_faction_id != v_place_faction THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Migrer les anciennes propositions vers le nouvel anchor si necessaire
  IF array_length(p_blob_place_ids, 1) > 0 THEN
    UPDATE territory_name_proposals
    SET anchor_place_id = p_anchor_place_id
    WHERE anchor_place_id = ANY(p_blob_place_ids)
      AND anchor_place_id != p_anchor_place_id;
  END IF;

  -- Rate limit : max 2 propositions par joueur par territoire
  SELECT COUNT(*) INTO v_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  IF v_count >= 2 THEN
    RETURN json_build_object('error', 'max_proposals');
  END IF;

  INSERT INTO territory_name_proposals (anchor_place_id, proposed_by, name)
  VALUES (p_anchor_place_id, p_user_id, v_trimmed);

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.propose_territory_name(TEXT, TEXT, TEXT, TEXT[]) TO authenticated;
-- ============================================
-- MIGRATION 132 : Fix u.name → COALESCE(u.first_name, u.email_address)
-- ============================================
-- La migration 131 utilisait u.name qui n'existe pas sur la table users.
-- La colonne s'appelle first_name.

CREATE OR REPLACE FUNCTION public.get_territory_votes(
  p_anchor_place_id TEXT,
  p_user_id         TEXT,
  p_blob_place_ids  TEXT[]
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_faction    TEXT;
  v_territory_faction TEXT;
  v_claimed_count   INT;
  v_vote_power      INT;
  v_proposals       JSON;
  v_used_votes      INT;
  v_proposals_count INT;
BEGIN
  -- Migrer les propositions avec un ancien anchor vers le nouvel anchor
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Faction du user
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  -- Faction du territoire (la plus representee dans le blob)
  SELECT faction_id INTO v_territory_faction
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
  GROUP BY faction_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Eligibilite : meme faction = 1 vote de base + lieux claimed, sinon 0
  IF v_user_faction IS NOT NULL AND v_user_faction = v_territory_faction THEN
    SELECT COUNT(*) INTO v_claimed_count
    FROM places
    WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

    v_vote_power := 1 + v_claimed_count;
  ELSE
    v_vote_power := 0;
  END IF;

  -- Nombre de propositions du joueur pour ce territoire
  SELECT COUNT(*) INTO v_proposals_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  -- Liste des propositions avec score net (SEULEMENT les votes de la faction du territoire)
  SELECT json_agg(row_data ORDER BY net_score DESC, created_at ASC) INTO v_proposals
  FROM (
    SELECT
      json_build_object(
        'id',         p.id,
        'name',       p.name,
        'proposedBy', p.proposed_by,
        'netScore',   COALESCE(SUM(v.value) FILTER (WHERE u_voter.faction_id = v_territory_faction), 0),
        'myVote',     MAX(CASE WHEN v.voter_id = p_user_id THEN v.value ELSE NULL END),
        'isOrphan',   (u_proposer.faction_id IS DISTINCT FROM v_territory_faction),
        'voters',     COALESCE(
          (SELECT json_agg(json_build_object('name', COALESCE(u.first_name, u.email_address), 'value', v2.value) ORDER BY ABS(v2.value) DESC)
           FROM territory_name_votes v2
           JOIN users u ON u.id = v2.voter_id
           WHERE v2.proposal_id = p.id AND u.faction_id = v_territory_faction),
          '[]'::json
        )
      ) AS row_data,
      COALESCE(SUM(v.value) FILTER (WHERE u_voter.faction_id = v_territory_faction), 0) AS net_score,
      p.created_at
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    LEFT JOIN users u_voter ON u_voter.id = v.voter_id
    JOIN users u_proposer ON u_proposer.id = p.proposed_by
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name, p.proposed_by, p.created_at, u_proposer.faction_id
  ) sub;

  -- Votes utilises
  SELECT COALESCE(SUM(ABS(tv.value)), 0) INTO v_used_votes
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  RETURN json_build_object(
    'votePower',      v_vote_power,
    'usedVotes',      v_used_votes,
    'proposalsCount', v_proposals_count,
    'proposals',      COALESCE(v_proposals, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_territory_votes(TEXT, TEXT, TEXT[]) TO authenticated;
-- ============================================
-- MIGRATION 133 : Fix usedVotes — ne compter que les votes actifs
-- ============================================
-- usedVotes comptait tous les votes y compris ceux sur des propositions
-- d'anciens joueurs d'une autre faction. Maintenant on ne compte que les
-- votes sur des propositions de joueurs de la faction du territoire.
-- On supprime aussi les votes orphelins (votant plus de la bonne faction).

CREATE OR REPLACE FUNCTION public.get_territory_votes(
  p_anchor_place_id TEXT,
  p_user_id         TEXT,
  p_blob_place_ids  TEXT[]
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_faction    TEXT;
  v_territory_faction TEXT;
  v_claimed_count   INT;
  v_vote_power      INT;
  v_proposals       JSON;
  v_used_votes      INT;
  v_proposals_count INT;
BEGIN
  -- Migrer les propositions avec un ancien anchor vers le nouvel anchor
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Faction du user
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  -- Faction du territoire (la plus representee dans le blob)
  SELECT faction_id INTO v_territory_faction
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
  GROUP BY faction_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Supprimer les votes de joueurs qui ne sont plus de la faction du territoire
  -- (nettoyage au passage, evite l'accumulation de votes orphelins)
  DELETE FROM territory_name_votes tv
  USING territory_name_proposals tp, users u
  WHERE tv.proposal_id = tp.id
    AND tp.anchor_place_id = p_anchor_place_id
    AND u.id = tv.voter_id
    AND (u.faction_id IS DISTINCT FROM v_territory_faction);

  -- Eligibilite : meme faction = 1 vote de base + lieux claimed, sinon 0
  IF v_user_faction IS NOT NULL AND v_user_faction = v_territory_faction THEN
    SELECT COUNT(*) INTO v_claimed_count
    FROM places
    WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

    v_vote_power := 1 + v_claimed_count;
  ELSE
    v_vote_power := 0;
  END IF;

  -- Nombre de propositions du joueur pour ce territoire
  SELECT COUNT(*) INTO v_proposals_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  -- Liste des propositions avec score net
  SELECT json_agg(row_data ORDER BY net_score DESC, created_at ASC) INTO v_proposals
  FROM (
    SELECT
      json_build_object(
        'id',         p.id,
        'name',       p.name,
        'proposedBy', p.proposed_by,
        'netScore',   COALESCE(SUM(v.value), 0),
        'myVote',     MAX(CASE WHEN v.voter_id = p_user_id THEN v.value ELSE NULL END),
        'isOrphan',   (u_proposer.faction_id IS DISTINCT FROM v_territory_faction),
        'voters',     COALESCE(
          (SELECT json_agg(json_build_object('name', COALESCE(u.first_name, u.email_address), 'value', v2.value) ORDER BY ABS(v2.value) DESC)
           FROM territory_name_votes v2
           JOIN users u ON u.id = v2.voter_id
           WHERE v2.proposal_id = p.id),
          '[]'::json
        )
      ) AS row_data,
      COALESCE(SUM(v.value), 0) AS net_score,
      p.created_at
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    JOIN users u_proposer ON u_proposer.id = p.proposed_by
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name, p.proposed_by, p.created_at, u_proposer.faction_id
  ) sub;

  -- Votes utilises (apres le nettoyage, tout ce qui reste est valide)
  SELECT COALESCE(SUM(ABS(tv.value)), 0) INTO v_used_votes
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  RETURN json_build_object(
    'votePower',      v_vote_power,
    'usedVotes',      v_used_votes,
    'proposalsCount', v_proposals_count,
    'proposals',      COALESCE(v_proposals, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_territory_votes(TEXT, TEXT, TEXT[]) TO authenticated;
-- ============================================
-- MIGRATION 134 : Supprimer votes sur propositions orphelines
-- ============================================
-- Une proposition est orpheline si son auteur n'est plus de la faction du territoire.
-- Les votes sur ces propositions doivent aussi etre supprimes car ils bloquent
-- le budget de votes des joueurs actifs.

CREATE OR REPLACE FUNCTION public.get_territory_votes(
  p_anchor_place_id TEXT,
  p_user_id         TEXT,
  p_blob_place_ids  TEXT[]
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_faction    TEXT;
  v_territory_faction TEXT;
  v_claimed_count   INT;
  v_vote_power      INT;
  v_proposals       JSON;
  v_used_votes      INT;
  v_proposals_count INT;
BEGIN
  -- Migrer les propositions avec un ancien anchor vers le nouvel anchor
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Faction du user
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  -- Faction du territoire (la plus representee dans le blob)
  SELECT faction_id INTO v_territory_faction
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
  GROUP BY faction_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- 1. Supprimer les votes de joueurs qui ne sont plus de la faction du territoire
  DELETE FROM territory_name_votes tv
  USING territory_name_proposals tp, users u
  WHERE tv.proposal_id = tp.id
    AND tp.anchor_place_id = p_anchor_place_id
    AND u.id = tv.voter_id
    AND (u.faction_id IS DISTINCT FROM v_territory_faction);

  -- 2. Supprimer les votes sur des propositions orphelines
  --    (propositions dont l'auteur n'est plus de la faction du territoire)
  DELETE FROM territory_name_votes tv
  USING territory_name_proposals tp, users u_proposer
  WHERE tv.proposal_id = tp.id
    AND tp.anchor_place_id = p_anchor_place_id
    AND u_proposer.id = tp.proposed_by
    AND (u_proposer.faction_id IS DISTINCT FROM v_territory_faction);

  -- 3. Supprimer les propositions orphelines elles-memes
  DELETE FROM territory_name_proposals tp
  USING users u_proposer
  WHERE tp.anchor_place_id = p_anchor_place_id
    AND u_proposer.id = tp.proposed_by
    AND (u_proposer.faction_id IS DISTINCT FROM v_territory_faction);

  -- Eligibilite : meme faction = 1 vote de base + lieux claimed, sinon 0
  IF v_user_faction IS NOT NULL AND v_user_faction = v_territory_faction THEN
    SELECT COUNT(*) INTO v_claimed_count
    FROM places
    WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

    v_vote_power := 1 + v_claimed_count;
  ELSE
    v_vote_power := 0;
  END IF;

  -- Nombre de propositions du joueur pour ce territoire
  SELECT COUNT(*) INTO v_proposals_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  -- Liste des propositions (seulement celles dont l'auteur est de la bonne faction)
  SELECT json_agg(row_data ORDER BY net_score DESC, created_at ASC) INTO v_proposals
  FROM (
    SELECT
      json_build_object(
        'id',         p.id,
        'name',       p.name,
        'proposedBy', p.proposed_by,
        'netScore',   COALESCE(SUM(v.value), 0),
        'myVote',     MAX(CASE WHEN v.voter_id = p_user_id THEN v.value ELSE NULL END),
        'voters',     COALESCE(
          (SELECT json_agg(json_build_object('name', COALESCE(u.first_name, u.email_address), 'value', v2.value) ORDER BY ABS(v2.value) DESC)
           FROM territory_name_votes v2
           JOIN users u ON u.id = v2.voter_id
           WHERE v2.proposal_id = p.id),
          '[]'::json
        )
      ) AS row_data,
      COALESCE(SUM(v.value), 0) AS net_score,
      p.created_at
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    JOIN users u_proposer ON u_proposer.id = p.proposed_by
    WHERE p.anchor_place_id = p_anchor_place_id
      AND u_proposer.faction_id = v_territory_faction
    GROUP BY p.id, p.name, p.proposed_by, p.created_at
  ) sub;

  -- Votes utilises (tout ce qui reste apres nettoyage est valide)
  SELECT COALESCE(SUM(ABS(tv.value)), 0) INTO v_used_votes
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  RETURN json_build_object(
    'votePower',      v_vote_power,
    'usedVotes',      v_used_votes,
    'proposalsCount', v_proposals_count,
    'proposals',      COALESCE(v_proposals, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_territory_votes(TEXT, TEXT, TEXT[]) TO authenticated;
-- ============================================
-- MIGRATION 135 : Système à 4 jauges
-- ============================================
-- Ajout de la 4e jauge (Vitalité) et mapping tag → jauge
-- Les colonnes internes gardent leurs noms (energy, conquest, construction)
-- Le frontend mappe : energy→Bravoure, conquest→Noblesse, construction→Sagesse, vitalite→Vitalité

-- 1. Nouvelle jauge : Vitalité
ALTER TABLE users ADD COLUMN IF NOT EXISTS vitalite_points NUMERIC(6,1) DEFAULT 5.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_vitalite NUMERIC(6,1) DEFAULT 5.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vitalite_reset_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Bonus Vitalité sur les factions
ALTER TABLE factions ADD COLUMN IF NOT EXISTS bonus_vitalite NUMERIC(6,1) DEFAULT 0;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS bonus_regen_vitalite NUMERIC(4,1) DEFAULT 0;

-- 3. Colonne gauge directement sur les tags
-- Chaque tag de lieu est associé à une jauge (energy/conquest/construction/vitalite)
-- UI: energy=Bravoure, conquest=Noblesse, construction=Sagesse, vitalite=Vitalité
ALTER TABLE tags ADD COLUMN IF NOT EXISTS gauge VARCHAR(30) NOT NULL DEFAULT 'energy'
  CHECK (gauge IN ('energy', 'conquest', 'construction', 'vitalite'));

-- 4. Initialiser la Vitalité des joueurs existants (même valeur que l'énergie)
UPDATE users SET
  vitalite_points = LEAST(5, max_vitalite),
  vitalite_reset_at = NOW()
WHERE vitalite_points IS NULL OR vitalite_reset_at IS NULL;

-- 5. Modifier get_user_energy pour retourner aussi la Vitalité
CREATE OR REPLACE FUNCTION public.get_user_energy(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Utilisateur
  v_energy NUMERIC(6,1);
  v_max_energy NUMERIC(4,1);
  v_energy_reset TIMESTAMPTZ;
  v_conquest NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1);
  v_conquest_reset TIMESTAMPTZ;
  v_construction NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_construction_reset TIMESTAMPTZ;
  v_vitalite NUMERIC(6,1);
  v_max_vitalite NUMERIC(6,1);
  v_vitalite_reset TIMESTAMPTZ;
  v_notoriety INT;
  -- Faction
  v_faction_id TEXT;
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
  v_bonus_vitalite NUMERIC(6,1);
  v_bonus_regen_energy NUMERIC(4,1);
  v_bonus_regen_conquest NUMERIC(4,1);
  v_bonus_regen_construction NUMERIC(4,1);
  v_bonus_regen_vitalite NUMERIC(4,1);
  -- Fragment bonuses
  v_frag_max_energy NUMERIC := 0;
  v_frag_max_conquest NUMERIC := 0;
  v_frag_max_construction NUMERIC := 0;
  v_frag_max_vitalite NUMERIC := 0;
  v_frag_regen_energy NUMERIC := 0;
  v_frag_regen_conquest NUMERIC := 0;
  v_frag_regen_construction NUMERIC := 0;
  v_frag_regen_vitalite NUMERIC := 0;
  -- Cycles
  v_energy_cycle INT;
  v_conquest_cycle INT;
  v_construction_cycle INT;
  v_vitalite_cycle INT;
  -- Regen
  v_elapsed INT;
  v_ticks INT;
  v_add NUMERIC;
  v_next_point INT;
  -- Underdog
  v_is_underdog BOOLEAN := FALSE;
  v_underdog_mult NUMERIC := 1;
BEGIN
  -- Charger utilisateur
  SELECT energy_points, max_energy, energy_reset_at,
         conquest_points, max_conquest, conquest_reset_at,
         construction_points, max_construction, construction_reset_at,
         COALESCE(vitalite_points, 5), COALESCE(max_vitalite, 5), COALESCE(vitalite_reset_at, NOW()),
         COALESCE(notoriety_points, 0), faction_id
  INTO v_energy, v_max_energy, v_energy_reset,
       v_conquest, v_max_conquest, v_conquest_reset,
       v_construction, v_max_construction, v_construction_reset,
       v_vitalite, v_max_vitalite, v_vitalite_reset,
       v_notoriety, v_faction_id
  FROM users WHERE id = p_user_id;

  -- Charger bonus faction
  IF v_faction_id IS NOT NULL THEN
    SELECT COALESCE(bonus_energy, 0), COALESCE(bonus_conquest, 0),
           COALESCE(bonus_construction, 0), COALESCE(bonus_vitalite, 0),
           COALESCE(bonus_regen_energy, 0), COALESCE(bonus_regen_conquest, 0),
           COALESCE(bonus_regen_construction, 0), COALESCE(bonus_regen_vitalite, 0)
    INTO v_bonus_energy, v_bonus_conquest, v_bonus_construction, v_bonus_vitalite,
         v_bonus_regen_energy, v_bonus_regen_conquest, v_bonus_regen_construction, v_bonus_regen_vitalite
    FROM factions WHERE id = v_faction_id;
  ELSE
    v_bonus_energy := 0; v_bonus_conquest := 0; v_bonus_construction := 0; v_bonus_vitalite := 0;
    v_bonus_regen_energy := 0; v_bonus_regen_conquest := 0; v_bonus_regen_construction := 0; v_bonus_regen_vitalite := 0;
  END IF;

  -- Charger bonus fragments
  SELECT
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_construction' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_vitalite' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_construction' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_vitalite' THEN tf.bonus_value ELSE 0 END), 0)
  INTO v_frag_max_energy, v_frag_max_conquest, v_frag_max_construction, v_frag_max_vitalite,
       v_frag_regen_energy, v_frag_regen_conquest, v_frag_regen_construction, v_frag_regen_vitalite
  FROM user_fragments uf
  JOIN title_fragments tf ON tf.id = uf.fragment_id
  WHERE uf.user_id = p_user_id AND tf.bonus_type IS NOT NULL;

  -- Appliquer les bonus au max
  v_max_energy := GREATEST(1, v_max_energy + v_bonus_energy + v_frag_max_energy);
  v_max_conquest := GREATEST(1, v_max_conquest + v_bonus_conquest + v_frag_max_conquest);
  v_max_construction := GREATEST(1, v_max_construction + v_bonus_construction + v_frag_max_construction);
  v_max_vitalite := GREATEST(1, v_max_vitalite + v_bonus_vitalite + v_frag_max_vitalite);

  -- Calculer les cycles avec bonus
  v_energy_cycle := GREATEST(600, (7200 * (100 - v_bonus_regen_energy - v_frag_regen_energy) / 100)::INT);
  v_conquest_cycle := GREATEST(600, (14400 * (100 - v_bonus_regen_conquest - v_frag_regen_conquest) / 100)::INT);
  v_construction_cycle := GREATEST(600, (14400 * (100 - v_bonus_regen_construction - v_frag_regen_construction) / 100)::INT);
  v_vitalite_cycle := GREATEST(600, (14400 * (100 - v_bonus_regen_vitalite - v_frag_regen_vitalite) / 100)::INT);

  -- Underdog
  SELECT id = v_faction_id INTO v_is_underdog FROM (SELECT get_underdog_faction_id() AS id) sub;
  IF v_is_underdog THEN
    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'underdog_multiplier'), 2)
    INTO v_underdog_mult;
    v_energy_cycle := GREATEST(300, (v_energy_cycle / v_underdog_mult)::INT);
    v_conquest_cycle := GREATEST(300, (v_conquest_cycle / v_underdog_mult)::INT);
    v_construction_cycle := GREATEST(300, (v_construction_cycle / v_underdog_mult)::INT);
    v_vitalite_cycle := GREATEST(300, (v_vitalite_cycle / v_underdog_mult)::INT);
  END IF;

  -- Regen Energy
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_energy_cycle);
  v_add := LEAST(v_ticks, v_max_energy - v_energy);
  IF v_add > 0 THEN
    v_energy := LEAST(v_energy + v_add, v_max_energy);
    v_energy_reset := v_energy_reset + (v_ticks * v_energy_cycle * INTERVAL '1 second');
    UPDATE users SET energy_points = v_energy, energy_reset_at = v_energy_reset WHERE id = p_user_id;
  END IF;
  v_next_point := v_energy_cycle - (EXTRACT(EPOCH FROM (NOW() - v_energy_reset))::INT % v_energy_cycle);

  -- Regen Conquest
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_conquest_cycle);
  v_add := LEAST(v_ticks, v_max_conquest - v_conquest);
  IF v_add > 0 THEN
    v_conquest := LEAST(v_conquest + v_add, v_max_conquest);
    v_conquest_reset := v_conquest_reset + (v_ticks * v_conquest_cycle * INTERVAL '1 second');
    UPDATE users SET conquest_points = v_conquest, conquest_reset_at = v_conquest_reset WHERE id = p_user_id;
  END IF;

  -- Regen Construction
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_construction_cycle);
  v_add := LEAST(v_ticks, v_max_construction - v_construction);
  IF v_add > 0 THEN
    v_construction := LEAST(v_construction + v_add, v_max_construction);
    v_construction_reset := v_construction_reset + (v_ticks * v_construction_cycle * INTERVAL '1 second');
    UPDATE users SET construction_points = v_construction, construction_reset_at = v_construction_reset WHERE id = p_user_id;
  END IF;

  -- Regen Vitalite
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_vitalite_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_vitalite_cycle);
  v_add := LEAST(v_ticks, v_max_vitalite - v_vitalite);
  IF v_add > 0 THEN
    v_vitalite := LEAST(v_vitalite + v_add, v_max_vitalite);
    v_vitalite_reset := v_vitalite_reset + (v_ticks * v_vitalite_cycle * INTERVAL '1 second');
    UPDATE users SET vitalite_points = v_vitalite, vitalite_reset_at = v_vitalite_reset WHERE id = p_user_id;
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'nextPointIn', v_next_point,
    'energyCycle', v_energy_cycle,
    'conquestPoints', v_conquest,
    'maxConquest', v_max_conquest,
    'conquestNextPointIn', v_conquest_cycle - (EXTRACT(EPOCH FROM (NOW() - v_conquest_reset))::INT % v_conquest_cycle),
    'conquestCycle', v_conquest_cycle,
    'constructionPoints', v_construction,
    'maxConstruction', v_max_construction,
    'constructionNextPointIn', v_construction_cycle - (EXTRACT(EPOCH FROM (NOW() - v_construction_reset))::INT % v_construction_cycle),
    'constructionCycle', v_construction_cycle,
    'vitalitePoints', v_vitalite,
    'maxVitalite', v_max_vitalite,
    'vitaliteNextPointIn', v_vitalite_cycle - (EXTRACT(EPOCH FROM (NOW() - v_vitalite_reset))::INT % v_vitalite_cycle),
    'vitaliteCycle', v_vitalite_cycle,
    'notorietyPoints', v_notoriety,
    'bonusEnergy', v_bonus_energy + v_frag_max_energy,
    'bonusConquest', v_bonus_conquest + v_frag_max_conquest,
    'bonusConstruction', v_bonus_construction + v_frag_max_construction,
    'bonusVitalite', v_bonus_vitalite + v_frag_max_vitalite,
    'isUnderdog', v_is_underdog,
    'underdogMultiplier', v_underdog_mult
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_energy(TEXT) TO authenticated;

-- 6. Mettre à jour handle_new_user pour initialiser la Vitalité
-- (Les nouveaux joueurs auront vitalite_points = 5 par défaut via le DEFAULT)
-- ============================================
-- MIGRATION 136 : Supprimer les tags inutilisés
-- ============================================

DELETE FROM tags WHERE id IN (
  'ff7ef112-119b-49d2-bae2-472f7c0ba0e9',
  'kD45LWnJdKiZ7yjZpNnj'
);
-- ============================================
-- MIGRATION 137 : Actions basées sur la jauge du lieu
-- ============================================
-- discover_place et claim_place dépensent la jauge associée
-- au tag primaire du lieu (via tags.gauge) au lieu d'energy/conquest en dur

-- ============================================
-- 1. discover_place : dépenser la jauge du tag primaire
-- ============================================

CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already BOOLEAN;
  v_cost NUMERIC := 1.0;
  v_gauge TEXT := 'energy';
  v_current_points NUMERIC;
  v_place_faction TEXT;
  v_user_faction TEXT;
  -- Rewards
  v_reward_energy INT := 0;
  v_reward_conquest INT := 0;
  v_reward_construction INT := 0;
  -- Max values (pour le retour)
  v_max_energy NUMERIC;
  v_max_conquest NUMERIC;
  v_max_construction NUMERIC;
  v_max_vitalite NUMERIC;
BEGIN
  -- Déjà découvert ?
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;

  IF v_already THEN
    RETURN json_build_object('error', 'already_discovered');
  END IF;

  -- Trouver la jauge du lieu via son tag primaire
  SELECT COALESCE(t.gauge, 'energy')
  INTO v_gauge
  FROM place_tags pt
  JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE
  LIMIT 1;

  -- GPS = gratuit
  IF p_method = 'gps' THEN
    v_cost := 0;
  ELSE
    -- Remote : coût réduit si même héritage
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_place_id;
    SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

    IF v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
      v_cost := 0.5;
    ELSE
      v_cost := 1.0;
    END IF;

    -- Lire les points de la bonne jauge
    EXECUTE format('SELECT %I FROM users WHERE id = $1',
      CASE v_gauge
        WHEN 'energy' THEN 'energy_points'
        WHEN 'conquest' THEN 'conquest_points'
        WHEN 'construction' THEN 'construction_points'
        WHEN 'vitalite' THEN 'vitalite_points'
      END
    ) INTO v_current_points USING p_user_id;

    IF v_current_points < v_cost THEN
      RETURN json_build_object('error', 'not_enough_points', 'gauge', v_gauge, 'current', v_current_points, 'cost', v_cost);
    END IF;

    -- Déduire les points de la bonne jauge
    EXECUTE format('UPDATE users SET %I = GREATEST(0, %I - $1) WHERE id = $2',
      CASE v_gauge
        WHEN 'energy' THEN 'energy_points'
        WHEN 'conquest' THEN 'conquest_points'
        WHEN 'construction' THEN 'construction_points'
        WHEN 'vitalite' THEN 'vitalite_points'
      END,
      CASE v_gauge
        WHEN 'energy' THEN 'energy_points'
        WHEN 'conquest' THEN 'conquest_points'
        WHEN 'construction' THEN 'construction_points'
        WHEN 'vitalite' THEN 'vitalite_points'
      END
    ) USING v_cost, p_user_id;
  END IF;

  -- Enregistrer la découverte
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Récompenses du tag primaire
  SELECT t.reward_energy, t.reward_conquest, t.reward_construction
  INTO v_reward_energy, v_reward_conquest, v_reward_construction
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE
  LIMIT 1;

  v_reward_energy := COALESCE(v_reward_energy, 0);
  v_reward_conquest := COALESCE(v_reward_conquest, 0);
  v_reward_construction := COALESCE(v_reward_construction, 0);

  IF v_reward_energy > 0 OR v_reward_conquest > 0 OR v_reward_construction > 0 THEN
    SELECT max_energy, max_conquest, max_construction, max_vitalite
    INTO v_max_energy, v_max_conquest, v_max_construction, v_max_vitalite
    FROM users WHERE id = p_user_id;

    UPDATE users
    SET energy_points = LEAST(energy_points + v_reward_energy, COALESCE(v_max_energy, 5)),
        conquest_points = LEAST(conquest_points + v_reward_conquest, COALESCE(v_max_conquest, 5)),
        construction_points = LEAST(construction_points + v_reward_construction, COALESCE(v_max_construction, 5))
    WHERE id = p_user_id;
  END IF;

  -- Gloire +2
  UPDATE users SET notoriety_points = notoriety_points + 2 WHERE id = p_user_id;

  -- Retourner l'état actuel
  RETURN json_build_object(
    'success', true,
    'gauge', v_gauge,
    'cost', v_cost,
    'rewards', json_build_object('energy', v_reward_energy, 'conquest', v_reward_conquest, 'construction', v_reward_construction)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================
-- 2. claim_place : dépenser la jauge du tag primaire
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_current_faction TEXT;
  v_fortification INT;
  v_claim_cost INT;
  v_gauge TEXT := 'energy';
  v_current_points NUMERIC;
  v_notoriety INT;
  -- Zone defense
  v_zone_multiplier NUMERIC := 0.5;
  v_size_multiplier NUMERIC := 0;
  v_neighbor_fort NUMERIC := 0;
  v_neighbor_count INT := 0;
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  -- Vérifier que le joueur a un héritage
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- État du lieu
  SELECT faction_id, fortification_level INTO v_current_faction, v_fortification FROM places WHERE id = p_place_id;

  -- Déjà protégé par le même héritage
  IF v_current_faction = v_faction_id THEN
    RETURN json_build_object('error', 'already_claimed');
  END IF;

  -- Trouver la jauge du lieu via son tag primaire
  SELECT COALESCE(t.gauge, 'energy')
  INTO v_gauge
  FROM place_tags pt
  JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE
  LIMIT 1;

  -- Settings zone defense
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_fort_multiplier'), 0.5) INTO v_zone_multiplier;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'territory_size_defense_mult'), 0) INTO v_size_multiplier;

  -- Calcul voisins (même logique qu'avant)
  IF v_current_faction IS NOT NULL THEN
    SELECT COALESCE(SUM(p2.fortification_level), 0) INTO v_neighbor_fort
    FROM places p2
    WHERE p2.faction_id = v_current_faction
      AND p2.id != p_place_id
      AND sqrt(
        pow((p2.latitude - (SELECT latitude FROM places WHERE id = p_place_id)) * 111, 2)
        + pow((p2.longitude - (SELECT longitude FROM places WHERE id = p_place_id)) * 79, 2)
      ) <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10);

    -- Blob expansion pour territory size
    IF v_size_multiplier > 0 THEN
      v_blob_ids := ARRAY[p_place_id];
      LOOP
        SELECT array_agg(p2.id) INTO v_new_ids
        FROM places p2
        WHERE p2.faction_id = v_current_faction
          AND NOT (p2.id = ANY(v_blob_ids))
          AND EXISTS (
            SELECT 1 FROM unnest(v_blob_ids) AS bid
            JOIN places pb ON pb.id = bid
            WHERE sqrt(pow((p2.latitude - pb.latitude) * 111, 2) + pow((p2.longitude - pb.longitude) * 79, 2))
              <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10)
          );
        EXIT WHEN v_new_ids IS NULL;
        v_blob_ids := v_blob_ids || v_new_ids;
      END LOOP;
      v_neighbor_count := array_length(v_blob_ids, 1) - 1;
    END IF;
  END IF;

  -- Coût dynamique
  v_claim_cost := 1
    + COALESCE(v_fortification, 0)
    + FLOOR(v_neighbor_fort * v_zone_multiplier)
    + FLOOR(v_neighbor_count * v_size_multiplier);

  -- Lire les points de la bonne jauge
  EXECUTE format('SELECT %I FROM users WHERE id = $1',
    CASE v_gauge
      WHEN 'energy' THEN 'energy_points'
      WHEN 'conquest' THEN 'conquest_points'
      WHEN 'construction' THEN 'construction_points'
      WHEN 'vitalite' THEN 'vitalite_points'
    END
  ) INTO v_current_points USING p_user_id;

  IF v_current_points < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'not_enough_points',
      'gauge', v_gauge,
      'current', v_current_points,
      'claimCost', v_claim_cost,
      'neighborFort', v_neighbor_fort,
      'neighborCount', v_neighbor_count
    );
  END IF;

  -- Déduire les points de la bonne jauge
  EXECUTE format('UPDATE users SET %I = GREATEST(0, %I - $1) WHERE id = $2',
    CASE v_gauge
      WHEN 'energy' THEN 'energy_points'
      WHEN 'conquest' THEN 'conquest_points'
      WHEN 'construction' THEN 'construction_points'
      WHEN 'vitalite' THEN 'vitalite_points'
    END,
    CASE v_gauge
      WHEN 'energy' THEN 'energy_points'
      WHEN 'conquest' THEN 'conquest_points'
      WHEN 'construction' THEN 'construction_points'
      WHEN 'vitalite' THEN 'vitalite_points'
    END
  ) USING v_claim_cost, p_user_id;

  -- Reset fortification si changement d'héritage
  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN
    v_fortification := 0;
  END IF;

  -- Mettre à jour le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = COALESCE(v_fortification, 0)
  WHERE id = p_place_id;

  -- Gloire +5
  UPDATE users
  SET notoriety_points = notoriety_points + 5
  WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  -- Historique
  INSERT INTO place_claims (place_id, user_id, faction_id)
  VALUES (p_place_id, p_user_id, v_faction_id);

  RETURN json_build_object(
    'success', true,
    'gauge', v_gauge,
    'claimCost', v_claim_cost,
    'notorietyPoints', v_notoriety,
    'factionId', v_faction_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_place(TEXT, TEXT) TO authenticated;
-- ============================================
-- MIGRATION 138 : Ajouter gauge au primaryTag dans get_place_by_id
-- ============================================
-- Le frontend a besoin de savoir quelle jauge le lieu utilise
-- pour afficher l'icône et le nom corrects

-- On remplace uniquement la construction du primaryTag dans get_place_by_id
-- Le reste de la fonction reste identique

-- Comme la fonction est très longue, on fait un UPDATE chirurgical
-- via CREATE OR REPLACE en reprenant la dernière version (migration 095)
-- et en ajoutant juste 'gauge', t.gauge dans le json_build_object du primaryTag

-- NOTE: Comme on ne peut pas patcher une seule ligne d'une fonction PL/pgSQL,
-- on doit réécrire toute la fonction. Voir ci-dessous.

-- Pour éviter de réécrire 300 lignes, on utilise une approche plus simple :
-- On crée une fonction helper qui retourne le gauge d'un lieu

CREATE OR REPLACE FUNCTION public.get_place_gauge(p_place_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(t.gauge, 'energy')
  FROM place_tags pt
  JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_gauge(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_gauge(TEXT) TO anon;
-- ============================================
-- MIGRATION 139 : Réduire le max par défaut à 3 pour les 4 jauges
-- ============================================
-- Avec 4 jauges au lieu de 3, il faut réduire le max par défaut
-- pour que les Fragments aient plus de valeur (+1 max = +33% au lieu de +20%)

-- Mettre à jour les valeurs par défaut
ALTER TABLE users ALTER COLUMN max_energy SET DEFAULT 3.0;
ALTER TABLE users ALTER COLUMN max_conquest SET DEFAULT 3.0;
ALTER TABLE users ALTER COLUMN max_construction SET DEFAULT 3.0;
ALTER TABLE users ALTER COLUMN max_vitalite SET DEFAULT 3.0;

-- Mettre à jour les joueurs existants qui ont encore les valeurs par défaut (5)
UPDATE users SET max_energy = 3 WHERE max_energy = 5;
UPDATE users SET max_conquest = 3 WHERE max_conquest = 5;
UPDATE users SET max_construction = 3 WHERE max_construction = 5;
UPDATE users SET max_vitalite = 3 WHERE max_vitalite = 5;

-- Plafonner les points actuels au nouveau max
UPDATE users SET energy_points = LEAST(energy_points, 3) WHERE energy_points > 3 AND max_energy = 3;
UPDATE users SET conquest_points = LEAST(conquest_points, 3) WHERE conquest_points > 3 AND max_conquest = 3;
UPDATE users SET construction_points = LEAST(construction_points, 3) WHERE construction_points > 3 AND max_construction = 3;
UPDATE users SET vitalite_points = LEAST(vitalite_points, 3) WHERE vitalite_points > 3 AND max_vitalite = 3;
-- ============================================
-- MIGRATION 140 : Cycles de regen configurables
-- ============================================
-- Les cycles de base sont lus depuis app_settings au lieu d'être hardcodés

-- Insérer les valeurs par défaut
INSERT INTO app_settings (key, value) VALUES ('energy_base_cycle', '7200') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('conquest_base_cycle', '14400') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('construction_base_cycle', '14400') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('vitalite_base_cycle', '14400') ON CONFLICT (key) DO NOTHING;

-- Mettre à jour get_user_energy pour lire les cycles depuis app_settings
CREATE OR REPLACE FUNCTION public.get_user_energy(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy NUMERIC(6,1);
  v_max_energy NUMERIC(4,1);
  v_energy_reset TIMESTAMPTZ;
  v_conquest NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1);
  v_conquest_reset TIMESTAMPTZ;
  v_construction NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_construction_reset TIMESTAMPTZ;
  v_vitalite NUMERIC(6,1);
  v_max_vitalite NUMERIC(6,1);
  v_vitalite_reset TIMESTAMPTZ;
  v_notoriety INT;
  v_faction_id TEXT;
  -- Bonus faction
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
  v_bonus_vitalite NUMERIC(6,1);
  v_bonus_regen_energy NUMERIC(4,1);
  v_bonus_regen_conquest NUMERIC(4,1);
  v_bonus_regen_construction NUMERIC(4,1);
  v_bonus_regen_vitalite NUMERIC(4,1);
  -- Fragment bonuses
  v_frag_max_energy NUMERIC := 0;
  v_frag_max_conquest NUMERIC := 0;
  v_frag_max_construction NUMERIC := 0;
  v_frag_max_vitalite NUMERIC := 0;
  v_frag_regen_energy NUMERIC := 0;
  v_frag_regen_conquest NUMERIC := 0;
  v_frag_regen_construction NUMERIC := 0;
  v_frag_regen_vitalite NUMERIC := 0;
  -- Base cycles (from app_settings)
  v_base_energy_cycle INT;
  v_base_conquest_cycle INT;
  v_base_construction_cycle INT;
  v_base_vitalite_cycle INT;
  -- Computed cycles
  v_energy_cycle INT;
  v_conquest_cycle INT;
  v_construction_cycle INT;
  v_vitalite_cycle INT;
  -- Regen
  v_elapsed INT;
  v_ticks INT;
  v_add NUMERIC;
  v_next_point INT;
  -- Underdog
  v_is_underdog BOOLEAN := FALSE;
  v_underdog_mult NUMERIC := 1;
BEGIN
  -- Lire les cycles de base depuis app_settings
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'energy_base_cycle'), 7200) INTO v_base_energy_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'conquest_base_cycle'), 14400) INTO v_base_conquest_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'construction_base_cycle'), 14400) INTO v_base_construction_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'vitalite_base_cycle'), 14400) INTO v_base_vitalite_cycle;

  -- Charger utilisateur
  SELECT energy_points, max_energy, energy_reset_at,
         conquest_points, max_conquest, conquest_reset_at,
         construction_points, max_construction, construction_reset_at,
         COALESCE(vitalite_points, 3), COALESCE(max_vitalite, 3), COALESCE(vitalite_reset_at, NOW()),
         COALESCE(notoriety_points, 0), faction_id
  INTO v_energy, v_max_energy, v_energy_reset,
       v_conquest, v_max_conquest, v_conquest_reset,
       v_construction, v_max_construction, v_construction_reset,
       v_vitalite, v_max_vitalite, v_vitalite_reset,
       v_notoriety, v_faction_id
  FROM users WHERE id = p_user_id;

  -- Charger bonus faction
  IF v_faction_id IS NOT NULL THEN
    SELECT COALESCE(bonus_energy, 0), COALESCE(bonus_conquest, 0),
           COALESCE(bonus_construction, 0), COALESCE(bonus_vitalite, 0),
           COALESCE(bonus_regen_energy, 0), COALESCE(bonus_regen_conquest, 0),
           COALESCE(bonus_regen_construction, 0), COALESCE(bonus_regen_vitalite, 0)
    INTO v_bonus_energy, v_bonus_conquest, v_bonus_construction, v_bonus_vitalite,
         v_bonus_regen_energy, v_bonus_regen_conquest, v_bonus_regen_construction, v_bonus_regen_vitalite
    FROM factions WHERE id = v_faction_id;
  ELSE
    v_bonus_energy := 0; v_bonus_conquest := 0; v_bonus_construction := 0; v_bonus_vitalite := 0;
    v_bonus_regen_energy := 0; v_bonus_regen_conquest := 0; v_bonus_regen_construction := 0; v_bonus_regen_vitalite := 0;
  END IF;

  -- Charger bonus fragments
  SELECT
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_construction' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_vitalite' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_construction' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_vitalite' THEN tf.bonus_value ELSE 0 END), 0)
  INTO v_frag_max_energy, v_frag_max_conquest, v_frag_max_construction, v_frag_max_vitalite,
       v_frag_regen_energy, v_frag_regen_conquest, v_frag_regen_construction, v_frag_regen_vitalite
  FROM user_fragments uf
  JOIN title_fragments tf ON tf.id = uf.fragment_id
  WHERE uf.user_id = p_user_id AND tf.bonus_type IS NOT NULL;

  -- Appliquer les bonus au max
  v_max_energy := GREATEST(1, v_max_energy + v_bonus_energy + v_frag_max_energy);
  v_max_conquest := GREATEST(1, v_max_conquest + v_bonus_conquest + v_frag_max_conquest);
  v_max_construction := GREATEST(1, v_max_construction + v_bonus_construction + v_frag_max_construction);
  v_max_vitalite := GREATEST(1, v_max_vitalite + v_bonus_vitalite + v_frag_max_vitalite);

  -- Calculer les cycles avec bonus (à partir des cycles de base configurables)
  v_energy_cycle := GREATEST(600, (v_base_energy_cycle * (100 - v_bonus_regen_energy - v_frag_regen_energy) / 100)::INT);
  v_conquest_cycle := GREATEST(600, (v_base_conquest_cycle * (100 - v_bonus_regen_conquest - v_frag_regen_conquest) / 100)::INT);
  v_construction_cycle := GREATEST(600, (v_base_construction_cycle * (100 - v_bonus_regen_construction - v_frag_regen_construction) / 100)::INT);
  v_vitalite_cycle := GREATEST(600, (v_base_vitalite_cycle * (100 - v_bonus_regen_vitalite - v_frag_regen_vitalite) / 100)::INT);

  -- Underdog
  SELECT id = v_faction_id INTO v_is_underdog FROM (SELECT get_underdog_faction_id() AS id) sub;
  IF v_is_underdog THEN
    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'underdog_multiplier'), 2)
    INTO v_underdog_mult;
    v_energy_cycle := GREATEST(300, (v_energy_cycle / v_underdog_mult)::INT);
    v_conquest_cycle := GREATEST(300, (v_conquest_cycle / v_underdog_mult)::INT);
    v_construction_cycle := GREATEST(300, (v_construction_cycle / v_underdog_mult)::INT);
    v_vitalite_cycle := GREATEST(300, (v_vitalite_cycle / v_underdog_mult)::INT);
  END IF;

  -- Regen Energy
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_energy_cycle);
  v_add := LEAST(v_ticks, v_max_energy - v_energy);
  IF v_add > 0 THEN
    v_energy := LEAST(v_energy + v_add, v_max_energy);
    v_energy_reset := v_energy_reset + (v_ticks * v_energy_cycle * INTERVAL '1 second');
    UPDATE users SET energy_points = v_energy, energy_reset_at = v_energy_reset WHERE id = p_user_id;
  END IF;
  v_next_point := v_energy_cycle - (EXTRACT(EPOCH FROM (NOW() - v_energy_reset))::INT % v_energy_cycle);

  -- Regen Conquest
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_conquest_cycle);
  v_add := LEAST(v_ticks, v_max_conquest - v_conquest);
  IF v_add > 0 THEN
    v_conquest := LEAST(v_conquest + v_add, v_max_conquest);
    v_conquest_reset := v_conquest_reset + (v_ticks * v_conquest_cycle * INTERVAL '1 second');
    UPDATE users SET conquest_points = v_conquest, conquest_reset_at = v_conquest_reset WHERE id = p_user_id;
  END IF;

  -- Regen Construction
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_construction_cycle);
  v_add := LEAST(v_ticks, v_max_construction - v_construction);
  IF v_add > 0 THEN
    v_construction := LEAST(v_construction + v_add, v_max_construction);
    v_construction_reset := v_construction_reset + (v_ticks * v_construction_cycle * INTERVAL '1 second');
    UPDATE users SET construction_points = v_construction, construction_reset_at = v_construction_reset WHERE id = p_user_id;
  END IF;

  -- Regen Vitalite
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_vitalite_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_vitalite_cycle);
  v_add := LEAST(v_ticks, v_max_vitalite - v_vitalite);
  IF v_add > 0 THEN
    v_vitalite := LEAST(v_vitalite + v_add, v_max_vitalite);
    v_vitalite_reset := v_vitalite_reset + (v_ticks * v_vitalite_cycle * INTERVAL '1 second');
    UPDATE users SET vitalite_points = v_vitalite, vitalite_reset_at = v_vitalite_reset WHERE id = p_user_id;
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'nextPointIn', v_next_point,
    'energyCycle', v_energy_cycle,
    'conquestPoints', v_conquest,
    'maxConquest', v_max_conquest,
    'conquestNextPointIn', v_conquest_cycle - (EXTRACT(EPOCH FROM (NOW() - v_conquest_reset))::INT % v_conquest_cycle),
    'conquestCycle', v_conquest_cycle,
    'constructionPoints', v_construction,
    'maxConstruction', v_max_construction,
    'constructionNextPointIn', v_construction_cycle - (EXTRACT(EPOCH FROM (NOW() - v_construction_reset))::INT % v_construction_cycle),
    'constructionCycle', v_construction_cycle,
    'vitalitePoints', v_vitalite,
    'maxVitalite', v_max_vitalite,
    'vitaliteNextPointIn', v_vitalite_cycle - (EXTRACT(EPOCH FROM (NOW() - v_vitalite_reset))::INT % v_vitalite_cycle),
    'vitaliteCycle', v_vitalite_cycle,
    'notorietyPoints', v_notoriety,
    'bonusEnergy', v_bonus_energy + v_frag_max_energy,
    'bonusConquest', v_bonus_conquest + v_frag_max_conquest,
    'bonusConstruction', v_bonus_construction + v_frag_max_construction,
    'bonusVitalite', v_bonus_vitalite + v_frag_max_vitalite,
    'isUnderdog', v_is_underdog,
    'underdogMultiplier', v_underdog_mult
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_energy(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 141 : Retour à une seule jauge (Énergie)
-- ============================================
-- Les 4 jauges étaient trop complexes. On revient à l'énergie unique.
-- Le coût varie selon le type de lieu (tag). Les Fragments réduisent les coûts.

-- 1. Ajouter un coût de base par tag (remplace le système de gauge)
ALTER TABLE tags ADD COLUMN IF NOT EXISTS base_cost NUMERIC(4,1) NOT NULL DEFAULT 1.0;

-- 2. Modifier discover_place : toujours dépenser de l'énergie, coût = tag.base_cost
CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already BOOLEAN;
  v_base_cost NUMERIC := 1.0;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_max_energy NUMERIC;
  v_place_faction TEXT;
  v_user_faction TEXT;
  v_reward_energy INT := 0;
  v_reward_conquest INT := 0;
  v_reward_construction INT := 0;
BEGIN
  -- Déjà découvert ?
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN
    RETURN json_build_object('error', 'already_discovered');
  END IF;

  -- Coût de base du lieu (depuis le tag primaire)
  SELECT COALESCE(t.base_cost, 1.0)
  INTO v_base_cost
  FROM place_tags pt
  JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE
  LIMIT 1;

  -- GPS = gratuit
  IF p_method = 'gps' THEN
    v_cost := 0;
  ELSE
    -- Remote : coût réduit si même héritage
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_place_id;
    SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

    IF v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
      v_cost := v_base_cost * 0.5;
    ELSE
      v_cost := v_base_cost;
    END IF;
  END IF;

  -- Vérifier l'énergie
  SELECT energy_points, max_energy INTO v_energy, v_max_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  -- Déduire l'énergie
  IF v_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_cost) WHERE id = p_user_id;
  END IF;

  -- Enregistrer la découverte
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Récompenses du tag primaire
  SELECT t.reward_energy, t.reward_conquest, t.reward_construction
  INTO v_reward_energy, v_reward_conquest, v_reward_construction
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE
  LIMIT 1;

  v_reward_energy := COALESCE(v_reward_energy, 0);
  v_reward_conquest := COALESCE(v_reward_conquest, 0);
  v_reward_construction := COALESCE(v_reward_construction, 0);

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  -- Gloire +2
  UPDATE users SET notoriety_points = notoriety_points + 2 WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'cost', v_cost,
    'rewards', json_build_object('energy', v_reward_energy)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT) TO authenticated;

-- 3. Modifier claim_place : toujours dépenser de l'énergie
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_current_faction TEXT;
  v_fortification INT;
  v_base_cost NUMERIC := 1.0;
  v_claim_cost NUMERIC;
  v_energy NUMERIC;
  v_notoriety INT;
  v_zone_multiplier NUMERIC := 0.5;
  v_size_multiplier NUMERIC := 0;
  v_neighbor_fort NUMERIC := 0;
  v_neighbor_count INT := 0;
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  -- Vérifier héritage
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- État du lieu
  SELECT faction_id, fortification_level INTO v_current_faction, v_fortification FROM places WHERE id = p_place_id;
  IF v_current_faction = v_faction_id THEN
    RETURN json_build_object('error', 'already_claimed');
  END IF;

  -- Coût de base du lieu
  SELECT COALESCE(t.base_cost, 1.0)
  INTO v_base_cost
  FROM place_tags pt
  JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE
  LIMIT 1;

  -- Settings zone defense
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_fort_multiplier'), 0.5) INTO v_zone_multiplier;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'territory_size_defense_mult'), 0) INTO v_size_multiplier;

  -- Calcul voisins
  IF v_current_faction IS NOT NULL THEN
    SELECT COALESCE(SUM(p2.fortification_level), 0) INTO v_neighbor_fort
    FROM places p2
    WHERE p2.faction_id = v_current_faction
      AND p2.id != p_place_id
      AND sqrt(
        pow((p2.latitude - (SELECT latitude FROM places WHERE id = p_place_id)) * 111, 2)
        + pow((p2.longitude - (SELECT longitude FROM places WHERE id = p_place_id)) * 79, 2)
      ) <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10);

    IF v_size_multiplier > 0 THEN
      v_blob_ids := ARRAY[p_place_id];
      LOOP
        SELECT array_agg(p2.id) INTO v_new_ids
        FROM places p2
        WHERE p2.faction_id = v_current_faction
          AND NOT (p2.id = ANY(v_blob_ids))
          AND EXISTS (
            SELECT 1 FROM unnest(v_blob_ids) AS bid
            JOIN places pb ON pb.id = bid
            WHERE sqrt(pow((p2.latitude - pb.latitude) * 111, 2) + pow((p2.longitude - pb.longitude) * 79, 2))
              <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10)
          );
        EXIT WHEN v_new_ids IS NULL;
        v_blob_ids := v_blob_ids || v_new_ids;
      END LOOP;
      v_neighbor_count := array_length(v_blob_ids, 1) - 1;
    END IF;
  END IF;

  -- Coût dynamique basé sur le coût du tag
  v_claim_cost := v_base_cost
    + COALESCE(v_fortification, 0)
    + FLOOR(v_neighbor_fort * v_zone_multiplier)
    + FLOOR(v_neighbor_count * v_size_multiplier);

  -- Vérifier l'énergie
  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'not_enough_energy',
      'energy', v_energy,
      'claimCost', v_claim_cost
    );
  END IF;

  -- Déduire l'énergie
  UPDATE users SET energy_points = GREATEST(0, energy_points - v_claim_cost) WHERE id = p_user_id
  RETURNING energy_points INTO v_energy;

  -- Reset fortification si changement d'héritage
  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN
    v_fortification := 0;
  END IF;

  -- Mettre à jour le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = COALESCE(v_fortification, 0)
  WHERE id = p_place_id;

  -- Gloire +5
  UPDATE users SET notoriety_points = notoriety_points + 5 WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  -- Historique
  INSERT INTO place_claims (place_id, user_id, faction_id)
  VALUES (p_place_id, p_user_id, v_faction_id);

  RETURN json_build_object(
    'success', true,
    'energy', v_energy,
    'claimCost', v_claim_cost,
    'notorietyPoints', v_notoriety,
    'factionId', v_faction_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_place(TEXT, TEXT) TO authenticated;
-- ============================================
-- MIGRATION 142 : Coût par distance
-- ============================================
-- Plus un lieu est loin du joueur, plus il coûte d'énergie.
-- GPS < 500m = x0.5, < 10km = x1, < 50km = x2, > 50km = x3

-- Helper : calcul de distance Haversine en km
CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 NUMERIC, lng1 NUMERIC,
  lat2 NUMERIC, lng2 NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 6371 * 2 * asin(sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2
  ));
$$;

-- Helper : multiplicateur de distance
CREATE OR REPLACE FUNCTION public.distance_multiplier(distance_km NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN distance_km < 0.5 THEN 0.5   -- GPS sur place
    WHEN distance_km < 10 THEN 1.0     -- Proche
    WHEN distance_km < 50 THEN 2.0     -- Moyen
    ELSE 3.0                            -- Loin
  END;
$$;

-- Modifier discover_place : ajouter coordonnées joueur + multiplicateur distance
CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote',
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already BOOLEAN;
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_max_energy NUMERIC;
  v_place_faction TEXT;
  v_user_faction TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_reward_energy INT := 0;
BEGIN
  -- Déjà découvert ?
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN
    RETURN json_build_object('error', 'already_discovered');
  END IF;

  -- Coût de base du lieu (depuis le tag primaire)
  SELECT COALESCE(t.base_cost, 1.0)
  INTO v_base_cost
  FROM place_tags pt
  JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE
  LIMIT 1;

  -- Coordonnées du lieu
  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;

  -- Calcul distance si coordonnées fournies
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL AND v_place_lng IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  ELSE
    v_dist_mult := 1.0; -- Pas de GPS = coût normal
  END IF;

  -- GPS method = gratuit (distance < 500m vérifié côté client)
  IF p_method = 'gps' THEN
    v_cost := 0;
  ELSE
    -- Réduction si même héritage
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_place_id;
    SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

    v_cost := v_base_cost * v_dist_mult;

    IF v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
      v_cost := v_cost * 0.5;
    END IF;

    -- Arrondir au 0.5 le plus proche
    v_cost := ROUND(v_cost * 2) / 2.0;
    v_cost := GREATEST(0.5, v_cost);
  END IF;

  -- Vérifier l'énergie
  SELECT energy_points, max_energy INTO v_energy, v_max_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost, 'distance', v_distance_km);
  END IF;

  -- Déduire l'énergie
  IF v_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_cost) WHERE id = p_user_id;
  END IF;

  -- Enregistrer la découverte
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Récompenses du tag primaire
  SELECT COALESCE(t.reward_energy, 0)
  INTO v_reward_energy
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE
  LIMIT 1;

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  -- Gloire +2
  UPDATE users SET notoriety_points = notoriety_points + 2 WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'cost', v_cost,
    'distance', v_distance_km,
    'distanceMultiplier', v_dist_mult
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- Modifier claim_place : ajouter coordonnées joueur + multiplicateur distance
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_current_faction TEXT;
  v_fortification INT;
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_claim_cost NUMERIC;
  v_energy NUMERIC;
  v_notoriety INT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_zone_multiplier NUMERIC := 0.5;
  v_size_multiplier NUMERIC := 0;
  v_neighbor_fort NUMERIC := 0;
  v_neighbor_count INT := 0;
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  -- Vérifier héritage
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- État du lieu
  SELECT faction_id, fortification_level, latitude, longitude
  INTO v_current_faction, v_fortification, v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  IF v_current_faction = v_faction_id THEN
    RETURN json_build_object('error', 'already_claimed');
  END IF;

  -- Coût de base du lieu
  SELECT COALESCE(t.base_cost, 1.0)
  INTO v_base_cost
  FROM place_tags pt
  JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE
  LIMIT 1;

  -- Calcul distance
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL AND v_place_lng IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  ELSE
    v_dist_mult := 1.0;
  END IF;

  -- Settings zone defense
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_fort_multiplier'), 0.5) INTO v_zone_multiplier;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'territory_size_defense_mult'), 0) INTO v_size_multiplier;

  -- Calcul voisins
  IF v_current_faction IS NOT NULL THEN
    SELECT COALESCE(SUM(p2.fortification_level), 0) INTO v_neighbor_fort
    FROM places p2
    WHERE p2.faction_id = v_current_faction
      AND p2.id != p_place_id
      AND sqrt(
        pow((p2.latitude - v_place_lat) * 111, 2)
        + pow((p2.longitude - v_place_lng) * 79, 2)
      ) <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10);

    IF v_size_multiplier > 0 THEN
      v_blob_ids := ARRAY[p_place_id];
      LOOP
        SELECT array_agg(p2.id) INTO v_new_ids
        FROM places p2
        WHERE p2.faction_id = v_current_faction
          AND NOT (p2.id = ANY(v_blob_ids))
          AND EXISTS (
            SELECT 1 FROM unnest(v_blob_ids) AS bid
            JOIN places pb ON pb.id = bid
            WHERE sqrt(pow((p2.latitude - pb.latitude) * 111, 2) + pow((p2.longitude - pb.longitude) * 79, 2))
              <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10)
          );
        EXIT WHEN v_new_ids IS NULL;
        v_blob_ids := v_blob_ids || v_new_ids;
      END LOOP;
      v_neighbor_count := array_length(v_blob_ids, 1) - 1;
    END IF;
  END IF;

  -- Coût = (base + fortif + zone) × multiplicateur distance
  v_claim_cost := (v_base_cost + COALESCE(v_fortification, 0)
    + FLOOR(v_neighbor_fort * v_zone_multiplier)
    + FLOOR(v_neighbor_count * v_size_multiplier)) * v_dist_mult;

  -- Arrondir au 0.5
  v_claim_cost := ROUND(v_claim_cost * 2) / 2.0;
  v_claim_cost := GREATEST(0.5, v_claim_cost);

  -- Vérifier l'énergie
  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'not_enough_energy',
      'energy', v_energy,
      'claimCost', v_claim_cost,
      'distance', v_distance_km
    );
  END IF;

  -- Déduire l'énergie
  UPDATE users SET energy_points = GREATEST(0, energy_points - v_claim_cost) WHERE id = p_user_id
  RETURNING energy_points INTO v_energy;

  -- Reset fortification si changement d'héritage
  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN
    v_fortification := 0;
  END IF;

  -- Mettre à jour le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = COALESCE(v_fortification, 0)
  WHERE id = p_place_id;

  -- Gloire +5
  UPDATE users SET notoriety_points = notoriety_points + 5 WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  -- Historique
  INSERT INTO place_claims (place_id, user_id, faction_id)
  VALUES (p_place_id, p_user_id, v_faction_id);

  RETURN json_build_object(
    'success', true,
    'energy', v_energy,
    'claimCost', v_claim_cost,
    'distance', v_distance_km,
    'distanceMultiplier', v_dist_mult,
    'notorietyPoints', v_notoriety,
    'factionId', v_faction_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
-- ============================================
-- MIGRATION 143 : Supprimer les anciennes signatures de RPCs
-- ============================================
-- PostgreSQL garde les anciennes signatures quand on en crée de nouvelles
-- avec des paramètres différents. Il faut les drop explicitement.

-- Anciennes signatures sans coordonnées
DROP FUNCTION IF EXISTS public.discover_place(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.claim_place(TEXT, TEXT);
-- ============================================
-- MIGRATION 144 : Seuils de distance configurables
-- ============================================

INSERT INTO app_settings (key, value) VALUES ('distance_gps_km', '0.5') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('distance_close_km', '10') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('distance_mid_km', '50') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('distance_mult_gps', '0.5') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('distance_mult_close', '1') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('distance_mult_mid', '2') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('distance_mult_far', '3') ON CONFLICT (key) DO NOTHING;

-- Mettre à jour le helper distance_multiplier pour lire les settings
CREATE OR REPLACE FUNCTION public.distance_multiplier(distance_km NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_gps NUMERIC;
  v_close NUMERIC;
  v_mid NUMERIC;
  v_mult_gps NUMERIC;
  v_mult_close NUMERIC;
  v_mult_mid NUMERIC;
  v_mult_far NUMERIC;
BEGIN
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_gps_km'), 0.5) INTO v_gps;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_close_km'), 10) INTO v_close;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_mid_km'), 50) INTO v_mid;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_mult_gps'), 0.5) INTO v_mult_gps;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_mult_close'), 1) INTO v_mult_close;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_mult_mid'), 2) INTO v_mult_mid;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_mult_far'), 3) INTO v_mult_far;

  RETURN CASE
    WHEN distance_km < v_gps THEN v_mult_gps
    WHEN distance_km < v_close THEN v_mult_close
    WHEN distance_km < v_mid THEN v_mult_mid
    ELSE v_mult_far
  END;
END;
$$;
-- ============================================
-- MIGRATION 145 : fortify_place utilise l'énergie au lieu de construction
-- ============================================

CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_cost INT;
  v_next_name TEXT;
  v_energy NUMERIC;
  v_notoriety INT;
  v_place_tags TEXT[];
  v_actor_name TEXT;
  v_place_title TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  -- Vérifier que le joueur a un héritage
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Vérifier que le lieu appartient au même héritage
  SELECT faction_id, fortification_level INTO v_place_faction, v_current_level FROM places WHERE id = p_place_id;
  IF v_place_faction IS NULL OR v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'not_your_faction');
  END IF;

  -- Tags du lieu
  SELECT ARRAY_AGG(tag_id) INTO v_place_tags
  FROM place_tags WHERE place_id = p_place_id;

  -- Cout et nom du prochain niveau
  SELECT ct.cost, ct.name INTO v_cost, v_next_name
  FROM construction_types ct
  WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_cost IS NULL THEN
    RETURN json_build_object('error', 'max_level');
  END IF;

  -- Vérifier l'énergie (au lieu de construction_points)
  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object(
      'error', 'not_enough_energy',
      'energy', v_energy,
      'cost', v_cost
    );
  END IF;

  -- Déduire l'énergie + ajouter gloire
  UPDATE users
  SET energy_points = energy_points - v_cost,
      notoriety_points = notoriety_points + 5
  WHERE id = p_user_id;

  -- Incrémenter le niveau
  UPDATE places
  SET fortification_level = v_current_level + 1,
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Logger l'activité
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = p_user_id;
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  SELECT color, pattern INTO v_faction_color, v_faction_pattern FROM factions WHERE id = v_user_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'fortify',
    p_user_id,
    p_place_id,
    v_user_faction,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'fortificationLevel', v_current_level + 1
    )
  );

  -- Récupérer l'état final
  SELECT energy_points, notoriety_points
  INTO v_energy, v_notoriety
  FROM users WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'energy', v_energy,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', v_current_level + 1,
    'fortificationName', v_next_name,
    'cost', v_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fortify_place(TEXT, TEXT) TO authenticated;
-- ============================================
-- MIGRATION 146 : Gloire comme joker (complément d'énergie)
-- ============================================
-- Les RPCs discover_place, claim_place et fortify_place acceptent
-- un paramètre optionnel p_use_glory BOOLEAN DEFAULT FALSE
-- Si true ET pas assez d'énergie, la différence est payée en Gloire (notoriety_points)

-- discover_place avec support Gloire
CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote',
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_use_glory BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already BOOLEAN;
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_glory INT;
  v_energy_to_pay NUMERIC;
  v_glory_to_pay INT;
  v_place_faction TEXT;
  v_user_faction TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_reward_energy INT := 0;
BEGIN
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN
    RETURN json_build_object('error', 'already_discovered');
  END IF;

  SELECT COALESCE(t.base_cost, 1.0)
  INTO v_base_cost
  FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  IF p_method = 'gps' THEN
    v_cost := 0;
  ELSE
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_place_id;
    SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
    v_cost := v_base_cost * v_dist_mult;
    IF v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
      v_cost := v_cost * 0.5;
    END IF;
    v_cost := GREATEST(0.5, ROUND(v_cost * 2) / 2.0);
  END IF;

  SELECT energy_points, COALESCE(notoriety_points, 0) INTO v_energy, v_glory FROM users WHERE id = p_user_id;

  -- Calcul paiement : énergie d'abord, gloire en complément
  IF v_energy >= v_cost THEN
    v_energy_to_pay := v_cost;
    v_glory_to_pay := 0;
  ELSIF p_use_glory AND (v_energy + v_glory) >= v_cost THEN
    v_energy_to_pay := v_energy; -- tout ce qu'on a
    v_glory_to_pay := CEIL(v_cost - v_energy)::INT;
  ELSE
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'glory', v_glory, 'cost', v_cost, 'distance', v_distance_km);
  END IF;

  -- Déduire
  IF v_energy_to_pay > 0 OR v_glory_to_pay > 0 THEN
    UPDATE users SET
      energy_points = GREATEST(0, energy_points - v_energy_to_pay),
      notoriety_points = GREATEST(0, notoriety_points - v_glory_to_pay)
    WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT COALESCE(t.reward_energy, 0) INTO v_reward_energy
  FROM place_tags ptag JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE LIMIT 1;

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  -- Gloire +2
  UPDATE users SET notoriety_points = notoriety_points + 2 WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'cost', v_cost, 'gloryCost', v_glory_to_pay, 'distance', v_distance_km);
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;

-- Drop l'ancienne signature
DROP FUNCTION IF EXISTS public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC);

-- claim_place avec support Gloire
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_use_glory BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_current_faction TEXT;
  v_fortification INT;
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_claim_cost NUMERIC;
  v_energy NUMERIC;
  v_glory INT;
  v_energy_to_pay NUMERIC;
  v_glory_to_pay INT;
  v_notoriety INT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_zone_multiplier NUMERIC;
  v_size_multiplier NUMERIC;
  v_neighbor_fort NUMERIC := 0;
  v_neighbor_count INT := 0;
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level, latitude, longitude
  INTO v_current_faction, v_fortification, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;

  IF v_current_faction = v_faction_id THEN RETURN json_build_object('error', 'already_claimed'); END IF;

  SELECT COALESCE(t.base_cost, 1.0) INTO v_base_cost
  FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_fort_multiplier'), 0.5) INTO v_zone_multiplier;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'territory_size_defense_mult'), 0) INTO v_size_multiplier;

  IF v_current_faction IS NOT NULL THEN
    SELECT COALESCE(SUM(p2.fortification_level), 0) INTO v_neighbor_fort
    FROM places p2 WHERE p2.faction_id = v_current_faction AND p2.id != p_place_id
      AND sqrt(pow((p2.latitude - v_place_lat)*111,2)+pow((p2.longitude - v_place_lng)*79,2))
        <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10);

    IF v_size_multiplier > 0 THEN
      v_blob_ids := ARRAY[p_place_id];
      LOOP
        SELECT array_agg(p2.id) INTO v_new_ids FROM places p2
        WHERE p2.faction_id = v_current_faction AND NOT (p2.id = ANY(v_blob_ids))
          AND EXISTS (SELECT 1 FROM unnest(v_blob_ids) AS bid JOIN places pb ON pb.id = bid
            WHERE sqrt(pow((p2.latitude-pb.latitude)*111,2)+pow((p2.longitude-pb.longitude)*79,2))
              <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10));
        EXIT WHEN v_new_ids IS NULL;
        v_blob_ids := v_blob_ids || v_new_ids;
      END LOOP;
      v_neighbor_count := array_length(v_blob_ids, 1) - 1;
    END IF;
  END IF;

  v_claim_cost := (v_base_cost + COALESCE(v_fortification,0) + FLOOR(v_neighbor_fort*v_zone_multiplier) + FLOOR(v_neighbor_count*v_size_multiplier)) * v_dist_mult;
  v_claim_cost := GREATEST(0.5, ROUND(v_claim_cost*2)/2.0);

  SELECT energy_points, COALESCE(notoriety_points, 0) INTO v_energy, v_glory FROM users WHERE id = p_user_id;

  IF v_energy >= v_claim_cost THEN
    v_energy_to_pay := v_claim_cost;
    v_glory_to_pay := 0;
  ELSIF p_use_glory AND (v_energy + v_glory) >= v_claim_cost THEN
    v_energy_to_pay := v_energy;
    v_glory_to_pay := CEIL(v_claim_cost - v_energy)::INT;
  ELSE
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'glory', v_glory, 'claimCost', v_claim_cost, 'distance', v_distance_km);
  END IF;

  UPDATE users SET
    energy_points = GREATEST(0, energy_points - v_energy_to_pay),
    notoriety_points = GREATEST(0, notoriety_points - v_glory_to_pay)
  WHERE id = p_user_id
  RETURNING energy_points, notoriety_points INTO v_energy, v_notoriety;

  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN v_fortification := 0; END IF;

  UPDATE places SET faction_id = v_faction_id, claimed_by = p_user_id, claimed_at = NOW(),
    fortification_level = COALESCE(v_fortification, 0) WHERE id = p_place_id;

  -- Gloire +5
  UPDATE users SET notoriety_points = notoriety_points + 5 WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  INSERT INTO place_claims (place_id, user_id, faction_id) VALUES (p_place_id, p_user_id, v_faction_id);

  RETURN json_build_object('success', true, 'energy', v_energy, 'claimCost', v_claim_cost,
    'gloryCost', v_glory_to_pay, 'notorietyPoints', v_notoriety, 'factionId', v_faction_id, 'distance', v_distance_km);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;

DROP FUNCTION IF EXISTS public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC);

-- fortify_place avec support Gloire
CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_use_glory BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_cost INT;
  v_next_name TEXT;
  v_energy NUMERIC;
  v_glory INT;
  v_energy_to_pay NUMERIC;
  v_glory_to_pay INT;
  v_notoriety INT;
  v_place_tags TEXT[];
  v_actor_name TEXT;
  v_place_title TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level INTO v_place_faction, v_current_level FROM places WHERE id = p_place_id;
  IF v_place_faction IS NULL OR v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'not_your_faction');
  END IF;

  SELECT ARRAY_AGG(tag_id) INTO v_place_tags FROM place_tags WHERE place_id = p_place_id;

  SELECT ct.cost, ct.name INTO v_cost, v_next_name
  FROM construction_types ct WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_cost IS NULL THEN RETURN json_build_object('error', 'max_level'); END IF;

  SELECT energy_points, COALESCE(notoriety_points, 0) INTO v_energy, v_glory FROM users WHERE id = p_user_id;

  IF v_energy >= v_cost THEN
    v_energy_to_pay := v_cost;
    v_glory_to_pay := 0;
  ELSIF p_use_glory AND (v_energy + v_glory) >= v_cost THEN
    v_energy_to_pay := v_energy;
    v_glory_to_pay := CEIL(v_cost - v_energy)::INT;
  ELSE
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'glory', v_glory, 'cost', v_cost);
  END IF;

  UPDATE users SET
    energy_points = GREATEST(0, energy_points - v_energy_to_pay),
    notoriety_points = GREATEST(0, notoriety_points - v_glory_to_pay) + 5
  WHERE id = p_user_id;

  UPDATE places SET fortification_level = v_current_level + 1, updated_at = NOW() WHERE id = p_place_id;

  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = p_user_id;
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  SELECT color, pattern INTO v_faction_color, v_faction_pattern FROM factions WHERE id = v_user_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('fortify', p_user_id, p_place_id, v_user_faction,
    jsonb_build_object('placeTitle', v_place_title, 'placeLatitude', v_place_lat, 'placeLongitude', v_place_lng,
      'actorName', v_actor_name, 'factionColor', v_faction_color, 'factionPattern', v_faction_pattern,
      'fortificationLevel', v_current_level + 1));

  SELECT energy_points, notoriety_points INTO v_energy, v_notoriety FROM users WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'energy', v_energy, 'gloryCost', v_glory_to_pay,
    'notorietyPoints', v_notoriety, 'fortificationLevel', v_current_level + 1,
    'fortificationName', v_next_name, 'cost', v_cost);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fortify_place(TEXT, TEXT, BOOLEAN) TO authenticated;

DROP FUNCTION IF EXISTS public.fortify_place(TEXT, TEXT);
-- ============================================
-- MIGRATION 147 : Revert Gloire comme joker
-- ============================================
-- La Gloire redevient un score pur (classement). Pas de dépense.
-- On recrée les RPCs sans le paramètre p_use_glory.

-- Drop les signatures avec p_use_glory
DROP FUNCTION IF EXISTS public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN);
DROP FUNCTION IF EXISTS public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN);
DROP FUNCTION IF EXISTS public.fortify_place(TEXT, TEXT, BOOLEAN);

-- Recréer discover_place (sans gloire)
CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote',
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already BOOLEAN;
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_place_faction TEXT;
  v_user_faction TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_reward_energy INT := 0;
BEGIN
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN RETURN json_build_object('error', 'already_discovered'); END IF;

  SELECT COALESCE(t.base_cost, 1.0) INTO v_base_cost
  FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  IF p_method = 'gps' THEN
    v_cost := 0;
  ELSE
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_place_id;
    SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
    v_cost := v_base_cost * v_dist_mult;
    IF v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN v_cost := v_cost * 0.5; END IF;
    v_cost := GREATEST(0.5, ROUND(v_cost * 2) / 2.0);
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost, 'distance', v_distance_km);
  END IF;

  IF v_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_cost) WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method) ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT COALESCE(t.reward_energy, 0) INTO v_reward_energy
  FROM place_tags ptag JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE LIMIT 1;

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  UPDATE users SET notoriety_points = notoriety_points + 2 WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'cost', v_cost, 'distance', v_distance_km);
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- Recréer claim_place (sans gloire)
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_current_faction TEXT;
  v_fortification INT;
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_claim_cost NUMERIC;
  v_energy NUMERIC;
  v_notoriety INT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_zone_multiplier NUMERIC;
  v_size_multiplier NUMERIC;
  v_neighbor_fort NUMERIC := 0;
  v_neighbor_count INT := 0;
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level, latitude, longitude
  INTO v_current_faction, v_fortification, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  IF v_current_faction = v_faction_id THEN RETURN json_build_object('error', 'already_claimed'); END IF;

  SELECT COALESCE(t.base_cost, 1.0) INTO v_base_cost
  FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_fort_multiplier'), 0.5) INTO v_zone_multiplier;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'territory_size_defense_mult'), 0) INTO v_size_multiplier;

  IF v_current_faction IS NOT NULL THEN
    SELECT COALESCE(SUM(p2.fortification_level), 0) INTO v_neighbor_fort
    FROM places p2 WHERE p2.faction_id = v_current_faction AND p2.id != p_place_id
      AND sqrt(pow((p2.latitude-v_place_lat)*111,2)+pow((p2.longitude-v_place_lng)*79,2))
        <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10);
    IF v_size_multiplier > 0 THEN
      v_blob_ids := ARRAY[p_place_id];
      LOOP
        SELECT array_agg(p2.id) INTO v_new_ids FROM places p2
        WHERE p2.faction_id = v_current_faction AND NOT (p2.id = ANY(v_blob_ids))
          AND EXISTS (SELECT 1 FROM unnest(v_blob_ids) AS bid JOIN places pb ON pb.id = bid
            WHERE sqrt(pow((p2.latitude-pb.latitude)*111,2)+pow((p2.longitude-pb.longitude)*79,2))
              <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10));
        EXIT WHEN v_new_ids IS NULL;
        v_blob_ids := v_blob_ids || v_new_ids;
      END LOOP;
      v_neighbor_count := array_length(v_blob_ids, 1) - 1;
    END IF;
  END IF;

  v_claim_cost := (v_base_cost + COALESCE(v_fortification,0) + FLOOR(v_neighbor_fort*v_zone_multiplier) + FLOOR(v_neighbor_count*v_size_multiplier)) * v_dist_mult;
  v_claim_cost := GREATEST(0.5, ROUND(v_claim_cost*2)/2.0);

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_claim_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'claimCost', v_claim_cost, 'distance', v_distance_km);
  END IF;

  UPDATE users SET energy_points = GREATEST(0, energy_points - v_claim_cost) WHERE id = p_user_id
  RETURNING energy_points INTO v_energy;

  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN v_fortification := 0; END IF;

  UPDATE places SET faction_id = v_faction_id, claimed_by = p_user_id, claimed_at = NOW(),
    fortification_level = COALESCE(v_fortification, 0) WHERE id = p_place_id;

  UPDATE users SET notoriety_points = notoriety_points + 5 WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  INSERT INTO place_claims (place_id, user_id, faction_id) VALUES (p_place_id, p_user_id, v_faction_id);

  RETURN json_build_object('success', true, 'energy', v_energy, 'claimCost', v_claim_cost,
    'notorietyPoints', v_notoriety, 'factionId', v_faction_id, 'distance', v_distance_km);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- Recréer fortify_place (sans gloire)
CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_cost INT;
  v_next_name TEXT;
  v_energy NUMERIC;
  v_notoriety INT;
  v_place_tags TEXT[];
  v_actor_name TEXT;
  v_place_title TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level INTO v_place_faction, v_current_level FROM places WHERE id = p_place_id;
  IF v_place_faction IS NULL OR v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'not_your_faction');
  END IF;

  SELECT ARRAY_AGG(tag_id) INTO v_place_tags FROM place_tags WHERE place_id = p_place_id;

  SELECT ct.cost, ct.name INTO v_cost, v_next_name
  FROM construction_types ct WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_cost IS NULL THEN RETURN json_build_object('error', 'max_level'); END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  UPDATE users SET energy_points = energy_points - v_cost, notoriety_points = notoriety_points + 5
  WHERE id = p_user_id;

  UPDATE places SET fortification_level = v_current_level + 1, updated_at = NOW() WHERE id = p_place_id;

  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = p_user_id;
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  SELECT color, pattern INTO v_faction_color, v_faction_pattern FROM factions WHERE id = v_user_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('fortify', p_user_id, p_place_id, v_user_faction,
    jsonb_build_object('placeTitle', v_place_title, 'placeLatitude', v_place_lat, 'placeLongitude', v_place_lng,
      'actorName', v_actor_name, 'factionColor', v_faction_color, 'factionPattern', v_faction_pattern,
      'fortificationLevel', v_current_level + 1));

  SELECT energy_points, notoriety_points INTO v_energy, v_notoriety FROM users WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'energy', v_energy, 'notorietyPoints', v_notoriety,
    'fortificationLevel', v_current_level + 1, 'fortificationName', v_next_name, 'cost', v_cost);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fortify_place(TEXT, TEXT) TO authenticated;
-- ============================================
-- MIGRATION 148 : Ajouter l'avatar du protecteur dans get_place_by_id
-- ============================================
-- On ajoute claimedByAvatar dans le JSON claim retourné

-- On ne réécrit pas toute la fonction, on crée un helper
CREATE OR REPLACE FUNCTION public.get_user_avatar(p_user_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT avatar_url FROM users WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_avatar(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_avatar(TEXT) TO anon;
-- ============================================
-- MIGRATION 149 : Fortification avec coût par distance
-- ============================================

DROP FUNCTION IF EXISTS public.fortify_place(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_base_cost INT;
  v_dist_mult NUMERIC := 1.0;
  v_cost NUMERIC;
  v_next_name TEXT;
  v_energy NUMERIC;
  v_notoriety INT;
  v_place_tags TEXT[];
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_actor_name TEXT;
  v_place_title TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level, latitude, longitude
  INTO v_place_faction, v_current_level, v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  IF v_place_faction IS NULL OR v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'not_your_faction');
  END IF;

  SELECT ARRAY_AGG(tag_id) INTO v_place_tags FROM place_tags WHERE place_id = p_place_id;

  SELECT ct.cost, ct.name INTO v_base_cost, v_next_name
  FROM construction_types ct WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_base_cost IS NULL THEN RETURN json_build_object('error', 'max_level'); END IF;

  -- Multiplicateur de distance
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  v_cost := GREATEST(1, ROUND(v_base_cost * v_dist_mult * 2) / 2.0);

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost, 'distance', v_distance_km);
  END IF;

  UPDATE users SET energy_points = energy_points - v_cost, notoriety_points = notoriety_points + 5
  WHERE id = p_user_id;

  UPDATE places SET fortification_level = v_current_level + 1, updated_at = NOW() WHERE id = p_place_id;

  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = p_user_id;
  SELECT title INTO v_place_title FROM places WHERE id = p_place_id;
  SELECT color, pattern INTO v_faction_color, v_faction_pattern FROM factions WHERE id = v_user_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('fortify', p_user_id, p_place_id, v_user_faction,
    jsonb_build_object('placeTitle', v_place_title, 'placeLatitude', v_place_lat, 'placeLongitude', v_place_lng,
      'actorName', v_actor_name, 'factionColor', v_faction_color, 'factionPattern', v_faction_pattern,
      'fortificationLevel', v_current_level + 1));

  SELECT energy_points, notoriety_points INTO v_energy, v_notoriety FROM users WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'energy', v_energy, 'notorietyPoints', v_notoriety,
    'fortificationLevel', v_current_level + 1, 'fortificationName', v_next_name,
    'cost', v_cost, 'distance', v_distance_km);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fortify_place(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
-- ============================================
-- MIGRATION 150 : Fix formule distance
-- ============================================
-- Le multiplicateur de distance s'applique SEULEMENT au coût de base
-- La fortification et les bonus zone s'ajoutent APRES
-- Formule : (base_cost × distance) + fortif + zone_bonus

-- claim_place
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_current_faction TEXT;
  v_fortification INT;
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_claim_cost NUMERIC;
  v_energy NUMERIC;
  v_notoriety INT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_zone_multiplier NUMERIC;
  v_size_multiplier NUMERIC;
  v_neighbor_fort NUMERIC := 0;
  v_neighbor_count INT := 0;
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level, latitude, longitude
  INTO v_current_faction, v_fortification, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  IF v_current_faction = v_faction_id THEN RETURN json_build_object('error', 'already_claimed'); END IF;

  SELECT COALESCE(t.base_cost, 1.0) INTO v_base_cost
  FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_fort_multiplier'), 0.5) INTO v_zone_multiplier;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'territory_size_defense_mult'), 0) INTO v_size_multiplier;

  IF v_current_faction IS NOT NULL THEN
    SELECT COALESCE(SUM(p2.fortification_level), 0) INTO v_neighbor_fort
    FROM places p2 WHERE p2.faction_id = v_current_faction AND p2.id != p_place_id
      AND sqrt(pow((p2.latitude-v_place_lat)*111,2)+pow((p2.longitude-v_place_lng)*79,2))
        <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10);
    IF v_size_multiplier > 0 THEN
      v_blob_ids := ARRAY[p_place_id];
      LOOP
        SELECT array_agg(p2.id) INTO v_new_ids FROM places p2
        WHERE p2.faction_id = v_current_faction AND NOT (p2.id = ANY(v_blob_ids))
          AND EXISTS (SELECT 1 FROM unnest(v_blob_ids) AS bid JOIN places pb ON pb.id = bid
            WHERE sqrt(pow((p2.latitude-pb.latitude)*111,2)+pow((p2.longitude-pb.longitude)*79,2))
              <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10));
        EXIT WHEN v_new_ids IS NULL;
        v_blob_ids := v_blob_ids || v_new_ids;
      END LOOP;
      v_neighbor_count := array_length(v_blob_ids, 1) - 1;
    END IF;
  END IF;

  -- Formule : (base × distance) + fortif + zone (la distance ne multiplie PAS la fortification)
  v_claim_cost := (v_base_cost * v_dist_mult)
    + COALESCE(v_fortification, 0)
    + FLOOR(v_neighbor_fort * v_zone_multiplier)
    + FLOOR(v_neighbor_count * v_size_multiplier);
  v_claim_cost := GREATEST(0.5, ROUND(v_claim_cost * 2) / 2.0);

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_claim_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'claimCost', v_claim_cost, 'distance', v_distance_km);
  END IF;

  UPDATE users SET energy_points = GREATEST(0, energy_points - v_claim_cost) WHERE id = p_user_id
  RETURNING energy_points INTO v_energy;

  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN v_fortification := 0; END IF;

  UPDATE places SET faction_id = v_faction_id, claimed_by = p_user_id, claimed_at = NOW(),
    fortification_level = COALESCE(v_fortification, 0) WHERE id = p_place_id;

  UPDATE users SET notoriety_points = notoriety_points + 5 WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  INSERT INTO place_claims (place_id, user_id, faction_id) VALUES (p_place_id, p_user_id, v_faction_id);

  RETURN json_build_object('success', true, 'energy', v_energy, 'claimCost', v_claim_cost,
    'notorietyPoints', v_notoriety, 'factionId', v_faction_id, 'distance', v_distance_km);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- fortify_place : même fix
DROP FUNCTION IF EXISTS public.fortify_place(TEXT, TEXT, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_base_cost INT;
  v_dist_mult NUMERIC := 1.0;
  v_cost NUMERIC;
  v_next_name TEXT;
  v_energy NUMERIC;
  v_notoriety INT;
  v_place_tags TEXT[];
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_actor_name TEXT;
  v_place_title TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level, latitude, longitude
  INTO v_place_faction, v_current_level, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  IF v_place_faction IS NULL OR v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'not_your_faction');
  END IF;

  SELECT ARRAY_AGG(tag_id) INTO v_place_tags FROM place_tags WHERE place_id = p_place_id;

  SELECT ct.cost, ct.name INTO v_base_cost, v_next_name
  FROM construction_types ct WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_base_cost IS NULL THEN RETURN json_build_object('error', 'max_level'); END IF;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  -- Le coût de fortification de base est multiplié par la distance
  v_cost := GREATEST(1, ROUND(v_base_cost * v_dist_mult * 2) / 2.0);

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost, 'distance', v_distance_km);
  END IF;

  UPDATE users SET energy_points = energy_points - v_cost, notoriety_points = notoriety_points + 5
  WHERE id = p_user_id;

  UPDATE places SET fortification_level = v_current_level + 1, updated_at = NOW() WHERE id = p_place_id;

  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = p_user_id;
  SELECT title INTO v_place_title FROM places WHERE id = p_place_id;
  SELECT color, pattern INTO v_faction_color, v_faction_pattern FROM factions WHERE id = v_user_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('fortify', p_user_id, p_place_id, v_user_faction,
    jsonb_build_object('placeTitle', v_place_title, 'placeLatitude', v_place_lat, 'placeLongitude', v_place_lng,
      'actorName', v_actor_name, 'factionColor', v_faction_color, 'factionPattern', v_faction_pattern,
      'fortificationLevel', v_current_level + 1));

  SELECT energy_points, notoriety_points INTO v_energy, v_notoriety FROM users WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'energy', v_energy, 'notorietyPoints', v_notoriety,
    'fortificationLevel', v_current_level + 1, 'fortificationName', v_next_name,
    'cost', v_cost, 'distance', v_distance_km);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fortify_place(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
-- ============================================
-- MIGRATION 151 : Bonus par tag par Héritage
-- ============================================
-- Chaque héritage peut avoir une réduction de coût sur certains types de lieux

CREATE TABLE IF NOT EXISTS faction_tag_bonuses (
  faction_id VARCHAR(255) NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  tag_id VARCHAR(255) NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  cost_reduction NUMERIC(5,2) NOT NULL DEFAULT 0,  -- en pourcentage (ex: 50 = -50%)
  PRIMARY KEY (faction_id, tag_id)
);

ALTER TABLE faction_tag_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faction_tag_bonuses_read" ON faction_tag_bonuses FOR SELECT USING (true);
CREATE POLICY "faction_tag_bonuses_admin" ON faction_tag_bonuses FOR ALL USING (true) WITH CHECK (true);
-- ============================================
-- MIGRATION 152 : Appliquer les bonus héritage/tag dans les RPCs
-- ============================================
-- Helper qui retourne la réduction de coût pour un joueur sur un lieu

CREATE OR REPLACE FUNCTION public.get_faction_tag_reduction(p_user_id TEXT, p_place_id TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT ftb.cost_reduction
     FROM faction_tag_bonuses ftb
     JOIN users u ON u.faction_id = ftb.faction_id
     JOIN place_tags pt ON pt.tag_id = ftb.tag_id AND pt.is_primary = TRUE
     WHERE u.id = p_user_id AND pt.place_id = p_place_id
     LIMIT 1),
    0
  );
$$;

-- Mettre à jour discover_place pour appliquer la réduction
CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote',
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already BOOLEAN;
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_tag_reduction NUMERIC := 0;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_place_faction TEXT;
  v_user_faction TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_reward_energy INT := 0;
BEGIN
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN RETURN json_build_object('error', 'already_discovered'); END IF;

  SELECT COALESCE(t.base_cost, 1.0) INTO v_base_cost
  FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  -- Réduction héritage/tag
  v_tag_reduction := get_faction_tag_reduction(p_user_id, p_place_id);

  IF p_method = 'gps' THEN
    v_cost := 0;
  ELSE
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_place_id;
    SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
    v_cost := (v_base_cost * v_dist_mult) * (1 - v_tag_reduction / 100);
    IF v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN v_cost := v_cost * 0.5; END IF;
    v_cost := GREATEST(0.5, ROUND(v_cost * 2) / 2.0);
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost, 'distance', v_distance_km, 'tagReduction', v_tag_reduction);
  END IF;

  IF v_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_cost) WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method) ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT COALESCE(t.reward_energy, 0) INTO v_reward_energy
  FROM place_tags ptag JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE LIMIT 1;

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  UPDATE users SET notoriety_points = notoriety_points + 2 WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'cost', v_cost, 'distance', v_distance_km, 'tagReduction', v_tag_reduction);
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- Mettre à jour claim_place pour appliquer la réduction
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_current_faction TEXT;
  v_fortification INT;
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_tag_reduction NUMERIC := 0;
  v_claim_cost NUMERIC;
  v_energy NUMERIC;
  v_notoriety INT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_zone_multiplier NUMERIC;
  v_size_multiplier NUMERIC;
  v_neighbor_fort NUMERIC := 0;
  v_neighbor_count INT := 0;
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level, latitude, longitude
  INTO v_current_faction, v_fortification, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  IF v_current_faction = v_faction_id THEN RETURN json_build_object('error', 'already_claimed'); END IF;

  SELECT COALESCE(t.base_cost, 1.0) INTO v_base_cost
  FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  -- Réduction héritage/tag
  v_tag_reduction := get_faction_tag_reduction(p_user_id, p_place_id);

  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_fort_multiplier'), 0.5) INTO v_zone_multiplier;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'territory_size_defense_mult'), 0) INTO v_size_multiplier;

  IF v_current_faction IS NOT NULL THEN
    SELECT COALESCE(SUM(p2.fortification_level), 0) INTO v_neighbor_fort
    FROM places p2 WHERE p2.faction_id = v_current_faction AND p2.id != p_place_id
      AND sqrt(pow((p2.latitude-v_place_lat)*111,2)+pow((p2.longitude-v_place_lng)*79,2))
        <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10);
    IF v_size_multiplier > 0 THEN
      v_blob_ids := ARRAY[p_place_id];
      LOOP
        SELECT array_agg(p2.id) INTO v_new_ids FROM places p2
        WHERE p2.faction_id = v_current_faction AND NOT (p2.id = ANY(v_blob_ids))
          AND EXISTS (SELECT 1 FROM unnest(v_blob_ids) AS bid JOIN places pb ON pb.id = bid
            WHERE sqrt(pow((p2.latitude-pb.latitude)*111,2)+pow((p2.longitude-pb.longitude)*79,2))
              <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10));
        EXIT WHEN v_new_ids IS NULL;
        v_blob_ids := v_blob_ids || v_new_ids;
      END LOOP;
      v_neighbor_count := array_length(v_blob_ids, 1) - 1;
    END IF;
  END IF;

  -- Formule : (base × distance - réduction héritage) + fortif + zone
  v_claim_cost := GREATEST(0, (v_base_cost * v_dist_mult) * (1 - v_tag_reduction / 100))
    + COALESCE(v_fortification, 0)
    + FLOOR(v_neighbor_fort * v_zone_multiplier)
    + FLOOR(v_neighbor_count * v_size_multiplier);
  v_claim_cost := GREATEST(0.5, ROUND(v_claim_cost * 2) / 2.0);

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_claim_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'claimCost', v_claim_cost, 'distance', v_distance_km, 'tagReduction', v_tag_reduction);
  END IF;

  UPDATE users SET energy_points = GREATEST(0, energy_points - v_claim_cost) WHERE id = p_user_id
  RETURNING energy_points INTO v_energy;

  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN v_fortification := 0; END IF;

  UPDATE places SET faction_id = v_faction_id, claimed_by = p_user_id, claimed_at = NOW(),
    fortification_level = COALESCE(v_fortification, 0) WHERE id = p_place_id;

  UPDATE users SET notoriety_points = notoriety_points + 5 WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  INSERT INTO place_claims (place_id, user_id, faction_id) VALUES (p_place_id, p_user_id, v_faction_id);

  RETURN json_build_object('success', true, 'energy', v_energy, 'claimCost', v_claim_cost,
    'notorietyPoints', v_notoriety, 'factionId', v_faction_id, 'distance', v_distance_km, 'tagReduction', v_tag_reduction);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
-- ============================================
-- MIGRATION 153 : Compétences actives des Fragments
-- ============================================

-- Ajouter les colonnes de compétence sur les fragments
ALTER TABLE title_fragments ADD COLUMN IF NOT EXISTS ability_type VARCHAR(50) DEFAULT NULL;
ALTER TABLE title_fragments ADD COLUMN IF NOT EXISTS ability_cooldown_hours INT DEFAULT 24;

-- Table de tracking des utilisations
CREATE TABLE IF NOT EXISTS fragment_ability_uses (
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fragment_id INT NOT NULL REFERENCES title_fragments(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, fragment_id)
);

ALTER TABLE fragment_ability_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ability_uses_read" ON fragment_ability_uses FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "ability_uses_write" ON fragment_ability_uses FOR ALL USING (user_id = auth.uid()::text);

-- RPC : utiliser une compétence
CREATE OR REPLACE FUNCTION public.use_fragment_ability(
  p_user_id TEXT,
  p_fragment_id INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ability_type VARCHAR(50);
  v_cooldown_hours INT;
  v_last_used TIMESTAMPTZ;
  v_has_fragment BOOLEAN;
BEGIN
  -- Vérifier que le joueur possède le fragment
  SELECT EXISTS (SELECT 1 FROM user_fragments WHERE user_id = p_user_id AND fragment_id = p_fragment_id)
  INTO v_has_fragment;
  IF NOT v_has_fragment THEN
    RETURN json_build_object('error', 'fragment_not_owned');
  END IF;

  -- Lire la compétence
  SELECT ability_type, COALESCE(ability_cooldown_hours, 24)
  INTO v_ability_type, v_cooldown_hours
  FROM title_fragments WHERE id = p_fragment_id;

  IF v_ability_type IS NULL THEN
    RETURN json_build_object('error', 'no_ability');
  END IF;

  -- Vérifier le cooldown
  SELECT used_at INTO v_last_used
  FROM fragment_ability_uses
  WHERE user_id = p_user_id AND fragment_id = p_fragment_id;

  IF v_last_used IS NOT NULL AND v_last_used + (v_cooldown_hours || ' hours')::INTERVAL > NOW() THEN
    RETURN json_build_object(
      'error', 'on_cooldown',
      'availableAt', (v_last_used + (v_cooldown_hours || ' hours')::INTERVAL)
    );
  END IF;

  -- Enregistrer l'utilisation
  INSERT INTO fragment_ability_uses (user_id, fragment_id, used_at)
  VALUES (p_user_id, p_fragment_id, NOW())
  ON CONFLICT (user_id, fragment_id) DO UPDATE SET used_at = NOW();

  RETURN json_build_object('success', true, 'ability', v_ability_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.use_fragment_ability(TEXT, INT) TO authenticated;

-- RPC : lister les compétences disponibles du joueur
CREATE OR REPLACE FUNCTION public.get_my_abilities(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT
      tf.id AS fragment_id,
      tf.name,
      tf.icon,
      tf.icon_url,
      tf.ability_type,
      tf.ability_cooldown_hours,
      fau.used_at AS last_used,
      CASE
        WHEN fau.used_at IS NULL THEN true
        WHEN fau.used_at + (COALESCE(tf.ability_cooldown_hours, 24) || ' hours')::INTERVAL <= NOW() THEN true
        ELSE false
      END AS available
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    LEFT JOIN fragment_ability_uses fau ON fau.user_id = uf.user_id AND fau.fragment_id = tf.id
    WHERE uf.user_id = p_user_id AND tf.ability_type IS NOT NULL
    ORDER BY tf.name
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_abilities(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 154 : Retourner ability_type dans get_user_fragments
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_fragments(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT
      tf.id, tf.name, tf.icon, tf.icon_url, tf.image_url, tf.link_url,
      tf.collection, tf.bonus_type, tf.bonus_value,
      tf.ability_type, tf.ability_cooldown_hours,
      uf.unlocked_at, uf.source,
      (
        SELECT json_agg(json_build_object(
          'id', fw.id, 'word', fw.word, 'slot', fw.slot, 'gender', fw.gender
        ))
        FROM fragment_words fw WHERE fw.fragment_id = tf.id
      ) AS words
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    WHERE uf.user_id = p_user_id AND tf.visible = true
    ORDER BY uf.unlocked_at DESC
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_fragments(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 155 : Retourner ability_type dans get_all_fragments
-- ============================================

CREATE OR REPLACE FUNCTION public.get_all_fragments(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data ORDER BY owned DESC, name) INTO v_result
  FROM (
    SELECT
      tf.id, tf.name, tf.description, tf.icon, tf.image_url, tf.link_url,
      tf.bonus_type, tf.bonus_value,
      tf.ability_type, tf.ability_cooldown_hours,
      EXISTS (
        SELECT 1 FROM user_fragments uf
        WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id
      ) AS owned
    FROM title_fragments tf
    WHERE tf.visible = true
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_fragments(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_fragments(TEXT) TO anon;
-- ============================================
-- MIGRATION 156 : Image dédiée pour les compétences
-- ============================================

ALTER TABLE title_fragments ADD COLUMN IF NOT EXISTS ability_icon_url TEXT DEFAULT NULL;
-- ============================================
-- MIGRATION 157 : Retourner ability_icon_url dans get_my_abilities
-- ============================================

CREATE OR REPLACE FUNCTION public.get_my_abilities(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT
      tf.id AS fragment_id,
      tf.name,
      tf.icon,
      tf.icon_url,
      tf.ability_icon_url,
      tf.ability_type,
      tf.ability_cooldown_hours,
      fau.used_at AS last_used,
      CASE
        WHEN fau.used_at IS NULL THEN true
        WHEN fau.used_at + (COALESCE(tf.ability_cooldown_hours, 24) || ' hours')::INTERVAL <= NOW() THEN true
        ELSE false
      END AS available
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    LEFT JOIN fragment_ability_uses fau ON fau.user_id = uf.user_id AND fau.fragment_id = tf.id
    WHERE uf.user_id = p_user_id AND tf.ability_type IS NOT NULL
    ORDER BY tf.name
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_abilities(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 158 : Vider les utilisations de compétences (données de test)
-- ============================================

DELETE FROM fragment_ability_uses;
-- ============================================
-- MIGRATION 159 : Flag gratuit pour les compétences actives
-- ============================================
-- Les RPCs acceptent un paramètre p_free BOOLEAN
-- Si true, le coût en énergie est 0 (compétence active consommée)

-- discover_place avec p_free
CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote',
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_free BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already BOOLEAN;
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_tag_reduction NUMERIC := 0;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_place_faction TEXT;
  v_user_faction TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_reward_energy INT := 0;
BEGIN
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN RETURN json_build_object('error', 'already_discovered'); END IF;

  IF p_free THEN
    v_cost := 0;
  ELSIF p_method = 'gps' THEN
    v_cost := 0;
  ELSE
    SELECT COALESCE(t.base_cost, 1.0) INTO v_base_cost
    FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
    WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

    SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;

    IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
      v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
      v_dist_mult := distance_multiplier(v_distance_km);
    END IF;

    v_tag_reduction := get_faction_tag_reduction(p_user_id, p_place_id);

    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_place_id;
    SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
    v_cost := (v_base_cost * v_dist_mult) * (1 - v_tag_reduction / 100);
    IF v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN v_cost := v_cost * 0.5; END IF;
    v_cost := GREATEST(0.5, ROUND(v_cost * 2) / 2.0);
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  IF v_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_cost) WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method) ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT COALESCE(t.reward_energy, 0) INTO v_reward_energy
  FROM place_tags ptag JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE LIMIT 1;

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  UPDATE users SET notoriety_points = notoriety_points + 2 WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'cost', v_cost, 'free', p_free);
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;
DROP FUNCTION IF EXISTS public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC);

-- claim_place avec p_free
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_free BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_current_faction TEXT;
  v_fortification INT;
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_tag_reduction NUMERIC := 0;
  v_claim_cost NUMERIC;
  v_energy NUMERIC;
  v_notoriety INT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_zone_multiplier NUMERIC;
  v_size_multiplier NUMERIC;
  v_neighbor_fort NUMERIC := 0;
  v_neighbor_count INT := 0;
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level, latitude, longitude
  INTO v_current_faction, v_fortification, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  IF v_current_faction = v_faction_id THEN RETURN json_build_object('error', 'already_claimed'); END IF;

  IF p_free THEN
    v_claim_cost := 0;
  ELSE
    SELECT COALESCE(t.base_cost, 1.0) INTO v_base_cost
    FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
    WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

    IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
      v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
      v_dist_mult := distance_multiplier(v_distance_km);
    END IF;

    v_tag_reduction := get_faction_tag_reduction(p_user_id, p_place_id);

    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_fort_multiplier'), 0.5) INTO v_zone_multiplier;
    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'territory_size_defense_mult'), 0) INTO v_size_multiplier;

    IF v_current_faction IS NOT NULL THEN
      SELECT COALESCE(SUM(p2.fortification_level), 0) INTO v_neighbor_fort
      FROM places p2 WHERE p2.faction_id = v_current_faction AND p2.id != p_place_id
        AND sqrt(pow((p2.latitude-v_place_lat)*111,2)+pow((p2.longitude-v_place_lng)*79,2))
          <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10);
      IF v_size_multiplier > 0 THEN
        v_blob_ids := ARRAY[p_place_id];
        LOOP
          SELECT array_agg(p2.id) INTO v_new_ids FROM places p2
          WHERE p2.faction_id = v_current_faction AND NOT (p2.id = ANY(v_blob_ids))
            AND EXISTS (SELECT 1 FROM unnest(v_blob_ids) AS bid JOIN places pb ON pb.id = bid
              WHERE sqrt(pow((p2.latitude-pb.latitude)*111,2)+pow((p2.longitude-pb.longitude)*79,2))
                <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10));
          EXIT WHEN v_new_ids IS NULL;
          v_blob_ids := v_blob_ids || v_new_ids;
        END LOOP;
        v_neighbor_count := array_length(v_blob_ids, 1) - 1;
      END IF;
    END IF;

    v_claim_cost := GREATEST(0, (v_base_cost * v_dist_mult) * (1 - v_tag_reduction / 100))
      + COALESCE(v_fortification, 0)
      + FLOOR(v_neighbor_fort * v_zone_multiplier)
      + FLOOR(v_neighbor_count * v_size_multiplier);
    v_claim_cost := GREATEST(0.5, ROUND(v_claim_cost * 2) / 2.0);
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_claim_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'claimCost', v_claim_cost);
  END IF;

  IF v_claim_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_claim_cost) WHERE id = p_user_id
    RETURNING energy_points INTO v_energy;
  END IF;

  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN v_fortification := 0; END IF;

  UPDATE places SET faction_id = v_faction_id, claimed_by = p_user_id, claimed_at = NOW(),
    fortification_level = COALESCE(v_fortification, 0) WHERE id = p_place_id;

  UPDATE users SET notoriety_points = notoriety_points + 5 WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  INSERT INTO place_claims (place_id, user_id, faction_id) VALUES (p_place_id, p_user_id, v_faction_id);

  RETURN json_build_object('success', true, 'energy', v_energy, 'claimCost', v_claim_cost,
    'notorietyPoints', v_notoriety, 'factionId', v_faction_id, 'free', p_free);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;
DROP FUNCTION IF EXISTS public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC);
-- Vider les utilisations de compétences pour reset le cooldown
DELETE FROM fragment_ability_uses;
-- ============================================
-- MIGRATION 161 : Supprimer ability_icon_url, utiliser image_url
-- ============================================

ALTER TABLE title_fragments DROP COLUMN IF EXISTS ability_icon_url;

-- Mettre à jour get_my_abilities pour retourner image_url au lieu de ability_icon_url
CREATE OR REPLACE FUNCTION public.get_my_abilities(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT
      tf.id AS fragment_id,
      tf.name,
      tf.icon,
      tf.icon_url,
      tf.image_url,
      tf.ability_type,
      tf.ability_cooldown_hours,
      fau.used_at AS last_used,
      CASE
        WHEN fau.used_at IS NULL THEN true
        WHEN fau.used_at + (COALESCE(tf.ability_cooldown_hours, 24) || ' hours')::INTERVAL <= NOW() THEN true
        ELSE false
      END AS available
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    LEFT JOIN fragment_ability_uses fau ON fau.user_id = uf.user_id AND fau.fragment_id = tf.id
    WHERE uf.user_id = p_user_id AND tf.ability_type IS NOT NULL
    ORDER BY tf.name
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_abilities(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 162 : Nettoyer les titres orphelins au changement d'héritage
-- ============================================
-- Quand un joueur change de faction, ses titres de faction affichés
-- peuvent devenir invalides. On les retire.

-- Retirer les titres de faction qui ne correspondent plus
UPDATE users u
SET displayed_title_ids_v3 = (
  SELECT array_agg(tid)
  FROM unnest(u.displayed_title_ids_v3) AS tid
  WHERE tid < 0  -- Mots de fragments (négatifs) → on garde
    OR EXISTS (SELECT 1 FROM titles t WHERE t.id = tid AND (t.type = 'general' OR (t.type = 'faction' AND t.faction_id = u.faction_id)))
)
WHERE displayed_title_ids_v3 IS NOT NULL AND array_length(displayed_title_ids_v3, 1) > 0;

-- Remplacer les NULL par un array vide
UPDATE users SET displayed_title_ids_v3 = '{}' WHERE displayed_title_ids_v3 IS NULL;
-- ============================================
-- MIGRATION 163 : Nettoyer les titres au changement d'héritage
-- ============================================

CREATE OR REPLACE FUNCTION public.set_user_faction(
  p_user_id TEXT,
  p_faction_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_faction_id TEXT;
  v_old_notoriety INT;
  v_new_notoriety INT;
  v_notoriety_lost INT;
BEGIN
  -- Verifier que la faction existe (ou null pour quitter)
  IF p_faction_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM factions WHERE id = p_faction_id) THEN
      RETURN json_build_object('error', 'Faction not found');
    END IF;
  END IF;

  -- Recuperer l'ancienne faction + notoriete actuelle
  SELECT faction_id, COALESCE(notoriety_points, 0)
  INTO v_old_faction_id, v_old_notoriety
  FROM users WHERE id = p_user_id;

  -- Solidifier : tous les lieux de l'ancienne faction deviennent des decouvertes
  IF v_old_faction_id IS NOT NULL THEN
    INSERT INTO places_discovered (user_id, place_id, method)
    SELECT p_user_id, p.id, 'remote'
    FROM places p
    WHERE p.faction_id = v_old_faction_id
    ON CONFLICT (user_id, place_id) DO NOTHING;
  END IF;

  -- Si CHANGEMENT de faction → diviser notoriete par 2 + nettoyer titres
  IF v_old_faction_id IS NOT NULL
     AND p_faction_id IS NOT NULL
     AND v_old_faction_id != p_faction_id THEN

    v_new_notoriety := FLOOR(v_old_notoriety / 2);
    v_notoriety_lost := v_old_notoriety - v_new_notoriety;

    -- Retirer les titres de l'ancienne faction des titres affichés
    UPDATE users
    SET faction_id = p_faction_id,
        notoriety_points = v_new_notoriety,
        displayed_title_ids_v3 = (
          SELECT COALESCE(array_agg(tid), '{}')
          FROM unnest(displayed_title_ids_v3) AS tid
          WHERE tid < 0  -- Mots de fragments → garder
            OR NOT EXISTS (SELECT 1 FROM titles t WHERE t.id = tid AND t.type = 'faction' AND t.faction_id = v_old_faction_id)
        ),
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN json_build_object('success', true, 'notorietyLost', v_notoriety_lost, 'notorietyPoints', v_new_notoriety);
  ELSE
    -- Premier join ou depart → pas de cout
    UPDATE users SET faction_id = p_faction_id, updated_at = NOW() WHERE id = p_user_id;
    RETURN json_build_object('success', true, 'notorietyLost', 0);
  END IF;
END;
$$;
-- ============================================
-- MIGRATION 164 : Valeur configurable pour les compétences
-- ============================================
-- Permet de configurer le % de réduction pour discount_claim, discount_discover, etc.

ALTER TABLE title_fragments ADD COLUMN IF NOT EXISTS ability_value NUMERIC(5,2) DEFAULT 0;
-- ============================================
-- MIGRATION 165 : Filtrer les titres affichés par ceux débloqués
-- ============================================
-- get_player_profile affichait tous les displayed_title_ids_v3 sans vérifier
-- si le titre est encore débloqué. On filtre maintenant.

-- Mettre à jour get_player_profile pour croiser displayed_title_ids_v3 avec les titres débloqués
-- La section displayed_general doit vérifier :
-- - Titres généraux (id > 0) : le titre doit être dans unlockedGeneralTitles
-- - Titre faction : le titre doit être le factionTitle actuel
-- - Mots de fragment (id < 0) : le fragment doit être dans user_fragments

-- Pour les titres généraux, on croise avec unlockedGeneralTitles
-- Pour les titres faction, on vérifie que c'est le bon
-- Pour les fragments, on vérifie user_fragments

-- Approche simple : ne garder que les IDs qui sont dans la liste débloquée
-- On reconstruit v_displayed_general en filtrant

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_titles_data JSON;
  v_displayed_v3 INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_claimed_places JSON;
  v_unlocked_ids INT[];
  v_faction_title_id INT;
BEGIN
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  -- ID du titre de faction actuel
  IF v_faction_title IS NOT NULL THEN
    v_faction_title_id := (v_faction_title->>'id')::INT;
  END IF;

  -- IDs des titres généraux débloqués
  SELECT array_agg((elem->>'id')::INT) INTO v_unlocked_ids
  FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem;
  v_unlocked_ids := COALESCE(v_unlocked_ids, '{}');

  -- Ajouter le titre de faction si existant
  IF v_faction_title_id IS NOT NULL THEN
    v_unlocked_ids := v_unlocked_ids || v_faction_title_id;
  END IF;

  SELECT COALESCE(displayed_title_ids_v3, '{}') INTO v_displayed_v3 FROM users WHERE id = p_user_id;

  IF array_length(v_displayed_v3, 1) > 0 THEN
    SELECT json_agg(row_data ORDER BY pos) INTO v_displayed_general
    FROM (
      -- Titres généraux et faction : vérifier qu'ils sont débloqués
      SELECT t.id, t.name, t.icon, NULL::TEXT AS icon_url, array_position(v_displayed_v3, t.id) AS pos
      FROM titles t WHERE t.id = ANY(v_displayed_v3) AND t.id > 0 AND t.id = ANY(v_unlocked_ids)
      UNION ALL
      -- Mots de fragment : vérifier que le fragment est possédé
      SELECT fw.id * -1 AS id, fw.word AS name, tf.icon, tf.icon_url, array_position(v_displayed_v3, fw.id * -1) AS pos
      FROM fragment_words fw JOIN title_fragments tf ON tf.id = fw.fragment_id
      WHERE (fw.id * -1) = ANY(v_displayed_v3)
        AND EXISTS (SELECT 1 FROM user_fragments uf WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id)
    ) row_data;

    -- Nettoyer les IDs invalides de displayed_title_ids_v3
    UPDATE users
    SET displayed_title_ids_v3 = (
      SELECT COALESCE(array_agg(tid), '{}')
      FROM unnest(v_displayed_v3) AS tid
      WHERE tid = ANY(v_unlocked_ids)  -- titres généraux/faction débloqués
        OR (tid < 0 AND EXISTS (  -- mots de fragment possédés
          SELECT 1 FROM user_fragments uf
          JOIN fragment_words fw ON fw.fragment_id = uf.fragment_id
          WHERE uf.user_id = p_user_id AND fw.id * -1 = tid
        ))
    )
    WHERE id = p_user_id
      AND displayed_title_ids_v3 IS DISTINCT FROM (
        SELECT COALESCE(array_agg(tid), '{}')
        FROM unnest(v_displayed_v3) AS tid
        WHERE tid = ANY(v_unlocked_ids)
          OR (tid < 0 AND EXISTS (
            SELECT 1 FROM user_fragments uf
            JOIN fragment_words fw ON fw.fragment_id = uf.fragment_id
            WHERE uf.user_id = p_user_id AND fw.id * -1 = tid
          ))
      );
  END IF;

  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem) INTO v_displayed_general
    FROM (SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem LIMIT 1) sub;
  END IF;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_authored_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''), 'createdAt', p.created_at,
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE p.author_id = p_user_id ORDER BY p.created_at DESC LIMIT 500) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_discovered_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places_explored pe JOIN places p ON p.id = pe.place_id LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE pe.user_id = p_user_id ORDER BY pe.created_at DESC LIMIT 500) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_claimed_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE p.claimed_by = p_user_id ORDER BY p.claimed_at DESC LIMIT 500) sub;

  SELECT json_build_object(
    'userId', u.id, 'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id, 'factionTitle', f.title, 'factionColor', f.color, 'factionPattern', f.pattern,
    'profileImage', u.avatar_url, 'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places, 'discoveredPlaces', v_discovered_places, 'claimedPlaces', v_claimed_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  ) INTO v_result FROM users u LEFT JOIN factions f ON f.id = u.faction_id WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_profile TO anon;
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
-- ============================================
-- MIGRATION 167 : RPC de preview du coût
-- ============================================
-- Une seule fonction qui calcule le coût d'une action (discover, claim, fortify)
-- Le frontend l'appelle AVANT l'action pour afficher le vrai coût
-- Plus besoin de dupliquer le calcul côté client

CREATE OR REPLACE FUNCTION public.preview_action_cost(
  p_user_id TEXT,
  p_place_id TEXT,
  p_action TEXT,  -- 'discover' | 'claim' | 'fortify'
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_fortify_level INT DEFAULT NULL  -- pour fortify : le level cible
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_tag_reduction NUMERIC := 0;
  v_fortif_cost NUMERIC := 0;
  v_zone_cost NUMERIC := 0;
  v_size_cost NUMERIC := 0;
  v_same_faction_discount BOOLEAN := FALSE;
  v_total NUMERIC;
  v_energy NUMERIC;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC := 0;
  v_place_faction TEXT;
  v_user_faction TEXT;
  v_fortification INT;
  v_zone_multiplier NUMERIC;
  v_size_multiplier NUMERIC;
  v_neighbor_fort NUMERIC := 0;
  v_neighbor_count INT := 0;
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  -- Énergie actuelle
  SELECT energy_points, faction_id INTO v_energy, v_user_faction FROM users WHERE id = p_user_id;

  -- Lieu
  SELECT latitude, longitude, faction_id, COALESCE(fortification_level, 0)
  INTO v_place_lat, v_place_lng, v_place_faction, v_fortification
  FROM places WHERE id = p_place_id;

  -- Base cost du tag
  SELECT COALESCE(t.base_cost, 1.0) INTO v_base_cost
  FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

  -- Distance
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  -- Réduction héritage
  v_tag_reduction := get_faction_tag_reduction(p_user_id, p_place_id);

  -- Coût de base avec distance et réduction
  v_total := (v_base_cost * v_dist_mult) * (1 - v_tag_reduction / 100);

  -- Réduction même faction (discover uniquement)
  IF p_action = 'discover' AND v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
    v_total := v_total * 0.5;
    v_same_faction_discount := TRUE;
  END IF;

  -- Fortification (claim / fortify)
  IF p_action = 'claim' THEN
    v_fortif_cost := COALESCE(v_fortification, 0);

    -- Voisins fortifiés
    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_fort_multiplier'), 0.5) INTO v_zone_multiplier;
    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'territory_size_defense_mult'), 0) INTO v_size_multiplier;

    IF v_place_faction IS NOT NULL THEN
      SELECT COALESCE(SUM(p2.fortification_level), 0) INTO v_neighbor_fort
      FROM places p2 WHERE p2.faction_id = v_place_faction AND p2.id != p_place_id
        AND sqrt(pow((p2.latitude-v_place_lat)*111,2)+pow((p2.longitude-v_place_lng)*79,2))
          <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10);

      IF v_size_multiplier > 0 THEN
        v_blob_ids := ARRAY[p_place_id];
        LOOP
          SELECT array_agg(p2.id) INTO v_new_ids FROM places p2
          WHERE p2.faction_id = v_place_faction AND NOT (p2.id = ANY(v_blob_ids))
            AND EXISTS (SELECT 1 FROM unnest(v_blob_ids) AS bid JOIN places pb ON pb.id = bid
              WHERE sqrt(pow((p2.latitude-pb.latitude)*111,2)+pow((p2.longitude-pb.longitude)*79,2))
                <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10));
          EXIT WHEN v_new_ids IS NULL;
          v_blob_ids := v_blob_ids || v_new_ids;
        END LOOP;
        v_neighbor_count := array_length(v_blob_ids, 1) - 1;
      END IF;
    END IF;

    v_zone_cost := FLOOR(v_neighbor_fort * v_zone_multiplier);
    v_size_cost := FLOOR(v_neighbor_count * v_size_multiplier);
  END IF;

  IF p_action = 'fortify' AND p_fortify_level IS NOT NULL THEN
    SELECT COALESCE(ct.cost, 1) INTO v_fortif_cost
    FROM construction_types ct WHERE ct.level = p_fortify_level;
  END IF;

  v_total := v_total + v_fortif_cost + v_zone_cost + v_size_cost;
  v_total := GREATEST(0.5, ROUND(v_total * 2) / 2.0);

  RETURN json_build_object(
    'cost', v_total,
    'energy', v_energy,
    'canAfford', v_energy >= v_total,
    'detail', json_build_object(
      'baseCost', v_base_cost,
      'distanceKm', ROUND(v_distance_km::NUMERIC, 1),
      'distanceMult', v_dist_mult,
      'tagReduction', v_tag_reduction,
      'sameFaction', v_same_faction_discount,
      'fortifCost', v_fortif_cost,
      'zoneCost', v_zone_cost,
      'sizeCost', v_size_cost
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_action_cost(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT) TO authenticated;
-- ============================================
-- MIGRATION 168 : Calcul de coût unifié
-- ============================================
-- Toutes les RPCs d'action utilisent preview_action_cost pour le calcul
-- UNE SEULE source de vérité. Zéro divergence frontend/backend.

-- ============================================
-- DISCOVER_PLACE : utilise preview_action_cost
-- ============================================
CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote',
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_free BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already BOOLEAN;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_preview JSON;
  v_reward_energy INT := 0;
BEGIN
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN RETURN json_build_object('error', 'already_discovered'); END IF;

  -- Calcul du coût via la source unique
  IF p_free THEN
    v_cost := 0;
  ELSIF p_method = 'gps' THEN
    v_cost := 0;
  ELSE
    v_preview := preview_action_cost(p_user_id, p_place_id, 'discover', p_user_lat, p_user_lng);
    v_cost := (v_preview->>'cost')::NUMERIC;
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  IF v_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_cost) WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method) ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT COALESCE(t.reward_energy, 0) INTO v_reward_energy
  FROM place_tags ptag JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE LIMIT 1;

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  UPDATE users SET notoriety_points = notoriety_points + 2 WHERE id = p_user_id;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  RETURN json_build_object('success', true, 'cost', v_cost, 'energy', v_energy, 'free', p_free);
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;

-- ============================================
-- CLAIM_PLACE : utilise preview_action_cost
-- ============================================
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_free BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_current_faction TEXT;
  v_fortification INT;
  v_claim_cost NUMERIC;
  v_energy NUMERIC;
  v_notoriety INT;
  v_preview JSON;
  v_user_avatar TEXT;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level
  INTO v_current_faction, v_fortification FROM places WHERE id = p_place_id;
  IF v_current_faction = v_faction_id THEN RETURN json_build_object('error', 'already_claimed'); END IF;

  -- Calcul du coût via la source unique
  IF p_free THEN
    v_claim_cost := 0;
  ELSE
    v_preview := preview_action_cost(p_user_id, p_place_id, 'claim', p_user_lat, p_user_lng);
    v_claim_cost := (v_preview->>'cost')::NUMERIC;
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_claim_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'claimCost', v_claim_cost);
  END IF;

  IF v_claim_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_claim_cost) WHERE id = p_user_id
    RETURNING energy_points INTO v_energy;
  END IF;

  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN v_fortification := 0; END IF;

  SELECT avatar_url INTO v_user_avatar FROM users WHERE id = p_user_id;

  UPDATE places SET faction_id = v_faction_id, claimed_by = p_user_id, claimed_at = NOW(),
    claimed_avatar_url = v_user_avatar,
    fortification_level = COALESCE(v_fortification, 0) WHERE id = p_place_id;

  UPDATE users SET notoriety_points = notoriety_points + 5 WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  INSERT INTO place_claims (place_id, user_id, faction_id) VALUES (p_place_id, p_user_id, v_faction_id);

  RETURN json_build_object('success', true, 'energy', v_energy, 'claimCost', v_claim_cost,
    'notorietyPoints', v_notoriety, 'factionId', v_faction_id, 'free', p_free);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;

-- ============================================
-- FORTIFY_PLACE : utilise preview_action_cost
-- ============================================
CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_cost NUMERIC;
  v_next_name TEXT;
  v_energy NUMERIC;
  v_notoriety INT;
  v_place_tags TEXT[];
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_actor_name TEXT;
  v_place_title TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_preview JSON;
  v_base_cost INT;
BEGIN
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level, latitude, longitude
  INTO v_place_faction, v_current_level, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  IF v_place_faction IS NULL OR v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'not_your_faction');
  END IF;

  SELECT ARRAY_AGG(tag_id) INTO v_place_tags FROM place_tags WHERE place_id = p_place_id;

  SELECT ct.cost, ct.name INTO v_base_cost, v_next_name
  FROM construction_types ct WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_base_cost IS NULL THEN RETURN json_build_object('error', 'max_level'); END IF;

  -- Calcul du coût via la source unique
  v_preview := preview_action_cost(p_user_id, p_place_id, 'fortify', p_user_lat, p_user_lng, v_current_level + 1);
  v_cost := (v_preview->>'cost')::NUMERIC;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  UPDATE users SET energy_points = energy_points - v_cost, notoriety_points = notoriety_points + 5
  WHERE id = p_user_id;

  UPDATE places SET fortification_level = v_current_level + 1, updated_at = NOW() WHERE id = p_place_id;

  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = p_user_id;
  SELECT title INTO v_place_title FROM places WHERE id = p_place_id;
  SELECT color, pattern INTO v_faction_color, v_faction_pattern FROM factions WHERE id = v_user_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('fortify', p_user_id, p_place_id, v_user_faction,
    jsonb_build_object('placeTitle', v_place_title, 'placeLatitude', v_place_lat, 'placeLongitude', v_place_lng,
      'actorName', v_actor_name, 'factionColor', v_faction_color, 'factionPattern', v_faction_pattern,
      'fortificationLevel', v_current_level + 1));

  SELECT energy_points, notoriety_points INTO v_energy, v_notoriety FROM users WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'energy', v_energy, 'notorietyPoints', v_notoriety,
    'fortificationLevel', v_current_level + 1, 'fortificationName', v_next_name,
    'cost', v_cost);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fortify_place(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- Nettoyage des anciennes signatures qui pourraient exister
DROP FUNCTION IF EXISTS public.claim_place(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.discover_place(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC);
-- ============================================
-- MIGRATION 169 : Ajouter la colonne claimed_avatar_url sur places
-- ============================================
ALTER TABLE places ADD COLUMN IF NOT EXISTS claimed_avatar_url TEXT;
-- ============================================
-- MIGRATION 170 : Supprimer TOUTES les anciennes signatures
-- ============================================
-- PostgreSQL garde les fonctions par signature exacte.
-- On drop tout et on recrée uniquement les bonnes signatures.

-- Lister et drop toutes les variantes de claim_place
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM pg_proc
    WHERE proname = 'claim_place' AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;

  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM pg_proc
    WHERE proname = 'discover_place' AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;

  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM pg_proc
    WHERE proname = 'fortify_place' AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END;
$$;

-- ============================================
-- DISCOVER_PLACE (unique signature)
-- ============================================
CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote',
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_free BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already BOOLEAN;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_preview JSON;
  v_reward_energy INT := 0;
BEGIN
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN RETURN json_build_object('error', 'already_discovered'); END IF;

  IF p_free THEN
    v_cost := 0;
  ELSIF p_method = 'gps' THEN
    v_cost := 0;
  ELSE
    v_preview := preview_action_cost(p_user_id, p_place_id, 'discover', p_user_lat, p_user_lng);
    v_cost := (v_preview->>'cost')::NUMERIC;
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  IF v_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_cost) WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method) ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT COALESCE(t.reward_energy, 0) INTO v_reward_energy
  FROM place_tags ptag JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE LIMIT 1;

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  UPDATE users SET notoriety_points = notoriety_points + 2 WHERE id = p_user_id;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  RETURN json_build_object('success', true, 'cost', v_cost, 'energy', v_energy, 'free', p_free);
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;

-- ============================================
-- CLAIM_PLACE (unique signature)
-- ============================================
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_free BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_current_faction TEXT;
  v_fortification INT;
  v_claim_cost NUMERIC;
  v_energy NUMERIC;
  v_notoriety INT;
  v_preview JSON;
  v_user_avatar TEXT;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level
  INTO v_current_faction, v_fortification FROM places WHERE id = p_place_id;
  IF v_current_faction = v_faction_id THEN RETURN json_build_object('error', 'already_claimed'); END IF;

  IF p_free THEN
    v_claim_cost := 0;
  ELSE
    v_preview := preview_action_cost(p_user_id, p_place_id, 'claim', p_user_lat, p_user_lng);
    v_claim_cost := (v_preview->>'cost')::NUMERIC;
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_claim_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'claimCost', v_claim_cost);
  END IF;

  IF v_claim_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_claim_cost) WHERE id = p_user_id
    RETURNING energy_points INTO v_energy;
  END IF;

  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN v_fortification := 0; END IF;

  SELECT avatar_url INTO v_user_avatar FROM users WHERE id = p_user_id;

  UPDATE places SET faction_id = v_faction_id, claimed_by = p_user_id, claimed_at = NOW(),
    claimed_avatar_url = v_user_avatar,
    fortification_level = COALESCE(v_fortification, 0) WHERE id = p_place_id;

  UPDATE users SET notoriety_points = notoriety_points + 5 WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  INSERT INTO place_claims (place_id, user_id, faction_id) VALUES (p_place_id, p_user_id, v_faction_id);

  RETURN json_build_object('success', true, 'energy', v_energy, 'claimCost', v_claim_cost,
    'notorietyPoints', v_notoriety, 'factionId', v_faction_id, 'free', p_free);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;

-- ============================================
-- FORTIFY_PLACE (unique signature)
-- ============================================
CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_cost NUMERIC;
  v_next_name TEXT;
  v_energy NUMERIC;
  v_notoriety INT;
  v_place_tags TEXT[];
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_actor_name TEXT;
  v_place_title TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_preview JSON;
  v_base_cost INT;
BEGIN
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level, latitude, longitude
  INTO v_place_faction, v_current_level, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  IF v_place_faction IS NULL OR v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'not_your_faction');
  END IF;

  SELECT ARRAY_AGG(tag_id) INTO v_place_tags FROM place_tags WHERE place_id = p_place_id;

  SELECT ct.cost, ct.name INTO v_base_cost, v_next_name
  FROM construction_types ct WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_base_cost IS NULL THEN RETURN json_build_object('error', 'max_level'); END IF;

  v_preview := preview_action_cost(p_user_id, p_place_id, 'fortify', p_user_lat, p_user_lng, v_current_level + 1);
  v_cost := (v_preview->>'cost')::NUMERIC;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  UPDATE users SET energy_points = energy_points - v_cost, notoriety_points = notoriety_points + 5
  WHERE id = p_user_id;

  UPDATE places SET fortification_level = v_current_level + 1, updated_at = NOW() WHERE id = p_place_id;

  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = p_user_id;
  SELECT title INTO v_place_title FROM places WHERE id = p_place_id;
  SELECT color, pattern INTO v_faction_color, v_faction_pattern FROM factions WHERE id = v_user_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('fortify', p_user_id, p_place_id, v_user_faction,
    jsonb_build_object('placeTitle', v_place_title, 'placeLatitude', v_place_lat, 'placeLongitude', v_place_lng,
      'actorName', v_actor_name, 'factionColor', v_faction_color, 'factionPattern', v_faction_pattern,
      'fortificationLevel', v_current_level + 1));

  SELECT energy_points, notoriety_points INTO v_energy, v_notoriety FROM users WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'energy', v_energy, 'notorietyPoints', v_notoriety,
    'fortificationLevel', v_current_level + 1, 'fortificationName', v_next_name,
    'cost', v_cost);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fortify_place(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
-- ============================================
-- MIGRATION 171 : Supprimer la boucle de blob (performance)
-- ============================================
-- Le calcul du blob complet est O(n²) et cause des timeouts sur les gros territoires.
-- territory_size_defense_mult est à 0 par défaut et n'a jamais été activé.
-- On garde seulement le calcul des voisins fortifiés dans un rayon (rapide, O(1) avec le scan).

CREATE OR REPLACE FUNCTION public.preview_action_cost(
  p_user_id TEXT,
  p_place_id TEXT,
  p_action TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_fortify_level INT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_tag_reduction NUMERIC := 0;
  v_fortif_cost NUMERIC := 0;
  v_zone_cost NUMERIC := 0;
  v_same_faction_discount BOOLEAN := FALSE;
  v_total NUMERIC;
  v_energy NUMERIC;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC := 0;
  v_place_faction TEXT;
  v_user_faction TEXT;
  v_fortification INT;
  v_zone_multiplier NUMERIC;
  v_neighbor_fort NUMERIC := 0;
  v_detection_radius NUMERIC;
BEGIN
  -- Énergie actuelle
  SELECT energy_points, faction_id INTO v_energy, v_user_faction FROM users WHERE id = p_user_id;

  -- Lieu
  SELECT latitude, longitude, faction_id, COALESCE(fortification_level, 0)
  INTO v_place_lat, v_place_lng, v_place_faction, v_fortification
  FROM places WHERE id = p_place_id;

  -- Base cost du tag
  SELECT COALESCE(t.base_cost, 1.0) INTO v_base_cost
  FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

  -- Distance
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  -- Réduction héritage
  v_tag_reduction := get_faction_tag_reduction(p_user_id, p_place_id);

  -- Coût de base avec distance et réduction
  v_total := (v_base_cost * v_dist_mult) * (1 - v_tag_reduction / 100);

  -- Réduction même faction (discover uniquement)
  IF p_action = 'discover' AND v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
    v_total := v_total * 0.5;
    v_same_faction_discount := TRUE;
  END IF;

  -- Fortification (claim)
  IF p_action = 'claim' THEN
    v_fortif_cost := COALESCE(v_fortification, 0);

    -- Voisins fortifiés dans un rayon (simple, pas de boucle de blob)
    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_fort_multiplier'), 0.5) INTO v_zone_multiplier;
    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10) INTO v_detection_radius;

    IF v_place_faction IS NOT NULL AND v_zone_multiplier > 0 THEN
      SELECT COALESCE(SUM(p2.fortification_level), 0) INTO v_neighbor_fort
      FROM places p2
      WHERE p2.faction_id = v_place_faction
        AND p2.id != p_place_id
        AND p2.fortification_level > 0
        AND sqrt(pow((p2.latitude - v_place_lat) * 111, 2) + pow((p2.longitude - v_place_lng) * 79, 2)) <= v_detection_radius;
    END IF;

    v_zone_cost := FLOOR(v_neighbor_fort * v_zone_multiplier);
  END IF;

  -- Fortification (fortify)
  IF p_action = 'fortify' AND p_fortify_level IS NOT NULL THEN
    SELECT COALESCE(ct.cost, 1) INTO v_fortif_cost
    FROM construction_types ct WHERE ct.level = p_fortify_level;
  END IF;

  v_total := v_total + v_fortif_cost + v_zone_cost;
  v_total := GREATEST(0.5, ROUND(v_total * 2) / 2.0);

  RETURN json_build_object(
    'cost', v_total,
    'energy', v_energy,
    'canAfford', v_energy >= v_total,
    'detail', json_build_object(
      'baseCost', v_base_cost,
      'distanceKm', ROUND(v_distance_km::NUMERIC, 1),
      'distanceMult', v_dist_mult,
      'tagReduction', v_tag_reduction,
      'sameFaction', v_same_faction_discount,
      'fortifCost', v_fortif_cost,
      'zoneCost', v_zone_cost,
      'sizeCost', 0
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_action_cost(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT) TO authenticated;
-- ============================================
-- MIGRATION 172 : Fix performance get_place_by_id
-- ============================================
-- SEUL CHANGEMENT : supprime la boucle de blob O(n³) et simplifie le calcul des voisins
-- Tout le reste est identique à la migration 095

CREATE OR REPLACE FUNCTION public.get_place_by_id(
  p_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place RECORD;
  v_place_type RECORD;
  v_author RECORD;
  v_views_count INT;
  v_likes_count INT;
  v_explored_count INT;
  v_geocache_count INT;
  v_avg_score DOUBLE PRECISION;
  v_last_explorers JSON;
  v_requester JSON;
  v_primary_tag JSON;
  v_all_tags JSON;
  v_claim JSON;
  v_zone_fort INT;
  v_zone_count INT;
  v_claimer_name TEXT;
  v_radius_km NUMERIC(6,1);
  v_lat_delta NUMERIC(8,5);
  v_lon_delta NUMERIC(8,5);
BEGIN
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT * INTO v_place_type FROM place_types WHERE id = v_place.place_type_id;
  SELECT * INTO v_author FROM users WHERE id = v_place.author_id;

  -- Metrics
  SELECT COUNT(*) INTO v_views_count FROM places_viewed WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_likes_count FROM places_liked WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_explored_count FROM places_explored WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_geocache_count FROM reviews WHERE place_id = p_id AND geocache = true;
  SELECT AVG(score) INTO v_avg_score FROM reviews WHERE place_id = p_id;

  -- Derniers explorateurs
  SELECT json_agg(explorer) INTO v_last_explorers
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'lastName', COALESCE(u.display_name, u.first_name, 'Aventurier'),
      'profileImageUrl', u.avatar_url
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    WHERE pe.place_id = p_id AND pe.user_id != v_place.author_id
    ORDER BY pe.updated_at DESC
  ) sub;

  -- Tag primaire
  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'color', t.color,
    'background', t.background
  ) INTO v_primary_tag
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_id AND ptag.is_primary = TRUE
  LIMIT 1;

  -- Tous les tags
  SELECT json_agg(tag_data) INTO v_all_tags
  FROM (
    SELECT json_build_object(
      'id', t.id,
      'title', t.title,
      'color', t.color,
      'background', t.background,
      'isPrimary', ptag.is_primary
    ) AS tag_data
    FROM place_tags ptag
    JOIN tags t ON t.id = ptag.tag_id
    WHERE ptag.place_id = p_id
    ORDER BY ptag.is_primary DESC, t."order"
  ) sub;

  -- Requester state
  IF p_user_id IS NOT NULL THEN
    v_requester := json_build_object(
      'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked WHERE place_id = p_id AND user_id = p_user_id),
      'liked', EXISTS(SELECT 1 FROM places_liked WHERE place_id = p_id AND user_id = p_user_id),
      'explored', EXISTS(SELECT 1 FROM places_explored WHERE place_id = p_id AND user_id = p_user_id)
    );
  ELSE
    v_requester := NULL;
  END IF;

  -- Rayon configurable
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_detection_radius_km'), '10')::NUMERIC(6,1) INTO v_radius_km;
  v_lat_delta := v_radius_km / 111.0;
  v_lon_delta := v_radius_km / 79.0;

  -- Fortification voisins (SIMPLIFIÉ : distance simple, plus de boucle de blob)
  v_zone_fort := 0;
  v_zone_count := 0;
  IF v_place.faction_id IS NOT NULL THEN
    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_zone_fort
    FROM places p2
    WHERE p2.faction_id = v_place.faction_id
      AND p2.id != p_id
      AND p2.fortification_level > 0
      AND ABS(p2.latitude - v_place.latitude) < v_lat_delta
      AND ABS(p2.longitude - v_place.longitude) < v_lon_delta
      AND sqrt(pow((p2.latitude - v_place.latitude) * 111, 2) + pow((p2.longitude - v_place.longitude) * 79, 2)) <= v_radius_km;
  END IF;

  -- Nom du joueur qui a revendique
  IF v_place.claimed_by IS NOT NULL THEN
    SELECT COALESCE(display_name, first_name, 'Inconnu')
    INTO v_claimer_name
    FROM users WHERE id = v_place.claimed_by;
  END IF;

  -- Claim info
  IF v_place.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'factionId', f.id,
      'factionTitle', f.title,
      'factionColor', f.color,
      'factionPattern', f.pattern,
      'claimedBy', v_place.claimed_by,
      'claimedByName', COALESCE(v_claimer_name, 'Inconnu'),
      'claimedAt', v_place.claimed_at,
      'fortificationLevel', v_place.fortification_level,
      'zoneFortification', v_zone_fort,
      'zoneNeighborCount', v_zone_count
    ) INTO v_claim
    FROM factions f
    WHERE f.id = v_place.faction_id;
  ELSE
    v_claim := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_place.id,
    'title', v_place.title,
    'text', v_place.text,
    'address', v_place.address,
    'accessibility', v_place.accessibility,
    'sensible', COALESCE(v_place.sensible, false),
    'geocaching', v_geocache_count > 0,
    'images', v_place.images,
    'author', json_build_object(
      'id', COALESCE(v_author.id, v_place.author_id),
      'lastName', COALESCE(v_author.display_name, v_author.first_name, 'Utilisateur inconnu'),
      'profileImageUrl', v_author.avatar_url
    ),
    'type', json_build_object(
      'id', v_place_type.id,
      'title', v_place_type.title
    ),
    'primaryTag', v_primary_tag,
    'tags', COALESCE(v_all_tags, '[]'::json),
    'location', json_build_object(
      'latitude', v_place.latitude,
      'longitude', v_place.longitude
    ),
    'metrics', json_build_object(
      'views', v_views_count,
      'likes', v_likes_count,
      'explored', v_explored_count,
      'note', v_avg_score
    ),
    'claim', v_claim,
    'requester', v_requester,
    'lastExplorers', COALESCE(v_last_explorers, '[]'::json),
    'beginAt', v_place.begin_at,
    'endAt', v_place.end_at,
    'createdAt', v_place.created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_by_id(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_by_id(TEXT, TEXT) TO anon;
-- ============================================
-- MIGRATION 173 : Multiplicateur de Gloire paramétrable
-- ============================================
-- Ajout d'un param p_glory_mult (default 1) sur les 3 RPCs d'action.
-- Le frontend passe le multiplicateur quand le buff double_glory est actif.
-- On drop d'abord les anciennes signatures puis on recrée.

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc
    WHERE proname IN ('discover_place', 'claim_place', 'fortify_place') AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE'; END LOOP;
END;
$$;

-- ============================================
-- DISCOVER_PLACE
-- ============================================
CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote',
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_free BOOLEAN DEFAULT FALSE,
  p_glory_mult NUMERIC DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already BOOLEAN;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_preview JSON;
  v_reward_energy INT := 0;
  v_glory_gain INT;
BEGIN
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN RETURN json_build_object('error', 'already_discovered'); END IF;

  IF p_free THEN
    v_cost := 0;
  ELSIF p_method = 'gps' THEN
    v_cost := 0;
  ELSE
    v_preview := preview_action_cost(p_user_id, p_place_id, 'discover', p_user_lat, p_user_lng);
    v_cost := (v_preview->>'cost')::NUMERIC;
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  IF v_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_cost) WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method) ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT COALESCE(t.reward_energy, 0) INTO v_reward_energy
  FROM place_tags ptag JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE LIMIT 1;

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  v_glory_gain := GREATEST(1, ROUND(2 * COALESCE(p_glory_mult, 1)));
  UPDATE users SET notoriety_points = notoriety_points + v_glory_gain WHERE id = p_user_id;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  RETURN json_build_object('success', true, 'cost', v_cost, 'energy', v_energy, 'free', p_free, 'gloryGain', v_glory_gain);
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC) TO authenticated;

-- ============================================
-- CLAIM_PLACE
-- ============================================
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_free BOOLEAN DEFAULT FALSE,
  p_glory_mult NUMERIC DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_current_faction TEXT;
  v_fortification INT;
  v_claim_cost NUMERIC;
  v_energy NUMERIC;
  v_notoriety INT;
  v_preview JSON;
  v_user_avatar TEXT;
  v_glory_gain INT;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level
  INTO v_current_faction, v_fortification FROM places WHERE id = p_place_id;
  IF v_current_faction = v_faction_id THEN RETURN json_build_object('error', 'already_claimed'); END IF;

  IF p_free THEN
    v_claim_cost := 0;
  ELSE
    v_preview := preview_action_cost(p_user_id, p_place_id, 'claim', p_user_lat, p_user_lng);
    v_claim_cost := (v_preview->>'cost')::NUMERIC;
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_claim_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'claimCost', v_claim_cost);
  END IF;

  IF v_claim_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_claim_cost) WHERE id = p_user_id
    RETURNING energy_points INTO v_energy;
  END IF;

  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN v_fortification := 0; END IF;

  SELECT avatar_url INTO v_user_avatar FROM users WHERE id = p_user_id;

  UPDATE places SET faction_id = v_faction_id, claimed_by = p_user_id, claimed_at = NOW(),
    claimed_avatar_url = v_user_avatar,
    fortification_level = COALESCE(v_fortification, 0) WHERE id = p_place_id;

  v_glory_gain := GREATEST(1, ROUND(5 * COALESCE(p_glory_mult, 1)));
  UPDATE users SET notoriety_points = notoriety_points + v_glory_gain WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  INSERT INTO place_claims (place_id, user_id, faction_id) VALUES (p_place_id, p_user_id, v_faction_id);

  RETURN json_build_object('success', true, 'energy', v_energy, 'claimCost', v_claim_cost,
    'notorietyPoints', v_notoriety, 'factionId', v_faction_id, 'free', p_free, 'gloryGain', v_glory_gain);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC) TO authenticated;

-- ============================================
-- FORTIFY_PLACE
-- ============================================
CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_glory_mult NUMERIC DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_cost NUMERIC;
  v_next_name TEXT;
  v_energy NUMERIC;
  v_notoriety INT;
  v_place_tags TEXT[];
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_actor_name TEXT;
  v_place_title TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_preview JSON;
  v_base_cost INT;
  v_glory_gain INT;
BEGIN
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level, latitude, longitude
  INTO v_place_faction, v_current_level, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  IF v_place_faction IS NULL OR v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'not_your_faction');
  END IF;

  SELECT ARRAY_AGG(tag_id) INTO v_place_tags FROM place_tags WHERE place_id = p_place_id;

  SELECT ct.cost, ct.name INTO v_base_cost, v_next_name
  FROM construction_types ct WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_base_cost IS NULL THEN RETURN json_build_object('error', 'max_level'); END IF;

  v_preview := preview_action_cost(p_user_id, p_place_id, 'fortify', p_user_lat, p_user_lng, v_current_level + 1);
  v_cost := (v_preview->>'cost')::NUMERIC;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  v_glory_gain := GREATEST(1, ROUND(5 * COALESCE(p_glory_mult, 1)));
  UPDATE users SET energy_points = energy_points - v_cost, notoriety_points = notoriety_points + v_glory_gain
  WHERE id = p_user_id;

  UPDATE places SET fortification_level = v_current_level + 1, updated_at = NOW() WHERE id = p_place_id;

  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = p_user_id;
  SELECT title INTO v_place_title FROM places WHERE id = p_place_id;
  SELECT color, pattern INTO v_faction_color, v_faction_pattern FROM factions WHERE id = v_user_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('fortify', p_user_id, p_place_id, v_user_faction,
    jsonb_build_object('placeTitle', v_place_title, 'placeLatitude', v_place_lat, 'placeLongitude', v_place_lng,
      'actorName', v_actor_name, 'factionColor', v_faction_color, 'factionPattern', v_faction_pattern,
      'fortificationLevel', v_current_level + 1));

  SELECT energy_points, notoriety_points INTO v_energy, v_notoriety FROM users WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'energy', v_energy, 'notorietyPoints', v_notoriety,
    'fortificationLevel', v_current_level + 1, 'fortificationName', v_next_name,
    'cost', v_cost, 'gloryGain', v_glory_gain);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fortify_place(TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
-- ============================================
-- MIGRATION 174 : Taux de Gloire configurables
-- ============================================

INSERT INTO app_settings (key, value) VALUES ('glory_discover', '2') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('glory_claim', '5') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('glory_fortify', '5') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('glory_cost_bonus_pct', '10') ON CONFLICT (key) DO NOTHING;
-- ============================================
-- MIGRATION 175 : RPCs lisent les taux de Gloire depuis app_settings
-- ============================================
-- Remplace les valeurs hardcodées (2, 5, 5) par des lectures de app_settings
-- On drop et recrée les 3 RPCs (copie exacte de 173, seul changement : lecture settings)

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc
    WHERE proname IN ('discover_place', 'claim_place', 'fortify_place') AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE'; END LOOP;
END;
$$;

-- ============================================
-- DISCOVER_PLACE
-- ============================================
CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote',
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_free BOOLEAN DEFAULT FALSE,
  p_glory_mult NUMERIC DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already BOOLEAN;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_preview JSON;
  v_reward_energy INT := 0;
  v_glory_base INT;
  v_glory_cost_pct NUMERIC;
  v_glory_gain INT;
BEGIN
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN RETURN json_build_object('error', 'already_discovered'); END IF;

  IF p_free THEN
    v_cost := 0;
  ELSIF p_method = 'gps' THEN
    v_cost := 0;
  ELSE
    v_preview := preview_action_cost(p_user_id, p_place_id, 'discover', p_user_lat, p_user_lng);
    v_cost := (v_preview->>'cost')::NUMERIC;
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  IF v_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_cost) WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method) ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT COALESCE(t.reward_energy, 0) INTO v_reward_energy
  FROM place_tags ptag JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE LIMIT 1;

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'glory_discover'), 2) INTO v_glory_base;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'glory_cost_bonus_pct'), 10) INTO v_glory_cost_pct;
  v_glory_gain := GREATEST(1, ROUND((v_glory_base + v_cost * v_glory_cost_pct / 100) * COALESCE(p_glory_mult, 1)));
  UPDATE users SET notoriety_points = notoriety_points + v_glory_gain WHERE id = p_user_id;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  RETURN json_build_object('success', true, 'cost', v_cost, 'energy', v_energy, 'free', p_free, 'gloryGain', v_glory_gain);
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC) TO authenticated;

-- ============================================
-- CLAIM_PLACE
-- ============================================
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_free BOOLEAN DEFAULT FALSE,
  p_glory_mult NUMERIC DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_current_faction TEXT;
  v_fortification INT;
  v_claim_cost NUMERIC;
  v_energy NUMERIC;
  v_notoriety INT;
  v_preview JSON;
  v_user_avatar TEXT;
  v_glory_base INT;
  v_glory_cost_pct NUMERIC;
  v_glory_gain INT;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level
  INTO v_current_faction, v_fortification FROM places WHERE id = p_place_id;
  IF v_current_faction = v_faction_id THEN RETURN json_build_object('error', 'already_claimed'); END IF;

  IF p_free THEN
    v_claim_cost := 0;
  ELSE
    v_preview := preview_action_cost(p_user_id, p_place_id, 'claim', p_user_lat, p_user_lng);
    v_claim_cost := (v_preview->>'cost')::NUMERIC;
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_claim_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'claimCost', v_claim_cost);
  END IF;

  IF v_claim_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_claim_cost) WHERE id = p_user_id
    RETURNING energy_points INTO v_energy;
  END IF;

  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN v_fortification := 0; END IF;

  SELECT avatar_url INTO v_user_avatar FROM users WHERE id = p_user_id;

  UPDATE places SET faction_id = v_faction_id, claimed_by = p_user_id, claimed_at = NOW(),
    claimed_avatar_url = v_user_avatar,
    fortification_level = COALESCE(v_fortification, 0) WHERE id = p_place_id;

  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'glory_claim'), 5) INTO v_glory_base;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'glory_cost_bonus_pct'), 10) INTO v_glory_cost_pct;
  v_glory_gain := GREATEST(1, ROUND((v_glory_base + v_claim_cost * v_glory_cost_pct / 100) * COALESCE(p_glory_mult, 1)));
  UPDATE users SET notoriety_points = notoriety_points + v_glory_gain WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  INSERT INTO place_claims (place_id, user_id, faction_id) VALUES (p_place_id, p_user_id, v_faction_id);

  RETURN json_build_object('success', true, 'energy', v_energy, 'claimCost', v_claim_cost,
    'notorietyPoints', v_notoriety, 'factionId', v_faction_id, 'free', p_free, 'gloryGain', v_glory_gain);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC) TO authenticated;

-- ============================================
-- FORTIFY_PLACE
-- ============================================
CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_glory_mult NUMERIC DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_cost NUMERIC;
  v_next_name TEXT;
  v_energy NUMERIC;
  v_notoriety INT;
  v_place_tags TEXT[];
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_actor_name TEXT;
  v_place_title TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_preview JSON;
  v_base_cost INT;
  v_glory_base INT;
  v_glory_cost_pct NUMERIC;
  v_glory_gain INT;
BEGIN
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level, latitude, longitude
  INTO v_place_faction, v_current_level, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  IF v_place_faction IS NULL OR v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'not_your_faction');
  END IF;

  SELECT ARRAY_AGG(tag_id) INTO v_place_tags FROM place_tags WHERE place_id = p_place_id;

  SELECT ct.cost, ct.name INTO v_base_cost, v_next_name
  FROM construction_types ct WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_base_cost IS NULL THEN RETURN json_build_object('error', 'max_level'); END IF;

  v_preview := preview_action_cost(p_user_id, p_place_id, 'fortify', p_user_lat, p_user_lng, v_current_level + 1);
  v_cost := (v_preview->>'cost')::NUMERIC;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'glory_fortify'), 5) INTO v_glory_base;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'glory_cost_bonus_pct'), 10) INTO v_glory_cost_pct;
  v_glory_gain := GREATEST(1, ROUND((v_glory_base + v_cost * v_glory_cost_pct / 100) * COALESCE(p_glory_mult, 1)));
  UPDATE users SET energy_points = energy_points - v_cost, notoriety_points = notoriety_points + v_glory_gain
  WHERE id = p_user_id;

  UPDATE places SET fortification_level = v_current_level + 1, updated_at = NOW() WHERE id = p_place_id;

  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = p_user_id;
  SELECT title INTO v_place_title FROM places WHERE id = p_place_id;
  SELECT color, pattern INTO v_faction_color, v_faction_pattern FROM factions WHERE id = v_user_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('fortify', p_user_id, p_place_id, v_user_faction,
    jsonb_build_object('placeTitle', v_place_title, 'placeLatitude', v_place_lat, 'placeLongitude', v_place_lng,
      'actorName', v_actor_name, 'factionColor', v_faction_color, 'factionPattern', v_faction_pattern,
      'fortificationLevel', v_current_level + 1));

  SELECT energy_points, notoriety_points INTO v_energy, v_notoriety FROM users WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'energy', v_energy, 'notorietyPoints', v_notoriety,
    'fortificationLevel', v_current_level + 1, 'fortificationName', v_next_name,
    'cost', v_cost, 'gloryGain', v_glory_gain);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fortify_place(TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
-- ============================================
-- MIGRATION 176 : Ajouter gloryPreview dans preview_action_cost
-- ============================================
-- Retourne la Gloire projetée pour que le frontend l'affiche sous le bouton
-- Copie exacte de 171, seul ajout : lecture des settings glory + calcul

CREATE OR REPLACE FUNCTION public.preview_action_cost(
  p_user_id TEXT,
  p_place_id TEXT,
  p_action TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_fortify_level INT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_tag_reduction NUMERIC := 0;
  v_fortif_cost NUMERIC := 0;
  v_zone_cost NUMERIC := 0;
  v_same_faction_discount BOOLEAN := FALSE;
  v_total NUMERIC;
  v_energy NUMERIC;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC := 0;
  v_place_faction TEXT;
  v_user_faction TEXT;
  v_fortification INT;
  v_zone_multiplier NUMERIC;
  v_neighbor_fort NUMERIC := 0;
  v_detection_radius NUMERIC;
  v_glory_base INT;
  v_glory_cost_pct NUMERIC;
  v_glory_preview INT;
BEGIN
  -- Énergie actuelle
  SELECT energy_points, faction_id INTO v_energy, v_user_faction FROM users WHERE id = p_user_id;

  -- Lieu
  SELECT latitude, longitude, faction_id, COALESCE(fortification_level, 0)
  INTO v_place_lat, v_place_lng, v_place_faction, v_fortification
  FROM places WHERE id = p_place_id;

  -- Base cost du tag
  SELECT COALESCE(t.base_cost, 1.0) INTO v_base_cost
  FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

  -- Distance
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  -- Réduction héritage
  v_tag_reduction := get_faction_tag_reduction(p_user_id, p_place_id);

  -- Coût de base avec distance et réduction
  v_total := (v_base_cost * v_dist_mult) * (1 - v_tag_reduction / 100);

  -- Réduction même faction (discover uniquement)
  IF p_action = 'discover' AND v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
    v_total := v_total * 0.5;
    v_same_faction_discount := TRUE;
  END IF;

  -- Fortification (claim)
  IF p_action = 'claim' THEN
    v_fortif_cost := COALESCE(v_fortification, 0);

    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_fort_multiplier'), 0.5) INTO v_zone_multiplier;
    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10) INTO v_detection_radius;

    IF v_place_faction IS NOT NULL AND v_zone_multiplier > 0 THEN
      SELECT COALESCE(SUM(p2.fortification_level), 0) INTO v_neighbor_fort
      FROM places p2
      WHERE p2.faction_id = v_place_faction
        AND p2.id != p_place_id
        AND p2.fortification_level > 0
        AND sqrt(pow((p2.latitude - v_place_lat) * 111, 2) + pow((p2.longitude - v_place_lng) * 79, 2)) <= v_detection_radius;
    END IF;

    v_zone_cost := FLOOR(v_neighbor_fort * v_zone_multiplier);
  END IF;

  -- Fortification (fortify)
  IF p_action = 'fortify' AND p_fortify_level IS NOT NULL THEN
    SELECT COALESCE(ct.cost, 1) INTO v_fortif_cost
    FROM construction_types ct WHERE ct.level = p_fortify_level;
  END IF;

  v_total := v_total + v_fortif_cost + v_zone_cost;
  v_total := GREATEST(0.5, ROUND(v_total * 2) / 2.0);

  -- Projection Gloire
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key =
    CASE p_action WHEN 'discover' THEN 'glory_discover' WHEN 'claim' THEN 'glory_claim' WHEN 'fortify' THEN 'glory_fortify' END
  ), 5) INTO v_glory_base;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'glory_cost_bonus_pct'), 10) INTO v_glory_cost_pct;
  v_glory_preview := GREATEST(1, ROUND(v_glory_base + v_total * v_glory_cost_pct / 100));

  RETURN json_build_object(
    'cost', v_total,
    'energy', v_energy,
    'canAfford', v_energy >= v_total,
    'gloryPreview', v_glory_preview,
    'detail', json_build_object(
      'baseCost', v_base_cost,
      'distanceKm', ROUND(v_distance_km::NUMERIC, 1),
      'distanceMult', v_dist_mult,
      'tagReduction', v_tag_reduction,
      'sameFaction', v_same_faction_discount,
      'fortifCost', v_fortif_cost,
      'zoneCost', v_zone_cost,
      'sizeCost', 0
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_action_cost(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT) TO authenticated;
-- ============================================
-- MIGRATION 177 : Ajouter gloryGain dans les activity_log
-- ============================================
-- Le trigger claim lit glory_claim + glory_cost_bonus_pct depuis app_settings
-- et calcule une estimation du gain de Gloire pour l'afficher dans les toasts

CREATE OR REPLACE FUNCTION log_claim_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_title TEXT;
  v_place_lat DOUBLE PRECISION;
  v_place_lng DOUBLE PRECISION;
  v_faction_title TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_actor_name TEXT;
  v_glory_base INT;
  v_previous_faction TEXT;
  v_previous_actor TEXT;
  v_previous_actor_name TEXT;
BEGIN
  SELECT title, latitude, longitude, faction_id, claimed_by
  INTO v_place_title, v_place_lat, v_place_lng, v_previous_faction, v_previous_actor
  FROM places WHERE id = NEW.place_id;
  SELECT title, color, pattern INTO v_faction_title, v_faction_color, v_faction_pattern
  FROM factions WHERE id = NEW.faction_id;
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.user_id;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'glory_claim'), 5) INTO v_glory_base;

  IF v_previous_actor IS NOT NULL AND v_previous_actor != NEW.user_id THEN
    SELECT COALESCE(first_name, email_address) INTO v_previous_actor_name FROM users WHERE id = v_previous_actor;
  END IF;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'claim',
    NEW.user_id,
    NEW.place_id,
    NEW.faction_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'factionTitle', v_faction_title,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'actorName', v_actor_name,
      'gloryGain', v_glory_base,
      'previousFactionId', v_previous_faction,
      'previousActorId', v_previous_actor,
      'previousActorName', v_previous_actor_name
    )
  );
  RETURN NEW;
END;
$$;
-- ============================================
-- MIGRATION 178 : Compter les lieux veillés au lieu de l'historique place_claims
-- ============================================
-- v_claims comptait place_claims (historique incomplet)
-- On remplace par places WHERE claimed_by = user_id (lieux actuellement veillés)
-- Copie exacte de get_user_titles (051) avec cette seule ligne changée

-- Lire l'ancienne fonction pour ne changer QUE la ligne concernée
-- La fonction get_user_titles est dans 051_titles_v2.sql

-- On ne recrée que la partie stats dans get_user_titles
-- Mais get_user_titles est grosse et complexe — on va plutôt patcher via un wrapper

-- Approche simple : modifier directement la ligne dans get_user_titles
-- Pour ça il faut recréer la fonction entière...

-- Alternative minimale : créer un helper et modifier get_all_player_titles (130)
-- qui est la version utilisée par le frontend

-- Vérifié : get_all_player_titles (130) appelle get_user_titles (051) qui fait le COUNT
-- Le fix doit être dans get_user_titles

-- On recrée SEULEMENT get_user_titles en copiant l'exacte structure de 051
-- mais en changeant la ligne 112

CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_notoriety INT;
  v_displayed_ids INT[];
  v_discoveries INT;
  v_claims INT;
  v_likes INT;
  v_fortifications INT;
  v_general JSON;
  v_faction JSON;
  v_faction2 JSON;
  v_is_top BOOLEAN;
  v_top_check RECORD;
  v_general_arr JSON[] := '{}';
BEGIN
  -- ====== Stats du joueur ======
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  -- CHANGEMENT : compter les lieux actuellement veillés au lieu de l'historique place_claims
  SELECT COUNT(*) INTO v_claims FROM places WHERE claimed_by = p_user_id;
  SELECT COALESCE(notoriety_points, 0), faction_id, COALESCE(displayed_general_title_ids, '{}')
    INTO v_notoriety, v_faction_id, v_displayed_ids
    FROM users WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_likes FROM places_liked WHERE user_id = p_user_id;
  SELECT COALESCE(SUM(fortification_level), 0) INTO v_fortifications
    FROM places WHERE claimed_by = p_user_id AND fortification_level > 0;

  -- ====== Titres généraux (type = 'general') ======
  FOR v_general IN
    SELECT json_build_object(
      'id', t.id,
      'name', t.name,
      'icon', t.icon,
      'order', t."order",
      'type', 'general',
      'unlocked', CASE
        WHEN t.condition IS NULL THEN false
        WHEN t.condition->>'stat' = 'discoveries' THEN v_discoveries >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'claims' THEN v_claims >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'notoriety' THEN v_notoriety >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'likes' THEN v_likes >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'fortifications' THEN v_fortifications >= (t.condition->>'min')::INT
        ELSE false
      END
    )
    FROM titles t
    WHERE t.type = 'general'
    ORDER BY t."order"
  LOOP
    v_general_arr := array_append(v_general_arr, v_general);
  END LOOP;

  -- ====== Titre de faction (rang 2 = le + haut en notoriété) ======
  v_faction2 := NULL;
  IF v_faction_id IS NOT NULL THEN
    SELECT id, name INTO v_top_check
    FROM users
    WHERE faction_id = v_faction_id AND id != p_user_id
    ORDER BY notoriety_points DESC
    LIMIT 1;

    v_is_top := NOT FOUND OR v_notoriety >= (
      SELECT COALESCE(MAX(notoriety_points), 0)
      FROM users WHERE faction_id = v_faction_id AND id != p_user_id
    );

    IF v_is_top THEN
      SELECT json_build_object(
        'id', t.id,
        'name', t.name,
        'icon', t.icon,
        'type', 'faction'
      ) INTO v_faction2
      FROM titles t
      WHERE t.type = 'faction' AND t.faction_id = v_faction_id
      ORDER BY t."order" DESC
      LIMIT 1;
    END IF;
  END IF;

  RETURN json_build_object(
    'unlockedGeneralTitles', COALESCE((
      SELECT json_agg(elem)
      FROM unnest(v_general_arr) AS elem
      WHERE (elem->>'unlocked')::boolean = true
    ), '[]'::json),
    'displayedGeneralTitleIds', v_displayed_ids,
    'factionTitle', v_faction2,
    'stats', json_build_object(
      'discoveries', v_discoveries,
      'claims', v_claims,
      'notoriety', v_notoriety,
      'likes', v_likes,
      'fortifications', v_fortifications
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_titles(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 179 : Fix GRANT sur get_player_profile
-- ============================================
-- La migration 165 a oublié la signature (TEXT) dans le GRANT

GRANT EXECUTE ON FUNCTION public.get_player_profile(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_profile(TEXT) TO anon;
-- ============================================
-- MIGRATION 180 : Recréer get_player_profile (la 165 a été modifiée localement après application)
-- ============================================
-- Copie exacte du contenu de la migration 165 modifiée

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_titles_data JSON;
  v_displayed_v3 INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_claimed_places JSON;
  v_unlocked_ids INT[];
  v_faction_title_id INT;
BEGIN
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  -- ID du titre de faction actuel
  IF v_faction_title IS NOT NULL THEN
    v_faction_title_id := (v_faction_title->>'id')::INT;
  END IF;

  -- IDs des titres généraux débloqués
  SELECT array_agg((elem->>'id')::INT) INTO v_unlocked_ids
  FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem;
  v_unlocked_ids := COALESCE(v_unlocked_ids, '{}');

  -- Ajouter le titre de faction si existant
  IF v_faction_title_id IS NOT NULL THEN
    v_unlocked_ids := v_unlocked_ids || v_faction_title_id;
  END IF;

  SELECT COALESCE(displayed_title_ids_v3, '{}') INTO v_displayed_v3 FROM users WHERE id = p_user_id;

  IF array_length(v_displayed_v3, 1) > 0 THEN
    SELECT json_agg(row_data ORDER BY pos) INTO v_displayed_general
    FROM (
      -- Titres généraux et faction : vérifier qu'ils sont débloqués
      SELECT t.id, t.name, t.icon, NULL::TEXT AS icon_url, array_position(v_displayed_v3, t.id) AS pos
      FROM titles t WHERE t.id = ANY(v_displayed_v3) AND t.id > 0 AND t.id = ANY(v_unlocked_ids)
      UNION ALL
      -- Mots de fragment : vérifier que le fragment est possédé
      SELECT fw.id * -1 AS id, fw.word AS name, tf.icon, tf.icon_url, array_position(v_displayed_v3, fw.id * -1) AS pos
      FROM fragment_words fw JOIN title_fragments tf ON tf.id = fw.fragment_id
      WHERE (fw.id * -1) = ANY(v_displayed_v3)
        AND EXISTS (SELECT 1 FROM user_fragments uf WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id)
    ) row_data;

    -- Nettoyer les IDs invalides de displayed_title_ids_v3
    UPDATE users
    SET displayed_title_ids_v3 = (
      SELECT COALESCE(array_agg(tid), '{}')
      FROM unnest(v_displayed_v3) AS tid
      WHERE tid = ANY(v_unlocked_ids)
        OR (tid < 0 AND EXISTS (
          SELECT 1 FROM user_fragments uf
          JOIN fragment_words fw ON fw.fragment_id = uf.fragment_id
          WHERE uf.user_id = p_user_id AND fw.id * -1 = tid
        ))
    )
    WHERE id = p_user_id
      AND displayed_title_ids_v3 IS DISTINCT FROM (
        SELECT COALESCE(array_agg(tid), '{}')
        FROM unnest(v_displayed_v3) AS tid
        WHERE tid = ANY(v_unlocked_ids)
          OR (tid < 0 AND EXISTS (
            SELECT 1 FROM user_fragments uf
            JOIN fragment_words fw ON fw.fragment_id = uf.fragment_id
            WHERE uf.user_id = p_user_id AND fw.id * -1 = tid
          ))
      );
  END IF;

  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem) INTO v_displayed_general
    FROM (SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem LIMIT 1) sub;
  END IF;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_authored_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''), 'createdAt', p.created_at,
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE p.author_id = p_user_id ORDER BY p.created_at DESC LIMIT 500) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_discovered_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places_explored pe JOIN places p ON p.id = pe.place_id LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE pe.user_id = p_user_id ORDER BY pe.created_at DESC LIMIT 500) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_claimed_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE p.claimed_by = p_user_id ORDER BY p.claimed_at DESC LIMIT 500) sub;

  SELECT json_build_object(
    'userId', u.id, 'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id, 'factionTitle', f.title, 'factionColor', f.color, 'factionPattern', f.pattern,
    'profileImage', u.avatar_url, 'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places, 'discoveredPlaces', v_discovered_places, 'claimedPlaces', v_claimed_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  ) INTO v_result FROM users u LEFT JOIN factions f ON f.id = u.faction_id WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_profile(TEXT) TO anon;
-- ============================================
-- MIGRATION 181 : Drop toutes les signatures de get_player_profile et recréer
-- ============================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc
    WHERE proname = 'get_player_profile' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE'; END LOOP;
END;
$$;

-- Recréer avec la bonne signature
CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_titles_data JSON;
  v_displayed_v3 INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_claimed_places JSON;
  v_unlocked_ids INT[];
  v_faction_title_id INT;
BEGIN
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  IF v_faction_title IS NOT NULL THEN
    v_faction_title_id := (v_faction_title->>'id')::INT;
  END IF;

  SELECT array_agg((elem->>'id')::INT) INTO v_unlocked_ids
  FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem;
  v_unlocked_ids := COALESCE(v_unlocked_ids, '{}');

  IF v_faction_title_id IS NOT NULL THEN
    v_unlocked_ids := v_unlocked_ids || v_faction_title_id;
  END IF;

  SELECT COALESCE(displayed_title_ids_v3, '{}') INTO v_displayed_v3 FROM users WHERE id = p_user_id;

  IF array_length(v_displayed_v3, 1) > 0 THEN
    SELECT json_agg(row_data ORDER BY pos) INTO v_displayed_general
    FROM (
      SELECT t.id, t.name, t.icon, NULL::TEXT AS icon_url, array_position(v_displayed_v3, t.id) AS pos
      FROM titles t WHERE t.id = ANY(v_displayed_v3) AND t.id > 0 AND t.id = ANY(v_unlocked_ids)
      UNION ALL
      SELECT fw.id * -1 AS id, fw.word AS name, tf.icon, tf.icon_url, array_position(v_displayed_v3, fw.id * -1) AS pos
      FROM fragment_words fw JOIN title_fragments tf ON tf.id = fw.fragment_id
      WHERE (fw.id * -1) = ANY(v_displayed_v3)
        AND EXISTS (SELECT 1 FROM user_fragments uf WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id)
    ) row_data;

    UPDATE users
    SET displayed_title_ids_v3 = (
      SELECT COALESCE(array_agg(tid), '{}')
      FROM unnest(v_displayed_v3) AS tid
      WHERE tid = ANY(v_unlocked_ids)
        OR (tid < 0 AND EXISTS (
          SELECT 1 FROM user_fragments uf
          JOIN fragment_words fw ON fw.fragment_id = uf.fragment_id
          WHERE uf.user_id = p_user_id AND fw.id * -1 = tid
        ))
    )
    WHERE id = p_user_id
      AND displayed_title_ids_v3 IS DISTINCT FROM (
        SELECT COALESCE(array_agg(tid), '{}')
        FROM unnest(v_displayed_v3) AS tid
        WHERE tid = ANY(v_unlocked_ids)
          OR (tid < 0 AND EXISTS (
            SELECT 1 FROM user_fragments uf
            JOIN fragment_words fw ON fw.fragment_id = uf.fragment_id
            WHERE uf.user_id = p_user_id AND fw.id * -1 = tid
          ))
      );
  END IF;

  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem) INTO v_displayed_general
    FROM (SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem LIMIT 1) sub;
  END IF;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_authored_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''), 'createdAt', p.created_at,
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE p.author_id = p_user_id ORDER BY p.created_at DESC LIMIT 500) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_discovered_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places_explored pe JOIN places p ON p.id = pe.place_id LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE pe.user_id = p_user_id ORDER BY pe.created_at DESC LIMIT 500) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_claimed_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE p.claimed_by = p_user_id ORDER BY p.claimed_at DESC LIMIT 500) sub;

  SELECT json_build_object(
    'userId', u.id, 'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id, 'factionTitle', f.title, 'factionColor', f.color, 'factionPattern', f.pattern,
    'profileImage', u.avatar_url, 'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places, 'discoveredPlaces', v_discovered_places, 'claimedPlaces', v_claimed_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  ) INTO v_result FROM users u LEFT JOIN factions f ON f.id = u.faction_id WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_profile(TEXT) TO anon;
-- ============================================
-- MIGRATION 182 : Fix column "name" → "first_name" dans get_user_titles
-- ============================================
-- La migration 178 a copié "SELECT id, name FROM users" mais la colonne
-- s'appelle first_name, pas name.

CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_notoriety INT;
  v_displayed_ids INT[];
  v_discoveries INT;
  v_claims INT;
  v_likes INT;
  v_fortifications INT;
  v_general JSON;
  v_faction JSON;
  v_faction2 JSON;
  v_is_top BOOLEAN;
  v_top_check RECORD;
  v_general_arr JSON[] := '{}';
BEGIN
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_claims FROM places WHERE claimed_by = p_user_id;
  SELECT COALESCE(notoriety_points, 0), faction_id, COALESCE(displayed_general_title_ids, '{}')
    INTO v_notoriety, v_faction_id, v_displayed_ids
    FROM users WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_likes FROM places_liked WHERE user_id = p_user_id;
  SELECT COALESCE(SUM(fortification_level), 0) INTO v_fortifications
    FROM places WHERE claimed_by = p_user_id AND fortification_level > 0;

  FOR v_general IN
    SELECT json_build_object(
      'id', t.id,
      'name', t.name,
      'icon', t.icon,
      'order', t."order",
      'type', 'general',
      'unlocked', CASE
        WHEN t.condition IS NULL THEN false
        WHEN t.condition->>'stat' = 'discoveries' THEN v_discoveries >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'claims' THEN v_claims >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'notoriety' THEN v_notoriety >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'likes' THEN v_likes >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'fortifications' THEN v_fortifications >= (t.condition->>'min')::INT
        ELSE false
      END
    )
    FROM titles t
    WHERE t.type = 'general'
    ORDER BY t."order"
  LOOP
    v_general_arr := array_append(v_general_arr, v_general);
  END LOOP;

  v_faction2 := NULL;
  IF v_faction_id IS NOT NULL THEN
    SELECT id, first_name INTO v_top_check
    FROM users
    WHERE faction_id = v_faction_id AND id != p_user_id
    ORDER BY notoriety_points DESC
    LIMIT 1;

    v_is_top := NOT FOUND OR v_notoriety >= (
      SELECT COALESCE(MAX(notoriety_points), 0)
      FROM users WHERE faction_id = v_faction_id AND id != p_user_id
    );

    IF v_is_top THEN
      SELECT json_build_object(
        'id', t.id,
        'name', t.name,
        'icon', t.icon,
        'type', 'faction'
      ) INTO v_faction2
      FROM titles t
      WHERE t.type = 'faction' AND t.faction_id = v_faction_id
      ORDER BY t."order" DESC
      LIMIT 1;
    END IF;
  END IF;

  RETURN json_build_object(
    'unlockedGeneralTitles', COALESCE((
      SELECT json_agg(elem)
      FROM unnest(v_general_arr) AS elem
      WHERE (elem->>'unlocked')::boolean = true
    ), '[]'::json),
    'displayedGeneralTitleIds', v_displayed_ids,
    'factionTitle', v_faction2,
    'stats', json_build_object(
      'discoveries', v_discoveries,
      'claims', v_claims,
      'notoriety', v_notoriety,
      'likes', v_likes,
      'fortifications', v_fortifications
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_titles(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 183 : Lien Shopify ↔ Users
-- ============================================
-- Ajouter le lien vers le client Shopify sur chaque user
-- et la source du compte (app, shopify, both)

-- Lien vers le client Shopify
ALTER TABLE users ADD COLUMN IF NOT EXISTS shopify_customer_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_shopify_customer_id ON users(shopify_customer_id) WHERE shopify_customer_id IS NOT NULL;

-- Source du compte
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_source VARCHAR(20) DEFAULT 'app';
-- Valeurs : 'app' (inscrit via l'app), 'shopify' (importé de Shopify), 'both' (les deux)

-- Marquer les users existants comme source 'app'
UPDATE users SET account_source = 'app' WHERE account_source IS NULL;
-- ============================================
-- MIGRATION 184 : Corriger account_source
-- ============================================
-- 'both' = s'est connecté à l'app ET est client Shopify
-- 'shopify' = client Shopify qui ne s'est jamais connecté à l'app
-- 'app' = joueur app sans compte Shopify

-- Tous les profils avec un shopify_customer_id qui se sont connectés à l'app = 'both'
UPDATE users SET account_source = 'both'
WHERE shopify_customer_id IS NOT NULL
  AND (last_login_at IS NOT NULL OR faction_id IS NOT NULL);

-- Tous les profils avec un shopify_customer_id qui ne se sont JAMAIS connectés = 'shopify'
UPDATE users SET account_source = 'shopify'
WHERE shopify_customer_id IS NOT NULL
  AND last_login_at IS NULL
  AND faction_id IS NULL;

-- Les joueurs sans shopify = 'app'
UPDATE users SET account_source = 'app'
WHERE shopify_customer_id IS NULL;
-- ============================================
-- MIGRATION 185 : Fix account_source v2
-- ============================================
-- Le critère last_login_at/faction_id était trop strict.
-- Le vrai critère : l'ID est un UUID (créé par auth Supabase) = joueur app.
-- L'ID commence par 'shopify-' = importé de Shopify, jamais connecté.

-- Vrais joueurs app qui sont aussi clients Shopify = 'both'
UPDATE users SET account_source = 'both'
WHERE shopify_customer_id IS NOT NULL
  AND id NOT LIKE 'shopify-%';

-- Profils importés de Shopify (jamais connectés à l'app) = 'shopify'
UPDATE users SET account_source = 'shopify'
WHERE id LIKE 'shopify-%';

-- Joueurs app sans lien Shopify = 'app'
UPDATE users SET account_source = 'app'
WHERE shopify_customer_id IS NULL
  AND id NOT LIKE 'shopify-%';
-- ============================================
-- MIGRATION 186 : Restaurer le champ "unlocks" dans get_user_titles
-- ============================================
-- La migration 182 a réécrit la fonction mais a oublié le champ unlocks
-- dans le json_build_object. Résultat : le bouton "ajouter un lieu"
-- reste verrouillé car le frontend ne peut plus lire t.unlocks.

CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_notoriety INT;
  v_displayed_ids INT[];
  v_discoveries INT;
  v_claims INT;
  v_likes INT;
  v_fortifications INT;
  v_general JSON;
  v_faction JSON;
  v_faction2 JSON;
  v_is_top BOOLEAN;
  v_top_check RECORD;
  v_general_arr JSON[] := '{}';
BEGIN
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_claims FROM places WHERE claimed_by = p_user_id;
  SELECT COALESCE(notoriety_points, 0), faction_id, COALESCE(displayed_general_title_ids, '{}')
    INTO v_notoriety, v_faction_id, v_displayed_ids
    FROM users WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_likes FROM places_liked WHERE user_id = p_user_id;
  SELECT COALESCE(SUM(fortification_level), 0) INTO v_fortifications
    FROM places WHERE claimed_by = p_user_id AND fortification_level > 0;

  FOR v_general IN
    SELECT json_build_object(
      'id', t.id,
      'name', t.name,
      'icon', t.icon,
      'order', t."order",
      'type', 'general',
      'unlocks', t.unlocks,
      'unlocked', CASE
        WHEN t.condition IS NULL THEN false
        WHEN t.condition->>'stat' = 'discoveries' THEN v_discoveries >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'claims' THEN v_claims >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'notoriety' THEN v_notoriety >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'likes' THEN v_likes >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'fortifications' THEN v_fortifications >= (t.condition->>'min')::INT
        ELSE false
      END
    )
    FROM titles t
    WHERE t.type = 'general'
    ORDER BY t."order"
  LOOP
    v_general_arr := array_append(v_general_arr, v_general);
  END LOOP;

  v_faction2 := NULL;
  IF v_faction_id IS NOT NULL THEN
    SELECT id, first_name INTO v_top_check
    FROM users
    WHERE faction_id = v_faction_id AND id != p_user_id
    ORDER BY notoriety_points DESC
    LIMIT 1;

    v_is_top := NOT FOUND OR v_notoriety >= (
      SELECT COALESCE(MAX(notoriety_points), 0)
      FROM users WHERE faction_id = v_faction_id AND id != p_user_id
    );

    IF v_is_top THEN
      SELECT json_build_object(
        'id', t.id,
        'name', t.name,
        'icon', t.icon,
        'unlocks', t.unlocks,
        'type', 'faction'
      ) INTO v_faction2
      FROM titles t
      WHERE t.type = 'faction' AND t.faction_id = v_faction_id
      ORDER BY t."order" DESC
      LIMIT 1;
    END IF;
  END IF;

  RETURN json_build_object(
    'unlockedGeneralTitles', COALESCE((
      SELECT json_agg(elem)
      FROM unnest(v_general_arr) AS elem
      WHERE (elem->>'unlocked')::boolean = true
    ), '[]'::json),
    'displayedGeneralTitleIds', v_displayed_ids,
    'factionTitle', v_faction2,
    'stats', json_build_object(
      'discoveries', v_discoveries,
      'claims', v_claims,
      'notoriety', v_notoriety,
      'likes', v_likes,
      'fortifications', v_fortifications
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_titles(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 187 : Fix regen fantôme au max d'énergie
-- ============================================
-- Bug : energy_reset_at n'avançait jamais quand le joueur était au max.
-- Après une action, le prochain get_user_energy voyait un timestamp périmé
-- et régénérait instantanément des points fantômes.
-- Fix : avancer energy_reset_at dès que des ticks sont passés, même au max.

CREATE OR REPLACE FUNCTION public.get_user_energy(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy NUMERIC(6,1);
  v_max_energy NUMERIC(4,1);
  v_energy_reset TIMESTAMPTZ;
  v_conquest NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1);
  v_conquest_reset TIMESTAMPTZ;
  v_construction NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_construction_reset TIMESTAMPTZ;
  v_vitalite NUMERIC(6,1);
  v_max_vitalite NUMERIC(6,1);
  v_vitalite_reset TIMESTAMPTZ;
  v_notoriety INT;
  v_faction_id TEXT;
  -- Bonus faction
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
  v_bonus_vitalite NUMERIC(6,1);
  v_bonus_regen_energy NUMERIC(4,1);
  v_bonus_regen_conquest NUMERIC(4,1);
  v_bonus_regen_construction NUMERIC(4,1);
  v_bonus_regen_vitalite NUMERIC(4,1);
  -- Fragment bonuses
  v_frag_max_energy NUMERIC := 0;
  v_frag_max_conquest NUMERIC := 0;
  v_frag_max_construction NUMERIC := 0;
  v_frag_max_vitalite NUMERIC := 0;
  v_frag_regen_energy NUMERIC := 0;
  v_frag_regen_conquest NUMERIC := 0;
  v_frag_regen_construction NUMERIC := 0;
  v_frag_regen_vitalite NUMERIC := 0;
  -- Base cycles (from app_settings)
  v_base_energy_cycle INT;
  v_base_conquest_cycle INT;
  v_base_construction_cycle INT;
  v_base_vitalite_cycle INT;
  -- Computed cycles
  v_energy_cycle INT;
  v_conquest_cycle INT;
  v_construction_cycle INT;
  v_vitalite_cycle INT;
  -- Regen
  v_elapsed INT;
  v_ticks INT;
  v_add NUMERIC;
  v_next_point INT;
  -- Underdog
  v_is_underdog BOOLEAN := FALSE;
  v_underdog_mult NUMERIC := 1;
BEGIN
  -- Lire les cycles de base depuis app_settings
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'energy_base_cycle'), 7200) INTO v_base_energy_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'conquest_base_cycle'), 14400) INTO v_base_conquest_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'construction_base_cycle'), 14400) INTO v_base_construction_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'vitalite_base_cycle'), 14400) INTO v_base_vitalite_cycle;

  -- Charger utilisateur
  SELECT energy_points, max_energy, energy_reset_at,
         conquest_points, max_conquest, conquest_reset_at,
         construction_points, max_construction, construction_reset_at,
         COALESCE(vitalite_points, 3), COALESCE(max_vitalite, 3), COALESCE(vitalite_reset_at, NOW()),
         COALESCE(notoriety_points, 0), faction_id
  INTO v_energy, v_max_energy, v_energy_reset,
       v_conquest, v_max_conquest, v_conquest_reset,
       v_construction, v_max_construction, v_construction_reset,
       v_vitalite, v_max_vitalite, v_vitalite_reset,
       v_notoriety, v_faction_id
  FROM users WHERE id = p_user_id;

  -- Charger bonus faction
  IF v_faction_id IS NOT NULL THEN
    SELECT COALESCE(bonus_energy, 0), COALESCE(bonus_conquest, 0),
           COALESCE(bonus_construction, 0), COALESCE(bonus_vitalite, 0),
           COALESCE(bonus_regen_energy, 0), COALESCE(bonus_regen_conquest, 0),
           COALESCE(bonus_regen_construction, 0), COALESCE(bonus_regen_vitalite, 0)
    INTO v_bonus_energy, v_bonus_conquest, v_bonus_construction, v_bonus_vitalite,
         v_bonus_regen_energy, v_bonus_regen_conquest, v_bonus_regen_construction, v_bonus_regen_vitalite
    FROM factions WHERE id = v_faction_id;
  ELSE
    v_bonus_energy := 0; v_bonus_conquest := 0; v_bonus_construction := 0; v_bonus_vitalite := 0;
    v_bonus_regen_energy := 0; v_bonus_regen_conquest := 0; v_bonus_regen_construction := 0; v_bonus_regen_vitalite := 0;
  END IF;

  -- Charger bonus fragments
  SELECT
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_construction' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_vitalite' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_construction' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_vitalite' THEN tf.bonus_value ELSE 0 END), 0)
  INTO v_frag_max_energy, v_frag_max_conquest, v_frag_max_construction, v_frag_max_vitalite,
       v_frag_regen_energy, v_frag_regen_conquest, v_frag_regen_construction, v_frag_regen_vitalite
  FROM user_fragments uf
  JOIN title_fragments tf ON tf.id = uf.fragment_id
  WHERE uf.user_id = p_user_id AND tf.bonus_type IS NOT NULL;

  -- Appliquer les bonus au max
  v_max_energy := GREATEST(1, v_max_energy + v_bonus_energy + v_frag_max_energy);
  v_max_conquest := GREATEST(1, v_max_conquest + v_bonus_conquest + v_frag_max_conquest);
  v_max_construction := GREATEST(1, v_max_construction + v_bonus_construction + v_frag_max_construction);
  v_max_vitalite := GREATEST(1, v_max_vitalite + v_bonus_vitalite + v_frag_max_vitalite);

  -- Calculer les cycles avec bonus (à partir des cycles de base configurables)
  v_energy_cycle := GREATEST(600, (v_base_energy_cycle * (100 - v_bonus_regen_energy - v_frag_regen_energy) / 100)::INT);
  v_conquest_cycle := GREATEST(600, (v_base_conquest_cycle * (100 - v_bonus_regen_conquest - v_frag_regen_conquest) / 100)::INT);
  v_construction_cycle := GREATEST(600, (v_base_construction_cycle * (100 - v_bonus_regen_construction - v_frag_regen_construction) / 100)::INT);
  v_vitalite_cycle := GREATEST(600, (v_base_vitalite_cycle * (100 - v_bonus_regen_vitalite - v_frag_regen_vitalite) / 100)::INT);

  -- Underdog
  SELECT id = v_faction_id INTO v_is_underdog FROM (SELECT get_underdog_faction_id() AS id) sub;
  IF v_is_underdog THEN
    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'underdog_multiplier'), 2)
    INTO v_underdog_mult;
    v_energy_cycle := GREATEST(300, (v_energy_cycle / v_underdog_mult)::INT);
    v_conquest_cycle := GREATEST(300, (v_conquest_cycle / v_underdog_mult)::INT);
    v_construction_cycle := GREATEST(300, (v_construction_cycle / v_underdog_mult)::INT);
    v_vitalite_cycle := GREATEST(300, (v_vitalite_cycle / v_underdog_mult)::INT);
  END IF;

  -- Regen Energy (FIX: avancer energy_reset_at même au max)
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_energy_cycle);
  v_add := LEAST(v_ticks, v_max_energy - v_energy);
  IF v_ticks > 0 THEN
    v_energy_reset := v_energy_reset + (v_ticks * v_energy_cycle * INTERVAL '1 second');
    IF v_add > 0 THEN
      v_energy := LEAST(v_energy + v_add, v_max_energy);
    END IF;
    UPDATE users SET energy_points = v_energy, energy_reset_at = v_energy_reset WHERE id = p_user_id;
  END IF;
  v_next_point := v_energy_cycle - (EXTRACT(EPOCH FROM (NOW() - v_energy_reset))::INT % v_energy_cycle);

  -- Regen Conquest (FIX: même pattern)
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_conquest_cycle);
  v_add := LEAST(v_ticks, v_max_conquest - v_conquest);
  IF v_ticks > 0 THEN
    v_conquest_reset := v_conquest_reset + (v_ticks * v_conquest_cycle * INTERVAL '1 second');
    IF v_add > 0 THEN
      v_conquest := LEAST(v_conquest + v_add, v_max_conquest);
    END IF;
    UPDATE users SET conquest_points = v_conquest, conquest_reset_at = v_conquest_reset WHERE id = p_user_id;
  END IF;

  -- Regen Construction (FIX: même pattern)
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_construction_cycle);
  v_add := LEAST(v_ticks, v_max_construction - v_construction);
  IF v_ticks > 0 THEN
    v_construction_reset := v_construction_reset + (v_ticks * v_construction_cycle * INTERVAL '1 second');
    IF v_add > 0 THEN
      v_construction := LEAST(v_construction + v_add, v_max_construction);
    END IF;
    UPDATE users SET construction_points = v_construction, construction_reset_at = v_construction_reset WHERE id = p_user_id;
  END IF;

  -- Regen Vitalite (FIX: même pattern)
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_vitalite_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_vitalite_cycle);
  v_add := LEAST(v_ticks, v_max_vitalite - v_vitalite);
  IF v_ticks > 0 THEN
    v_vitalite_reset := v_vitalite_reset + (v_ticks * v_vitalite_cycle * INTERVAL '1 second');
    IF v_add > 0 THEN
      v_vitalite := LEAST(v_vitalite + v_add, v_max_vitalite);
    END IF;
    UPDATE users SET vitalite_points = v_vitalite, vitalite_reset_at = v_vitalite_reset WHERE id = p_user_id;
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'nextPointIn', v_next_point,
    'energyCycle', v_energy_cycle,
    'conquestPoints', v_conquest,
    'maxConquest', v_max_conquest,
    'conquestNextPointIn', v_conquest_cycle - (EXTRACT(EPOCH FROM (NOW() - v_conquest_reset))::INT % v_conquest_cycle),
    'conquestCycle', v_conquest_cycle,
    'constructionPoints', v_construction,
    'maxConstruction', v_max_construction,
    'constructionNextPointIn', v_construction_cycle - (EXTRACT(EPOCH FROM (NOW() - v_construction_reset))::INT % v_construction_cycle),
    'constructionCycle', v_construction_cycle,
    'vitalitePoints', v_vitalite,
    'maxVitalite', v_max_vitalite,
    'vitaliteNextPointIn', v_vitalite_cycle - (EXTRACT(EPOCH FROM (NOW() - v_vitalite_reset))::INT % v_vitalite_cycle),
    'vitaliteCycle', v_vitalite_cycle,
    'notorietyPoints', v_notoriety,
    'bonusEnergy', v_bonus_energy + v_frag_max_energy,
    'bonusConquest', v_bonus_conquest + v_frag_max_conquest,
    'bonusConstruction', v_bonus_construction + v_frag_max_construction,
    'bonusVitalite', v_bonus_vitalite + v_frag_max_vitalite,
    'isUnderdog', v_is_underdog,
    'underdogMultiplier', v_underdog_mult
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_energy(TEXT) TO authenticated;
-- Étendre le CHECK constraint sur purchase_log.status
-- pour supporter les nouveaux statuts du webhook : skipped, no_match, no_tags
ALTER TABLE purchase_log DROP CONSTRAINT IF EXISTS purchase_log_status_check;
ALTER TABLE purchase_log ADD CONSTRAINT purchase_log_status_check
  CHECK (status IN ('unlocked', 'pending', 'manual', 'skipped', 'no_match', 'no_tags'));
-- ============================================
-- MIGRATION 189 : handle_new_user — FIX URGENT v3
-- ============================================
-- Bug critique : "Database error saving new user" pour les anciens membres.
-- La version 078 de handle_new_user est obsolete : il manque les FK
-- ajoutees depuis (territory_*, user_fragments, fragment_ability_uses,
-- purchase_log) + les nouvelles colonnes (vitalite_*, shopify_*, account_source).
--
-- Causes du crash :
-- 1. territory_name_proposals et territory_name_votes referent users(id)
--    SANS ON DELETE CASCADE → le DELETE de l'ancien user echoue.
-- 2. L'EXCEPTION handler inserait email='' → UNIQUE violation si un
--    ghost user existait deja avec email=''.
-- 3. user_fragments, fragment_ability_uses CASCADE-deleted = perte data.
-- 4. Colonnes vitalite/shopify non copiees lors de la migration.
--
-- Fix :
-- 1. Migrer TOUTES les FK (y compris les nouvelles tables)
-- 2. Copier TOUTES les colonnes actuelles
-- 3. Fallback email = unique hash pour eviter les conflits
-- ============================================

-- D'abord, nettoyer les ghost users avec email vide (restes de migrations echouees)
-- On les supprime seulement s'ils n'ont aucune donnee associee
DELETE FROM public.users
WHERE email_address = ''
  AND id NOT IN (SELECT DISTINCT user_id FROM places_discovered)
  AND id NOT IN (SELECT DISTINCT author_id FROM places WHERE author_id IS NOT NULL)
  AND id NOT IN (SELECT DISTINCT claimed_by FROM places WHERE claimed_by IS NOT NULL)
  AND id NOT IN (SELECT DISTINCT user_id FROM chat_messages)
  AND id NOT IN (SELECT user_id FROM user_fragments);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_err TEXT;
  v_max_e NUMERIC(4,1);
  v_max_c NUMERIC(6,1);
  v_max_b NUMERIC(6,1);
BEGIN
  -- Chercher si un user avec cet email existe deja
  SELECT * INTO v_existing
  FROM public.users
  WHERE LOWER(email_address) = LOWER(COALESCE(NEW.email, ''))
  LIMIT 1;

  IF v_existing.id IS NOT NULL AND v_existing.id != NEW.id::TEXT THEN
    -- =============================================
    -- ANCIEN COMPTE PRE-SUPABASE : migrer vers le nouvel auth ID
    -- =============================================
    BEGIN
      -- 0) Vider l'email et shopify_customer_id de l'ancien user pour liberer les index uniques
      UPDATE public.users SET email_address = '', shopify_customer_id = NULL WHERE id = v_existing.id;

      -- 1) Creer un nouveau user avec le nouvel ID (copie COMPLETE de l'ancien)
      INSERT INTO public.users (
        id, email_address, first_name, gender, rank, role, bio,
        avatar_url, display_name, instagram, location_name, location_zip,
        faction_id, energy_points, energy_reset_at,
        conquest_points, conquest_reset_at,
        construction_points, construction_reset_at,
        max_energy, max_conquest, max_construction,
        vitalite_points, max_vitalite, vitalite_reset_at,
        notoriety_points, displayed_general_title_ids,
        displayed_title_ids_v3, game_mode,
        shopify_customer_id, account_source,
        is_active, website_url,
        created_at, updated_at
      )
      SELECT
        NEW.id::TEXT,
        v_existing.email_address,
        v_existing.first_name,
        v_existing.gender,
        v_existing.rank,
        v_existing.role,
        v_existing.bio,
        v_existing.avatar_url,
        v_existing.display_name,
        v_existing.instagram,
        v_existing.location_name,
        v_existing.location_zip,
        v_existing.faction_id,
        v_existing.energy_points,
        v_existing.energy_reset_at,
        v_existing.conquest_points,
        v_existing.conquest_reset_at,
        v_existing.construction_points,
        v_existing.construction_reset_at,
        v_existing.max_energy,
        v_existing.max_conquest,
        v_existing.max_construction,
        COALESCE(v_existing.vitalite_points, 5),
        COALESCE(v_existing.max_vitalite, 5),
        COALESCE(v_existing.vitalite_reset_at, NOW()),
        v_existing.notoriety_points,
        v_existing.displayed_general_title_ids,
        v_existing.displayed_title_ids_v3,
        v_existing.game_mode,
        v_existing.shopify_customer_id,
        v_existing.account_source,
        v_existing.is_active,
        v_existing.website_url,
        v_existing.created_at,
        NOW()
      ON CONFLICT (id) DO NOTHING;

      -- 2) Migrer TOUTES les FK de l'ancien ID vers le nouveau
      -- === Tables originales (depuis 078) ===
      UPDATE places_discovered SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE place_claims SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE chat_messages SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_viewed SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_liked SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_explored SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_bookmarked SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE reviews SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE image_media SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE member_codes SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_community_photos SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_photo_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_review_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_community_photos SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE hub_photo_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE hub_review_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE places SET author_id = NEW.id::TEXT WHERE author_id = v_existing.id;
      UPDATE places SET claimed_by = NEW.id::TEXT WHERE claimed_by = v_existing.id;
      UPDATE activity_log SET actor_id = NEW.id::TEXT WHERE actor_id = v_existing.id;
      UPDATE place_claims SET previous_claimed_by = NEW.id::TEXT WHERE previous_claimed_by = v_existing.id;

      -- === NOUVELLES TABLES (ajoutees apres 078) ===
      UPDATE territory_name_proposals SET proposed_by = NEW.id::TEXT WHERE proposed_by = v_existing.id;
      UPDATE territory_name_votes SET voter_id = NEW.id::TEXT WHERE voter_id = v_existing.id;
      UPDATE user_fragments SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE fragment_ability_uses SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE purchase_log SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;

      -- 3) Supprimer l'ancien doublon (email deja vide, FKs migrees)
      DELETE FROM public.users WHERE id = v_existing.id;

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE WARNING '[handle_new_user] Migration failed for % (old_id=%, new_id=%): %',
        NEW.email, v_existing.id, NEW.id, v_err;

      -- Fallback : creer un user basique avec email UNIQUE (pas '' qui peut conflictuer)
      INSERT INTO public.users (id, email_address, first_name, gender, rank, role, bio, created_at, updated_at)
      VALUES (
        NEW.id::TEXT,
        '__migrated_' || NEW.id::TEXT,
        COALESCE(v_existing.first_name, 'Aventurier'),
        COALESCE(v_existing.gender, 'unknown'),
        COALESCE(v_existing.rank, 'guest'),
        COALESCE(v_existing.role, 'user'),
        COALESCE(v_existing.bio, ''),
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    END;

  ELSE
    -- =============================================
    -- PAS DE DOUBLON : insert normal
    -- =============================================
    SELECT max_energy, max_conquest, max_construction
    INTO v_max_e, v_max_c, v_max_b
    FROM public.users
    WHERE role = 'user'
    ORDER BY created_at ASC
    LIMIT 1;

    v_max_e := COALESCE(v_max_e, 5.0);
    v_max_c := COALESCE(v_max_c, 5.0);
    v_max_b := COALESCE(v_max_b, 5.0);

    INSERT INTO public.users (
      id, email_address, gender, rank, role, bio,
      max_energy, max_conquest, max_construction,
      energy_points, conquest_points, construction_points,
      energy_reset_at, conquest_reset_at, construction_reset_at,
      created_at, updated_at
    )
    VALUES (
      NEW.id::TEXT,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'gender', 'unknown'),
      'guest', 'user', '',
      v_max_e, v_max_c, v_max_b,
      v_max_e, v_max_c, v_max_b,
      NOW(), NOW(), NOW(),
      NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email_address = COALESCE(EXCLUDED.email_address, public.users.email_address),
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;
-- ============================================
-- MIGRATION 190 : Migration d'ancien compte au login
-- ============================================
-- Le trigger handle_new_user ne se re-declenche jamais apres le
-- premier signup. Les anciens comptes dont la migration a echoue
-- sont bloques : users.id = Firebase ID, auth.uid() = Supabase UUID.
-- Resultat : RLS crash sur chat_messages, places_discovered, etc.
--
-- Cette RPC est appelee par usePlayer.ts quand il detecte un mismatch
-- entre auth.uid() et users.id. Elle migre l'ancien compte vers le
-- nouvel UUID Supabase, en toute securite.
-- ============================================

CREATE OR REPLACE FUNCTION public.migrate_user_to_auth_id(
  p_old_id TEXT,
  p_new_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_err TEXT;
BEGIN
  -- Securite : seul l'utilisateur authentifie peut migrer son propre compte
  IF auth.uid()::TEXT != p_new_id THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  -- Verifier que l'ancien user existe
  SELECT email_address INTO v_email FROM public.users WHERE id = p_old_id;
  IF v_email IS NULL THEN
    RETURN json_build_object('error', 'old_user_not_found');
  END IF;

  -- Verifier qu'un user avec le nouvel ID n'existe pas deja
  -- (sauf les ghosts __migrated_ qu'on va supprimer)
  DELETE FROM public.users
  WHERE id = p_new_id
    AND (email_address LIKE '__migrated_%' OR email_address = '');

  -- Vider l'email et shopify_customer_id de l'ancien pour liberer les index uniques
  UPDATE public.users SET email_address = '', shopify_customer_id = NULL WHERE id = p_old_id;

  -- Inserer le nouveau user avec copie complete
  INSERT INTO public.users (
    id, email_address, first_name, gender, rank, role, bio,
    avatar_url, display_name, instagram, location_name, location_zip,
    faction_id, energy_points, energy_reset_at,
    conquest_points, conquest_reset_at,
    construction_points, construction_reset_at,
    max_energy, max_conquest, max_construction,
    vitalite_points, max_vitalite, vitalite_reset_at,
    notoriety_points, displayed_general_title_ids,
    displayed_title_ids_v3, game_mode,
    shopify_customer_id, account_source,
    is_active, website_url,
    created_at, updated_at
  )
  SELECT
    p_new_id,
    v_email,
    first_name, gender, rank, role, bio,
    avatar_url, display_name, instagram, location_name, location_zip,
    faction_id, energy_points, energy_reset_at,
    conquest_points, conquest_reset_at,
    construction_points, construction_reset_at,
    max_energy, max_conquest, max_construction,
    COALESCE(vitalite_points, 5), COALESCE(max_vitalite, 5), COALESCE(vitalite_reset_at, NOW()),
    notoriety_points, displayed_general_title_ids,
    displayed_title_ids_v3, game_mode,
    shopify_customer_id, account_source,
    is_active, website_url,
    created_at, NOW()
  FROM public.users WHERE id = p_old_id
  ON CONFLICT (id) DO NOTHING;

  -- Migrer TOUTES les FK
  UPDATE places_discovered SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE place_claims SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE chat_messages SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_viewed SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_liked SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_explored SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_bookmarked SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE reviews SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE image_media SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE member_codes SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_community_photos SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_photo_submissions SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_review_submissions SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_community_photos SET moderated_by = p_new_id WHERE moderated_by = p_old_id;
  UPDATE hub_photo_submissions SET moderated_by = p_new_id WHERE moderated_by = p_old_id;
  UPDATE hub_review_submissions SET moderated_by = p_new_id WHERE moderated_by = p_old_id;
  UPDATE places SET author_id = p_new_id WHERE author_id = p_old_id;
  UPDATE places SET claimed_by = p_new_id WHERE claimed_by = p_old_id;
  UPDATE activity_log SET actor_id = p_new_id WHERE actor_id = p_old_id;
  UPDATE place_claims SET previous_claimed_by = p_new_id WHERE previous_claimed_by = p_old_id;
  -- Tables ajoutees apres 078
  UPDATE territory_name_proposals SET proposed_by = p_new_id WHERE proposed_by = p_old_id;
  UPDATE territory_name_votes SET voter_id = p_new_id WHERE voter_id = p_old_id;
  UPDATE user_fragments SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE fragment_ability_uses SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE purchase_log SET user_id = p_new_id WHERE user_id = p_old_id;

  -- Supprimer l'ancien
  DELETE FROM public.users WHERE id = p_old_id;

  RETURN json_build_object('success', true, 'migrated_from', p_old_id, 'migrated_to', p_new_id);

EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
  RAISE WARNING '[migrate_user_to_auth_id] Failed: %', v_err;
  RETURN json_build_object('error', v_err);
END;
$$;

GRANT EXECUTE ON FUNCTION public.migrate_user_to_auth_id(TEXT, TEXT) TO authenticated;
-- ============================================
-- MIGRATION 191 : Fix titres faction par rang
-- ============================================
-- Bug : get_user_titles ne donnait un titre faction qu'au joueur #1.
-- Les titres avec condition.rank > 1 (ex: Prélat = Top 5) n'étaient
-- jamais attribués.
--
-- Fix : calculer le rang du joueur dans sa faction, puis lui attribuer
-- le titre le plus élevé dont il remplit la condition de rang.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_notoriety INT;
  v_displayed_ids INT[];
  v_discoveries INT;
  v_claims INT;
  v_likes INT;
  v_fortifications INT;
  v_general JSON;
  v_faction2 JSON;
  v_general_arr JSON[] := '{}';
  v_player_rank INT;
BEGIN
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_claims FROM places WHERE claimed_by = p_user_id;
  SELECT COALESCE(notoriety_points, 0), faction_id, COALESCE(displayed_general_title_ids, '{}')
    INTO v_notoriety, v_faction_id, v_displayed_ids
    FROM users WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_likes FROM places_liked WHERE user_id = p_user_id;
  SELECT COALESCE(SUM(fortification_level), 0) INTO v_fortifications
    FROM places WHERE claimed_by = p_user_id AND fortification_level > 0;

  -- Titres généraux (inchangé)
  FOR v_general IN
    SELECT json_build_object(
      'id', t.id,
      'name', t.name,
      'icon', t.icon,
      'order', t."order",
      'type', 'general',
      'unlocked', CASE
        WHEN t.condition IS NULL THEN false
        WHEN t.condition->>'stat' = 'discoveries' THEN v_discoveries >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'claims' THEN v_claims >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'notoriety' THEN v_notoriety >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'likes' THEN v_likes >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'fortifications' THEN v_fortifications >= (t.condition->>'min')::INT
        ELSE false
      END
    )
    FROM titles t
    WHERE t.type = 'general'
    ORDER BY t."order"
  LOOP
    v_general_arr := array_append(v_general_arr, v_general);
  END LOOP;

  -- Titre faction : basé sur le rang réel du joueur
  v_faction2 := NULL;
  IF v_faction_id IS NOT NULL THEN
    -- Calculer le rang du joueur dans sa faction (par notoriété DESC)
    SELECT rk INTO v_player_rank
    FROM (
      SELECT id, RANK() OVER (ORDER BY COALESCE(notoriety_points, 0) DESC) AS rk
      FROM users
      WHERE faction_id = v_faction_id
    ) ranked
    WHERE id = p_user_id;

    -- Trouver le titre le plus élevé dont le joueur remplit la condition de rang
    -- Ex: rang 3 → remplit "rank: 5" (Top 5) mais pas "rank: 1" (Top 1)
    SELECT json_build_object(
      'id', t.id,
      'name', t.name,
      'icon', t.icon,
      'type', 'faction'
    ) INTO v_faction2
    FROM titles t
    WHERE t.type = 'faction'
      AND t.faction_id = v_faction_id
      AND t.condition IS NOT NULL
      AND (t.condition->>'rank') IS NOT NULL
      AND v_player_rank <= (t.condition->>'rank')::INT
    ORDER BY t."order" DESC
    LIMIT 1;
  END IF;

  RETURN json_build_object(
    'unlockedGeneralTitles', COALESCE((
      SELECT json_agg(elem)
      FROM unnest(v_general_arr) AS elem
      WHERE (elem->>'unlocked')::boolean = true
    ), '[]'::json),
    'displayedGeneralTitleIds', v_displayed_ids,
    'factionTitle', v_faction2,
    'stats', json_build_object(
      'discoveries', v_discoveries,
      'claims', v_claims,
      'notoriety', v_notoriety,
      'likes', v_likes,
      'fortifications', v_fortifications
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_titles(TEXT) TO authenticated;
-- ============================================
-- MIGRATION 192 : Supprimer account_source = 'both'
-- ============================================
-- La source indique D'OU vient le compte : 'app' ou 'shopify'.
-- 'both' n'a pas de sens — un compte est créé à UN endroit.
-- Le lien Shopify se voit via shopify_customer_id (non null = client).
--
-- Règle : si l'id commence par 'shopify-' → source shopify, sinon → app.
-- ============================================

-- Corriger tous les 'both' : la vraie source dépend de comment l'ID a été créé
UPDATE users SET account_source = 'shopify' WHERE account_source = 'both' AND id LIKE 'shopify-%';
UPDATE users SET account_source = 'app' WHERE account_source = 'both' AND id NOT LIKE 'shopify-%';

-- Sécurité : mettre à jour le CHECK constraint pour interdire 'both'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_source_check;
ALTER TABLE users ADD CONSTRAINT users_account_source_check
  CHECK (account_source IN ('app', 'shopify'));
-- ============================================
-- MIGRATION 193 : Restaurer le champ "unlocks" dans get_user_titles (bis)
-- ============================================
-- La migration 191 a réécrit get_user_titles mais a ENCORE oublié le
-- champ unlocks dans les json_build_object (même bug que la 182/186).
-- Résultat : le bouton "ajouter un lieu" reste verrouillé car le
-- frontend ne peut plus lire t.unlocks.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_notoriety INT;
  v_displayed_ids INT[];
  v_discoveries INT;
  v_claims INT;
  v_likes INT;
  v_fortifications INT;
  v_general JSON;
  v_faction2 JSON;
  v_general_arr JSON[] := '{}';
  v_player_rank INT;
BEGIN
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_claims FROM places WHERE claimed_by = p_user_id;
  SELECT COALESCE(notoriety_points, 0), faction_id, COALESCE(displayed_general_title_ids, '{}')
    INTO v_notoriety, v_faction_id, v_displayed_ids
    FROM users WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_likes FROM places_liked WHERE user_id = p_user_id;
  SELECT COALESCE(SUM(fortification_level), 0) INTO v_fortifications
    FROM places WHERE claimed_by = p_user_id AND fortification_level > 0;

  -- Titres généraux
  -- ⚠️ NE PAS OUBLIER 'unlocks' ci-dessous — le bouton "ajouter un lieu" en dépend (bug 182, 186, 191, 193)
  FOR v_general IN
    SELECT json_build_object(
      'id', t.id,
      'name', t.name,
      'icon', t.icon,
      'unlocks', t.unlocks,  -- ← CRITIQUE : sans ça le bouton add_place est grisé
      'order', t."order",
      'type', 'general',
      'unlocked', CASE
        WHEN t.condition IS NULL THEN false
        WHEN t.condition->>'stat' = 'discoveries' THEN v_discoveries >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'claims' THEN v_claims >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'notoriety' THEN v_notoriety >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'likes' THEN v_likes >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'fortifications' THEN v_fortifications >= (t.condition->>'min')::INT
        ELSE false
      END
    )
    FROM titles t
    WHERE t.type = 'general'
    ORDER BY t."order"
  LOOP
    v_general_arr := array_append(v_general_arr, v_general);
  END LOOP;

  -- Titre faction : basé sur le rang réel du joueur
  v_faction2 := NULL;
  IF v_faction_id IS NOT NULL THEN
    SELECT rk INTO v_player_rank
    FROM (
      SELECT id, RANK() OVER (ORDER BY COALESCE(notoriety_points, 0) DESC) AS rk
      FROM users
      WHERE faction_id = v_faction_id
    ) ranked
    WHERE id = p_user_id;

    -- ⚠️ NE PAS OUBLIER 'unlocks' ci-dessous (même raison que pour les titres généraux)
    SELECT json_build_object(
      'id', t.id,
      'name', t.name,
      'icon', t.icon,
      'unlocks', t.unlocks,  -- ← CRITIQUE
      'type', 'faction'
    ) INTO v_faction2
    FROM titles t
    WHERE t.type = 'faction'
      AND t.faction_id = v_faction_id
      AND t.condition IS NOT NULL
      AND (t.condition->>'rank') IS NOT NULL
      AND v_player_rank <= (t.condition->>'rank')::INT
    ORDER BY t."order" DESC
    LIMIT 1;
  END IF;

  RETURN json_build_object(
    'unlockedGeneralTitles', COALESCE((
      SELECT json_agg(elem)
      FROM unnest(v_general_arr) AS elem
      WHERE (elem->>'unlocked')::boolean = true
    ), '[]'::json),
    'displayedGeneralTitleIds', v_displayed_ids,
    'factionTitle', v_faction2,
    'stats', json_build_object(
      'discoveries', v_discoveries,
      'claims', v_claims,
      'notoriety', v_notoriety,
      'likes', v_likes,
      'fortifications', v_fortifications
    )
  );
END;
$$;
-- ============================================
-- MIGRATION 194 : Ajouter condition "places_added" pour les titres
-- ============================================
-- Permet de décerner un titre en fonction du nombre de lieux créés
-- par un joueur (places.author_id).
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_notoriety INT;
  v_displayed_ids INT[];
  v_discoveries INT;
  v_claims INT;
  v_likes INT;
  v_fortifications INT;
  v_places_added INT;
  v_general JSON;
  v_faction2 JSON;
  v_general_arr JSON[] := '{}';
  v_player_rank INT;
BEGIN
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_claims FROM places WHERE claimed_by = p_user_id;
  SELECT COALESCE(notoriety_points, 0), faction_id, COALESCE(displayed_general_title_ids, '{}')
    INTO v_notoriety, v_faction_id, v_displayed_ids
    FROM users WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_likes FROM places_liked WHERE user_id = p_user_id;
  SELECT COALESCE(SUM(fortification_level), 0) INTO v_fortifications
    FROM places WHERE claimed_by = p_user_id AND fortification_level > 0;
  SELECT COUNT(*) INTO v_places_added FROM places WHERE author_id = p_user_id;

  -- Titres généraux
  -- ⚠️ NE PAS OUBLIER 'unlocks' ci-dessous — le bouton "ajouter un lieu" en dépend (bug 182, 186, 191, 193)
  FOR v_general IN
    SELECT json_build_object(
      'id', t.id,
      'name', t.name,
      'icon', t.icon,
      'unlocks', t.unlocks,  -- ← CRITIQUE : sans ça le bouton add_place est grisé
      'order', t."order",
      'type', 'general',
      'unlocked', CASE
        WHEN t.condition IS NULL THEN false
        WHEN t.condition->>'stat' = 'discoveries' THEN v_discoveries >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'claims' THEN v_claims >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'notoriety' THEN v_notoriety >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'likes' THEN v_likes >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'fortifications' THEN v_fortifications >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'places_added' THEN v_places_added >= (t.condition->>'min')::INT
        ELSE false
      END
    )
    FROM titles t
    WHERE t.type = 'general'
    ORDER BY t."order"
  LOOP
    v_general_arr := array_append(v_general_arr, v_general);
  END LOOP;

  -- Titre faction : basé sur le rang réel du joueur
  v_faction2 := NULL;
  IF v_faction_id IS NOT NULL THEN
    SELECT rk INTO v_player_rank
    FROM (
      SELECT id, RANK() OVER (ORDER BY COALESCE(notoriety_points, 0) DESC) AS rk
      FROM users
      WHERE faction_id = v_faction_id
    ) ranked
    WHERE id = p_user_id;

    -- ⚠️ NE PAS OUBLIER 'unlocks' ci-dessous (même raison que pour les titres généraux)
    SELECT json_build_object(
      'id', t.id,
      'name', t.name,
      'icon', t.icon,
      'unlocks', t.unlocks,  -- ← CRITIQUE
      'type', 'faction'
    ) INTO v_faction2
    FROM titles t
    WHERE t.type = 'faction'
      AND t.faction_id = v_faction_id
      AND t.condition IS NOT NULL
      AND (t.condition->>'rank') IS NOT NULL
      AND v_player_rank <= (t.condition->>'rank')::INT
    ORDER BY t."order" DESC
    LIMIT 1;
  END IF;

  RETURN json_build_object(
    'unlockedGeneralTitles', COALESCE((
      SELECT json_agg(elem)
      FROM unnest(v_general_arr) AS elem
      WHERE (elem->>'unlocked')::boolean = true
    ), '[]'::json),
    'displayedGeneralTitleIds', v_displayed_ids,
    'factionTitle', v_faction2,
    'stats', json_build_object(
      'discoveries', v_discoveries,
      'claims', v_claims,
      'notoriety', v_notoriety,
      'likes', v_likes,
      'fortifications', v_fortifications,
      'places_added', v_places_added
    )
  );
END;
$$;
