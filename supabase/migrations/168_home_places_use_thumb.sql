-- 168_home_places_use_thumb.sql
--
-- WHY : les cards "Lieux récents / À proximité" de la home mobile
-- chargeaient images[0].url (5+ MB sur Cathédrale Sainte-Cécile) au lieu
-- du thumb (300 KB déjà généré par le pipeline d'upload). Sur 4G mobile,
-- 9 cards × 5 MB = 45 MB à charger pour une simple home.
-- Fix : COALESCE(thumb, url) — fallback url pour les rares anciennes
-- images qui n'auraient pas encore de thumb.
--
-- Reprend EXACTEMENT mig 151 (cf. discipline B1 : copier-coller la baseline)
-- en ne changeant QUE l'extraction d'image_url.

BEGIN;

-- ────────────────────────────────────────────────────────────────────
-- get_recent_places : thumb prioritaire
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
  created_at TIMESTAMPTZ,
  tag_icon TEXT,
  tag_color TEXT,
  author_id TEXT,
  author_name TEXT
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
      THEN COALESCE(p.images->0->>'thumb', p.images->0->>'url')
      ELSE NULL
    END AS image_url,
    p.created_at,
    t.icon::TEXT  AS tag_icon,
    t.color::TEXT AS tag_color,
    p.author_id::TEXT AS author_id,
    COALESCE(NULLIF(u.first_name, '')::TEXT, u.display_name, 'Quelqu''un') AS author_name
  FROM public.places p
  LEFT JOIN public.place_tags pt
    ON pt.place_id = p.id AND pt.is_primary = TRUE
  LEFT JOIN public.tags t
    ON t.id = pt.tag_id
  LEFT JOIN public.users u
    ON u.id = p.author_id
  WHERE p.private = false
    AND p.masked = false
  ORDER BY p.created_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_places(INT) TO authenticated;

-- ────────────────────────────────────────────────────────────────────
-- get_nearby_places : thumb prioritaire (Haversine inchangé)
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
  distance_km DOUBLE PRECISION,
  created_at TIMESTAMPTZ,
  tag_icon TEXT,
  tag_color TEXT,
  author_id TEXT,
  author_name TEXT
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
      THEN COALESCE(p.images->0->>'thumb', p.images->0->>'url')
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
    ) AS distance_km,
    p.created_at,
    t.icon::TEXT  AS tag_icon,
    t.color::TEXT AS tag_color,
    p.author_id::TEXT AS author_id,
    COALESCE(NULLIF(u.first_name, '')::TEXT, u.display_name, 'Quelqu''un') AS author_name
  FROM public.places p
  LEFT JOIN public.place_tags pt
    ON pt.place_id = p.id AND pt.is_primary = TRUE
  LEFT JOIN public.tags t
    ON t.id = pt.tag_id
  LEFT JOIN public.users u
    ON u.id = p.author_id
  WHERE p.private = false
    AND p.masked = false
  ORDER BY distance_km ASC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_places(DOUBLE PRECISION, DOUBLE PRECISION, INT) TO authenticated;

COMMIT;
