-- 266_publish_gps_mark_rpc.sql
-- WHY : transforme une marque GPS en lieu (ou fusionne sur un lieu existant),
-- avec bonus visite GPS RÉTROACTIF dérivé de la marque. Anti-triche : la marque
-- doit appartenir au caller, le lieu final doit être < 200 m de la marque, et le
-- privilège GPS n'est accordé que si la marque a moins de N jours (fraîcheur).
-- Délègue la création à _create_place_internal (mig 200) en injectant la position
-- de la marque comme "GPS live".

BEGIN;

-- Helper : lieux existants proches d'un point (pour détecter une collision à la
-- publication). distance en mètres ; has_veilleur pour savoir si l'étendard est libre.
CREATE OR REPLACE FUNCTION public.find_nearby_places(
  p_lat      real,
  p_lng      real,
  p_radius_m numeric DEFAULT 30
) RETURNS TABLE (place_id text, title text, distance_m numeric, has_veilleur boolean)
LANGUAGE sql STABLE
AS $$
  SELECT p.id,
         p.title,
         ROUND((haversine_km(p_lat::numeric, p_lng::numeric, p.latitude::numeric, p.longitude::numeric) * 1000)::numeric, 1) AS distance_m,
         EXISTS (SELECT 1 FROM public.place_veille pv WHERE pv.place_id = p.id) AS has_veilleur
  FROM public.places p
  WHERE p.private = false
    AND haversine_km(p_lat::numeric, p_lng::numeric, p.latitude::numeric, p.longitude::numeric) * 1000 <= p_radius_m
  ORDER BY distance_m ASC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.find_nearby_places(real, real, numeric)
  TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.publish_gps_mark(
  p_user_id            text,
  p_draft_id           uuid,
  p_title              text,
  p_latitude           real,
  p_longitude          real,
  p_tag_id             text,
  p_images             jsonb   DEFAULT '[]'::jsonb,
  p_address            text    DEFAULT '',
  p_text               text    DEFAULT '',
  p_era_id             text    DEFAULT NULL,
  p_year_exact         integer DEFAULT NULL,
  p_secondary_tag_ids  text[]  DEFAULT '{}',
  p_merge_into_place_id text   DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_draft           public.place_drafts%ROWTYPE;
  v_fresh           boolean;
  v_freshness_days  int;
  v_dist_to_final   numeric;
  v_disc_count      int;
  v_min_disc        int := 3;
  v_user_lat        real;
  v_user_lng        real;
  v_result          json;
  v_place_id        text;
  v_tag             text;
  v_faction_id      text;
  v_exploration_gain int;
  v_target_lat      real;
  v_target_lng      real;
  v_target_dist     numeric;
  v_has_veilleur    boolean;
  v_auto_expedition_id uuid;
  v_solo_bonus      integer;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_draft FROM public.place_drafts
  WHERE id = p_draft_id AND user_id = p_user_id AND status = 'open';
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'draft_not_found');
  END IF;

  -- Fraîcheur : privilège GPS rétroactif uniquement si la marque est récente.
  SELECT COALESCE((SELECT value::int FROM public.app_settings WHERE key = 'place_draft_freshness_days'), 30)
    INTO v_freshness_days;
  v_fresh := (now() - v_draft.created_at) <= make_interval(days => v_freshness_days);

  -- Anti-triche : le lieu final doit être à < 200 m de la position de la marque.
  v_dist_to_final := haversine_km(v_draft.latitude::numeric, v_draft.longitude::numeric,
                                  p_latitude::numeric, p_longitude::numeric) * 1000;
  IF v_dist_to_final > 200 THEN
    RETURN json_build_object('error', 'place_too_far_from_mark', 'distanceM', ROUND(v_dist_to_final, 0));
  END IF;

  -- GPS effectif injecté dans _create_place_internal : coords de la marque si
  -- fraîche (⇒ isGps + auto-plant + visite), NULL sinon (⇒ ajout à distance).
  IF v_fresh THEN
    v_user_lat := v_draft.latitude;
    v_user_lng := v_draft.longitude;
  ELSE
    v_user_lat := NULL;
    v_user_lng := NULL;
  END IF;

  -- =========================================================================
  -- CAS FUSION : l'utilisateur confirme que le lieu existe déjà (p_merge_into…).
  -- =========================================================================
  IF p_merge_into_place_id IS NOT NULL THEN
    SELECT latitude, longitude INTO v_target_lat, v_target_lng
    FROM public.places WHERE id = p_merge_into_place_id;
    IF v_target_lat IS NULL THEN
      RETURN json_build_object('error', 'merge_target_not_found');
    END IF;

    -- Le lieu cible doit lui aussi être < 200 m de la marque (légitimité visite).
    v_target_dist := haversine_km(v_draft.latitude::numeric, v_draft.longitude::numeric,
                                  v_target_lat::numeric, v_target_lng::numeric) * 1000;
    IF v_target_dist > 200 THEN
      RETURN json_build_object('error', 'merge_target_too_far', 'distanceM', ROUND(v_target_dist, 0));
    END IF;

    -- Découverte (idempotent) — l'utilisateur connaît désormais ce lieu.
    INSERT INTO public.places_discovered (user_id, place_id, method)
    VALUES (p_user_id, p_merge_into_place_id, CASE WHEN v_fresh THEN 'gps' ELSE 'remote' END)
    ON CONFLICT (user_id, place_id) DO NOTHING;

    IF v_fresh THEN
      SELECT faction_id INTO v_faction_id FROM public.users WHERE id = p_user_id;
      SELECT COALESCE((SELECT value::int FROM public.app_settings WHERE key = 'exploration_visit_gps'), 10)
        INTO v_exploration_gain;

      -- Visite GPS rétroactive (planter = visiter ; ici on enregistre la visite).
      IF NOT EXISTS (SELECT 1 FROM public.place_explorers WHERE place_id = p_merge_into_place_id AND user_id = p_user_id) THEN
        INSERT INTO public.place_explorers (place_id, user_id) VALUES (p_merge_into_place_id, p_user_id)
        ON CONFLICT DO NOTHING;
        UPDATE public.users SET exploration_points = exploration_points + v_exploration_gain WHERE id = p_user_id;
        INSERT INTO public.activity_log (type, actor_id, place_id, faction_id, data)
        VALUES ('visit_gps', p_user_id, p_merge_into_place_id, v_faction_id,
          jsonb_build_object('explorationGain', v_exploration_gain, 'fromDraft', true));
      END IF;

      -- Étendard rétroactif si le lieu est SANS veilleur et le user a une faction
      -- (mirroir du bloc auto-plant de _create_place_internal, mig 200).
      v_has_veilleur := EXISTS (SELECT 1 FROM public.place_veille WHERE place_id = p_merge_into_place_id);
      IF NOT v_has_veilleur AND v_faction_id IS NOT NULL THEN
        v_solo_bonus := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_solo_bonus'), 50);

        INSERT INTO public.expeditions (place_id, is_neutral, faction_id, title, created_at)
        VALUES (p_merge_into_place_id, false, v_faction_id, NULL, now())
        RETURNING id INTO v_auto_expedition_id;

        INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
        VALUES (v_auto_expedition_id, p_user_id, v_faction_id);

        INSERT INTO public.place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id, veilleur_user_id)
        VALUES (p_merge_into_place_id, v_auto_expedition_id, v_faction_id, false, now(), false, NULL, p_user_id)
        ON CONFLICT (place_id) DO NOTHING;

        INSERT INTO public.place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
        VALUES (p_merge_into_place_id, p_user_id, v_auto_expedition_id, p_user_id, 'plant_bonus', v_solo_bonus);

        INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
        VALUES (p_merge_into_place_id, v_auto_expedition_id, p_user_id, v_faction_id, false, now());

        INSERT INTO public.activity_log (type, actor_id, place_id, faction_id, data)
        VALUES ('plant_flag', p_user_id, p_merge_into_place_id, v_faction_id,
          jsonb_build_object('isNeutral', false, 'expeditionId', v_auto_expedition_id, 'memberCount', 1, 'fromDraft', true, 'plantBonus', v_solo_bonus));
      END IF;
    END IF;

    UPDATE public.place_drafts
    SET status = 'published', published_place_id = p_merge_into_place_id, published_at = now()
    WHERE id = p_draft_id;

    RETURN json_build_object('success', true, 'mode', 'merged',
      'placeId', p_merge_into_place_id, 'isGps', v_fresh);
  END IF;

  -- =========================================================================
  -- CAS CRÉATION : nouveau lieu.
  -- =========================================================================
  -- Gate publication = 3 découvertes (réplique mig 061 ; le front gate déjà l'UI).
  SELECT count(*) INTO v_disc_count FROM public.places_discovered WHERE user_id = p_user_id;
  IF v_disc_count < v_min_disc THEN
    RETURN json_build_object('error', 'not_enough_discoveries',
      'requiredDiscoveries', v_min_disc, 'currentDiscoveries', v_disc_count);
  END IF;

  SELECT public._create_place_internal(
    p_user_id, p_title, p_latitude, p_longitude, p_tag_id,
    COALESCE(p_images, '[]'::jsonb), p_address, p_text,
    v_user_lat, v_user_lng, NULL, p_era_id, p_year_exact
  ) INTO v_result;

  IF (v_result->>'error') IS NOT NULL THEN
    RETURN v_result;  -- propage l'erreur (tag introuvable, etc.)
  END IF;

  v_place_id := v_result->>'placeId';

  -- Tags secondaires (le 1er est posé par _create_place_internal).
  IF array_length(p_secondary_tag_ids, 1) > 0 THEN
    FOREACH v_tag IN ARRAY p_secondary_tag_ids LOOP
      INSERT INTO public.place_tags (place_id, tag_id, is_primary)
      VALUES (v_place_id, v_tag, false) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.place_drafts
  SET status = 'published', published_place_id = v_place_id, published_at = now()
  WHERE id = p_draft_id;

  -- v_result contient déjà {success, placeId, isGps, rewards, …}. On ajoute mode.
  RETURN (v_result::jsonb || jsonb_build_object('mode', 'created'))::json;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_gps_mark(text, uuid, text, real, real, text, jsonb, text, text, text, integer, text[], text)
  TO authenticated, service_role;

COMMIT;
