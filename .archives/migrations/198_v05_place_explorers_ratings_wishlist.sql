-- 198_v05_place_explorers_ratings_wishlist.sql
-- V0.5 : Hall of Fame (explorateurs GPS), notes, wishlist

-- Explorateurs = joueurs vérifiés GPS sur un lieu
CREATE TABLE IF NOT EXISTS place_explorers (
  id SERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(place_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_explorers_place ON place_explorers(place_id);

-- Notes en étoiles (réservées aux explorateurs)
CREATE TABLE IF NOT EXISTS place_ratings (
  id SERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(place_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_place ON place_ratings(place_id);

-- Wishlist "Je veux y aller"
CREATE TABLE IF NOT EXISTS place_wishlist (
  id SERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(place_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user ON place_wishlist(user_id);

-- RLS pour les 3 tables
ALTER TABLE place_explorers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "explorers_select" ON place_explorers FOR SELECT USING (true);

ALTER TABLE place_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings_select" ON place_ratings FOR SELECT USING (true);
CREATE POLICY "ratings_upsert" ON place_ratings FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id);
CREATE POLICY "ratings_update" ON place_ratings FOR UPDATE USING (auth.uid()::TEXT = user_id);

ALTER TABLE place_wishlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wishlist_select" ON place_wishlist FOR SELECT USING (auth.uid()::TEXT = user_id);
CREATE POLICY "wishlist_insert" ON place_wishlist FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id);
CREATE POLICY "wishlist_delete" ON place_wishlist FOR DELETE USING (auth.uid()::TEXT = user_id);
