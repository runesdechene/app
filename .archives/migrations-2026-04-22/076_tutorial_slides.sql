-- 076_tutorial_slides.sql
-- Système de tutoriel : slides gérées depuis le Hub, affichées dans explore-web

-- ============================================================
-- 1. Table tutorial_slides
-- ============================================================
CREATE TABLE IF NOT EXISTS tutorial_slides (
  id          SERIAL PRIMARY KEY,
  phase       TEXT NOT NULL CHECK (phase IN ('before', 'after')),
  position    INT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  image_url   TEXT,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. Colonne tutorial_completed_at sur users
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS tutorial_completed_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE tutorial_slides ENABLE ROW LEVEL SECURITY;

-- Lecture publique (les slides ne sont pas secrètes)
CREATE POLICY "tutorial_slides_select" ON tutorial_slides
  FOR SELECT USING (true);

-- Écriture réservée aux admins
CREATE POLICY "tutorial_slides_insert" ON tutorial_slides
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::TEXT AND role = 'admin'));

CREATE POLICY "tutorial_slides_update" ON tutorial_slides
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::TEXT AND role = 'admin'));

CREATE POLICY "tutorial_slides_delete" ON tutorial_slides
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::TEXT AND role = 'admin'));
