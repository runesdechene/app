-- 196_v05_place_influence.sql
-- V0.5 : influence multi-Héritage par lieu

CREATE TABLE IF NOT EXISTS place_influence (
  id SERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  faction_id VARCHAR(255) NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  placed_points INT NOT NULL DEFAULT 0,        -- influence placée (décroît)
  content_points INT NOT NULL DEFAULT 0,       -- influence de contenu (permanent)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(place_id, faction_id)
);

CREATE INDEX IF NOT EXISTS idx_place_influence_place ON place_influence(place_id);
CREATE INDEX IF NOT EXISTS idx_place_influence_faction ON place_influence(faction_id);

COMMENT ON TABLE place_influence IS 'Influence par Héritage sur chaque lieu. placed_points décroît (-1/semaine), content_points est permanent.';

-- RLS : tout le monde peut lire, seules les RPCs modifient
ALTER TABLE place_influence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "place_influence_select" ON place_influence FOR SELECT USING (true);
