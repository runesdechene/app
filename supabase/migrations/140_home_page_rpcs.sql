-- 140_home_page_rpcs.sql
--
-- 3 RPCs pour la HomePage (pivot home-first, 9 mai 2026) :
--   - get_recent_fragments : carrousel "Fragments" sur la home (10 derniers visibles)
--   - get_recent_places    : tab "Nouveaux Lieux" (derniers lieux publics)
--   - get_nearby_places    : tab "Proches" (Haversine, sans PostGIS)
--
-- Schéma confirmé via baseline 2026-04-22 :
--   * title_fragments (id INT, name, icon, icon_url, image_url, link_url,
--                      collection, created_at, visible BOOL)
--   * user_fragments  (user_id VARCHAR, fragment_id INT)
--   * places          (id VARCHAR, title, slug, latitude REAL, longitude REAL,
--                      images JSONB, private BOOL, masked BOOL, created_at)
--
-- Lieux "visibles" = private = false AND masked = false (pattern existant cf. mig 002).
-- Image de cover = images->0->>'url' (jsonb array, pattern existant).

BEGIN;

-- ────────────────────────────────────────────────────────────────────
-- 1) get_recent_fragments : derniers fragments visibles, marque owned
-- ────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_recent_fragments(text, int);
CREATE OR REPLACE FUNCTION public.get_recent_fragments(
  p_user_id TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id INT,
  name TEXT,
  icon TEXT,
  icon_url TEXT,
  image_url TEXT,
  link_url TEXT,
  collection TEXT,
  owned BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tf.id,
    tf.name::TEXT,
    tf.icon::TEXT,
    tf.icon_url,
    tf.image_url,
    tf.link_url,
    tf.collection::TEXT,
    EXISTS (
      SELECT 1 FROM public.user_fragments uf
      WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id
    ) AS owned
  FROM public.title_fragments tf
  WHERE tf.visible = true
  ORDER BY tf.created_at DESC NULLS LAST, tf.id DESC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_fragments(TEXT, INT) TO authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 2) get_recent_places : derniers lieux publics validés
-- ────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_recent_places(int);
CREATE OR REPLACE FUNCTION public.get_recent_places(
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  slug TEXT,
  latitude REAL,
  longitude REAL,
  image_url TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id::TEXT,
    p.title::TEXT,
    p.slug,
    p.latitude,
    p.longitude,
    CASE
      WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
      THEN p.images->0->>'url'
      ELSE NULL
    END AS image_url,
    p.created_at
  FROM public.places p
  WHERE p.private = false
    AND p.masked = false
  ORDER BY p.created_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_places(INT) TO authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 3) get_nearby_places : Haversine inline (rayon Terre = 6371 km)
-- ────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_nearby_places(double precision, double precision, int);
CREATE OR REPLACE FUNCTION public.get_nearby_places(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  slug TEXT,
  latitude REAL,
  longitude REAL,
  image_url TEXT,
  distance_km DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id::TEXT,
    p.title::TEXT,
    p.slug,
    p.latitude,
    p.longitude,
    CASE
      WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
      THEN p.images->0->>'url'
      ELSE NULL
    END AS image_url,
    (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_lat)) * cos(radians(p.latitude::DOUBLE PRECISION))
          * cos(radians(p.longitude::DOUBLE PRECISION) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(p.latitude::DOUBLE PRECISION))
        ))
      )
    ) AS distance_km
  FROM public.places p
  WHERE p.private = false
    AND p.masked = false
  ORDER BY distance_km ASC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_places(DOUBLE PRECISION, DOUBLE PRECISION, INT) TO authenticated;

COMMIT;
