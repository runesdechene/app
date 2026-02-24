-- ============================================
-- MIGRATION 051 : Titres v2 — Conditions flexibles + Selection joueur
-- ============================================
-- 1. Remplace condition_type/condition_value par JSONB condition
-- 2. Ajoute displayed_general_title_ids sur users
-- 3. Helper check_title_condition()
-- 4. Rewrite get_user_titles() — retourne TOUS les titres generaux debloques
-- 5. Nouvelle RPC set_displayed_titles()
-- 6. Rewrite get_player_profile() — retourne titres affiches
-- ============================================

-- ============================================
-- 1. Schema : JSONB condition
-- ============================================

ALTER TABLE titles ADD COLUMN IF NOT EXISTS condition JSONB;

-- Migrer les donnees existantes
UPDATE titles
SET condition = jsonb_build_object('stat', condition_type, 'min', condition_value)
WHERE condition IS NULL;

ALTER TABLE titles ALTER COLUMN condition SET NOT NULL;
ALTER TABLE titles ALTER COLUMN condition SET DEFAULT '{"stat":"discoveries","min":0}'::jsonb;

ALTER TABLE titles DROP COLUMN IF EXISTS condition_type;
ALTER TABLE titles DROP COLUMN IF EXISTS condition_value;

-- ============================================
-- 2. Selection joueur (max 2 titres generaux)
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS displayed_general_title_ids INT[] DEFAULT '{}';

-- ============================================
-- 3. Helper check_title_condition()
-- ============================================

CREATE OR REPLACE FUNCTION public.check_title_condition(
  p_condition JSONB,
  p_stat_value INT,
  p_rank_value INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Seuil : {"stat": "xxx", "min": N}
  IF p_condition ? 'min' THEN
    RETURN p_stat_value >= (p_condition->>'min')::INT;
  END IF;

  -- Top N : {"stat": "xxx", "rank": N}
  IF p_condition ? 'rank' THEN
    RETURN p_rank_value <= (p_condition->>'rank')::INT;
  END IF;

  -- Classement : {"stat": "xxx", "rank_from": N, "rank_to": M}
  IF p_condition ? 'rank_from' AND p_condition ? 'rank_to' THEN
    RETURN p_rank_value >= (p_condition->>'rank_from')::INT
       AND p_rank_value <= (p_condition->>'rank_to')::INT;
  END IF;

  RETURN FALSE;
END;
$$;

-- ============================================
-- 4. Rewrite get_user_titles()
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Stats
  v_discoveries INT;
  v_claims INT;
  v_notoriety INT;
  v_likes INT;
  v_fortifications INT;
  v_faction_id VARCHAR(255);
  v_displayed_ids INT[];
  -- Rangs globaux
  v_grank_discoveries INT;
  v_grank_claims INT;
  v_grank_notoriety INT;
  v_grank_likes INT;
  v_grank_fortifications INT;
  -- Rangs faction
  v_frank_discoveries INT;
  v_frank_claims INT;
  v_frank_notoriety INT;
  v_frank_likes INT;
  v_frank_fortifications INT;
  -- Resultats
  v_general_all JSON;
  v_faction JSON;
  -- Helpers pour iteration
  v_title RECORD;
  v_stat TEXT;
  v_stat_val INT;
  v_rank_val INT;
  v_matched BOOLEAN;
  v_general_arr JSON[] := '{}';
BEGIN
  -- ====== Stats du joueur ======
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_claims FROM place_claims WHERE user_id = p_user_id;
  SELECT COALESCE(notoriety_points, 0), faction_id, COALESCE(displayed_general_title_ids, '{}')
    INTO v_notoriety, v_faction_id, v_displayed_ids
    FROM users WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_likes FROM places_liked WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_fortifications FROM activity_log
    WHERE actor_id = p_user_id AND type = 'fortify';

  -- ====== Rangs globaux ======
  SELECT COALESCE(r, 999999) INTO v_grank_discoveries FROM (
    SELECT user_id, RANK() OVER (ORDER BY cnt DESC) AS r
    FROM (SELECT user_id, COUNT(*) AS cnt FROM places_discovered GROUP BY user_id) sub
  ) ranked WHERE user_id = p_user_id;
  v_grank_discoveries := COALESCE(v_grank_discoveries, 999999);

  SELECT COALESCE(r, 999999) INTO v_grank_claims FROM (
    SELECT user_id, RANK() OVER (ORDER BY cnt DESC) AS r
    FROM (SELECT user_id, COUNT(*) AS cnt FROM place_claims GROUP BY user_id) sub
  ) ranked WHERE user_id = p_user_id;
  v_grank_claims := COALESCE(v_grank_claims, 999999);

  SELECT COALESCE(r, 999999) INTO v_grank_notoriety FROM (
    SELECT id AS user_id, RANK() OVER (ORDER BY COALESCE(notoriety_points, 0) DESC) AS r
    FROM users
  ) ranked WHERE user_id = p_user_id;
  v_grank_notoriety := COALESCE(v_grank_notoriety, 999999);

  SELECT COALESCE(r, 999999) INTO v_grank_likes FROM (
    SELECT user_id, RANK() OVER (ORDER BY cnt DESC) AS r
    FROM (SELECT user_id, COUNT(*) AS cnt FROM places_liked GROUP BY user_id) sub
  ) ranked WHERE user_id = p_user_id;
  v_grank_likes := COALESCE(v_grank_likes, 999999);

  SELECT COALESCE(r, 999999) INTO v_grank_fortifications FROM (
    SELECT actor_id AS user_id, RANK() OVER (ORDER BY cnt DESC) AS r
    FROM (SELECT actor_id, COUNT(*) AS cnt FROM activity_log WHERE type = 'fortify' GROUP BY actor_id) sub
  ) ranked WHERE user_id = p_user_id;
  v_grank_fortifications := COALESCE(v_grank_fortifications, 999999);

  -- ====== Rangs faction ======
  IF v_faction_id IS NOT NULL THEN
    SELECT COALESCE(r, 999999) INTO v_frank_discoveries FROM (
      SELECT pd.user_id, RANK() OVER (ORDER BY COUNT(*) DESC) AS r
      FROM places_discovered pd
      JOIN users u ON u.id = pd.user_id
      WHERE u.faction_id = v_faction_id
      GROUP BY pd.user_id
    ) ranked WHERE user_id = p_user_id;
    v_frank_discoveries := COALESCE(v_frank_discoveries, 999999);

    SELECT COALESCE(r, 999999) INTO v_frank_claims FROM (
      SELECT pc.user_id, RANK() OVER (ORDER BY COUNT(*) DESC) AS r
      FROM place_claims pc
      JOIN users u ON u.id = pc.user_id
      WHERE u.faction_id = v_faction_id
      GROUP BY pc.user_id
    ) ranked WHERE user_id = p_user_id;
    v_frank_claims := COALESCE(v_frank_claims, 999999);

    SELECT COALESCE(r, 999999) INTO v_frank_notoriety FROM (
      SELECT id AS user_id, RANK() OVER (ORDER BY COALESCE(notoriety_points, 0) DESC) AS r
      FROM users WHERE faction_id = v_faction_id
    ) ranked WHERE user_id = p_user_id;
    v_frank_notoriety := COALESCE(v_frank_notoriety, 999999);

    SELECT COALESCE(r, 999999) INTO v_frank_likes FROM (
      SELECT pl.user_id, RANK() OVER (ORDER BY COUNT(*) DESC) AS r
      FROM places_liked pl
      JOIN users u ON u.id = pl.user_id
      WHERE u.faction_id = v_faction_id
      GROUP BY pl.user_id
    ) ranked WHERE user_id = p_user_id;
    v_frank_likes := COALESCE(v_frank_likes, 999999);

    SELECT COALESCE(r, 999999) INTO v_frank_fortifications FROM (
      SELECT al.actor_id AS user_id, RANK() OVER (ORDER BY COUNT(*) DESC) AS r
      FROM activity_log al
      JOIN users u ON u.id = al.actor_id
      WHERE al.type = 'fortify' AND u.faction_id = v_faction_id
      GROUP BY al.actor_id
    ) ranked WHERE user_id = p_user_id;
    v_frank_fortifications := COALESCE(v_frank_fortifications, 999999);
  END IF;

  -- ====== Titres generaux debloques (TOUS) ======
  FOR v_title IN
    SELECT t.id, t.name, t.icon, t.unlocks, t."order", t.condition
    FROM titles t
    WHERE t.type = 'general'
    ORDER BY t."order" DESC
  LOOP
    v_stat := v_title.condition->>'stat';

    v_stat_val := CASE v_stat
      WHEN 'discoveries' THEN v_discoveries
      WHEN 'claims' THEN v_claims
      WHEN 'notoriety' THEN v_notoriety
      WHEN 'likes' THEN v_likes
      WHEN 'fortifications' THEN v_fortifications
      ELSE 0
    END;

    v_rank_val := CASE v_stat
      WHEN 'discoveries' THEN v_grank_discoveries
      WHEN 'claims' THEN v_grank_claims
      WHEN 'notoriety' THEN v_grank_notoriety
      WHEN 'likes' THEN v_grank_likes
      WHEN 'fortifications' THEN v_grank_fortifications
      ELSE 999999
    END;

    v_matched := check_title_condition(v_title.condition, v_stat_val, v_rank_val);

    IF v_matched THEN
      v_general_arr := array_append(v_general_arr,
        json_build_object(
          'id', v_title.id, 'name', v_title.name,
          'icon', v_title.icon, 'unlocks', v_title.unlocks,
          'order', v_title."order"
        )
      );
    END IF;
  END LOOP;

  -- Convertir en JSON array
  IF array_length(v_general_arr, 1) > 0 THEN
    v_general_all := array_to_json(v_general_arr);
  ELSE
    v_general_all := '[]'::json;
  END IF;

  -- ====== Titre de faction (highest order, automatique) ======
  IF v_faction_id IS NOT NULL THEN
    FOR v_title IN
      SELECT t.id, t.name, t.icon, t.unlocks, t."order", t.condition
      FROM titles t
      WHERE t.type = 'faction' AND t.faction_id = v_faction_id
      ORDER BY t."order" DESC
    LOOP
      v_stat := v_title.condition->>'stat';

      v_stat_val := CASE v_stat
        WHEN 'discoveries' THEN v_discoveries
        WHEN 'claims' THEN v_claims
        WHEN 'notoriety' THEN v_notoriety
        WHEN 'likes' THEN v_likes
        WHEN 'fortifications' THEN v_fortifications
        ELSE 0
      END;

      v_rank_val := CASE v_stat
        WHEN 'discoveries' THEN v_frank_discoveries
        WHEN 'claims' THEN v_frank_claims
        WHEN 'notoriety' THEN v_frank_notoriety
        WHEN 'likes' THEN v_frank_likes
        WHEN 'fortifications' THEN v_frank_fortifications
        ELSE 999999
      END;

      v_matched := check_title_condition(v_title.condition, v_stat_val, v_rank_val);

      IF v_matched THEN
        v_faction := json_build_object(
          'id', v_title.id, 'name', v_title.name,
          'icon', v_title.icon, 'unlocks', v_title.unlocks,
          'order', v_title."order"
        );
        EXIT; -- Premier match = highest order (tri DESC)
      END IF;
    END LOOP;
  END IF;

  RETURN json_build_object(
    'unlockedGeneralTitles', v_general_all,
    'factionTitle', v_faction,
    'displayedGeneralTitleIds', v_displayed_ids,
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
-- 5. set_displayed_titles()
-- ============================================

CREATE OR REPLACE FUNCTION public.set_displayed_titles(
  p_user_id TEXT,
  p_title_ids INT[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Max 2 titres generaux
  IF array_length(p_title_ids, 1) > 2 THEN
    RETURN json_build_object('error', 'Maximum 2 titres generaux');
  END IF;

  -- Valider que les IDs sont des titres generaux existants
  IF p_title_ids IS NOT NULL AND array_length(p_title_ids, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(p_title_ids) tid
      WHERE NOT EXISTS (SELECT 1 FROM titles WHERE id = tid AND type = 'general')
    ) THEN
      RETURN json_build_object('error', 'Titre invalide');
    END IF;
  END IF;

  UPDATE users
  SET displayed_general_title_ids = COALESCE(p_title_ids, '{}')
  WHERE id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_displayed_titles TO authenticated;

-- ============================================
-- 6. Rewrite get_player_profile()
-- ============================================

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_avatar_url TEXT;
  v_titles_data JSON;
  v_displayed_ids INT[];
  v_displayed_general JSON;
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

  -- Charger titres via get_user_titles
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  -- Selection du joueur
  SELECT COALESCE(displayed_general_title_ids, '{}')
  INTO v_displayed_ids
  FROM users WHERE id = p_user_id;

  -- Filtrer les titres generaux affiches
  IF array_length(v_displayed_ids, 1) > 0 THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
    WHERE (elem->>'id')::INT = ANY(v_displayed_ids);
  END IF;

  -- Fallback : titre le plus haut (premier element, tri DESC)
  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM (
      SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
      LIMIT 1
    ) sub;
  END IF;

  -- Resultat
  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', v_avatar_url,
    'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;
