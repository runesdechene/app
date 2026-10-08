-- 464 — Les notifications qui manquaient, et l'énigme du jour qui ne partait pas
--
-- WHY : Uriel, 08/10/2026 : « il faut une notification push pour tout ça ». Inventaire complet :
--   docs/v2/notifications.md. Quatre trous :
--   1. revendiquer un lieu que quelqu'un tenait ne prévenait personne → `revendication_reprise`,
--      à celui qui le tenait ;
--   2. rejoindre une Compagnie publique ne prévenait personne → `nouveau_membre`, aux autres
--      membres (la Compagnie privée prévient déjà son Chef et ses Officiers : `demande_compagnie`) ;
--   3. la visite d'un lieu : la notification `exploration` était branchée sur la table de la V1
--      (`places_explored`) ; la V2 écrit dans `place_explorers` → `visite`, à l'auteur du lieu, à la
--      première visite de chaque Explorateur seulement ;
--   4. l'énigme du jour (`daily_enigma_ready`) : ~5 000 lignes par jour, mais rangée « silent » par
--      send-push : aucun push ne partait. Remplacée par `enigme_du_jour`, créée seulement pour qui
--      peut la recevoir (un téléphone abonné) et a vraiment une énigme réveillée qui l'attend.
--   Les envois sont à l'abri (BEGIN … EXCEPTION) : si une notification échoue, l'action passe quand
--   même (.claude/rules/supabase.md, « ne pas coupler les sous-systèmes »).
--   Définitions live du 08/10 copiées entières ; seuls s'ajoutent les envois et les quatre sortes.
--
-- SCHEMA CHECKED (08/10/2026, live) : place_veille(place_id text, veilleur_user_id text) ;
--   places(id, author_id varchar, title varchar) ; place_explorers(place_id, user_id, visited_at,
--   unique (place_id, user_id)) ; faction_members(faction_id varchar, user_id text, role text) ;
--   push_subscriptions(user_id text, …) ; users(push_important_enabled, is_active, last_login_at) ;
--   enigmes_eveillees(id, enigma_id, theme, effacee_le) ; enigma_responses(user_id, eveil_id,
--   enigma_id, correct) ; enigma_themes(id, active) ; notify(text, text, jsonb).

-- 1. Revendiquer : celui qui tenait le lieu est prévenu.
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
      WHERE v.place_id = p_id));
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
    (SELECT user_public_name(u.id, u.display_name, u.first_name) FROM users u WHERE u.id = p_moi)));
END;
$function$;

-- 2. Rejoindre une Compagnie publique : les autres membres sont prévenus.
CREATE OR REPLACE FUNCTION public.rejoindre_compagnie(p_id text, p_mot text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_moi text := (auth.uid())::text; f factions; v_nom text; v_qui text;
BEGIN
  IF v_moi IS NULL THEN PERFORM _refus('Connexion requise', 'connexion'); END IF;
  SELECT * INTO f FROM factions WHERE id = p_id AND NOT retired;
  IF NOT FOUND THEN PERFORM _refus('Compagnie introuvable', 'introuvable'); END IF;
  IF _role_compagnie(p_id, v_moi) IS NOT NULL THEN PERFORM _refus('Déjà membre', 'deja'); END IF;
  IF NOT f.privee THEN
    INSERT INTO faction_members (faction_id, user_id, joined_at, role) VALUES (p_id, v_moi, now(), 'membre');
    -- La V1 n'a qu'une Compagnie active : la première rejointe le devient si on n'en a pas.
    UPDATE users SET faction_id = p_id WHERE id = v_moi AND faction_id IS NULL;
    -- 464 : les autres membres apprennent l'arrivée.
    BEGIN
      SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;
      FOR v_qui IN SELECT user_id FROM faction_members WHERE faction_id = p_id AND user_id <> v_moi LOOP
        PERFORM notify(v_qui, 'nouveau_membre', jsonb_build_object('actorId', v_moi, 'actorName', v_nom,
          'compagnieId', p_id, 'compagnieNom', f.title));
      END LOOP;
    EXCEPTION WHEN others THEN RAISE WARNING 'rejoindre_compagnie : notification en échec (%)', SQLERRM;
    END;
    RETURN json_build_object('etat', 'membre');
  END IF;
  INSERT INTO demandes_compagnie (faction_id, user_id, mot) VALUES (p_id, v_moi, NULLIF(left(btrim(p_mot), 200), ''))
  ON CONFLICT (faction_id, user_id) DO UPDATE SET mot = EXCLUDED.mot, cree_le = now();
  BEGIN
    SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;
    FOR v_qui IN SELECT user_id FROM faction_members WHERE faction_id = p_id AND role IN ('chef', 'officier') LOOP
      PERFORM notify(v_qui, 'demande_compagnie', jsonb_build_object('actorId', v_moi, 'actorName', v_nom,
        'compagnieId', p_id, 'compagnieNom', f.title));
    END LOOP;
  EXCEPTION WHEN others THEN RAISE WARNING 'rejoindre_compagnie : notification en échec (%)', SQLERRM;
  END;
  RETURN json_build_object('etat', 'demande');
END;
$function$;

-- 3. Visiter un lieu : son auteur est prévenu, à la première visite de chaque Explorateur.
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
  v_premiere := NOT EXISTS (SELECT 1 FROM place_explorers WHERE place_id = p_id AND user_id = v_moi); -- 464
  INSERT INTO place_explorers (place_id, user_id, visited_at) VALUES (p_id, v_moi, now())
  ON CONFLICT (place_id, user_id) DO UPDATE SET visited_at = now();
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
  RETURN json_build_object('visiteLe', now());
END;
$function$;

-- 4. Les sortes que la cloche montre : les trois nouvelles s'ajoutent (l'énigme du jour n'est qu'un push).
CREATE OR REPLACE FUNCTION public._notification_v2(p_type text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT p_type = ANY (ARRAY[
    'like_contribution', 'like_carnet', 'new_carnet', 'description_edited', 'new_photo',
    'new_comment', 'comment_reply', 'place_position_edited', 'exploration',
    'milestone_vues', 'milestone_exploration', 'milestone_likes', 'mention', 'salut',
    'lieu_modifie', 'coeur_mot', 'demande_compagnie', 'demande_acceptee',
    'visite', 'revendication_reprise', 'nouveau_membre']);
$function$;

-- 5. L'énigme du jour : vers 12 h 30 (heure de Paris), à qui a un téléphone abonné, une énigme
--    réveillée qu'il n'a pas percée, et n'est pas venu depuis 18 h ; une fois par jour au plus.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily_enigma_lunch_push') THEN
    PERFORM cron.unschedule('daily_enigma_lunch_push');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enigme_du_jour') THEN
    PERFORM cron.unschedule('enigme_du_jour');
  END IF;
END $$;

SELECT cron.schedule('enigme_du_jour', '0,30 10,11 * * *', $cron$
  INSERT INTO public.notifications (recipient_id, type, data)
  SELECT u.id, 'enigme_du_jour', '{}'::jsonb
  FROM public.users u
  WHERE EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/Paris'))::int = 12
    AND EXTRACT(MINUTE FROM (now() AT TIME ZONE 'Europe/Paris'))::int BETWEEN 25 AND 35
    AND u.push_important_enabled
    AND u.is_active
    AND (u.last_login_at IS NULL OR u.last_login_at < now() - interval '18 hours')
    AND EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = u.id)
    AND EXISTS (
      SELECT 1 FROM public.enigmes_eveillees w JOIN public.enigma_themes t ON t.id = w.theme AND t.active
      WHERE w.effacee_le IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.enigma_responses r
                        WHERE r.user_id = u.id AND (r.eveil_id = w.id OR (r.enigma_id = w.enigma_id AND r.correct))))
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_id = u.id AND n.type = 'enigme_du_jour'
        AND (n.created_at AT TIME ZONE 'Europe/Paris')::date = (now() AT TIME ZONE 'Europe/Paris')::date);
$cron$);
