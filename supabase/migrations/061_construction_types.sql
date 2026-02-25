-- ============================================
-- MIGRATION 061 : Types de construction dynamiques
-- ============================================
-- Remplace les constantes hardcodees (FORTIFICATION_NAMES, etc.)
-- par une table construction_types geree depuis le Hub.
-- ============================================

CREATE TABLE IF NOT EXISTS construction_types (
  level INT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  cost INT NOT NULL DEFAULT 1,
  conquest_bonus INT NOT NULL DEFAULT 1,
  tag_ids TEXT[] DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed avec les 4 niveaux existants
INSERT INTO construction_types (level, name, description, cost, conquest_bonus) VALUES
  (1, 'Tour de guet',    'Coute +1 point de conquete aux ennemis pour revendiquer ce lieu.', 1, 1),
  (2, 'Tour de defense', 'Coute +2 points de conquete aux ennemis pour revendiquer ce lieu.', 2, 2),
  (3, 'Bastion',         'Coute +3 points de conquete aux ennemis pour revendiquer ce lieu.', 3, 3),
  (4, 'Befroi',          'Forteresse imprenable. Coute +4 points de conquete aux ennemis.', 5, 4)
ON CONFLICT (level) DO NOTHING;

-- RLS : lecture publique, ecriture admin
ALTER TABLE construction_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "construction_types_read" ON construction_types
  FOR SELECT USING (true);

CREATE POLICY "construction_types_admin" ON construction_types
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin')
  );

-- RPC pour lire tous les types (ordonnee par level)
CREATE OR REPLACE FUNCTION public.get_construction_types()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(json_agg(row_to_json(ct) ORDER BY ct.level), '[]'::json)
  FROM construction_types ct;
$$;

-- Mettre a jour fortify_place pour lire depuis la table
CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_max_level INT;
  v_cost INT;
  v_next_name TEXT;
  v_construction NUMERIC(6,1);
  v_max_construction NUMERIC(6,1) := 5.0;
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
  v_place_tags TEXT[];
BEGIN
  -- Verifier faction du user
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe et est revendique par la faction du user
  SELECT faction_id, fortification_level
  INTO v_place_faction, v_current_level
  FROM places WHERE id = p_place_id;

  IF v_place_faction IS NULL THEN
    RETURN json_build_object('error', 'Place not claimed');
  END IF;

  IF v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'Not your faction territory');
  END IF;

  -- Max level depuis la table
  SELECT MAX(level) INTO v_max_level FROM construction_types;
  IF v_max_level IS NULL THEN v_max_level := 0; END IF;

  IF v_current_level >= v_max_level THEN
    RETURN json_build_object('error', 'Max fortification reached');
  END IF;

  -- Tags du lieu (pour filtrage optionnel)
  SELECT ARRAY_AGG(tag_id) INTO v_place_tags
  FROM place_tags WHERE place_id = p_place_id;

  -- Cout et nom du prochain niveau
  SELECT ct.cost, ct.name INTO v_cost, v_next_name
  FROM construction_types ct
  WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_cost IS NULL THEN
    RETURN json_build_object('error', 'No construction type available for this level');
  END IF;

  -- Verifier les points de construction
  SELECT construction_points INTO v_construction FROM users WHERE id = p_user_id;
  IF v_construction < v_cost THEN
    RETURN json_build_object(
      'error', 'Not enough construction points',
      'constructionPoints', v_construction,
      'cost', v_cost
    );
  END IF;

  -- Deduire les points
  UPDATE users
  SET construction_points = construction_points - v_cost
  WHERE id = p_user_id;

  -- Incrementer le niveau
  UPDATE places
  SET fortification_level = v_current_level + 1,
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Recuperer l'etat final
  SELECT construction_points, construction_reset_at
  INTO v_construction, v_construction_reset_at
  FROM users WHERE id = p_user_id;

  -- Construction next point
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'fortificationLevel', v_current_level + 1,
    'fortificationName', v_next_name,
    'cost', v_cost
  );
END;
$$;
