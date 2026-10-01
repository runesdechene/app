-- WHY: correctifs de la relecture de l'énergie (399), 01/10/2026.
--   1. decouvrir_lieu : la ligne du joueur se verrouille AVANT de vérifier la découverte et avant
--      la recharge. Deux appels simultanés (double toucher, V1 + V2) ne paient plus deux fois le
--      même lieu, et la recharge (get_user_energy, qui réécrit la jauge) ne peut plus effacer un
--      paiement en cours.
--   2. discover_place (V1) : la récompense d'énergie d'un tag plafonnait à l'ancienne colonne
--      users.max_energy (3 à 9) et retirait des points ; elle plafonne au maximum commun.
--   3. cheat_refill (admin) : remplit jusqu'au maximum commun ; search_path fixé.
--   4. mon_energie rend la règle réglée dans le Hub (distances, prix) ; cout_decouverte, la zone
--      gratuite : la V2 n'écrit plus « 100 km » en dur.
-- SCHEMA CHECKED (01/10/2026) : decouvrir_lieu(text, numeric, numeric), discover_place(text,
--      text, text, numeric, numeric, boolean, numeric), cheat_refill(text), mon_energie(),
--      cout_decouverte(text, numeric, numeric) copiées de leur définition live ; _reglage et
--      _energie_max (399).

CREATE OR REPLACE FUNCTION public.decouvrir_lieu(p_id text, p_lat numeric DEFAULT NULL::numeric, p_lng numeric DEFAULT NULL::numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_moi text := (auth.uid())::text;

  v_xp_avant int;

  v_xp_apres int;

  v_niveau int;

  v_seuil int;

  v_suivant int;

  v_cout int;

  v_points numeric;

BEGIN

  IF v_moi IS NULL THEN

    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';

  END IF;

  IF NOT public._lieu_visible(p_id) THEN

    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';

  END IF;



  SELECT COALESCE(xp_total, 0) INTO v_xp_avant FROM users WHERE id = v_moi;

  -- Un lieu qu'on a ajouté ou visité est déjà connu : pas de découverte à distance en plus.

  IF NOT EXISTS (SELECT 1 FROM places p WHERE p.id = p_id AND p.author_id = v_moi)

     AND NOT EXISTS (SELECT 1 FROM place_explorers e WHERE e.place_id = p_id AND e.user_id = v_moi) THEN

    -- 399 : au-delà de 100 km, découvrir coûte de l'énergie ; une découverte faite ne se repaie pas.

    -- 401 : le verrou d'abord. Un second appel attend le premier, puis voit la découverte faite.
    PERFORM 1 FROM users WHERE id = v_moi FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM places_discovered d WHERE d.user_id = v_moi AND d.place_id = p_id) THEN

      v_cout := (public._cout_decouverte(p_id, p_lat, p_lng)->>'cout')::int;

      IF v_cout > 0 THEN

        PERFORM public.get_user_energy(v_moi); -- la recharge d'abord

        SELECT energy_points INTO v_points FROM users WHERE id = v_moi;

        IF v_points < v_cout THEN

          RAISE EXCEPTION 'Pas assez d''énergie' USING ERRCODE = 'RDC01';

        END IF;

        UPDATE users SET energy_points = energy_points - v_cout WHERE id = v_moi;

      END IF;

    END IF;

    INSERT INTO places_discovered (user_id, place_id, method) VALUES (v_moi, p_id, 'remote')

    ON CONFLICT (user_id, place_id) DO NOTHING;

  END IF;

  SELECT COALESCE(xp_total, 0) INTO v_xp_apres FROM users WHERE id = v_moi;



  v_niveau := public._level_from_xp(v_xp_apres);

  v_seuil := public._xp_for_level(v_niveau);

  v_suivant := public._xp_for_level(v_niveau + 1);

  RETURN json_build_object(

    'rang', (SELECT count(*) FROM places_discovered d WHERE d.user_id = v_moi),

    'gain', v_xp_apres - v_xp_avant,

    'niveau', v_niveau,

    -- Monter de niveau fait repartir la jauge de zéro.

    'avant', CASE WHEN public._level_from_xp(v_xp_avant) < v_niveau THEN 0

                  ELSE round((v_xp_avant - v_seuil)::numeric / greatest(1, v_suivant - v_seuil), 3) END,

    'apres', round((v_xp_apres - v_seuil)::numeric / greatest(1, v_suivant - v_seuil), 3));

END;

$function$;

CREATE OR REPLACE FUNCTION public.discover_place(p_user_id text, p_place_id text, p_method text DEFAULT 'remote'::text, p_user_lat numeric DEFAULT NULL::numeric, p_user_lng numeric DEFAULT NULL::numeric, p_free boolean DEFAULT false, p_glory_mult numeric DEFAULT 1)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_already BOOLEAN;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_preview JSON;
  v_reward_energy INT := 0;
  v_exploration_gain INT;
  v_gps_bonus INT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_m NUMERIC;
  v_method TEXT;
  v_proximity_m NUMERIC := 500;
  -- V123/V124 : variables Couronnes
  v_crowns_gain          integer := 0;
  v_quest_bonus          integer := 0;
  v_new_crowns_balance   integer := 0;
  v_discoveries_today    integer;
  v_quest_threshold      integer;
  v_quest_already_done   boolean;
  v_crowns_cap           integer;
  v_discovery_gain_cfg   integer;
  v_quest_bonus_cfg      integer;
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN RETURN json_build_object('error', 'already_discovered'); END IF;

  SELECT latitude, longitude INTO v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  IF v_place_lat IS NULL THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  v_method := 'remote';
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    v_distance_m := 6371000 * 2 * ASIN(SQRT(
      POWER(SIN(RADIANS(v_place_lat - p_user_lat) / 2), 2) +
      COS(RADIANS(p_user_lat)) * COS(RADIANS(v_place_lat)) *
      POWER(SIN(RADIANS(v_place_lng - p_user_lng) / 2), 2)
    ));
    IF v_distance_m <= v_proximity_m THEN
      v_method := 'gps';
    END IF;
  END IF;

  IF p_free THEN
    v_cost := 0;
  ELSIF v_method = 'gps' THEN
    v_cost := 0;
  ELSE
    v_preview := preview_action_cost(p_user_id, p_place_id, 'discover', p_user_lat, p_user_lng);
    v_cost := (v_preview->>'cost')::NUMERIC;
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  IF v_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_cost) WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, v_method) ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT COALESCE(t.reward_energy, 0) INTO v_reward_energy
  FROM place_tags ptag JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE LIMIT 1;

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, public._energie_max(p_user_id)) WHERE id = p_user_id;
  END IF;

  IF v_method = 'gps' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_gps_bonus'), 10) INTO v_gps_bonus;
    v_exploration_gain := v_gps_bonus;
  ELSE
    v_exploration_gain := 1;
  END IF;

  UPDATE users SET exploration_points = exploration_points + v_exploration_gain WHERE id = p_user_id;

  -- ───── V124 : Couronnes — crédit dans les deux cas (remote + gps) ─────
  -- Mini-quête "3 découvertes" : seuil compté sur découvertes REMOTE du jour
  -- (énergie dépensée = effort à récompenser). Bonus déclenché seulement si
  -- la découverte courante est elle-même remote.
  v_crowns_cap         := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_stock_cap'),                  500);
  v_discovery_gain_cfg := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_discovery_gain'),               1);
  v_quest_bonus_cfg    := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_quest_discover_bonus'),         1);
  v_quest_threshold    := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_quest_discover_threshold'),     3);

  v_crowns_gain := v_discovery_gain_cfg;

  IF v_method = 'remote' THEN
    -- Compter les découvertes REMOTE du jour (incluant celle qu'on vient d'insérer).
    SELECT count(*)::integer INTO v_discoveries_today
    FROM public.places_discovered
    WHERE user_id = p_user_id
      AND method = 'remote'
      AND discovered_at::date = current_date;

    SELECT EXISTS(
      SELECT 1 FROM public.activity_log
      WHERE actor_id = p_user_id
        AND type     = 'crown_quest_discovery'
        AND created_at::date = current_date
    ) INTO v_quest_already_done;

    IF v_discoveries_today >= v_quest_threshold AND NOT v_quest_already_done THEN
      v_quest_bonus := v_quest_bonus_cfg;
    END IF;
  END IF;

  IF (v_crowns_gain + v_quest_bonus) > 0 THEN
    INSERT INTO public.user_crowns (user_id, balance, updated_at)
    VALUES (p_user_id, LEAST(v_crowns_cap, v_crowns_gain + v_quest_bonus), now())
    ON CONFLICT (user_id) DO UPDATE SET
      balance    = LEAST(v_crowns_cap, public.user_crowns.balance + v_crowns_gain + v_quest_bonus),
      updated_at = now()
    RETURNING balance INTO v_new_crowns_balance;
  ELSE
    SELECT COALESCE(balance, 0) INTO v_new_crowns_balance FROM public.user_crowns WHERE user_id = p_user_id;
    v_new_crowns_balance := COALESCE(v_new_crowns_balance, 0);
  END IF;

  IF v_quest_bonus > 0 THEN
    INSERT INTO public.activity_log (type, actor_id, data)
    VALUES ('crown_quest_discovery', p_user_id, jsonb_build_object(
      'discoveriesCount', v_discoveries_today,
      'bonusGain',        v_quest_bonus,
      'newBalance',       v_new_crowns_balance,
      'method',           'remote'
    ));
  END IF;
  -- ───── FIN V124 ─────

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  RETURN json_build_object(
    'success', true,
    'cost', v_cost,
    'energy', v_energy,
    'free', p_free,
    'explorationGain', v_exploration_gain,
    'influenceGain', 0,
    'crownsGain',       v_crowns_gain,
    'questBonus',       v_quest_bonus,
    'newCrownsBalance', v_new_crowns_balance
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.cheat_refill(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role TEXT;
  v_max_energy NUMERIC(4,1);
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  -- Vérifier que c'est un admin
  SELECT role INTO v_role FROM users WHERE id = p_user_id;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- Lire les max + bonus faction
  SELECT u.max_energy, u.max_conquest, u.max_construction,
         COALESCE(f.bonus_energy, 0),
         COALESCE(f.bonus_conquest, 0),
         COALESCE(f.bonus_construction, 0)
  INTO v_max_energy, v_max_conquest, v_max_construction,
       v_bonus_energy, v_bonus_conquest, v_bonus_construction
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  -- Mettre au max + reset timestamps
  UPDATE users
  SET energy_points = public._energie_max(p_user_id),
      energy_reset_at = NOW(),
      conquest_points = v_max_conquest + v_bonus_conquest,
      conquest_reset_at = NOW(),
      construction_points = v_max_construction + v_bonus_construction,
      construction_reset_at = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'energy', public._energie_max(p_user_id),
    'maxEnergy', public._energie_max(p_user_id),
    'conquestPoints', v_max_conquest + v_bonus_conquest,
    'maxConquest', v_max_conquest + v_bonus_conquest,
    'constructionPoints', v_max_construction + v_bonus_construction,
    'maxConstruction', v_max_construction + v_bonus_construction
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mon_energie()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v json;

BEGIN

  IF auth.uid() IS NULL THEN

    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';

  END IF;

  v := public.get_user_energy((auth.uid())::text);

  RETURN json_build_object(

    'points', floor((v->>'energy')::numeric)::int,

    'max', (v->>'maxEnergy')::numeric::int,

    'prochainDans', CASE WHEN (v->>'energy')::numeric >= (v->>'maxEnergy')::numeric THEN NULL

                         ELSE (v->>'nextPointIn')::int END,

    'parPoint', (v->>'energyCycle')::int,
    'regle', json_build_object(
      'gratuitKm', public._reglage('decouverte_gratuite_km', 100),
      'palier1Km', public._reglage('decouverte_palier_1_km', 500),
      'palier2Km', public._reglage('decouverte_palier_2_km', 1500),
      'cout1', public._reglage('decouverte_cout_1', 1),
      'cout2', public._reglage('decouverte_cout_2', 2),
      'cout3', public._reglage('decouverte_cout_3', 3)));

END;

$function$;

CREATE OR REPLACE FUNCTION public.cout_decouverte(p_id text, p_lat numeric DEFAULT NULL::numeric, p_lng numeric DEFAULT NULL::numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$



DECLARE



  c json;



  e json;



BEGIN



  IF auth.uid() IS NULL THEN



    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';



  END IF;



  IF NOT public._lieu_visible(p_id) THEN



    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';



  END IF;



  c := public._cout_decouverte(p_id, p_lat, p_lng);



  e := public.mon_energie();



  RETURN json_build_object(



    'cout', (c->>'cout')::int,



    'distanceKm', (c->>'distanceKm')::numeric,



    'points', (e->>'points')::int,



    'max', (e->>'max')::int,



    'prochainDans', (e->>'prochainDans')::int,



    'parPoint', (e->>'parPoint')::int,
    'gratuitKm', public._reglage('decouverte_gratuite_km', 100));



END;



$function$;
