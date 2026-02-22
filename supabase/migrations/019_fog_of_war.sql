-- ============================================
-- MIGRATION 019 : Brouillard de guerre V1
-- ============================================
-- - places_discovered : lieux découverts par utilisateur
-- - energy_points + energy_reset_at sur users
-- - RPCs : get_user_discoveries, discover_place, get_user_energy
-- ============================================

-- ============================================
-- 1. TABLE : places_discovered
-- ============================================

CREATE TABLE IF NOT EXISTS places_discovered (
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  method VARCHAR(20) NOT NULL DEFAULT 'remote',  -- 'remote' | 'gps'
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_places_discovered_user ON places_discovered(user_id);
CREATE INDEX IF NOT EXISTS idx_places_discovered_place ON places_discovered(place_id);

-- RLS
ALTER TABLE places_discovered ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own discoveries"
  ON places_discovered FOR SELECT
  USING (true);

CREATE POLICY "Auth insert discoveries"
  ON places_discovered FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 2. COLONNES ÉNERGIE SUR USERS
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS energy_points INT NOT NULL DEFAULT 5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS energy_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================
-- 3. RPC : get_user_discoveries
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_discoveries(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(place_id) INTO v_result
  FROM places_discovered
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- ============================================
-- 4. RPC : get_user_energy
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy INT;
  v_reset_at TIMESTAMPTZ;
BEGIN
  SELECT energy_points, energy_reset_at INTO v_energy, v_reset_at
  FROM users WHERE id = p_user_id;

  -- Auto-reset si le dernier reset date d'avant aujourd'hui
  IF v_reset_at < date_trunc('day', NOW()) THEN
    UPDATE users
    SET energy_points = 5, energy_reset_at = NOW()
    WHERE id = p_user_id;
    v_energy := 5;
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', 5
  );
END;
$$;

-- ============================================
-- 5. RPC : discover_place
-- ============================================

CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote'  -- 'remote' | 'gps'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy INT;
  v_reset_at TIMESTAMPTZ;
  v_already BOOLEAN;
BEGIN
  -- Vérifier que le lieu existe
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Vérifier si déjà découvert (idempotent)
  SELECT EXISTS(
    SELECT 1 FROM places_discovered
    WHERE user_id = p_user_id AND place_id = p_place_id
  ) INTO v_already;

  IF v_already THEN
    SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
    RETURN json_build_object('success', true, 'already', true, 'energy', v_energy);
  END IF;

  -- Si méthode = remote, vérifier/reset l'énergie
  IF p_method = 'remote' THEN
    SELECT energy_points, energy_reset_at INTO v_energy, v_reset_at
    FROM users WHERE id = p_user_id;

    -- Auto-reset si le dernier reset date d'avant aujourd'hui
    IF v_reset_at < date_trunc('day', NOW()) THEN
      UPDATE users
      SET energy_points = 5, energy_reset_at = NOW()
      WHERE id = p_user_id;
      v_energy := 5;
    END IF;

    IF v_energy < 1 THEN
      RETURN json_build_object('error', 'Not enough energy', 'energy', 0);
    END IF;

    -- Déduire 1 point
    UPDATE users
    SET energy_points = energy_points - 1
    WHERE id = p_user_id;
  END IF;

  -- Insérer la découverte
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Retourner l'énergie restante
  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'energy', v_energy
  );
END;
$$;
