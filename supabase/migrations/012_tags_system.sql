-- ============================================
-- MIGRATION 012 : Système de Tags
-- ============================================
-- Migre les anciens place_types (catégories) vers des tags,
-- puis remplace place_types par 4 types structurels :
-- Lieu, Anecdote, Produit, Événement
--
-- ORDRE CRITIQUE : places.place_type_id a ON DELETE CASCADE.
-- On ne supprime les anciens types qu'APRÈS avoir migré les places.
-- ============================================


-- ============================================
-- 1. TABLES
-- ============================================

-- Table des tags (remplace les anciens place_types comme catégories)
CREATE TABLE IF NOT EXISTS tags (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title VARCHAR(255) NOT NULL,
  color VARCHAR(255) NOT NULL DEFAULT '#C19A6B',
  background VARCHAR(255) NOT NULL DEFAULT '#F5E6D3',
  icon VARCHAR(255),
  "order" INT NOT NULL DEFAULT 0
);

-- Table de jointure N:N entre places et tags
CREATE TABLE IF NOT EXISTS place_tags (
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  tag_id VARCHAR(255) NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (place_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_place_tags_tag_id ON place_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_place_tags_primary ON place_tags(place_id) WHERE is_primary = TRUE;


-- ============================================
-- 2. DATA MIGRATION
-- ============================================

-- 2a. Copier les anciens place_types → tags
INSERT INTO tags (id, title, color, background, "order", created_at, updated_at)
SELECT id, title, color, background, "order", created_at, updated_at
FROM place_types
ON CONFLICT (id) DO NOTHING;

-- 2b. Associer chaque lieu à son tag (= son ancien place_type), marqué comme primaire
INSERT INTO place_tags (place_id, tag_id, is_primary)
SELECT p.id, p.place_type_id, TRUE
FROM places p
ON CONFLICT (place_id, tag_id) DO NOTHING;

-- 2c. Insérer les 4 nouveaux types structurels dans place_types
-- (avant de modifier les places, pour que la FK soit valide)
-- On spécifie TOUTES les colonnes NOT NULL car Supabase n'applique pas les DEFAULT
INSERT INTO place_types (id, created_at, updated_at, parent_id, title, form_description, long_description, images, color, background, border, faded_color, "order", hidden)
VALUES
  ('lieu',       NOW(), NOW(), NULL, 'Lieu',        '', '', '{}'::jsonb, '#C19A6B', '#F5E6D3', '#000000', '#CCCCCC', 1, FALSE),
  ('anecdote',   NOW(), NOW(), NULL, 'Anecdote',    '', '', '{}'::jsonb, '#7D5A3C', '#F5E6D3', '#000000', '#CCCCCC', 2, FALSE),
  ('produit',    NOW(), NOW(), NULL, 'Produit',     '', '', '{}'::jsonb, '#A0784C', '#EDE0CE', '#000000', '#CCCCCC', 3, FALSE),
  ('evenement',  NOW(), NOW(), NULL, 'Événement',   '', '', '{}'::jsonb, '#4A3728', '#E8D5BE', '#000000', '#CCCCCC', 4, FALSE)
ON CONFLICT (id) DO NOTHING;

-- 2d. Basculer tous les lieux vers le type structurel "lieu"
UPDATE places SET place_type_id = 'lieu';

-- 2e. Supprimer les anciens types (plus aucune FK ne pointe dessus)
DELETE FROM place_types
WHERE id NOT IN ('lieu', 'anecdote', 'produit', 'evenement');


-- ============================================
-- 3. RLS
-- ============================================

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view tags" ON tags FOR SELECT USING (true);

ALTER TABLE place_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view place_tags" ON place_tags FOR SELECT USING (true);


-- ============================================
-- 4. RPC FUNCTIONS (mise à jour)
-- ============================================

-- -----------------------------------------------
-- 4.1 get_map_places — ajoute primaryTag
-- -----------------------------------------------
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
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
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
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id
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
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
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
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
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

-- -----------------------------------------------
-- 4.2 get_map_banners — filtre par type structurel
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_map_banners(
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_latitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_longitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
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
      'location', json_build_object(
        'latitude', p.latitude,
        'longitude', p.longitude
      ),
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
    WHERE p.place_type_id IN ('produit', 'evenement')
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

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- -----------------------------------------------
-- 4.3 get_regular_feed — ajoute primaryTag
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_regular_feed(
  p_type TEXT DEFAULT 'latest',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_count INT DEFAULT 10,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INT;
  v_total INT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_count;

  SELECT COUNT(*) INTO v_total FROM places WHERE place_type_id = 'lieu';

  IF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE
          WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
          THEN p.images->0->>'url'
          ELSE NULL
        END,
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
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'avg_score', AVG(r.score),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_user_id),
            'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_user_id),
            'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_user_id)
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSIF p_type = 'closest' AND p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE
          WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
          THEN p.images->0->>'url'
          ELSE NULL
        END,
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
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'avg_score', AVG(r.score),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_user_id),
            'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_user_id),
            'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_user_id)
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id
      ORDER BY (
        6371 * acos(
          cos(radians(p_latitude)) * cos(radians(p.latitude))
          * cos(radians(p.longitude) - radians(p_longitude))
          + sin(radians(p_latitude)) * sin(radians(p.latitude))
        )
      ) ASC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSE
    -- type = 'latest'
    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE
          WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
          THEN p.images->0->>'url'
          ELSE NULL
        END,
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
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'avg_score', AVG(r.score),
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_user_id),
            'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_user_id),
            'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_user_id)
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;
  END IF;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'meta', json_build_object(
      'page', p_page,
      'count', p_count,
      'total', v_total
    )
  );
END;
$$;

-- -----------------------------------------------
-- 4.4 get_banner_feed — filtre par type structurel
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_banner_feed(
  p_type TEXT DEFAULT 'latest',
  p_page INT DEFAULT 1,
  p_count INT DEFAULT 10,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INT;
  v_total INT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_count;

  SELECT COUNT(*) INTO v_total
  FROM places
  WHERE place_type_id IN ('produit', 'evenement');

  IF p_type = 'all' THEN
    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE
          WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
          THEN p.images->0->>'url'
          ELSE NULL
        END,
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
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'avg_score', AVG(r.score),
        'url', p.text,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_user_id),
            'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_user_id),
            'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_user_id)
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE p.place_type_id IN ('produit', 'evenement')
      GROUP BY p.id, pt.id, t.id
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSE
    -- type = 'latest' avec filtre date
    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE
          WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
          THEN p.images->0->>'url'
          ELSE NULL
        END,
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
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'avg_score', AVG(r.score),
        'url', p.text,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_user_id),
            'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_user_id),
            'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_user_id)
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE p.place_type_id IN ('produit', 'evenement')
        AND CURRENT_DATE >= p.begin_at - INTERVAL '7 days'
        AND CURRENT_DATE <= p.end_at
      GROUP BY p.id, pt.id, t.id
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;
  END IF;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'meta', json_build_object(
      'page', p_page,
      'count', p_count,
      'total', v_total
    )
  );
END;
$$;

-- -----------------------------------------------
-- 4.5 get_place_by_id — ajoute tags + primaryTag
-- -----------------------------------------------
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
    'requester', v_requester,
    'lastExplorers', COALESCE(v_last_explorers, '[]'::json),
    'beginAt', v_place.begin_at,
    'endAt', v_place.end_at
  );
END;
$$;

-- -----------------------------------------------
-- 4.8 get_user_places — ajoute primaryTag
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_places(
  p_user_id TEXT,
  p_list_type TEXT DEFAULT 'added',
  p_page INT DEFAULT 1,
  p_count INT DEFAULT 10,
  p_requester_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INT;
  v_total INT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_count;

  IF p_list_type = 'liked' THEN
    SELECT COUNT(*) INTO v_total
    FROM places p
    WHERE p.id IN (SELECT place_id FROM places_liked WHERE user_id = p_user_id)
      AND p.place_type_id = 'lieu';

    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE WHEN jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE WHEN t.id IS NOT NULL THEN json_build_object('id', t.id, 'title', t.title, 'color', t.color, 'background', t.background) ELSE NULL END,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'requester', CASE WHEN p_requester_id IS NOT NULL THEN json_build_object(
          'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_requester_id),
          'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_requester_id),
          'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_requester_id)
        ) ELSE NULL END
      ) AS row_data
      FROM places p
      JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      WHERE p.id IN (SELECT place_id FROM places_liked WHERE user_id = p_user_id)
        AND p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSIF p_list_type = 'bookmarked' THEN
    SELECT COUNT(*) INTO v_total
    FROM places p
    WHERE p.id IN (SELECT place_id FROM places_bookmarked WHERE user_id = p_user_id)
      AND p.place_type_id = 'lieu';

    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE WHEN jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE WHEN t.id IS NOT NULL THEN json_build_object('id', t.id, 'title', t.title, 'color', t.color, 'background', t.background) ELSE NULL END,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'requester', CASE WHEN p_requester_id IS NOT NULL THEN json_build_object(
          'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_requester_id),
          'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_requester_id),
          'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_requester_id)
        ) ELSE NULL END
      ) AS row_data
      FROM places p
      JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      WHERE p.id IN (SELECT place_id FROM places_bookmarked WHERE user_id = p_user_id)
        AND p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSIF p_list_type = 'explored' THEN
    SELECT COUNT(*) INTO v_total
    FROM places p
    WHERE p.id IN (SELECT place_id FROM places_explored WHERE user_id = p_user_id)
      AND p.place_type_id = 'lieu';

    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE WHEN jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE WHEN t.id IS NOT NULL THEN json_build_object('id', t.id, 'title', t.title, 'color', t.color, 'background', t.background) ELSE NULL END,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'requester', CASE WHEN p_requester_id IS NOT NULL THEN json_build_object(
          'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_requester_id),
          'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_requester_id),
          'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_requester_id)
        ) ELSE NULL END
      ) AS row_data
      FROM places p
      JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      WHERE p.id IN (SELECT place_id FROM places_explored WHERE user_id = p_user_id)
        AND p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSE
    -- type = 'added'
    SELECT COUNT(*) INTO v_total
    FROM places p
    WHERE p.author_id = p_user_id AND p.place_type_id = 'lieu';

    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE WHEN jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE WHEN t.id IS NOT NULL THEN json_build_object('id', t.id, 'title', t.title, 'color', t.color, 'background', t.background) ELSE NULL END,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'requester', CASE WHEN p_requester_id IS NOT NULL THEN json_build_object(
          'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_requester_id),
          'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_requester_id),
          'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_requester_id)
        ) ELSE NULL END
      ) AS row_data
      FROM places p
      JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      WHERE p.author_id = p_user_id AND p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;
  END IF;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'meta', json_build_object(
      'page', p_page,
      'count', p_count,
      'total', v_total
    )
  );
END;
$$;

-- -----------------------------------------------
-- 4.9 get_user_profile — adapte filtre hidden → type
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_profile(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_profile_url TEXT;
  v_places_added INT;
  v_places_explored INT;
BEGIN
  SELECT * INTO v_user FROM users WHERE id = p_user_id;
  IF v_user IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- Photo de profil
  SELECT
    CASE
      WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
        COALESCE(
          (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
          (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
        )
      ELSE NULL
    END INTO v_profile_url
  FROM image_media im
  WHERE im.id = v_user.profile_image_id;

  -- Nombre de places ajoutees (type lieu uniquement)
  SELECT COUNT(*) INTO v_places_added
  FROM places p
  WHERE p.author_id = p_user_id AND p.place_type_id = 'lieu';

  -- Nombre de places explorees
  SELECT COUNT(*) INTO v_places_explored
  FROM places_explored WHERE user_id = p_user_id;

  RETURN json_build_object(
    'id', v_user.id,
    'lastName', v_user.last_name,
    'biography', COALESCE(v_user.bio, v_user.biography, ''),
    'profileImageUrl', v_profile_url,
    'instagramId', v_user.instagram_id,
    'websiteUrl', v_user.website_url,
    'metrics', json_build_object(
      'placesAdded', v_places_added,
      'placesExplored', v_places_explored
    )
  );
END;
$$;
