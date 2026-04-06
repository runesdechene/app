-- ============================================
-- MIGRATION 079 : Identite des Territoires
-- ============================================
-- 1. Table territory_tiers (titres progressifs configurables)
-- 2. Table territory_names (noms custom par le top contributeur)
-- 3. RPC name_territory
-- 4. MAJ get_map_places : ajouter claimedById
-- ============================================

-- =========================================
-- 1. territory_tiers
-- =========================================
CREATE TABLE IF NOT EXISTS territory_tiers (
  id SERIAL PRIMARY KEY,
  min_places INT NOT NULL UNIQUE,
  title VARCHAR(50) NOT NULL
);

INSERT INTO territory_tiers (min_places, title) VALUES
  (3,  'Campement'),
  (5,  'Avant-Poste'),
  (8,  'Domaine'),
  (12, 'Seigneurie'),
  (17, 'Baronnie'),
  (22, 'Comté'),
  (30, 'Duché'),
  (45, 'Royaume'),
  (70, 'Empire')
ON CONFLICT (min_places) DO NOTHING;

-- RLS : lecture publique, ecriture admin
ALTER TABLE territory_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "territory_tiers_read" ON territory_tiers
  FOR SELECT USING (true);

CREATE POLICY "territory_tiers_write" ON territory_tiers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::TEXT AND u.role = 'admin'
    )
  );

-- =========================================
-- 2. territory_names
-- =========================================
CREATE TABLE IF NOT EXISTS territory_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faction_id VARCHAR(255) NOT NULL,
  anchor_place_id VARCHAR(255) NOT NULL UNIQUE,
  custom_name VARCHAR(100) NOT NULL,
  named_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE territory_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY "territory_names_read" ON territory_names
  FOR SELECT USING (true);

CREATE POLICY "territory_names_insert" ON territory_names
  FOR INSERT WITH CHECK (named_by = auth.uid()::TEXT);

CREATE POLICY "territory_names_update" ON territory_names
  FOR UPDATE USING (named_by = auth.uid()::TEXT);

-- =========================================
-- 3. RPC name_territory
-- =========================================
CREATE OR REPLACE FUNCTION public.name_territory(
  p_user_id TEXT,
  p_anchor_place_id TEXT,
  p_custom_name TEXT,
  p_blob_place_ids TEXT[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_anchor_faction TEXT;
  v_top_user TEXT;
  v_result JSON;
BEGIN
  -- 1. Verifier que le user a une faction
  SELECT faction_id INTO v_faction_id
  FROM users WHERE id = p_user_id;

  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- 2. Verifier que l'anchor appartient a la meme faction
  SELECT faction_id INTO v_anchor_faction
  FROM places WHERE id = p_anchor_place_id;

  IF v_anchor_faction IS NULL OR v_anchor_faction != v_faction_id THEN
    RETURN json_build_object('error', 'anchor_not_owned');
  END IF;

  -- 3. Trouver le top contributeur parmi les lieux du blob
  SELECT claimed_by INTO v_top_user
  FROM places
  WHERE id = ANY(p_blob_place_ids)
    AND faction_id = v_faction_id
    AND claimed_by IS NOT NULL
  GROUP BY claimed_by
  ORDER BY COUNT(*) DESC, MIN(claimed_at) ASC
  LIMIT 1;

  -- 4. Verifier que le user est le top contributeur (ou egalite)
  IF v_top_user IS NULL OR v_top_user != p_user_id THEN
    RETURN json_build_object('error', 'not_top_contributor');
  END IF;

  -- 5. Upsert dans territory_names
  INSERT INTO territory_names (faction_id, anchor_place_id, custom_name, named_by)
  VALUES (v_faction_id, p_anchor_place_id, p_custom_name, p_user_id)
  ON CONFLICT (anchor_place_id) DO UPDATE SET
    custom_name = EXCLUDED.custom_name,
    named_by = EXCLUDED.named_by,
    updated_at = NOW();

  RETURN json_build_object('ok', true);
END;
$$;

-- =========================================
-- 4. get_map_places — ajouter claimedById
-- =========================================
CREATE OR REPLACE FUNCTION public.get_map_places(
  p_type TEXT DEFAULT 'all',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_latitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_longitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', COALESCE(claimer.first_name, claimer.email_address),
        'claimedById', p.claimed_by,
        'fortificationLevel', p.fortification_level,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id, f.id, claimer.first_name, claimer.email_address, lk.likes_count, vw.views_count, ex.explored_count
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'latest' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', COALESCE(claimer.first_name, claimer.email_address),
        'claimedById', p.claimed_by,
        'fortificationLevel', p.fortification_level,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;

  ELSE
    -- type = 'all' avec viewport optionnel
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', COALESCE(claimer.first_name, claimer.email_address),
        'claimedById', p.claimed_by,
        'fortificationLevel', p.fortification_level,
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
        AND (
          p_latitude IS NULL
          OR (
            p.latitude >= (p_latitude - p_latitude_delta)
            AND p.latitude <= (p_latitude + p_latitude_delta)
            AND p.longitude >= (p_longitude - p_longitude_delta)
            AND p.longitude <= (p_longitude + p_longitude_delta)
          )
        )
      ORDER BY p.created_at
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
