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
