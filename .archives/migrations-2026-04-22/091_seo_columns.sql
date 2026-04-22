-- Colonnes SEO sur places (déjà appliquées en prod le 20 avril 2026)
-- Ce fichier existe pour la traçabilité des migrations.
ALTER TABLE places ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE places ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS seo_generated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_places_slug ON places(slug) WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_places_seo_stale
  ON places(updated_at)
  WHERE seo_description IS NULL OR seo_generated_at < updated_at;
