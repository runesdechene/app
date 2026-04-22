-- 197_v05_place_contributions.sql
-- V0.5 : contributions collaboratives sur les lieux (pages de carnet, photos, infos)

CREATE TABLE IF NOT EXISTS place_contributions (
  id SERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  faction_id VARCHAR(255) NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('carnet', 'photo', 'accessibility', 'season', 'warning')),
  content TEXT,                        -- texte (carnet, info)
  image_url TEXT,                      -- URL image (photo)
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),  -- note en étoiles (NULL si pas de note)
  votes_up INT NOT NULL DEFAULT 0,
  votes_down INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(place_id, user_id, type)      -- 1 contribution par type par user par lieu
);

CREATE INDEX IF NOT EXISTS idx_contributions_place ON place_contributions(place_id);
CREATE INDEX IF NOT EXISTS idx_contributions_user ON place_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_votes ON place_contributions(place_id, type, votes_up DESC);

-- Table de votes (1 vote par user par contribution)
CREATE TABLE IF NOT EXISTS contribution_votes (
  id SERIAL PRIMARY KEY,
  contribution_id INT NOT NULL REFERENCES place_contributions(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),  -- -1 = down, +1 = up
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contribution_id, user_id)
);

-- RLS
ALTER TABLE place_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contributions_select" ON place_contributions FOR SELECT USING (true);
CREATE POLICY "contributions_insert" ON place_contributions FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id);
CREATE POLICY "contributions_update" ON place_contributions FOR UPDATE USING (auth.uid()::TEXT = user_id);

ALTER TABLE contribution_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_select" ON contribution_votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON contribution_votes FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id);
