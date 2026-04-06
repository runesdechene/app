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
