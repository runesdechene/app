-- Migration 093: Add slug to get_place_by_id return
-- La colonne places.slug existe depuis la migration 091 mais la RPC
-- get_place_by_id (migration 075) ne la retournait pas au JSON final.
-- Sans ça, le bouton Partager (feature 2026-04-21) ne peut pas construire
-- l'URL SEO et reste masqué.
-- Copie conforme de la 075 + ajout 'slug' dans le json_build_object final.

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
  v_primary_tag JSON;
  v_all_tags JSON;
  v_claim JSON;
  v_zone_fort INT;
  v_zone_count INT;
  v_claimer_name TEXT;
  v_radius_km NUMERIC(6,1);
  v_lat_delta NUMERIC(8,5);
  v_lon_delta NUMERIC(8,5);
BEGIN
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT * INTO v_place_type FROM place_types WHERE id = v_place.place_type_id;
  SELECT * INTO v_author FROM users WHERE id = v_place.author_id;

  -- Metrics
  SELECT COUNT(*) INTO v_views_count FROM places_viewed WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_likes_count FROM places_liked WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_explored_count FROM places_explored WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_geocache_count FROM reviews WHERE place_id = p_id AND geocache = true;
  SELECT AVG(score) INTO v_avg_score FROM reviews WHERE place_id = p_id;

  -- Derniers explorateurs
  SELECT json_agg(explorer) INTO v_last_explorers
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'lastName', COALESCE(u.display_name, u.first_name, 'Aventurier'),
      'profileImageUrl', u.avatar_url
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
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

  -- Rayon configurable
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_detection_radius_km'), '10')::NUMERIC(6,1) INTO v_radius_km;
  v_lat_delta := v_radius_km / 111.0;
  v_lon_delta := v_radius_km / 79.0;

  -- Fortification voisins
  v_zone_fort := 0;
  v_zone_count := 0;
  IF v_place.faction_id IS NOT NULL THEN
    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_zone_fort
    FROM places p2
    WHERE p2.faction_id = v_place.faction_id
      AND p2.id != p_id
      AND p2.fortification_level > 0
      AND ABS(p2.latitude - v_place.latitude) < v_lat_delta
      AND ABS(p2.longitude - v_place.longitude) < v_lon_delta
      AND sqrt(pow((p2.latitude - v_place.latitude) * 111, 2) + pow((p2.longitude - v_place.longitude) * 79, 2)) <= v_radius_km;
  END IF;

  -- Nom du joueur qui a revendique
  IF v_place.claimed_by IS NOT NULL THEN
    SELECT COALESCE(display_name, first_name, 'Inconnu')
    INTO v_claimer_name
    FROM users WHERE id = v_place.claimed_by;
  END IF;

  -- Claim info
  IF v_place.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'factionId', f.id,
      'factionTitle', f.title,
      'factionColor', f.color,
      'factionPattern', f.pattern,
      'claimedBy', v_place.claimed_by,
      'claimedByName', COALESCE(v_claimer_name, 'Inconnu'),
      'claimedAt', v_place.claimed_at,
      'fortificationLevel', v_place.fortification_level,
      'zoneFortification', v_zone_fort,
      'zoneNeighborCount', v_zone_count
    ) INTO v_claim
    FROM factions f
    WHERE f.id = v_place.faction_id;
  ELSE
    v_claim := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_place.id,
    'slug', v_place.slug,
    'title', v_place.title,
    'text', v_place.text,
    'address', v_place.address,
    'accessibility', v_place.accessibility,
    'sensible', COALESCE(v_place.sensible, false),
    'geocaching', v_geocache_count > 0,
    'images', v_place.images,
    'author', json_build_object(
      'id', COALESCE(v_author.id, v_place.author_id),
      'lastName', COALESCE(v_author.display_name, v_author.first_name, 'Utilisateur inconnu'),
      'profileImageUrl', v_author.avatar_url
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
    'endAt', v_place.end_at,
    'createdAt', v_place.created_at,
    'eraId', v_place.era_id,
    'eraName', (SELECT e.name FROM eras e WHERE e.id = v_place.era_id),
    'yearExact', v_place.year_exact
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_by_id(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_by_id(TEXT, TEXT) TO anon;
