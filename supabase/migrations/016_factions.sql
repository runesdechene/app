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
