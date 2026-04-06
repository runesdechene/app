-- ============================================
-- MIGRATION 050 : Systeme de Titres
-- ============================================
-- Titres generaux (basés sur stats globales) + titres de faction
-- (basés sur la notoriété, avec noms propres par faction).
-- Configurables par l'admin dans le Hub.
-- ============================================

-- 1. Table titles
CREATE TABLE IF NOT EXISTS titles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('general', 'faction')),
  faction_id VARCHAR(255) REFERENCES factions(id) ON DELETE CASCADE,
  condition_type VARCHAR(30) NOT NULL,
  condition_value INT NOT NULL DEFAULT 0,
  "order" INT NOT NULL DEFAULT 0,
  icon VARCHAR(50),
  unlocks TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE titles ADD CONSTRAINT titles_faction_check
  CHECK (type = 'general' OR faction_id IS NOT NULL);

-- RLS : lecture publique, ecriture admin uniquement (via SECURITY DEFINER RPCs ou Hub direct)
ALTER TABLE titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view titles"
  ON titles FOR SELECT USING (true);

CREATE POLICY "Service role can manage titles"
  ON titles FOR ALL USING (true) WITH CHECK (true);

-- 2. Seed — Titres generaux de base
INSERT INTO titles (name, type, faction_id, condition_type, condition_value, "order", icon, unlocks) VALUES
  ('Novice',               'general', NULL, 'discoveries',     0,   0,  '🌱', '{}'),
  ('Explorateur novice',   'general', NULL, 'discoveries',     5,   1,  '🧭', '{add_place}'),
  ('Explorateur',          'general', NULL, 'discoveries',     25,  2,  '🗺️', '{}'),
  ('Explorateur confirmé', 'general', NULL, 'discoveries',     100, 3,  '⭐', '{}'),
  ('Conquérant',           'general', NULL, 'claims',          10,  4,  '⚔️', '{}'),
  ('Bâtisseur',            'general', NULL, 'fortifications',  5,   5,  '🏗️', '{}'),
  ('Légende',              'general', NULL, 'notoriety',       500, 10, '👑', '{}');

-- ============================================
-- 3. RPC get_user_titles
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_discoveries INT;
  v_claims INT;
  v_notoriety INT;
  v_likes INT;
  v_fortifications INT;
  v_faction_id VARCHAR(255);
  v_general JSON;
  v_faction JSON;
BEGIN
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_claims FROM place_claims WHERE user_id = p_user_id;
  SELECT COALESCE(notoriety_points, 0), faction_id INTO v_notoriety, v_faction_id FROM users WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_likes FROM places_liked WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_fortifications FROM activity_log WHERE actor_id = p_user_id AND type = 'fortify';

  -- Titre general le plus eleve
  SELECT json_build_object(
    'id', t.id, 'name', t.name, 'icon', t.icon,
    'unlocks', t.unlocks, 'order', t."order"
  )
  INTO v_general
  FROM titles t
  WHERE t.type = 'general'
    AND (
      (t.condition_type = 'discoveries' AND v_discoveries >= t.condition_value) OR
      (t.condition_type = 'claims' AND v_claims >= t.condition_value) OR
      (t.condition_type = 'notoriety' AND v_notoriety >= t.condition_value) OR
      (t.condition_type = 'likes' AND v_likes >= t.condition_value) OR
      (t.condition_type = 'fortifications' AND v_fortifications >= t.condition_value)
    )
  ORDER BY t."order" DESC
  LIMIT 1;

  -- Titre de faction le plus eleve
  IF v_faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'id', t.id, 'name', t.name, 'icon', t.icon,
      'unlocks', t.unlocks, 'order', t."order"
    )
    INTO v_faction
    FROM titles t
    WHERE t.type = 'faction'
      AND t.faction_id = v_faction_id
      AND (
        (t.condition_type = 'notoriety' AND v_notoriety >= t.condition_value) OR
        (t.condition_type = 'claims' AND v_claims >= t.condition_value) OR
        (t.condition_type = 'discoveries' AND v_discoveries >= t.condition_value)
      )
    ORDER BY t."order" DESC
    LIMIT 1;
  END IF;

  RETURN json_build_object(
    'generalTitle', v_general,
    'factionTitle', v_faction,
    'stats', json_build_object(
      'discoveries', v_discoveries,
      'claims', v_claims,
      'notoriety', v_notoriety,
      'likes', v_likes,
      'fortifications', v_fortifications
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_titles TO authenticated;

-- ============================================
-- 4. Update get_player_profile — ajouter titres
-- ============================================

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_avatar_url TEXT;
  v_discoveries INT;
  v_claims INT;
  v_notoriety INT;
  v_likes INT;
  v_fortifications INT;
  v_faction_id VARCHAR(255);
  v_general_title JSON;
  v_faction_title JSON;
BEGIN
  -- Avatar
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_avatar_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = p_user_id;

  -- Stats pour les titres
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_claims FROM place_claims WHERE user_id = p_user_id;
  SELECT COALESCE(notoriety_points, 0), faction_id INTO v_notoriety, v_faction_id FROM users WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_likes FROM places_liked WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_fortifications FROM activity_log WHERE actor_id = p_user_id AND type = 'fortify';

  -- Titre general
  SELECT json_build_object('id', t.id, 'name', t.name, 'icon', t.icon)
  INTO v_general_title
  FROM titles t
  WHERE t.type = 'general'
    AND (
      (t.condition_type = 'discoveries' AND v_discoveries >= t.condition_value) OR
      (t.condition_type = 'claims' AND v_claims >= t.condition_value) OR
      (t.condition_type = 'notoriety' AND v_notoriety >= t.condition_value) OR
      (t.condition_type = 'likes' AND v_likes >= t.condition_value) OR
      (t.condition_type = 'fortifications' AND v_fortifications >= t.condition_value)
    )
  ORDER BY t."order" DESC
  LIMIT 1;

  -- Titre faction
  IF v_faction_id IS NOT NULL THEN
    SELECT json_build_object('id', t.id, 'name', t.name, 'icon', t.icon)
    INTO v_faction_title
    FROM titles t
    WHERE t.type = 'faction'
      AND t.faction_id = v_faction_id
      AND (
        (t.condition_type = 'notoriety' AND v_notoriety >= t.condition_value) OR
        (t.condition_type = 'claims' AND v_claims >= t.condition_value) OR
        (t.condition_type = 'discoveries' AND v_discoveries >= t.condition_value)
      )
    ORDER BY t."order" DESC
    LIMIT 1;
  END IF;

  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', v_avatar_url,
    'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', v_discoveries,
    'claimedCount', v_claims,
    'likesCount', v_likes,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'generalTitle', v_general_title,
    'factionTitle2', v_faction_title
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

-- ============================================
-- 5. Log des fortifications dans activity_log
-- ============================================
-- Le trigger n'existe pas encore pour 'fortify'.
-- On l'ajoute ici.

CREATE OR REPLACE FUNCTION public.log_fortify_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_name TEXT;
  v_place_title TEXT;
BEGIN
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.claimed_by;
  SELECT title INTO v_place_title FROM places WHERE id = NEW.id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'fortify',
    NEW.claimed_by,
    NEW.id,
    NEW.faction_id,
    json_build_object(
      'placeTitle', v_place_title,
      'actorName', v_actor_name,
      'fortificationLevel', NEW.fortification_level
    )
  );

  RETURN NEW;
END;
$$;

-- Trigger sur UPDATE de fortification_level (quand il augmente)
DROP TRIGGER IF EXISTS trg_log_fortify ON places;
CREATE TRIGGER trg_log_fortify
  AFTER UPDATE OF fortification_level ON places
  FOR EACH ROW
  WHEN (NEW.fortification_level > OLD.fortification_level)
  EXECUTE FUNCTION log_fortify_activity();
