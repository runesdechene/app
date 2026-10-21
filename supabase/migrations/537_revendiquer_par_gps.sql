-- WHY: Revendiquer par GPS (spec docs/superpowers/specs/2026-10-21-revendiquer-gps-design.md).
--      La visite rend sa récompense (rang, XP gagnée, jauge du niveau) pour la fête de `Recompense` ;
--      seul, le nom de revendication choisi est gardé ; la revendication rend l'ancien tenant
--      (« Pris à … ») et le nombre de lieux conquis (« Ton 4ᵉ lieu conquis »).
-- SCHEMA CHECKED (21/10/2026, live) : les trois fonctions copiées entières de pg_get_functiondef ;
--   identiques à 531 (visiter_lieu, revendiquer_lieu) et 464 (_revendiquer).

CREATE OR REPLACE FUNCTION public.visiter_lieu(p_id text, p_lat double precision, p_lng double precision)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_lieu record;
  v_premiere boolean; -- 464
  v_xp_avant integer; -- 537 : la récompense de la visite
  v_xp_apres integer;
  v_niveau integer;
  v_seuil integer;
  v_suivant integer;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT id, latitude, longitude INTO v_lieu FROM places WHERE id = p_id AND public._lieu_visible(p_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF public._distance_m(p_lat, p_lng, v_lieu.latitude, v_lieu.longitude) > 200 THEN
    RAISE EXCEPTION 'Trop loin' USING ERRCODE = 'P0001';
  END IF;
  v_premiere := NOT EXISTS (SELECT 1 FROM place_explorers WHERE place_id = p_id AND user_id = v_moi
                             AND NOT a_distance); -- 464 ; 531 : un souvenir n'est pas une visite
  SELECT COALESCE(xp_total, 0) INTO v_xp_avant FROM users WHERE id = v_moi; -- 537
  INSERT INTO place_explorers (place_id, user_id, visited_at) VALUES (p_id, v_moi, now())
  ON CONFLICT (place_id, user_id) DO UPDATE SET visited_at = now(), a_distance = false; -- 531
  INSERT INTO places_discovered (user_id, place_id, method, discovered_at) VALUES (v_moi, p_id, 'gps', now())
  ON CONFLICT (user_id, place_id) DO UPDATE SET method = 'gps';
  PERFORM public.signaler_presence(p_lat, p_lng);
  -- 464 : l'auteur du lieu apprend qu'on est venu (pas pour une revisite, pas pour soi).
  IF v_premiere THEN
    BEGIN
      PERFORM notify(p.author_id, 'visite', jsonb_build_object(
        'actorId', v_moi,
        'actorName', (SELECT user_public_name(u.id, u.display_name, u.first_name) FROM users u WHERE u.id = v_moi),
        'placeId', p_id,
        'placeTitle', p.title))
      FROM places p WHERE p.id = p_id AND p.author_id IS DISTINCT FROM v_moi;
    EXCEPTION WHEN others THEN RAISE WARNING 'visiter_lieu : notification en échec (%)', SQLERRM;
    END;
  END IF;
  -- 537 : l'XP vient des déclencheurs de place_explorers (rien sur une revisite) ; on la mesure.
  SELECT COALESCE(xp_total, 0) INTO v_xp_apres FROM users WHERE id = v_moi;
  v_niveau := public._level_from_xp(v_xp_apres);
  v_seuil := public._xp_for_level(v_niveau);
  v_suivant := public._xp_for_level(v_niveau + 1);
  RETURN json_build_object(
    'visiteLe', now(),
    'rang', (SELECT count(*) FROM place_explorers WHERE user_id = v_moi AND NOT a_distance),
    'gain', v_xp_apres - v_xp_avant,
    'niveau', v_niveau,
    -- Monter de niveau fait repartir la jauge de zéro (comme percer_enigme, 470).
    'avant', CASE WHEN public._level_from_xp(v_xp_avant) < v_niveau THEN 0
                  ELSE round((v_xp_avant - v_seuil)::numeric / greatest(1, v_suivant - v_seuil), 3) END,
    'apres', round((v_xp_apres - v_seuil)::numeric / greatest(1, v_suivant - v_seuil), 3));
END;
$function$;


CREATE OR REPLACE FUNCTION public.revendiquer_lieu(p_id text, p_compagnons text[], p_nom text, p_pour_compagnie text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_valides text[];
  v_nom text := NULLIF(btrim(p_nom), '');
  v_pour text := NULLIF(btrim(COALESCE(p_pour_compagnie, '')), '');
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM places WHERE id = p_id AND nature = 'lieu' AND public._lieu_visible(p_id)) THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM place_explorers
    WHERE place_id = p_id AND user_id = v_moi AND visited_at > now() - interval '30 minutes'
      AND NOT a_distance) THEN -- 531 : jamais sur un souvenir
    RAISE EXCEPTION 'Visite trop ancienne' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public._presents_autour(p_id) a WHERE a.user_id = v_moi) THEN
    RAISE EXCEPTION 'Pas sur place' USING ERRCODE = 'P0001';
  END IF;

  -- Seuls comptent les compagnons présents maintenant : les autres sont ignorés.
  SELECT COALESCE(array_agg(a.user_id), '{}') INTO v_valides
  FROM public._presents_autour(p_id) a
  WHERE a.user_id = ANY (COALESCE(p_compagnons, '{}')) AND a.user_id <> v_moi;
  IF cardinality(v_valides) > 0 AND v_nom IS NULL THEN
    RAISE EXCEPTION 'Nom d''expédition manquant' USING ERRCODE = '22023';
  END IF;
  -- 537 : seul, le nom choisi est gardé (vide → la pilule porte mon nom).

  -- 422 : « pour » une Compagnie dont je suis membre seulement.
  IF v_pour IS NOT NULL AND public._role_compagnie(v_pour, v_moi) IS NULL THEN
    RAISE EXCEPTION 'Pas membre de cette Compagnie' USING ERRCODE = 'P0001', HINT = 'role';
  END IF;

  RETURN public._revendiquer(p_id, v_moi, v_valides, v_nom, v_pour);
END;
$function$;


CREATE OR REPLACE FUNCTION public._revendiquer(p_id text, p_moi text, p_valides text[], p_nom text, p_pour text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_faction text;
  v_expedition uuid;
  v_bonus integer;
  v_avant text; -- 464 : qui tenait le lieu
BEGIN
  -- Déjà tenant, seul : on rafraîchit la date, sans nouvelle expédition (comme la V1).
  IF cardinality(p_valides) = 0 AND EXISTS (
    SELECT 1 FROM place_veille v
    WHERE v.place_id = p_id
      AND (v.veilleur_user_id = p_moi
        OR EXISTS (SELECT 1 FROM expedition_members m WHERE m.expedition_id = v.expedition_id AND m.user_id = p_moi))) THEN
    UPDATE place_veille SET planted_at = now(), pour_compagnie = COALESCE(p_pour, pour_compagnie) WHERE place_id = p_id;
    UPDATE expeditions SET pour_compagnie = COALESCE(p_pour, pour_compagnie)
    WHERE id = (SELECT expedition_id FROM place_veille WHERE place_id = p_id);
    INSERT INTO revendications (place_id, user_id, pour_compagnie) VALUES (p_id, p_moi, p_pour); -- 438
    RETURN json_build_object('nom', (
      SELECT COALESCE(NULLIF(x.title, ''), user_public_name(u.id, u.display_name, u.first_name))
      FROM place_veille v LEFT JOIN expeditions x ON x.id = v.expedition_id LEFT JOIN users u ON u.id = p_moi
      WHERE v.place_id = p_id),
      'prisA', NULL, -- 537
      'rang', (SELECT count(DISTINCT place_id) FROM revendications WHERE user_id = p_moi));
  END IF;

  SELECT veilleur_user_id INTO v_avant FROM place_veille WHERE place_id = p_id; -- 464

  SELECT faction_id INTO v_faction FROM users WHERE id = p_moi;
  INSERT INTO expeditions (place_id, is_neutral, faction_id, title, pour_compagnie)
  VALUES (p_id, v_faction IS NULL, v_faction, p_nom, p_pour)
  RETURNING id INTO v_expedition;
  INSERT INTO expedition_members (expedition_id, user_id, faction_id)
  SELECT v_expedition, u.id, u.faction_id FROM users u WHERE u.id = ANY (p_valides || p_moi);

  INSERT INTO place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id, veilleur_user_id)
  VALUES (p_id, v_expedition, v_faction, v_faction IS NULL, now(), false, NULL, p_moi)
  ON CONFLICT (place_id) DO UPDATE SET
    expedition_id = EXCLUDED.expedition_id, faction_id = EXCLUDED.faction_id,
    is_neutral = EXCLUDED.is_neutral, planted_at = now(), by_influence = false,
    previous_expedition_id = NULL, veilleur_user_id = p_moi, pour_compagnie = p_pour;

  -- La Cour V1 repart de zéro, avec le bonus de plantage de la V1 : on ne reprend pas à distance
  -- un lieu revendiqué sur place (Uriel, 28/09). Pas de ligne veille_history : une revendication
  -- faite dans Explore ne compte pas en V1 (ni Gloire, ni Coupe, ni titres, ni classement).
  v_bonus := COALESCE((SELECT value::integer FROM app_settings WHERE key = 'plant_flag_solo_bonus'), 50)
    + COALESCE((SELECT value::integer FROM app_settings WHERE key = 'plant_flag_per_extra_member'), 30)
      * LEAST(cardinality(p_valides), COALESCE((SELECT value::integer FROM app_settings WHERE key = 'plant_flag_max_members_for_bonus'), 10));
  DELETE FROM place_court_action WHERE place_id = p_id AND beneficiary_user_id IS DISTINCT FROM p_moi;
  INSERT INTO place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
  VALUES (p_id, p_moi, v_expedition, p_moi, 'plant_bonus', v_bonus);
  DELETE FROM place_court_score WHERE place_id = p_id;
  INSERT INTO revendications (place_id, user_id, pour_compagnie) VALUES (p_id, p_moi, p_pour); -- 438

  -- 464 : celui qui tenait le lieu apprend qu'on le lui a repris (sauf s'il est de l'expédition).
  IF v_avant IS NOT NULL AND v_avant <> p_moi AND NOT (v_avant = ANY (p_valides)) THEN
    BEGIN
      PERFORM notify(v_avant, 'revendication_reprise', jsonb_build_object(
        'actorId', p_moi,
        'actorName', (SELECT user_public_name(u.id, u.display_name, u.first_name) FROM users u WHERE u.id = p_moi),
        'placeId', p_id,
        'placeTitle', (SELECT title FROM places WHERE id = p_id)));
    EXCEPTION WHEN others THEN RAISE WARNING '_revendiquer : notification en échec (%)', SQLERRM;
    END;
  END IF;

  RETURN json_build_object('nom', COALESCE(p_nom,
    (SELECT user_public_name(u.id, u.display_name, u.first_name) FROM users u WHERE u.id = p_moi)),
    -- 537 : à qui on l'a pris, et combien de lieux j'ai conquis.
    'prisA', CASE WHEN v_avant IS NOT NULL AND v_avant <> p_moi AND NOT (v_avant = ANY (p_valides)) THEN
      (SELECT user_public_name(u.id, u.display_name, u.first_name) FROM users u WHERE u.id = v_avant) END,
    'rang', (SELECT count(DISTINCT place_id) FROM revendications WHERE user_id = p_moi));
END;
$function$;

