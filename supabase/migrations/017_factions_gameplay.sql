-- ============================================
-- MIGRATION 017 : Factions gameplay
-- ============================================
-- - faction_id sur users (l'utilisateur choisit sa faction)
-- - faction_id + claimed_by sur places (un lieu peut être revendiqué)
-- - place_claims : historique des revendications
-- - RPCs : set_user_faction, claim_place
-- - MAJ RPCs : get_my_informations, get_place_by_id, get_map_places
-- ============================================

-- ============================================
-- 1. COLONNES
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS faction_id VARCHAR(255) REFERENCES factions(id) ON DELETE SET NULL;
ALTER TABLE places ADD COLUMN IF NOT EXISTS faction_id VARCHAR(255) REFERENCES factions(id) ON DELETE SET NULL;
ALTER TABLE places ADD COLUMN IF NOT EXISTS claimed_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE places ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_faction_id ON users(faction_id);
CREATE INDEX IF NOT EXISTS idx_places_faction_id ON places(faction_id);

-- ============================================
-- 2. HISTORIQUE DES CLAIMS
-- ============================================

CREATE TABLE IF NOT EXISTS place_claims (
  id SERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  faction_id VARCHAR(255) NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_place_claims_place_id ON place_claims(place_id);
CREATE INDEX IF NOT EXISTS idx_place_claims_faction_id ON place_claims(faction_id);

-- RLS
ALTER TABLE place_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read place_claims" ON place_claims FOR SELECT USING (true);
CREATE POLICY "Auth insert place_claims" ON place_claims FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 3. RPC : set_user_faction
-- ============================================

CREATE OR REPLACE FUNCTION public.set_user_faction(
  p_user_id TEXT,
  p_faction_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifier que la faction existe (ou null pour quitter)
  IF p_faction_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM factions WHERE id = p_faction_id) THEN
      RETURN json_build_object('error', 'Faction not found');
    END IF;
  END IF;

  UPDATE users SET faction_id = p_faction_id, updated_at = NOW() WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;

-- ============================================
-- 4. RPC : claim_place
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
BEGIN
  -- Récupérer la faction du user
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;

  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Vérifier que le lieu existe
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Revendiquer le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Historique
  INSERT INTO place_claims (place_id, user_id, faction_id)
  VALUES (p_place_id, p_user_id, v_faction_id);

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id
  );
END;
$$;

-- ============================================
-- 5. MAJ get_my_informations — ajouter faction
-- ============================================

CREATE OR REPLACE FUNCTION public.get_my_informations(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_profile_image JSON;
  v_faction JSON;
BEGIN
  SELECT * INTO v_user FROM users WHERE id = p_user_id;
  IF v_user IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- Photo de profil avec id + url
  IF v_user.profile_image_id IS NOT NULL THEN
    SELECT json_build_object(
      'id', im.id,
      'url', COALESCE(
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
      )
    ) INTO v_profile_image
    FROM image_media im
    WHERE im.id = v_user.profile_image_id;
  ELSE
    v_profile_image := NULL;
  END IF;

  -- Faction
  IF v_user.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'id', f.id,
      'title', f.title,
      'color', f.color,
      'pattern', f.pattern
    ) INTO v_faction
    FROM factions f
    WHERE f.id = v_user.faction_id;
  ELSE
    v_faction := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_user.id,
    'emailAddress', v_user.email_address,
    'role', COALESCE(v_user.role, 'user'),
    'rank', COALESCE(v_user.rank, 'guest'),
    'gender', v_user.gender,
    'lastName', v_user.last_name,
    'biography', COALESCE(v_user.bio, v_user.biography, ''),
    'instagramId', v_user.instagram_id,
    'websiteUrl', v_user.website_url,
    'profileImage', v_profile_image,
    'faction', v_faction
  );
END;
$$;

-- ============================================
-- 6. MAJ get_place_by_id — ajouter claim info
-- ============================================

CREATE OR REPLACE FUNCTION public.get_place_by_id(
  p_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place RECORD;
  v_place_type RECORD;
  v_author RECORD;
  v_views_count INT;
  v_likes_count INT;
  v_explored_count INT;
  v_geocache_count INT;
  v_avg_score DOUBLE PRECISION;
  v_last_explorers JSON;
  v_requester JSON;
  v_author_profile_url TEXT;
  v_primary_tag JSON;
  v_all_tags JSON;
  v_claim JSON;
BEGIN
  -- Recuperer la place
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Recuperer le type structurel
  SELECT * INTO v_place_type FROM place_types WHERE id = v_place.place_type_id;

  -- Recuperer l'auteur
  SELECT * INTO v_author FROM users WHERE id = v_place.author_id;

  -- Photo de profil de l'auteur
  IF v_author IS NOT NULL AND v_author.profile_image_id IS NOT NULL THEN
    SELECT
      CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END INTO v_author_profile_url
    FROM image_media im
    WHERE im.id = v_author.profile_image_id;
  ELSE
    v_author_profile_url := NULL;
  END IF;

  -- Metrics
  SELECT COUNT(*) INTO v_views_count FROM places_viewed WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_likes_count FROM places_liked WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_explored_count FROM places_explored WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_geocache_count FROM reviews WHERE place_id = p_id AND geocache = true;
  SELECT AVG(score) INTO v_avg_score FROM reviews WHERE place_id = p_id;

  -- Derniers explorateurs (hors auteur)
  SELECT json_agg(explorer) INTO v_last_explorers
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'lastName', u.last_name,
      'profileImageUrl', CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
    WHERE pe.place_id = p_id AND pe.user_id != v_place.author_id
    ORDER BY pe.updated_at DESC
  ) sub;

  -- Tag primaire
  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'color', t.color,
    'background', t.background
  ) INTO v_primary_tag
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_id AND ptag.is_primary = TRUE
  LIMIT 1;

  -- Tous les tags
  SELECT json_agg(tag_data) INTO v_all_tags
  FROM (
    SELECT json_build_object(
      'id', t.id,
      'title', t.title,
      'color', t.color,
      'background', t.background,
      'isPrimary', ptag.is_primary
    ) AS tag_data
    FROM place_tags ptag
    JOIN tags t ON t.id = ptag.tag_id
    WHERE ptag.place_id = p_id
    ORDER BY ptag.is_primary DESC, t."order"
  ) sub;

  -- Requester state
  IF p_user_id IS NOT NULL THEN
    v_requester := json_build_object(
      'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked WHERE place_id = p_id AND user_id = p_user_id),
      'liked', EXISTS(SELECT 1 FROM places_liked WHERE place_id = p_id AND user_id = p_user_id),
      'explored', EXISTS(SELECT 1 FROM places_explored WHERE place_id = p_id AND user_id = p_user_id)
    );
  ELSE
    v_requester := NULL;
  END IF;

  -- Claim info
  IF v_place.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'factionId', f.id,
      'factionTitle', f.title,
      'factionColor', f.color,
      'claimedBy', v_place.claimed_by,
      'claimedAt', v_place.claimed_at
    ) INTO v_claim
    FROM factions f
    WHERE f.id = v_place.faction_id;
  ELSE
    v_claim := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_place.id,
    'title', v_place.title,
    'text', v_place.text,
    'address', v_place.address,
    'accessibility', v_place.accessibility,
    'sensible', COALESCE(v_place.sensible, false),
    'geocaching', v_geocache_count > 0,
    'images', v_place.images,
    'author', json_build_object(
      'id', COALESCE(v_author.id, v_place.author_id),
      'lastName', COALESCE(v_author.last_name, 'Utilisateur inconnu'),
      'profileImageUrl', v_author_profile_url
    ),
    'type', json_build_object(
      'id', v_place_type.id,
      'title', v_place_type.title
    ),
    'primaryTag', v_primary_tag,
    'tags', COALESCE(v_all_tags, '[]'::json),
    'location', json_build_object(
      'latitude', v_place.latitude,
      'longitude', v_place.longitude
    ),
    'metrics', json_build_object(
      'views', v_views_count,
      'likes', v_likes_count,
      'explored', v_explored_count,
      'note', v_avg_score
    ),
    'claim', v_claim,
    'requester', v_requester,
    'lastExplorers', COALESCE(v_last_explorers, '[]'::json),
    'beginAt', v_place.begin_at,
    'endAt', v_place.end_at
  );
END;
$$;

-- ============================================
-- 7. MAJ get_map_places — faction color quand revendiqué
-- ============================================

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
      GROUP BY p.id, pt.id, t.id, f.id, lk.likes_count, vw.views_count, ex.explored_count
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
