-- ============================================
-- EXPLORE : Tables, RLS, Storage & RPC
-- Migration depuis explore-api (NestJS/DigitalOcean) vers Supabase
-- ============================================

-- ============================================
-- 1. TABLES
-- ============================================

-- La table "users" existe deja (001 + 002 + 003 + 004).
-- On ajoute les colonnes manquantes pour explore.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS rank VARCHAR(255) DEFAULT 'guest';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS website_url VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_access TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_device_os VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_device_version VARCHAR(255);

-- ============================================
-- IMAGE MEDIA
-- ============================================

CREATE TABLE IF NOT EXISTS image_media (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variants JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_image_media_user_id ON image_media(user_id);

-- Lien profil user -> image_media
-- (on ne cree pas de FK car profile_image_id peut pointer vers une image supprimee)

-- ============================================
-- PLACE TYPES
-- ============================================

CREATE TABLE IF NOT EXISTS place_types (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parent_id VARCHAR(255) REFERENCES place_types(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  form_description VARCHAR(255) NOT NULL DEFAULT '',
  long_description VARCHAR(255) NOT NULL DEFAULT '',
  images JSONB NOT NULL DEFAULT '{}',
  color VARCHAR(255) NOT NULL DEFAULT '#000000',
  background VARCHAR(255) NOT NULL DEFAULT '#FFFFFF',
  border VARCHAR(255) NOT NULL DEFAULT '#000000',
  faded_color VARCHAR(255) NOT NULL DEFAULT '#CCCCCC',
  "order" INT NOT NULL DEFAULT 0,
  hidden BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_place_types_parent_id ON place_types(parent_id);

-- ============================================
-- PLACES
-- ============================================

CREATE TABLE IF NOT EXISTS places (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  author_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_type_id VARCHAR(255) NOT NULL REFERENCES place_types(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  address VARCHAR(255) NOT NULL DEFAULT '',
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  private BOOLEAN NOT NULL DEFAULT FALSE,
  masked BOOLEAN NOT NULL DEFAULT FALSE,
  images JSONB NOT NULL DEFAULT '[]',
  accessibility VARCHAR(255),
  sensible BOOLEAN NOT NULL DEFAULT FALSE,
  begin_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_places_author_id ON places(author_id);
CREATE INDEX IF NOT EXISTS idx_places_place_type_id ON places(place_type_id);
CREATE INDEX IF NOT EXISTS idx_places_created_at ON places(created_at DESC);

-- ============================================
-- PLACES ACTIONS (viewed, liked, explored, bookmarked)
-- ============================================

CREATE TABLE IF NOT EXISTS places_viewed (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_places_viewed_user ON places_viewed(user_id);
CREATE INDEX IF NOT EXISTS idx_places_viewed_place ON places_viewed(place_id);

CREATE TABLE IF NOT EXISTS places_liked (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  UNIQUE(user_id, place_id)
);
CREATE INDEX IF NOT EXISTS idx_places_liked_user ON places_liked(user_id);
CREATE INDEX IF NOT EXISTS idx_places_liked_place ON places_liked(place_id);

CREATE TABLE IF NOT EXISTS places_explored (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  UNIQUE(user_id, place_id)
);
CREATE INDEX IF NOT EXISTS idx_places_explored_user ON places_explored(user_id);
CREATE INDEX IF NOT EXISTS idx_places_explored_place ON places_explored(place_id);

CREATE TABLE IF NOT EXISTS places_bookmarked (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  UNIQUE(user_id, place_id)
);
CREATE INDEX IF NOT EXISTS idx_places_bookmarked_user ON places_bookmarked(user_id);
CREATE INDEX IF NOT EXISTS idx_places_bookmarked_place ON places_bookmarked(place_id);

-- ============================================
-- REVIEWS
-- ============================================

CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT '',
  geocache BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_place ON reviews(place_id);

-- Table de jointure reviews <-> image_media (M2M)
CREATE TABLE IF NOT EXISTS reviews_images (
  review_id VARCHAR(255) NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  image_media_id VARCHAR(255) NOT NULL REFERENCES image_media(id) ON DELETE CASCADE,
  PRIMARY KEY (review_id, image_media_id)
);

-- ============================================
-- MEMBER CODES (systeme guest/member)
-- ============================================

CREATE TABLE IF NOT EXISTS member_codes (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id VARCHAR(255) UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  code VARCHAR(255) NOT NULL UNIQUE,
  is_consumed BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_member_codes_code ON member_codes(code);

-- ============================================
-- 2. ROW LEVEL SECURITY
-- ============================================

-- PLACES : tout le monde peut lire, seul l'auteur peut modifier
ALTER TABLE places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view places"
  ON places FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create places"
  ON places FOR INSERT
  WITH CHECK (auth.uid()::text = author_id);

CREATE POLICY "Authors can update their places"
  ON places FOR UPDATE
  USING (auth.uid()::text = author_id);

CREATE POLICY "Authors can delete their places"
  ON places FOR DELETE
  USING (auth.uid()::text = author_id);

-- PLACE TYPES : lecture publique, pas de modification client
ALTER TABLE place_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view place types"
  ON place_types FOR SELECT
  USING (true);

-- IMAGE MEDIA : lecture publique, creation par l'owner
ALTER TABLE image_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view image media"
  ON image_media FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own image media"
  ON image_media FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own image media"
  ON image_media FOR DELETE
  USING (auth.uid()::text = user_id);

-- REVIEWS : lecture publique, CRUD par l'auteur
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own reviews"
  ON reviews FOR DELETE
  USING (auth.uid()::text = user_id);

-- REVIEWS_IMAGES : lecture publique, insertion par l'auteur de la review
ALTER TABLE reviews_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view review images"
  ON reviews_images FOR SELECT
  USING (true);

CREATE POLICY "Review authors can manage review images"
  ON reviews_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.id = review_id
      AND reviews.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Review authors can delete review images"
  ON reviews_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.id = review_id
      AND reviews.user_id = auth.uid()::text
    )
  );

-- PLACES ACTIONS : chaque user gere ses propres actions
-- VIEWED
ALTER TABLE places_viewed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view place views"
  ON places_viewed FOR SELECT USING (true);

CREATE POLICY "Users can create their own views"
  ON places_viewed FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- LIKED
ALTER TABLE places_liked ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view place likes"
  ON places_liked FOR SELECT USING (true);

CREATE POLICY "Users can like places"
  ON places_liked FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can unlike places"
  ON places_liked FOR DELETE
  USING (auth.uid()::text = user_id);

-- EXPLORED
ALTER TABLE places_explored ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view explored places"
  ON places_explored FOR SELECT USING (true);

CREATE POLICY "Users can mark places as explored"
  ON places_explored FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can unmark explored places"
  ON places_explored FOR DELETE
  USING (auth.uid()::text = user_id);

-- BOOKMARKED
ALTER TABLE places_bookmarked ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bookmarked places"
  ON places_bookmarked FOR SELECT USING (true);

CREATE POLICY "Users can bookmark places"
  ON places_bookmarked FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can remove bookmarks"
  ON places_bookmarked FOR DELETE
  USING (auth.uid()::text = user_id);

-- MEMBER CODES : lecture par admin uniquement
ALTER TABLE member_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage member codes"
  ON member_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::text
      AND role = 'admin'
    )
  );

-- ============================================
-- 3. STORAGE BUCKET
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('place-images', 'place-images', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique
CREATE POLICY "Public read access on place-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'place-images');

-- Upload par les utilisateurs authentifies
CREATE POLICY "Authenticated users can upload place images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'place-images'
    AND auth.role() = 'authenticated'
  );

-- Suppression par l'owner (le path commence par user_id/)
CREATE POLICY "Users can delete their own place images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'place-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- 4. FONCTIONS RPC
-- ============================================

-- -----------------------------------------------
-- 4.1 get_map_places
-- Retourne les places pour la carte
-- Types: 'all' (viewport), 'latest', 'popular'
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
          'title', pt.title,
          'color', pt.color,
          'background', pt.background,
          'border', pt.border,
          'fadedColor', pt.faded_color,
          'images', pt.images,
          'order', pt."order",
          'hidden', pt.hidden
        ),
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
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      WHERE pt.hidden IS FALSE
      GROUP BY p.id, pt.id
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
          'title', pt.title,
          'color', pt.color,
          'background', pt.background,
          'border', pt.border,
          'fadedColor', pt.faded_color,
          'images', pt.images,
          'order', pt."order",
          'hidden', pt.hidden
        ),
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
      WHERE pt.hidden IS FALSE
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
          'title', pt.title,
          'color', pt.color,
          'background', pt.background,
          'border', pt.border,
          'fadedColor', pt.faded_color,
          'images', pt.images,
          'order', pt."order",
          'hidden', pt.hidden
        ),
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
      WHERE pt.hidden IS FALSE
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
-- 4.2 get_map_banners
-- Places de type "hidden" (bannieres/evenements) dans le viewport
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
        'title', pt.title,
        'color', pt.color,
        'background', pt.background,
        'border', pt.border,
        'fadedColor', pt.faded_color,
        'images', pt.images,
        'order', pt."order",
        'hidden', pt.hidden
      ),
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
    WHERE pt.hidden IS TRUE
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
-- 4.3 get_regular_feed
-- Feed pagine : latest, closest (Haversine), popular
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

  SELECT COUNT(*) INTO v_total FROM places;

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
          'title', pt.title,
          'color', pt.color,
          'background', pt.background,
          'border', pt.border,
          'fadedColor', pt.faded_color,
          'images', pt.images,
          'order', pt."order",
          'hidden', pt.hidden
        ),
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
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE pt.hidden IS FALSE
      GROUP BY p.id, pt.id
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
          'title', pt.title,
          'color', pt.color,
          'background', pt.background,
          'border', pt.border,
          'fadedColor', pt.faded_color,
          'images', pt.images,
          'order', pt."order",
          'hidden', pt.hidden
        ),
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
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE pt.hidden IS FALSE
      GROUP BY p.id, pt.id
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
          'title', pt.title,
          'color', pt.color,
          'background', pt.background,
          'border', pt.border,
          'fadedColor', pt.faded_color,
          'images', pt.images,
          'order', pt."order",
          'hidden', pt.hidden
        ),
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
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE pt.hidden IS FALSE
      GROUP BY p.id, pt.id
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
-- 4.4 get_banner_feed
-- Feed des bannieres (place_types hidden = true)
-- Types: 'all' (populaires), 'latest' (avec filtre date)
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

  SELECT COUNT(*) INTO v_total FROM places;

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
          'title', pt.title,
          'color', pt.color,
          'background', pt.background,
          'border', pt.border,
          'fadedColor', pt.faded_color,
          'images', pt.images,
          'order', pt."order",
          'hidden', pt.hidden
        ),
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
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE pt.hidden IS TRUE
      GROUP BY p.id, pt.id
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSE
    -- type = 'latest' avec filtre date (7 jours avant begin_at jusqu'a end_at)
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
          'title', pt.title,
          'color', pt.color,
          'background', pt.background,
          'border', pt.border,
          'fadedColor', pt.faded_color,
          'images', pt.images,
          'order', pt."order",
          'hidden', pt.hidden
        ),
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
      LEFT JOIN reviews r ON r.place_id = p.id
      WHERE pt.hidden IS TRUE
        AND CURRENT_DATE >= p.begin_at - INTERVAL '7 days'
        AND CURRENT_DATE <= p.end_at
      GROUP BY p.id, pt.id
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
-- 4.5 get_place_by_id
-- Detail complet d'une place avec metrics et requester state
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
BEGIN
  -- Recuperer la place
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Recuperer le type
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
      'title', v_place_type.title,
      'color', v_place_type.color,
      'background', v_place_type.background,
      'border', v_place_type.border,
      'fadedColor', v_place_type.faded_color,
      'images', v_place_type.images,
      'order', v_place_type."order",
      'hidden', v_place_type.hidden,
      'parent', v_place_type.parent_id
    ),
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
-- 4.6 get_place_reviews
-- Reviews paginées pour une place
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_place_reviews(
  p_place_id TEXT,
  p_page INT DEFAULT 1,
  p_count INT DEFAULT 10
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

  SELECT COUNT(*) INTO v_total FROM reviews WHERE place_id = p_place_id;

  SELECT json_agg(row_data) INTO v_data
  FROM (
    SELECT json_build_object(
      'id', r.id,
      'score', r.score,
      'message', r.message,
      'geocache', r.geocache,
      'createdAt', r.created_at,
      'user', json_build_object(
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
      ),
      'images', COALESCE(
        (
          SELECT json_agg(json_build_object(
            'id', rim.id,
            'thumbnailUrl', COALESCE(
              (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
              (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
              (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'original' LIMIT 1)
            ),
            'largeUrl', COALESCE(
              (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'webp_large' LIMIT 1),
              (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'png_large' LIMIT 1),
              (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'original' LIMIT 1)
            )
          ))
          FROM reviews_images ri
          JOIN image_media rim ON rim.id = ri.image_media_id
          WHERE ri.review_id = r.id
        ),
        '[]'::json
      )
    ) AS row_data
    FROM reviews r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
    WHERE r.place_id = p_place_id
    ORDER BY r.created_at DESC
    LIMIT p_count OFFSET v_offset
  ) sub;

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
-- 4.7 get_review_by_id
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_review_by_id(
  p_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'id', r.id,
    'score', r.score,
    'message', r.message,
    'geocache', r.geocache,
    'createdAt', r.created_at,
    'user', json_build_object(
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
    ),
    'images', COALESCE(
      (
        SELECT json_agg(json_build_object(
          'id', rim.id,
          'thumbnailUrl', COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          ),
          'largeUrl', COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'webp_large' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'png_large' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(rim.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ))
        FROM reviews_images ri
        JOIN image_media rim ON rim.id = ri.image_media_id
        WHERE ri.review_id = r.id
      ),
      '[]'::json
    )
  ) INTO v_result
  FROM reviews r
  JOIN users u ON u.id = r.user_id
  LEFT JOIN image_media im ON im.id = u.profile_image_id
  WHERE r.id = p_id;

  RETURN COALESCE(v_result, json_build_object('error', 'Review not found'));
END;
$$;

-- -----------------------------------------------
-- 4.8 get_user_places (liked, bookmarked, explored, added)
-- Fonction generique pour les listes de places d'un user
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
    JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.id IN (SELECT place_id FROM places_liked WHERE user_id = p_user_id)
      AND pt.hidden IS FALSE;

    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE WHEN jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
        'type', json_build_object('id', pt.id, 'title', pt.title, 'color', pt.color, 'background', pt.background, 'border', pt.border, 'fadedColor', pt.faded_color, 'images', pt.images, 'order', pt."order", 'hidden', pt.hidden),
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'requester', CASE WHEN p_requester_id IS NOT NULL THEN json_build_object(
          'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_requester_id),
          'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_requester_id),
          'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_requester_id)
        ) ELSE NULL END
      ) AS row_data
      FROM places p
      JOIN place_types pt ON pt.id = p.place_type_id
      WHERE p.id IN (SELECT place_id FROM places_liked WHERE user_id = p_user_id)
        AND pt.hidden IS FALSE
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSIF p_list_type = 'bookmarked' THEN
    SELECT COUNT(*) INTO v_total
    FROM places p
    JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.id IN (SELECT place_id FROM places_bookmarked WHERE user_id = p_user_id)
      AND pt.hidden IS FALSE;

    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE WHEN jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
        'type', json_build_object('id', pt.id, 'title', pt.title, 'color', pt.color, 'background', pt.background, 'border', pt.border, 'fadedColor', pt.faded_color, 'images', pt.images, 'order', pt."order", 'hidden', pt.hidden),
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'requester', CASE WHEN p_requester_id IS NOT NULL THEN json_build_object(
          'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_requester_id),
          'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_requester_id),
          'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_requester_id)
        ) ELSE NULL END
      ) AS row_data
      FROM places p
      JOIN place_types pt ON pt.id = p.place_type_id
      WHERE p.id IN (SELECT place_id FROM places_bookmarked WHERE user_id = p_user_id)
        AND pt.hidden IS FALSE
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSIF p_list_type = 'explored' THEN
    SELECT COUNT(*) INTO v_total
    FROM places p
    JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.id IN (SELECT place_id FROM places_explored WHERE user_id = p_user_id)
      AND pt.hidden IS FALSE;

    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE WHEN jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
        'type', json_build_object('id', pt.id, 'title', pt.title, 'color', pt.color, 'background', pt.background, 'border', pt.border, 'fadedColor', pt.faded_color, 'images', pt.images, 'order', pt."order", 'hidden', pt.hidden),
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'requester', CASE WHEN p_requester_id IS NOT NULL THEN json_build_object(
          'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_requester_id),
          'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_requester_id),
          'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_requester_id)
        ) ELSE NULL END
      ) AS row_data
      FROM places p
      JOIN place_types pt ON pt.id = p.place_type_id
      WHERE p.id IN (SELECT place_id FROM places_explored WHERE user_id = p_user_id)
        AND pt.hidden IS FALSE
      ORDER BY p.created_at DESC
      LIMIT p_count OFFSET v_offset
    ) sub;

  ELSE
    -- type = 'added' (places creees par l'utilisateur)
    SELECT COUNT(*) INTO v_total
    FROM places p
    JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.author_id = p_user_id AND pt.hidden IS FALSE;

    SELECT json_agg(row_data) INTO v_data
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'imageUrl', CASE WHEN jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
        'type', json_build_object('id', pt.id, 'title', pt.title, 'color', pt.color, 'background', pt.background, 'border', pt.border, 'fadedColor', pt.faded_color, 'images', pt.images, 'order', pt."order", 'hidden', pt.hidden),
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'requester', CASE WHEN p_requester_id IS NOT NULL THEN json_build_object(
          'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked pb WHERE pb.place_id = p.id AND pb.user_id = p_requester_id),
          'liked', EXISTS(SELECT 1 FROM places_liked pl WHERE pl.place_id = p.id AND pl.user_id = p_requester_id),
          'explored', EXISTS(SELECT 1 FROM places_explored pe WHERE pe.place_id = p.id AND pe.user_id = p_requester_id)
        ) ELSE NULL END
      ) AS row_data
      FROM places p
      JOIN place_types pt ON pt.id = p.place_type_id
      WHERE p.author_id = p_user_id AND pt.hidden IS FALSE
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
-- 4.9 get_user_profile
-- Profil public d'un utilisateur avec metrics
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

  -- Nombre de places ajoutees (hors hidden)
  SELECT COUNT(*) INTO v_places_added
  FROM places p
  JOIN place_types pt ON pt.id = p.place_type_id
  WHERE p.author_id = p_user_id AND pt.hidden IS FALSE;

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

-- -----------------------------------------------
-- 4.10 get_my_informations
-- Informations privees de l'utilisateur connecte
-- -----------------------------------------------
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
    'profileImage', v_profile_image
  );
END;
$$;
