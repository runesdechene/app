-- 347 — Garde d'identité sur les fonctions des lieux, du profil, des quêtes et du Studio
--
-- WHY : audit du 27/09/2026. Ces fonctions s'exécutent avec les droits de leur propriétaire
-- (SECURITY DEFINER), agissent pour le `p_user_id` FOURNI PAR L'APPELANT et ne vérifiaient
-- jamais que cet appelant est bien ce joueur : n'importe qui pouvait écrire, supprimer ou
-- publier au nom d'un autre. Le backlog les croyait « protégées par auth.uid() en interne ».
-- Chaque définition ci-dessous est la définition LIVE relevée le 27/09/2026, recopiée entière ;
-- seul ajout : la garde en tête du corps. Le front V1 envoie toujours son propre identifiant :
-- aucun effet pour un joueur honnête.

CREATE OR REPLACE FUNCTION public.add_place_comment(p_user_id text, p_place_id text, p_content text, p_images jsonb DEFAULT '[]'::jsonb, p_parent_id integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_content text := NULLIF(TRIM(p_content), '');
  v_faction text;
  v_parent_parent integer;
  v_parent_author text;
  v_id integer;
  v_place RECORD;
  v_actor RECORD;
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  IF v_content IS NULL THEN RETURN json_build_object('error','empty_content'); END IF;

  IF p_parent_id IS NOT NULL THEN
    SELECT parent_id, user_id INTO v_parent_parent, v_parent_author FROM place_contributions
    WHERE id = p_parent_id AND place_id = p_place_id AND type = 'comment';
    IF NOT FOUND THEN RETURN json_build_object('error','parent_not_found'); END IF;
    IF v_parent_parent IS NOT NULL THEN
      p_parent_id := v_parent_parent;
      SELECT user_id INTO v_parent_author FROM place_contributions WHERE id = p_parent_id;
    END IF;
  END IF;

  SELECT faction_id INTO v_faction FROM users WHERE id = p_user_id;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, images, parent_id, created_at, updated_at)
  VALUES (p_place_id, p_user_id, v_faction, 'comment', v_content, COALESCE(p_images,'[]'::jsonb), p_parent_id, now(), now())
  RETURNING id INTO v_id;

  SELECT title, latitude, longitude, author_id INTO v_place FROM places WHERE id = p_place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') AS name, avatar_url, faction_id INTO v_actor FROM users WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('contribute', p_user_id, p_place_id, v_actor.faction_id,
    jsonb_build_object(
      'contributionType', CASE WHEN p_parent_id IS NULL THEN 'comment' ELSE 'reply' END,
      'placeTitle', v_place.title, 'placeLatitude', v_place.latitude, 'placeLongitude', v_place.longitude,
      'actorName', v_actor.name, 'actorAvatarUrl', v_actor.avatar_url));

  IF p_parent_id IS NOT NULL AND v_parent_author IS NOT NULL AND v_parent_author <> p_user_id THEN
    PERFORM notify(v_parent_author, 'comment_reply', jsonb_build_object(
      'actorName', v_actor.name, 'actorId', p_user_id, 'placeTitle', v_place.title,
      'placeId', p_place_id, 'contributionId', v_id));
  END IF;
  IF v_place.author_id IS NOT NULL AND v_place.author_id <> p_user_id
     AND (p_parent_id IS NULL OR v_place.author_id <> v_parent_author) THEN
    PERFORM notify(v_place.author_id, 'new_comment', jsonb_build_object(
      'actorName', v_actor.name, 'actorId', p_user_id, 'placeTitle', v_place.title,
      'placeId', p_place_id, 'contributionId', v_id));
  END IF;

  RETURN json_build_object('success', true, 'id', v_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.add_place_photos(p_user_id text, p_place_id text, p_images jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller text := public._caller_user_id();
  v_faction text;
  v_id integer;
  v_place RECORD;
  v_actor RECORD;
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  IF v_caller IS NULL THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  IF p_images IS NULL OR jsonb_array_length(p_images) = 0 THEN
    RETURN json_build_object('error','no_images');
  END IF;

  IF NOT public._can_edit_place_meta(p_place_id, v_caller) THEN
    RETURN json_build_object('error','not_allowed');
  END IF;

  SELECT faction_id INTO v_faction FROM users WHERE id = v_caller;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, images, created_at, updated_at)
  VALUES (p_place_id, v_caller, v_faction, 'photo', p_images, now(), now())
  RETURNING id INTO v_id;

  SELECT title, latitude, longitude, author_id INTO v_place FROM places WHERE id = p_place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') AS name, avatar_url, faction_id
    INTO v_actor FROM users WHERE id = v_caller;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('contribute', v_caller, p_place_id, v_actor.faction_id,
    jsonb_build_object('contributionType','photo',
      'placeTitle', v_place.title, 'placeLatitude', v_place.latitude, 'placeLongitude', v_place.longitude,
      'actorName', v_actor.name, 'actorAvatarUrl', v_actor.avatar_url));

  IF v_place.author_id IS NOT NULL AND v_place.author_id <> v_caller THEN
    PERFORM notify(v_place.author_id, 'new_photo', jsonb_build_object(
      'actorName', v_actor.name, 'actorId', v_caller, 'placeTitle', v_place.title, 'placeId', p_place_id));
  END IF;

  RETURN json_build_object('success', true, 'id', v_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cheat_refill(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
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
  SET energy_points = v_max_energy + v_bonus_energy,
      energy_reset_at = NOW(),
      conquest_points = v_max_conquest + v_bonus_conquest,
      conquest_reset_at = NOW(),
      construction_points = v_max_construction + v_bonus_construction,
      construction_reset_at = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'energy', v_max_energy + v_bonus_energy,
    'maxEnergy', v_max_energy + v_bonus_energy,
    'conquestPoints', v_max_conquest + v_bonus_conquest,
    'maxConquest', v_max_conquest + v_bonus_conquest,
    'constructionPoints', v_max_construction + v_bonus_construction,
    'maxConstruction', v_max_construction + v_bonus_construction
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_photo_submission(p_user_id character varying, p_submitter_name text, p_submitter_email text, p_submitter_instagram text, p_location_name text DEFAULT NULL::text, p_location_zip text DEFAULT NULL::text, p_message text DEFAULT NULL::text, p_consent_brand boolean DEFAULT false, p_consent_account boolean DEFAULT false, p_submitter_role text DEFAULT 'client'::text, p_product_size text DEFAULT NULL::text, p_model_height_cm numeric DEFAULT NULL::numeric, p_model_shoulder_width_cm numeric DEFAULT NULL::numeric, p_departement text DEFAULT NULL::text, p_quest_ref text DEFAULT NULL::text, p_rating_experience integer DEFAULT NULL::integer, p_rating_products integer DEFAULT NULL::integer, p_team_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS NOT NULL AND p_user_id::text IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  INSERT INTO hub_photo_submissions (
    user_id, submitter_name, submitter_email, submitter_instagram,
    location_name, location_zip,
    message, consent_brand_usage, consent_account_creation, status, submitter_role,
    product_size, model_height_cm, model_shoulder_width_cm,
    departement, quest_ref,
    rating_experience, rating_products, team_note
  ) VALUES (
    p_user_id, p_submitter_name, p_submitter_email, p_submitter_instagram,
    p_location_name, p_location_zip,
    p_message, p_consent_brand, p_consent_account, 'pending', p_submitter_role,
    p_product_size, p_model_height_cm, p_model_shoulder_width_cm,
    NULLIF(btrim(p_departement), ''), NULLIF(btrim(p_quest_ref), ''),
    p_rating_experience, p_rating_products, NULLIF(btrim(p_team_note), '')
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.delete_place(p_user_id text, p_place_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_author_id TEXT;
  v_user_role TEXT;
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  -- Verifier que le lieu existe et recuperer l'auteur
  SELECT author_id INTO v_author_id FROM places WHERE id = p_place_id;
  IF v_author_id IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Verifier les droits : auteur ou admin
  SELECT role INTO v_user_role FROM users WHERE id = p_user_id;
  IF v_author_id != p_user_id AND COALESCE(v_user_role, 'user') != 'admin' THEN
    RETURN json_build_object('error', 'Not authorized');
  END IF;

  -- Nettoyer activity_log (FK sans CASCADE)
  DELETE FROM activity_log WHERE place_id = p_place_id;

  -- Supprimer (CASCADE sur toutes les tables liees)
  DELETE FROM places WHERE id = p_place_id;

  RETURN json_build_object('success', true);
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
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
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

CREATE OR REPLACE FUNCTION public.edit_place_description(p_user_id text, p_place_id text, p_content text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller  text := public._caller_user_id();
  v_content text := NULLIF(TRIM(p_content), '');
  v_faction text;
  v_place   RECORD;
  v_actor   RECORD;
  v_prev    RECORD;
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  IF v_caller IS NULL THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF v_content IS NULL THEN RETURN json_build_object('error','empty_content'); END IF;

  IF NOT public._can_edit_place_meta(p_place_id, v_caller) THEN
    RETURN json_build_object('error','not_allowed');
  END IF;

  SELECT faction_id INTO v_faction FROM users WHERE id = v_caller;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, created_at, updated_at)
  VALUES (p_place_id, v_caller, v_faction, 'description', v_content, now(), now())
  ON CONFLICT (place_id) WHERE (type = 'description')
  DO UPDATE SET content = EXCLUDED.content, user_id = EXCLUDED.user_id,
               faction_id = EXCLUDED.faction_id, updated_at = now();

  INSERT INTO place_description_revisions (place_id, content, edited_by)
  VALUES (p_place_id, v_content, v_caller);

  SELECT title, latitude, longitude INTO v_place FROM places WHERE id = p_place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') AS name, avatar_url, faction_id
    INTO v_actor FROM users WHERE id = v_caller;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('contribute', v_caller, p_place_id, v_actor.faction_id,
    jsonb_build_object('contributionType','description',
      'placeTitle', v_place.title, 'placeLatitude', v_place.latitude, 'placeLongitude', v_place.longitude,
      'actorName', v_actor.name, 'actorAvatarUrl', v_actor.avatar_url));

  FOR v_prev IN
    SELECT DISTINCT edited_by FROM place_description_revisions
    WHERE place_id = p_place_id AND edited_by <> v_caller
  LOOP
    PERFORM notify(v_prev.edited_by, 'description_edited', jsonb_build_object(
      'actorName', v_actor.name, 'actorId', v_caller, 'placeTitle', v_place.title, 'placeId', p_place_id));
  END LOOP;

  RETURN json_build_object('success', true, 'content', v_content);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_territory_votes(p_anchor_place_id text, p_user_id text, p_blob_place_ids text[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_faction         TEXT;
  v_territory_faction    TEXT;
  v_personal_inf         INT;
  v_threshold            INT;
  v_vote_power           INT;
  v_proposals            JSON;
  v_used_votes           INT;
  v_proposals_count      INT;
  v_my_veilled_place_ids TEXT[];
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  -- Migrer les propositions avec un ancien anchor vers le nouvel anchor
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  v_territory_faction := public._blob_dominant_faction(p_blob_place_ids);

  -- 1. Supprimer les votes de joueurs qui ne sont plus de la faction du territoire
  DELETE FROM territory_name_votes tv
  USING territory_name_proposals tp, users u
  WHERE tv.proposal_id = tp.id
    AND tp.anchor_place_id = p_anchor_place_id
    AND u.id = tv.voter_id
    AND (u.faction_id IS DISTINCT FROM v_territory_faction);

  -- 2. Supprimer les votes sur des propositions orphelines
  DELETE FROM territory_name_votes tv
  USING territory_name_proposals tp, users u_proposer
  WHERE tv.proposal_id = tp.id
    AND tp.anchor_place_id = p_anchor_place_id
    AND u_proposer.id = tp.proposed_by
    AND (u_proposer.faction_id IS DISTINCT FROM v_territory_faction);

  -- 3. Supprimer les propositions orphelines elles-mêmes
  DELETE FROM territory_name_proposals tp
  USING users u_proposer
  WHERE tp.anchor_place_id = p_anchor_place_id
    AND u_proposer.id = tp.proposed_by
    AND (u_proposer.faction_id IS DISTINCT FROM v_territory_faction);

  IF v_user_faction IS NOT NULL AND v_user_faction = v_territory_faction THEN
    v_personal_inf := public._user_blob_influence(p_user_id, p_blob_place_ids, v_territory_faction);
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'territory_vote_per_influence'), 1)
      INTO v_threshold;
    v_vote_power := 1 + (v_personal_inf / GREATEST(v_threshold, 1));
  ELSE
    v_vote_power := 0;
  END IF;

  -- V103 — liste des lieux du blob où l'user est veilleur direct (pour pill UI)
  SELECT COALESCE(array_agg(DISTINCT pv.place_id), '{}')
  INTO v_my_veilled_place_ids
  FROM place_veille pv
  JOIN expedition_members em ON em.expedition_id = pv.expedition_id
  WHERE pv.place_id = ANY(p_blob_place_ids)
    AND em.user_id = p_user_id
    AND pv.is_neutral = false;

  SELECT COUNT(*) INTO v_proposals_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  SELECT json_agg(row_data ORDER BY net_score DESC, created_at ASC) INTO v_proposals
  FROM (
    SELECT
      json_build_object(
        'id',         p.id,
        'name',       p.name,
        'proposedBy', p.proposed_by,
        'netScore',   COALESCE(SUM(v.value), 0),
        'myVote',     MAX(CASE WHEN v.voter_id = p_user_id THEN v.value ELSE NULL END),
        'voters',     COALESCE(
          (SELECT json_agg(json_build_object('name', public.user_public_name(u.id, u.display_name, u.first_name), 'value', v2.value) ORDER BY ABS(v2.value) DESC)
           FROM territory_name_votes v2
           JOIN users u ON u.id = v2.voter_id
           WHERE v2.proposal_id = p.id),
          '[]'::json
        )
      ) AS row_data,
      COALESCE(SUM(v.value), 0) AS net_score,
      p.created_at
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    JOIN users u_proposer ON u_proposer.id = p.proposed_by
    WHERE p.anchor_place_id = p_anchor_place_id
      AND u_proposer.faction_id = v_territory_faction
    GROUP BY p.id, p.name, p.proposed_by, p.created_at
  ) sub;

  SELECT COALESCE(SUM(ABS(tv.value)), 0) INTO v_used_votes
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  RETURN json_build_object(
    'votePower',         v_vote_power,
    'usedVotes',         v_used_votes,
    'proposalsCount',    v_proposals_count,
    'proposals',         COALESCE(v_proposals, '[]'::json),
    'personalInfluence', COALESCE(v_personal_inf, 0),
    'threshold',         COALESCE(v_threshold, 1),
    'myVeilledPlaceIds', COALESCE(v_my_veilled_place_ids, '{}'::text[])
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_energy(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_energy NUMERIC(6,1);
  v_max_energy NUMERIC(4,1);
  v_energy_reset TIMESTAMPTZ;
  v_conquest NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1);
  v_conquest_reset TIMESTAMPTZ;
  v_construction NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_construction_reset TIMESTAMPTZ;
  v_vitalite NUMERIC(6,1);
  v_max_vitalite NUMERIC(6,1);
  v_vitalite_reset TIMESTAMPTZ;
  v_notoriety INT;
  v_faction_id TEXT;
  -- Bonus faction
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
  v_bonus_vitalite NUMERIC(6,1);
  v_bonus_regen_energy NUMERIC(4,1);
  v_bonus_regen_conquest NUMERIC(4,1);
  v_bonus_regen_construction NUMERIC(4,1);
  v_bonus_regen_vitalite NUMERIC(4,1);
  -- Fragment bonuses
  v_frag_max_energy NUMERIC := 0;
  v_frag_max_conquest NUMERIC := 0;
  v_frag_max_construction NUMERIC := 0;
  v_frag_max_vitalite NUMERIC := 0;
  v_frag_regen_energy NUMERIC := 0;
  v_frag_regen_conquest NUMERIC := 0;
  v_frag_regen_construction NUMERIC := 0;
  v_frag_regen_vitalite NUMERIC := 0;
  -- Base cycles (from app_settings)
  v_base_energy_cycle INT;
  v_base_conquest_cycle INT;
  v_base_construction_cycle INT;
  v_base_vitalite_cycle INT;
  -- Computed cycles
  v_energy_cycle INT;
  v_conquest_cycle INT;
  v_construction_cycle INT;
  v_vitalite_cycle INT;
  -- Regen
  v_elapsed INT;
  v_ticks INT;
  v_add NUMERIC;
  v_next_point INT;
  -- Underdog
  v_is_underdog BOOLEAN := FALSE;
  v_underdog_mult NUMERIC := 1;
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  -- Lire les cycles de base depuis app_settings
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'energy_base_cycle'), 7200) INTO v_base_energy_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'conquest_base_cycle'), 14400) INTO v_base_conquest_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'construction_base_cycle'), 14400) INTO v_base_construction_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'vitalite_base_cycle'), 14400) INTO v_base_vitalite_cycle;

  -- Charger utilisateur
  SELECT energy_points, max_energy, energy_reset_at,
         conquest_points, max_conquest, conquest_reset_at,
         construction_points, max_construction, construction_reset_at,
         COALESCE(vitalite_points, 3), COALESCE(max_vitalite, 3), COALESCE(vitalite_reset_at, NOW()),
         COALESCE(notoriety_points, 0), faction_id
  INTO v_energy, v_max_energy, v_energy_reset,
       v_conquest, v_max_conquest, v_conquest_reset,
       v_construction, v_max_construction, v_construction_reset,
       v_vitalite, v_max_vitalite, v_vitalite_reset,
       v_notoriety, v_faction_id
  FROM users WHERE id = p_user_id;

  -- Charger bonus faction
  IF v_faction_id IS NOT NULL THEN
    SELECT COALESCE(bonus_energy, 0), COALESCE(bonus_conquest, 0),
           COALESCE(bonus_construction, 0), COALESCE(bonus_vitalite, 0),
           COALESCE(bonus_regen_energy, 0), COALESCE(bonus_regen_conquest, 0),
           COALESCE(bonus_regen_construction, 0), COALESCE(bonus_regen_vitalite, 0)
    INTO v_bonus_energy, v_bonus_conquest, v_bonus_construction, v_bonus_vitalite,
         v_bonus_regen_energy, v_bonus_regen_conquest, v_bonus_regen_construction, v_bonus_regen_vitalite
    FROM factions WHERE id = v_faction_id;
  ELSE
    v_bonus_energy := 0; v_bonus_conquest := 0; v_bonus_construction := 0; v_bonus_vitalite := 0;
    v_bonus_regen_energy := 0; v_bonus_regen_conquest := 0; v_bonus_regen_construction := 0; v_bonus_regen_vitalite := 0;
  END IF;

  -- Charger bonus fragments
  SELECT
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_construction' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_vitalite' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_construction' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_vitalite' THEN tf.bonus_value ELSE 0 END), 0)
  INTO v_frag_max_energy, v_frag_max_conquest, v_frag_max_construction, v_frag_max_vitalite,
       v_frag_regen_energy, v_frag_regen_conquest, v_frag_regen_construction, v_frag_regen_vitalite
  FROM user_fragments uf
  JOIN title_fragments tf ON tf.id = uf.fragment_id
  WHERE uf.user_id = p_user_id AND tf.bonus_type IS NOT NULL;

  -- Appliquer les bonus au max
  v_max_energy := GREATEST(1, v_max_energy + v_bonus_energy + v_frag_max_energy);
  v_max_conquest := GREATEST(1, v_max_conquest + v_bonus_conquest + v_frag_max_conquest);
  v_max_construction := GREATEST(1, v_max_construction + v_bonus_construction + v_frag_max_construction);
  v_max_vitalite := GREATEST(1, v_max_vitalite + v_bonus_vitalite + v_frag_max_vitalite);

  -- Calculer les cycles avec bonus (à partir des cycles de base configurables)
  v_energy_cycle := GREATEST(600, (v_base_energy_cycle * (100 - v_bonus_regen_energy - v_frag_regen_energy) / 100)::INT);
  v_conquest_cycle := GREATEST(600, (v_base_conquest_cycle * (100 - v_bonus_regen_conquest - v_frag_regen_conquest) / 100)::INT);
  v_construction_cycle := GREATEST(600, (v_base_construction_cycle * (100 - v_bonus_regen_construction - v_frag_regen_construction) / 100)::INT);
  v_vitalite_cycle := GREATEST(600, (v_base_vitalite_cycle * (100 - v_bonus_regen_vitalite - v_frag_regen_vitalite) / 100)::INT);

  -- Underdog
  SELECT id = v_faction_id INTO v_is_underdog FROM (SELECT get_underdog_faction_id() AS id) sub;
  IF v_is_underdog THEN
    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'underdog_multiplier'), 2)
    INTO v_underdog_mult;
    v_energy_cycle := GREATEST(300, (v_energy_cycle / v_underdog_mult)::INT);
    v_conquest_cycle := GREATEST(300, (v_conquest_cycle / v_underdog_mult)::INT);
    v_construction_cycle := GREATEST(300, (v_construction_cycle / v_underdog_mult)::INT);
    v_vitalite_cycle := GREATEST(300, (v_vitalite_cycle / v_underdog_mult)::INT);
  END IF;

  -- Regen Energy (FIX: avancer energy_reset_at même au max)
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_energy_cycle);
  v_add := LEAST(v_ticks, v_max_energy - v_energy);
  IF v_ticks > 0 THEN
    v_energy_reset := v_energy_reset + (v_ticks * v_energy_cycle * INTERVAL '1 second');
    IF v_add > 0 THEN
      v_energy := LEAST(v_energy + v_add, v_max_energy);
    END IF;
    UPDATE users SET energy_points = v_energy, energy_reset_at = v_energy_reset WHERE id = p_user_id;
  END IF;
  v_next_point := v_energy_cycle - (EXTRACT(EPOCH FROM (NOW() - v_energy_reset))::INT % v_energy_cycle);

  -- Regen Conquest (FIX: même pattern)
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_conquest_cycle);
  v_add := LEAST(v_ticks, v_max_conquest - v_conquest);
  IF v_ticks > 0 THEN
    v_conquest_reset := v_conquest_reset + (v_ticks * v_conquest_cycle * INTERVAL '1 second');
    IF v_add > 0 THEN
      v_conquest := LEAST(v_conquest + v_add, v_max_conquest);
    END IF;
    UPDATE users SET conquest_points = v_conquest, conquest_reset_at = v_conquest_reset WHERE id = p_user_id;
  END IF;

  -- Regen Construction (FIX: même pattern)
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_construction_cycle);
  v_add := LEAST(v_ticks, v_max_construction - v_construction);
  IF v_ticks > 0 THEN
    v_construction_reset := v_construction_reset + (v_ticks * v_construction_cycle * INTERVAL '1 second');
    IF v_add > 0 THEN
      v_construction := LEAST(v_construction + v_add, v_max_construction);
    END IF;
    UPDATE users SET construction_points = v_construction, construction_reset_at = v_construction_reset WHERE id = p_user_id;
  END IF;

  -- Regen Vitalite (FIX: même pattern)
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_vitalite_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_vitalite_cycle);
  v_add := LEAST(v_ticks, v_max_vitalite - v_vitalite);
  IF v_ticks > 0 THEN
    v_vitalite_reset := v_vitalite_reset + (v_ticks * v_vitalite_cycle * INTERVAL '1 second');
    IF v_add > 0 THEN
      v_vitalite := LEAST(v_vitalite + v_add, v_max_vitalite);
    END IF;
    UPDATE users SET vitalite_points = v_vitalite, vitalite_reset_at = v_vitalite_reset WHERE id = p_user_id;
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'nextPointIn', v_next_point,
    'energyCycle', v_energy_cycle,
    'conquestPoints', v_conquest,
    'maxConquest', v_max_conquest,
    'conquestNextPointIn', v_conquest_cycle - (EXTRACT(EPOCH FROM (NOW() - v_conquest_reset))::INT % v_conquest_cycle),
    'conquestCycle', v_conquest_cycle,
    'constructionPoints', v_construction,
    'maxConstruction', v_max_construction,
    'constructionNextPointIn', v_construction_cycle - (EXTRACT(EPOCH FROM (NOW() - v_construction_reset))::INT % v_construction_cycle),
    'constructionCycle', v_construction_cycle,
    'vitalitePoints', v_vitalite,
    'maxVitalite', v_max_vitalite,
    'vitaliteNextPointIn', v_vitalite_cycle - (EXTRACT(EPOCH FROM (NOW() - v_vitalite_reset))::INT % v_vitalite_cycle),
    'vitaliteCycle', v_vitalite_cycle,
    'notorietyPoints', v_notoriety,
    'bonusEnergy', v_bonus_energy + v_frag_max_energy,
    'bonusConquest', v_bonus_conquest + v_frag_max_conquest,
    'bonusConstruction', v_bonus_construction + v_frag_max_construction,
    'bonusVitalite', v_bonus_vitalite + v_frag_max_vitalite,
    'isUnderdog', v_is_underdog,
    'underdogMultiplier', v_underdog_mult
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_count INT;
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  UPDATE notifications SET read = TRUE
  WHERE recipient_id = p_user_id AND read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN json_build_object('success', true, 'markedRead', v_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.propose_territory_name(p_user_id text, p_anchor_place_id text, p_name text, p_blob_place_ids text[] DEFAULT '{}'::text[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_count INT;
  v_trimmed TEXT;
  v_user_faction TEXT;
  v_territory_faction TEXT;
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  v_trimmed := trim(p_name);

  IF length(v_trimmed) < 3 OR length(v_trimmed) > 50 THEN
    RETURN json_build_object('error', 'invalid_length');
  END IF;

  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  -- V0.5 : faction dominante par influence
  IF array_length(p_blob_place_ids, 1) > 0 THEN
    v_territory_faction := public._blob_dominant_faction(p_blob_place_ids);
  ELSE
    -- Fallback : faction dominante du seul anchor
    v_territory_faction := public._blob_dominant_faction(ARRAY[p_anchor_place_id]);
  END IF;

  -- Edge case : v_territory_faction NULL (blob sans place_influence) = personne éligible
  IF v_user_faction IS NULL OR v_territory_faction IS NULL OR v_user_faction != v_territory_faction THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Migrer les anciennes propositions vers le nouvel anchor si nécessaire
  IF array_length(p_blob_place_ids, 1) > 0 THEN
    UPDATE territory_name_proposals
    SET anchor_place_id = p_anchor_place_id
    WHERE anchor_place_id = ANY(p_blob_place_ids)
      AND anchor_place_id != p_anchor_place_id;
  END IF;

  -- Rate limit : max 2 propositions par joueur par territoire
  SELECT COUNT(*) INTO v_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  IF v_count >= 2 THEN
    RETURN json_build_object('error', 'max_proposals');
  END IF;

  INSERT INTO territory_name_proposals (anchor_place_id, proposed_by, name)
  VALUES (p_anchor_place_id, p_user_id, v_trimmed);

  RETURN json_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rate_place(p_user_id text, p_place_id text, p_rating integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_is_explorer BOOLEAN;
  v_is_author BOOLEAN;
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  -- Vérifier que le joueur est explorateur OU auteur du lieu
  SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
  INTO v_is_explorer;

  SELECT EXISTS(SELECT 1 FROM places WHERE id = p_place_id AND author_id = p_user_id)
  INTO v_is_author;

  IF NOT v_is_explorer AND NOT v_is_author THEN
    RETURN json_build_object('error', 'must_be_explorer');
  END IF;

  INSERT INTO place_ratings (place_id, user_id, rating)
  VALUES (p_place_id, p_user_id, p_rating)
  ON CONFLICT (place_id, user_id)
  DO UPDATE SET rating = p_rating, updated_at = NOW();

  RETURN json_build_object('success', true,
    'avgRating', (SELECT AVG(rating)::NUMERIC(2,1) FROM place_ratings WHERE place_id = p_place_id),
    'count', (SELECT COUNT(*) FROM place_ratings WHERE place_id = p_place_id));
END;
$function$;

CREATE OR REPLACE FUNCTION public.rename_place(p_user_id text, p_place_id text, p_title text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller  text := public._caller_user_id();
  v_trimmed text;
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  IF v_caller IS NULL THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  v_trimmed := TRIM(p_title);
  IF v_trimmed = '' OR v_trimmed IS NULL THEN
    RETURN json_build_object('error', 'empty_title');
  END IF;
  IF LENGTH(v_trimmed) > 255 THEN
    RETURN json_build_object('error', 'title_too_long');
  END IF;

  IF NOT public._can_edit_place_meta(p_place_id, v_caller) THEN
    RETURN json_build_object('error', 'not_allowed');
  END IF;

  UPDATE public.places SET title = v_trimmed, updated_at = NOW() WHERE id = p_place_id;
  RETURN json_build_object('success', true, 'title', v_trimmed);
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_displayed_titles_v3(p_user_id text, p_title_ids integer[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  IF array_length(p_title_ids, 1) > 3 THEN
    RETURN json_build_object('error', 'Maximum 3 titres');
  END IF;

  UPDATE users
  SET displayed_title_ids_v3 = COALESCE(p_title_ids, '{}')
  WHERE id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_contribution_like(p_user_id text, p_contribution_id integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contrib RECORD;
  v_existing integer;
  v_liked boolean;
  v_count integer;
  v_place RECORD;
  v_actor RECORD;
  v_rev RECORD;
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN RETURN json_build_object('error','unauthorized'); END IF;
  SELECT id, place_id, user_id, type INTO v_contrib FROM place_contributions WHERE id = p_contribution_id;
  IF NOT FOUND THEN RETURN json_build_object('error','not_found'); END IF;

  SELECT vote INTO v_existing FROM contribution_votes
  WHERE contribution_id = p_contribution_id AND user_id = p_user_id;

  IF v_existing = 1 THEN
    DELETE FROM contribution_votes WHERE contribution_id = p_contribution_id AND user_id = p_user_id;
    UPDATE place_contributions SET votes_up = GREATEST(0, votes_up - 1) WHERE id = p_contribution_id;
    v_liked := false;
  ELSIF v_existing IS NULL THEN
    INSERT INTO contribution_votes (contribution_id, user_id, vote) VALUES (p_contribution_id, p_user_id, 1);
    UPDATE place_contributions SET votes_up = votes_up + 1 WHERE id = p_contribution_id;
    v_liked := true;
  ELSE
    UPDATE contribution_votes SET vote = 1 WHERE contribution_id = p_contribution_id AND user_id = p_user_id;
    UPDATE place_contributions SET votes_up = votes_up + 1 WHERE id = p_contribution_id;
    v_liked := true;
  END IF;

  SELECT votes_up INTO v_count FROM place_contributions WHERE id = p_contribution_id;

  IF v_liked AND v_existing IS NULL THEN
    SELECT title INTO v_place FROM places WHERE id = v_contrib.place_id;
    SELECT COALESCE(display_name, first_name, 'Quelqu''un') AS name INTO v_actor FROM users WHERE id = p_user_id;

    IF v_contrib.type = 'description' THEN
      FOR v_rev IN
        SELECT DISTINCT edited_by FROM place_description_revisions
        WHERE place_id = v_contrib.place_id AND edited_by <> p_user_id
      LOOP
        PERFORM notify(v_rev.edited_by, 'like_contribution', jsonb_build_object(
          'actorName', v_actor.name, 'actorId', p_user_id, 'placeTitle', v_place.title,
          'placeId', v_contrib.place_id, 'contributionId', v_contrib.id, 'contributionType', 'description'));
      END LOOP;
    ELSIF v_contrib.user_id <> p_user_id THEN
      PERFORM notify(v_contrib.user_id, 'like_contribution', jsonb_build_object(
        'actorName', v_actor.name, 'actorId', p_user_id, 'placeTitle', v_place.title,
        'placeId', v_contrib.place_id, 'contributionId', v_contrib.id, 'contributionType', v_contrib.type));
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'liked', v_liked, 'votesUp', v_count);
END; $function$;

CREATE OR REPLACE FUNCTION public.toggle_wishlist(p_user_id text, p_place_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  SELECT EXISTS(SELECT 1 FROM place_wishlist WHERE place_id = p_place_id AND user_id = p_user_id)
  INTO v_exists;

  IF v_exists THEN
    DELETE FROM place_wishlist WHERE place_id = p_place_id AND user_id = p_user_id;
    RETURN json_build_object('wishlisted', false);
  ELSE
    INSERT INTO place_wishlist (place_id, user_id) VALUES (p_place_id, p_user_id);
    RETURN json_build_object('wishlisted', true);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.unlock_pending_fragments(p_user_id text, p_email text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_count INT := 0;
  v_row RECORD;
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  FOR v_row IN
    SELECT id, unlock_ref_id
    FROM purchase_log
    WHERE email = p_email
      AND status = 'pending'
      AND unlock_type = 'fragment'
  LOOP
    -- Inserer le fragment (ignore si deja present)
    INSERT INTO user_fragments (user_id, fragment_id, source)
    VALUES (p_user_id, v_row.unlock_ref_id, 'shopify')
    ON CONFLICT (user_id, fragment_id) DO NOTHING;

    -- Mettre a jour le log
    UPDATE purchase_log
    SET user_id = p_user_id, status = 'unlocked'
    WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.vote_territory_name(p_user_id text, p_proposal_id uuid, p_value smallint, p_blob_place_ids text[], p_anchor_place_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_faction      TEXT;
  v_territory_faction TEXT;
  v_personal_inf      INT;
  v_threshold         INT;
  v_vote_power        INT;
  v_total_used        INT;
  v_winning           TEXT;
  v_tied              BOOLEAN;
  v_net               INT;
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  -- V0.5 : faction dominante par influence
  v_territory_faction := public._blob_dominant_faction(p_blob_place_ids);

  -- Edge case : v_territory_faction NULL (blob sans place_influence) = personne éligible
  IF v_user_faction IS NULL OR v_territory_faction IS NULL OR v_user_faction != v_territory_faction THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- V0.5 : vote_power = 1 + influence_perso / seuil (remplace claimed_count V0.4)
  v_personal_inf := public._user_blob_influence(p_user_id, p_blob_place_ids, v_territory_faction);
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'territory_vote_per_influence'), 10)
    INTO v_threshold;
  v_vote_power := 1 + (v_personal_inf / GREATEST(v_threshold, 1));

  -- Migrer les anciennes propositions vers l'anchor actuel
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Upsert ou suppression du vote
  IF p_value = 0 THEN
    DELETE FROM territory_name_votes
    WHERE proposal_id = p_proposal_id AND voter_id = p_user_id;
  ELSE
    INSERT INTO territory_name_votes (proposal_id, voter_id, value)
    VALUES (p_proposal_id, p_user_id, p_value)
    ON CONFLICT (proposal_id, voter_id) DO UPDATE SET value = EXCLUDED.value;
  END IF;

  -- Valider que le total utilisé ne dépasse pas le vote power
  SELECT COALESCE(SUM(ABS(tv.value)), 0) INTO v_total_used
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  IF v_total_used > v_vote_power THEN
    -- Rollback
    DELETE FROM territory_name_votes
    WHERE proposal_id = p_proposal_id AND voter_id = p_user_id;

    RETURN json_build_object('error', 'not_enough_votes', 'votePower', v_vote_power, 'usedVotes', v_total_used - ABS(p_value));
  END IF;

  -- Recalculer le gagnant pour ce territoire
  WITH scores AS (
    SELECT p.name, COALESCE(SUM(v.value), 0) AS net_score
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name
    ORDER BY net_score DESC
  ),
  top_score AS (SELECT MAX(net_score) AS mx FROM scores),
  winners  AS (SELECT name FROM scores, top_score WHERE net_score = mx)
  SELECT
    CASE WHEN (SELECT COUNT(*) FROM winners) > 1 THEN NULL
         ELSE (SELECT name FROM winners LIMIT 1) END,
    (SELECT COUNT(*) FROM winners) > 1
  INTO v_winning, v_tied;

  -- Score net de la proposition votée
  SELECT COALESCE(SUM(value), 0) INTO v_net
  FROM territory_name_votes WHERE proposal_id = p_proposal_id;

  RETURN json_build_object(
    'ok',          true,
    'winningName', v_winning,
    'isTie',       v_tied,
    'proposalNet', v_net
  );
END;
$function$;
