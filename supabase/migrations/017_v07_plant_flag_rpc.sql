-- 017_v07_plant_flag_rpc.sql
-- WHY : RPC plant_flag — supplante la veille du lieu, gère solo et expedition
-- de manière unifiée (toute veille = expedition de 1 à N membres).
-- Distance max : 100m (cohérent avec visit_place_gps / revisit_place_gps).
-- Spec : docs/superpowers/specs/2026-04-30-v07-veille-plantage.md

CREATE OR REPLACE FUNCTION public.plant_flag(
  p_user_id            text,
  p_place_id           text,
  p_user_lat           numeric,
  p_user_lng           numeric,
  p_partners_user_ids  text[] DEFAULT '{}'::text[]
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_faction        text;
  v_place_lat           numeric;
  v_place_lng           numeric;
  v_place_title         text;
  v_distance_km         numeric;
  v_expedition_id       uuid;
  v_is_neutral          boolean := false;
  v_expedition_faction  text;
  v_factions            text[];
  v_partner_user_id     text;
  v_partner_faction     text;
  v_members_json        jsonb;
  v_now                 timestamptz := now();
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT faction_id INTO v_user_faction FROM public.users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM public.places WHERE id = p_place_id;
  IF v_place_lat IS NULL THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
  IF v_distance_km > 0.1 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::numeric, 2));
  END IF;

  -- Calcule l'ensemble des factions impliquées (créateur + partners)
  SELECT array_agg(DISTINCT u.faction_id) INTO v_factions
  FROM public.users u
  WHERE (u.id = ANY(p_partners_user_ids) OR u.id = p_user_id)
    AND u.faction_id IS NOT NULL;

  v_is_neutral := (COALESCE(array_length(v_factions, 1), 0) > 1);
  v_expedition_faction := CASE WHEN v_is_neutral THEN NULL ELSE v_user_faction END;

  -- Toujours créer une expédition (solo = expédition d'1 membre)
  INSERT INTO public.expeditions (place_id, is_neutral, faction_id, created_at)
  VALUES (p_place_id, v_is_neutral, v_expedition_faction, v_now)
  RETURNING id INTO v_expedition_id;

  -- Membre fondateur
  INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
  VALUES (v_expedition_id, p_user_id, v_user_faction);

  -- Partners (si fournis)
  IF array_length(p_partners_user_ids, 1) > 0 THEN
    FOREACH v_partner_user_id IN ARRAY p_partners_user_ids LOOP
      IF v_partner_user_id = p_user_id THEN CONTINUE; END IF;
      SELECT faction_id INTO v_partner_faction FROM public.users WHERE id = v_partner_user_id;
      IF v_partner_faction IS NOT NULL THEN
        INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
        VALUES (v_expedition_id, v_partner_user_id, v_partner_faction)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- UPSERT place_veille (supplante l'expédition précédente)
  INSERT INTO public.place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at)
  VALUES (p_place_id, v_expedition_id, v_expedition_faction, v_is_neutral, v_now)
  ON CONFLICT (place_id) DO UPDATE SET
    expedition_id = EXCLUDED.expedition_id,
    faction_id    = EXCLUDED.faction_id,
    is_neutral    = EXCLUDED.is_neutral,
    planted_at    = EXCLUDED.planted_at;

  -- Historique : 1 ligne par membre de l'expédition
  INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
  SELECT p_place_id, v_expedition_id, em.user_id, em.faction_id, v_is_neutral, v_now
  FROM public.expedition_members em WHERE em.expedition_id = v_expedition_id;

  -- Build members JSON pour retour
  SELECT jsonb_agg(jsonb_build_object(
    'userId', em.user_id,
    'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
    'avatarUrl', u.avatar_url,
    'factionId', em.faction_id
  ))
  INTO v_members_json
  FROM public.expedition_members em
  JOIN public.users u ON u.id = em.user_id
  WHERE em.expedition_id = v_expedition_id;

  -- Activity log
  INSERT INTO public.activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('plant_flag', p_user_id, p_place_id, v_expedition_faction,
          jsonb_build_object(
            'placeTitle', v_place_title,
            'isNeutral', v_is_neutral,
            'expeditionId', v_expedition_id,
            'memberCount', jsonb_array_length(v_members_json),
            'members', v_members_json
          ));

  RETURN json_build_object(
    'success',      true,
    'placeId',      p_place_id,
    'isNeutral',    v_is_neutral,
    'factionId',    v_expedition_faction,
    'expeditionId', v_expedition_id,
    'members',      v_members_json,
    'plantedAt',    v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.plant_flag(text, text, numeric, numeric, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.plant_flag(text, text, numeric, numeric, text[]) TO service_role;
