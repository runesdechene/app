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
