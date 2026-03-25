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
