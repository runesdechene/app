-- Migration 078: Extend contribute_to_place with info types + first-contribution rewards
-- Adds p_era_id and p_year_exact params.
-- For info types (accessibility, season, warning, epoch): grants erudition on first-ever contribution.
-- For epoch type: also updates places.era_id and places.year_exact.
-- Returns isFirstContribution boolean in JSON response.

-- Add 'epoch' to the CHECK constraint on place_contributions.type
ALTER TABLE place_contributions DROP CONSTRAINT IF EXISTS place_contributions_type_check;
ALTER TABLE place_contributions ADD CONSTRAINT place_contributions_type_check
  CHECK (type IN ('carnet', 'photo', 'accessibility', 'season', 'warning', 'epoch'));

-- Drop old signature before replacing
DROP FUNCTION IF EXISTS public.contribute_to_place(TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.contribute_to_place(
  p_user_id    TEXT,
  p_place_id   TEXT,
  p_type       TEXT,
  p_content    TEXT DEFAULT NULL,
  p_image_url  TEXT DEFAULT NULL,
  p_era_id     TEXT DEFAULT NULL,
  p_year_exact INT  DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id          TEXT;
  v_exploration_gain    INT := 0;
  v_erudition_gain      INT := 0;
  v_contribution_id     INT;
  v_place_title         TEXT;
  v_place_lat           NUMERIC;
  v_place_lng           NUMERIC;
  v_actor_name          TEXT;
  v_faction_color       TEXT;
  v_faction_pattern     TEXT;
  v_explorer            RECORD;
  v_is_first_contrib    BOOLEAN := FALSE;
  v_info_types          TEXT[] := ARRAY['accessibility', 'season', 'warning', 'epoch'];
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM users WHERE id = p_user_id;

  SELECT color, pattern INTO v_faction_color, v_faction_pattern
  FROM factions WHERE id = v_faction_id;

  -- Detect first-ever contribution of this type on this place (any user)
  IF p_type = ANY(v_info_types) THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM place_contributions
      WHERE place_id = p_place_id AND type = p_type
    ) INTO v_is_first_contrib;
  END IF;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, image_url)
  VALUES (p_place_id, p_user_id, v_faction_id, p_type, p_content, p_image_url)
  ON CONFLICT (place_id, user_id, type)
  DO UPDATE SET content   = COALESCE(EXCLUDED.content,    place_contributions.content),
               image_url  = COALESCE(EXCLUDED.image_url,  place_contributions.image_url),
               updated_at = NOW()
  RETURNING id INTO v_contribution_id;

  -- Rewards based on contribution type
  IF p_type = 'photo' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_photo'), 5)
      INTO v_exploration_gain;

  ELSIF p_type = 'carnet' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_carnet'), 5)
      INTO v_exploration_gain;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'erudition_add_carnet'), 3)
      INTO v_erudition_gain;

  ELSIF p_type = ANY(v_info_types) AND v_is_first_contrib THEN
    -- First-ever contribution on this (place, type): erudition reward, no exploration
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'erudition_add_info'), 1)
      INTO v_erudition_gain;
  END IF;

  IF v_exploration_gain > 0 OR v_erudition_gain > 0 THEN
    UPDATE users SET
      exploration_points = exploration_points + v_exploration_gain,
      erudition_points   = erudition_points   + v_erudition_gain
    WHERE id = p_user_id;
  END IF;

  -- For epoch contributions: persist era and year on the place
  IF p_type = 'epoch' AND p_era_id IS NOT NULL THEN
    UPDATE places
    SET era_id     = p_era_id,
        year_exact = p_year_exact
    WHERE id = p_place_id;
  END IF;

  PERFORM recalc_place_content_points(p_place_id);

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('contribute', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object(
      'contributionType',  p_type,
      'placeTitle',        v_place_title,
      'placeLatitude',     v_place_lat,
      'placeLongitude',    v_place_lng,
      'actorName',         v_actor_name,
      'factionColor',      v_faction_color,
      'factionPattern',    v_faction_pattern,
      'explorationGain',   v_exploration_gain,
      'eruditionGain',     v_erudition_gain,
      'isFirstContribution', v_is_first_contrib
    ));

  IF p_type = 'carnet' THEN
    FOR v_explorer IN
      SELECT user_id FROM place_explorers
      WHERE place_id = p_place_id AND user_id != p_user_id
    LOOP
      PERFORM notify(v_explorer.user_id, 'new_carnet', jsonb_build_object(
        'actorName', v_actor_name,
        'actorId',   p_user_id,
        'placeId',   p_place_id
      ));
    END LOOP;
  END IF;

  RETURN json_build_object(
    'success',             true,
    'contributionId',      v_contribution_id,
    'explorationGain',     v_exploration_gain,
    'eruditionGain',       v_erudition_gain,
    'isFirstContribution', v_is_first_contrib
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.contribute_to_place(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT) TO authenticated;

-- Seed default value for info contribution rewards
INSERT INTO public.app_settings (key, value)
VALUES ('erudition_add_info', '1')
ON CONFLICT (key) DO NOTHING;
