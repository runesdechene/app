-- ============================================
-- MIGRATION 153 : Compétences actives des Fragments
-- ============================================

-- Ajouter les colonnes de compétence sur les fragments
ALTER TABLE title_fragments ADD COLUMN IF NOT EXISTS ability_type VARCHAR(50) DEFAULT NULL;
ALTER TABLE title_fragments ADD COLUMN IF NOT EXISTS ability_cooldown_hours INT DEFAULT 24;

-- Table de tracking des utilisations
CREATE TABLE IF NOT EXISTS fragment_ability_uses (
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fragment_id INT NOT NULL REFERENCES title_fragments(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, fragment_id)
);

ALTER TABLE fragment_ability_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ability_uses_read" ON fragment_ability_uses FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "ability_uses_write" ON fragment_ability_uses FOR ALL USING (user_id = auth.uid()::text);

-- RPC : utiliser une compétence
CREATE OR REPLACE FUNCTION public.use_fragment_ability(
  p_user_id TEXT,
  p_fragment_id INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ability_type VARCHAR(50);
  v_cooldown_hours INT;
  v_last_used TIMESTAMPTZ;
  v_has_fragment BOOLEAN;
BEGIN
  -- Vérifier que le joueur possède le fragment
  SELECT EXISTS (SELECT 1 FROM user_fragments WHERE user_id = p_user_id AND fragment_id = p_fragment_id)
  INTO v_has_fragment;
  IF NOT v_has_fragment THEN
    RETURN json_build_object('error', 'fragment_not_owned');
  END IF;

  -- Lire la compétence
  SELECT ability_type, COALESCE(ability_cooldown_hours, 24)
  INTO v_ability_type, v_cooldown_hours
  FROM title_fragments WHERE id = p_fragment_id;

  IF v_ability_type IS NULL THEN
    RETURN json_build_object('error', 'no_ability');
  END IF;

  -- Vérifier le cooldown
  SELECT used_at INTO v_last_used
  FROM fragment_ability_uses
  WHERE user_id = p_user_id AND fragment_id = p_fragment_id;

  IF v_last_used IS NOT NULL AND v_last_used + (v_cooldown_hours || ' hours')::INTERVAL > NOW() THEN
    RETURN json_build_object(
      'error', 'on_cooldown',
      'availableAt', (v_last_used + (v_cooldown_hours || ' hours')::INTERVAL)
    );
  END IF;

  -- Enregistrer l'utilisation
  INSERT INTO fragment_ability_uses (user_id, fragment_id, used_at)
  VALUES (p_user_id, p_fragment_id, NOW())
  ON CONFLICT (user_id, fragment_id) DO UPDATE SET used_at = NOW();

  RETURN json_build_object('success', true, 'ability', v_ability_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.use_fragment_ability(TEXT, INT) TO authenticated;

-- RPC : lister les compétences disponibles du joueur
CREATE OR REPLACE FUNCTION public.get_my_abilities(p_user_id TEXT)
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
      tf.id AS fragment_id,
      tf.name,
      tf.icon,
      tf.icon_url,
      tf.ability_type,
      tf.ability_cooldown_hours,
      fau.used_at AS last_used,
      CASE
        WHEN fau.used_at IS NULL THEN true
        WHEN fau.used_at + (COALESCE(tf.ability_cooldown_hours, 24) || ' hours')::INTERVAL <= NOW() THEN true
        ELSE false
      END AS available
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    LEFT JOIN fragment_ability_uses fau ON fau.user_id = uf.user_id AND fau.fragment_id = tf.id
    WHERE uf.user_id = p_user_id AND tf.ability_type IS NOT NULL
    ORDER BY tf.name
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_abilities(TEXT) TO authenticated;
