-- 200_create_place_seed_description.sql
-- WHY : HOTFIX prod. _create_place_internal (mig 154) insère un carnet avec
-- ON CONFLICT (place_id, user_id, type) — contrainte supprimée par la mig 195
-- (refonte fiches collaboratives). Résultat : création de lieu cassée en prod
-- ("there is no unique or exclusion constraint matching the ON CONFLICT").
--
-- FIX + alignement modèle V0.9 : le texte de l'auteur à la création devient la
-- DESCRIPTION initiale du lieu (+ une révision), au lieu d'un carnet. Pas de
-- placeholder "Lieu découvert." si l'auteur n'écrit rien (la fiche affiche
-- l'invite). Les photos restent portées par places.images (la galerie les lit).
--
-- Reprise verbatim de 154 ; seul le bloc d'insertion place_contributions change.

BEGIN;

CREATE OR REPLACE FUNCTION public._create_place_internal(
  p_user_id      text,
  p_title        text,
  p_latitude     real,
  p_longitude    real,
  p_tag_id       text,
  p_images       jsonb DEFAULT '[]'::jsonb,
  p_address      text  DEFAULT ''::text,
  p_text         text  DEFAULT ''::text,
  p_user_lat     real  DEFAULT NULL::real,
  p_user_lng     real  DEFAULT NULL::real,
  p_carnet_title text  DEFAULT NULL::text,
  p_era_id       text  DEFAULT NULL::text,
  p_year_exact   integer DEFAULT NULL::integer
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_new_id         text;
  v_actor_name     text;
  v_faction_id     text;
  v_influence_gain int := 0;
  v_content_pts    int;
  v_is_gps         boolean := FALSE;
  v_distance_km    numeric;
  v_gps_radius     numeric;
  v_images         jsonb;
  v_desc_text      text;
  v_user_pos_provided boolean;
  v_auto_expedition_id uuid;
  v_solo_bonus         integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM tags WHERE id = p_tag_id) THEN
    RETURN json_build_object('error', 'Tag not found');
  END IF;

  v_images := COALESCE(p_images, '[]'::jsonb);

  SELECT COALESCE((SELECT value::numeric FROM app_settings WHERE key = 'distance_gps_km'), 0.5)
  INTO v_gps_radius;

  v_user_pos_provided := (p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL);

  IF v_user_pos_provided THEN
    v_distance_km := 6371 * acos(
      LEAST(1, GREATEST(-1,
        cos(radians(p_user_lat)) * cos(radians(p_latitude))
        * cos(radians(p_longitude) - radians(p_user_lng))
        + sin(radians(p_user_lat)) * sin(radians(p_latitude))
      ))
    );
    v_is_gps := v_distance_km <= v_gps_radius;
  END IF;

  v_new_id := gen_random_uuid()::text;

  INSERT INTO places (
    id, created_at, updated_at,
    author_id, place_type_id,
    title, text, address,
    latitude, longitude,
    images, private, masked,
    era_id, year_exact
  ) VALUES (
    v_new_id, NOW(), NOW(),
    p_user_id, 'lieu',
    p_title, p_text, p_address,
    p_latitude, p_longitude,
    v_images, false, false,
    p_era_id, p_year_exact
  );

  INSERT INTO place_tags (place_id, tag_id, is_primary)
  VALUES (v_new_id, p_tag_id, true);

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, v_new_id, CASE WHEN v_is_gps THEN 'gps' ELSE 'author' END)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  UPDATE users SET exploration_points = exploration_points + 5
  WHERE id = p_user_id;

  IF v_is_gps THEN
    v_influence_gain := 30;
    UPDATE users SET exploration_points = exploration_points + 10
    WHERE id = p_user_id;

    INSERT INTO place_explorers (place_id, user_id)
    VALUES (v_new_id, p_user_id)
    ON CONFLICT DO NOTHING;

    IF v_faction_id IS NOT NULL THEN
      v_solo_bonus := COALESCE(
        (SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_solo_bonus'),
        50
      );

      INSERT INTO public.expeditions (place_id, is_neutral, faction_id, title, created_at)
      VALUES (v_new_id, false, v_faction_id, NULL, NOW())
      RETURNING id INTO v_auto_expedition_id;

      INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
      VALUES (v_auto_expedition_id, p_user_id, v_faction_id);

      INSERT INTO public.place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id, veilleur_user_id)
      VALUES (v_new_id, v_auto_expedition_id, v_faction_id, false, NOW(), false, NULL, p_user_id);

      INSERT INTO public.place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
      VALUES (v_new_id, p_user_id, v_auto_expedition_id, p_user_id, 'plant_bonus', v_solo_bonus);

      INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
      VALUES (v_new_id, v_auto_expedition_id, p_user_id, v_faction_id, false, NOW());

      INSERT INTO public.activity_log (type, actor_id, place_id, faction_id, data)
      VALUES ('plant_flag', p_user_id, v_new_id, v_faction_id,
        jsonb_build_object(
          'placeTitle',   p_title,
          'isNeutral',    false,
          'expeditionId', v_auto_expedition_id,
          'memberCount',  1,
          'fromCreate',   true,
          'plantBonus',   v_solo_bonus
        ));
    END IF;
  END IF;

  v_content_pts := 10;
  IF jsonb_array_length(v_images) > 0 THEN
    v_content_pts := v_content_pts + 10;
  END IF;

  -- V200 : modèle V0.9. Le texte de l'auteur devient la DESCRIPTION initiale du
  -- lieu (+ révision), seulement s'il a réellement écrit quelque chose. Plus de
  -- carnet, plus de placeholder. Nouveau lieu => aucune description existante,
  -- donc INSERT simple (aucun ON CONFLICT, ce qui supprime le bug mig 195).
  v_desc_text := NULLIF(TRIM(p_text), '');
  IF v_desc_text IS NOT NULL THEN
    INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, created_at, updated_at)
    VALUES (v_new_id, p_user_id, v_faction_id, 'description', v_desc_text, NOW(), NOW());

    INSERT INTO place_description_revisions (place_id, content, edited_by, created_at)
    VALUES (v_new_id, v_desc_text, p_user_id, NOW());
  END IF;

  PERFORM recalc_place_content_points(v_new_id);

  SELECT COALESCE(first_name, email_address) INTO v_actor_name
  FROM users WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'new_place', p_user_id, v_new_id,
    jsonb_build_object(
      'placeTitle', p_title,
      'placeLatitude', p_latitude,
      'placeLongitude', p_longitude,
      'actorName', v_actor_name,
      'isGps', v_is_gps,
      'permanent', v_is_gps,
      'userDistanceKm', CASE WHEN v_distance_km IS NULL THEN NULL ELSE ROUND(v_distance_km, 3) END,
      'userPosProvided', v_user_pos_provided,
      'autoPlanted', v_is_gps AND v_faction_id IS NOT NULL
    )
  );

  RETURN json_build_object(
    'success', true,
    'placeId', v_new_id,
    'isGps', v_is_gps,
    'userDistanceKm', CASE WHEN v_distance_km IS NULL THEN NULL ELSE ROUND(v_distance_km, 3) END,
    'userPosProvided', v_user_pos_provided,
    'autoPlanted', v_is_gps AND v_faction_id IS NOT NULL,
    'rewards', json_build_object(
      'permanentInfluence', v_influence_gain,
      'explorationGain', CASE WHEN v_is_gps THEN 15 ELSE 5 END,
      'contentPoints', v_content_pts,
      'isExplorer', v_is_gps,
      'plantBonus', CASE WHEN v_is_gps AND v_faction_id IS NOT NULL THEN COALESCE(v_solo_bonus, 50) ELSE 0 END
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._create_place_internal(text, text, real, real, text, jsonb, text, text, real, real, text, text, integer)
  TO anon, authenticated, service_role;

COMMIT;
