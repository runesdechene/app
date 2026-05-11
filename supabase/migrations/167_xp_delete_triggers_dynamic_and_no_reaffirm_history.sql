-- 167_xp_delete_triggers_dynamic_and_no_reaffirm_history.sql
-- WHY : audit complet des asymétries gain/perte XP+Coupe découvert le 11/05/2026.
--
-- Bug 1 (xp_total) — triggers DELETE avec valeurs HARDCODED qui ne reflètent
-- plus le barème app_settings :
--   _trg_xp_place_delete           : reverse -20 vs INSERT lit glory.add_place (=7)
--   _trg_xp_contribution_delete    : reverse -5 (carnet) vs INSERT lit glory.carnet (=3)
--                                  : reverse -1/photo (carnet n'a rien à voir)
-- Conséquence : supprimer un lieu retirait +13 trop de Gloire au créateur.
--
-- Bug 2 (xp_total) — pas de DELETE trigger sur veille_history :
--   INSERT crédite +2 (lit glory.plant_flag), DELETE silencieux → asymétrie.
--   Le user gardait son +2 même si le lieu disparaissait. Ajout du trigger.
--
-- Bug 3 (Coupe — score dynamique calculé sur veille_history) — la RPC plant_flag
-- CAS D (reaffirm_gps) insérait un row veille_history à chaque clic. Or le calcul
-- _user_coupe_score compte chaque row × coupe.plant_flag. Donc chaque réaffirmation
-- gonflait silencieusement le score Coupe (pas affiché à l'user). À la suppression
-- du lieu, tout était reverse d'un coup (-N×2 inattendu).
--   Décision Uriel 11/05 : réaffirmer = action défensive, AUCUN gain (Cour ni Coupe).
--   Fix : ne plus INSERT veille_history en CAS D. Le user reste dans place_veille
--   comme veilleur, planted_at est mis à jour, les menaces Cour sont effacées,
--   mais aucune nouvelle entrée historique = aucun nouveau point.
--
-- Tout lit désormais app_settings dynamiquement. INSERT et DELETE STRICTEMENT
-- symétriques. Si le Hub change un barème, la rétrocession suit automatiquement.

-- ============================================================
-- 1. _trg_xp_place_delete — lit glory.add_place
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_xp_place_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE v_delta integer;
BEGIN
  IF OLD.author_id IS NULL OR OLD.created_at < public._xp_epoch() THEN RETURN OLD; END IF;
  SELECT COALESCE(value::int, 7) INTO v_delta FROM public.app_settings WHERE key = 'glory.add_place';
  v_delta := COALESCE(v_delta, 7);
  UPDATE public.users SET xp_total = GREATEST(0, xp_total - v_delta) WHERE id = OLD.author_id;
  RETURN OLD;
END;
$function$;

-- ============================================================
-- 2. _trg_xp_contribution_delete — lit glory.carnet et glory.photo
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_xp_contribution_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_delta      integer := 0;
  v_carnet     integer;
  v_photo      integer;
  v_photo_cnt  integer;
BEGIN
  IF OLD.created_at < public._xp_epoch() THEN RETURN OLD; END IF;
  IF OLD.type = 'carnet' THEN
    SELECT COALESCE(value::int, 3) INTO v_carnet FROM public.app_settings WHERE key = 'glory.carnet';
    v_delta := COALESCE(v_carnet, 3);
  ELSIF OLD.type = 'photo' THEN
    v_photo_cnt := COALESCE(jsonb_array_length(OLD.images), 0)
                 + CASE WHEN (OLD.images IS NULL OR jsonb_array_length(OLD.images) = 0)
                         AND OLD.image_url IS NOT NULL AND OLD.image_url != ''
                        THEN 1 ELSE 0 END;
    SELECT COALESCE(value::int, 1) INTO v_photo FROM public.app_settings WHERE key = 'glory.photo';
    v_delta := v_photo_cnt * COALESCE(v_photo, 1);
  END IF;
  IF v_delta > 0 THEN
    UPDATE public.users SET xp_total = GREATEST(0, xp_total - v_delta) WHERE id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$function$;

-- ============================================================
-- 3. _trg_xp_plantage_delete — NOUVEAU, symétrique au INSERT existant
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_xp_plantage_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE v_delta integer;
BEGIN
  IF COALESCE(OLD.planted_at, now()) < public._xp_epoch() THEN RETURN OLD; END IF;
  SELECT COALESCE(value::int, 2) INTO v_delta FROM public.app_settings WHERE key = 'glory.plant_flag';
  v_delta := COALESCE(v_delta, 2);
  UPDATE public.users SET xp_total = GREATEST(0, xp_total - v_delta) WHERE id = OLD.user_id;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_xp_plantage_del ON public.veille_history;
CREATE TRIGGER trg_xp_plantage_del
  AFTER DELETE ON public.veille_history
  FOR EACH ROW EXECUTE FUNCTION public._trg_xp_plantage_delete();

-- ============================================================
-- 4. plant_flag CAS D — ne plus INSERT dans veille_history
-- ============================================================
-- Méthode : copy-paste baseline ENTIÈRE (mig 166) + retrait de l'INSERT
-- veille_history dans le bloc CAS D. Aucune autre logique modifiée.

CREATE OR REPLACE FUNCTION public.plant_flag(p_user_id text, p_place_id text, p_user_lat numeric, p_user_lng numeric, p_partners_user_ids text[] DEFAULT '{}'::text[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
  v_cooldown_hours      int := _barem('cooldown.replant_hours', 24);
  v_last_plant          timestamptz;
  v_remaining_hours     numeric;
  v_prev_veilleur_exp   uuid;
  v_prev_by_influence   boolean;
  v_prev_previous_exp   uuid;
  v_threats_cleared     int;
  v_notif_data          jsonb;
  v_solo_bonus          integer;
  v_per_extra           integer;
  v_max_companions      integer;
  v_companions_count    integer;
  v_plant_bonus_amount  integer;
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

  SELECT pv.expedition_id, pv.by_influence, pv.previous_expedition_id
  INTO v_prev_veilleur_exp, v_prev_by_influence, v_prev_previous_exp
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  v_solo_bonus     := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_solo_bonus'),            50);
  v_per_extra      := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_per_extra_member'),      30);
  v_max_companions := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_max_members_for_bonus'), 10);

  v_companions_count := LEAST(
    COALESCE(array_length(p_partners_user_ids, 1), 0),
    v_max_companions
  );
  v_plant_bonus_amount := v_solo_bonus + v_per_extra * v_companions_count;

  -- CAS A
  IF COALESCE(v_prev_by_influence, false) = true
     AND v_prev_previous_exp IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.expedition_members em WHERE em.expedition_id = v_prev_previous_exp AND em.user_id = p_user_id)
  THEN
    UPDATE public.place_veille
    SET expedition_id          = v_prev_previous_exp,
        by_influence           = false,
        previous_expedition_id = NULL,
        planted_at             = v_now,
        veilleur_user_id       = p_user_id,
        faction_id             = (SELECT faction_id FROM public.expeditions WHERE id = v_prev_previous_exp),
        is_neutral             = (SELECT is_neutral FROM public.expeditions WHERE id = v_prev_previous_exp)
    WHERE place_id = p_place_id;

    DELETE FROM public.place_court_action WHERE place_id = p_place_id AND beneficiary_user_id IS DISTINCT FROM p_user_id;
    INSERT INTO public.place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
    VALUES (p_place_id, p_user_id, v_prev_previous_exp, p_user_id, 'plant_bonus', v_plant_bonus_amount);

    DELETE FROM public.place_court_score WHERE place_id = p_place_id;

    v_notif_data := jsonb_build_object('placeId', p_place_id, 'placeTitle', v_place_title,
      'expeditionId', v_prev_veilleur_exp, 'reclaimedBy', v_prev_previous_exp);
    INSERT INTO public.activity_log (type, actor_id, place_id, data)
    VALUES ('place_taken_back_gps', p_user_id, p_place_id, v_notif_data);
    PERFORM public._notify_court_members(v_prev_veilleur_exp, 'place_taken_back_gps', v_notif_data, p_user_id);

    INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
    VALUES (p_place_id, v_prev_previous_exp, p_user_id, v_user_faction, false, v_now);

    SELECT jsonb_agg(jsonb_build_object('userId', em.user_id,
      'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
      'avatarUrl', u.avatar_url, 'factionId', em.faction_id))
    INTO v_members_json
    FROM public.expedition_members em
    JOIN public.users u ON u.id = em.user_id
    WHERE em.expedition_id = v_prev_previous_exp;

    RETURN json_build_object('success', true, 'mode', 'reclaim_gps', 'placeId', p_place_id,
      'expeditionId', v_prev_previous_exp, 'members', v_members_json, 'plantedAt', v_now,
      'plantBonus', v_plant_bonus_amount);
  END IF;

  -- CAS B
  IF COALESCE(v_prev_by_influence, false) = true
     AND v_prev_veilleur_exp IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.expedition_members em WHERE em.expedition_id = v_prev_veilleur_exp AND em.user_id = p_user_id)
  THEN
    UPDATE public.place_veille
    SET by_influence = false, previous_expedition_id = NULL, planted_at = v_now, veilleur_user_id = p_user_id
    WHERE place_id = p_place_id;

    DELETE FROM public.place_court_action WHERE place_id = p_place_id AND beneficiary_user_id IS DISTINCT FROM p_user_id;
    INSERT INTO public.place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
    VALUES (p_place_id, p_user_id, v_prev_veilleur_exp, p_user_id, 'plant_bonus', v_plant_bonus_amount);

    DELETE FROM public.place_court_score WHERE place_id = p_place_id AND expedition_id != v_prev_veilleur_exp;

    INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
    VALUES (p_place_id, v_prev_veilleur_exp, p_user_id, v_user_faction, false, v_now);

    SELECT jsonb_agg(jsonb_build_object('userId', em.user_id,
      'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
      'avatarUrl', u.avatar_url, 'factionId', em.faction_id))
    INTO v_members_json
    FROM public.expedition_members em
    JOIN public.users u ON u.id = em.user_id
    WHERE em.expedition_id = v_prev_veilleur_exp;

    RETURN json_build_object('success', true, 'mode', 'confirm_gps', 'placeId', p_place_id,
      'expeditionId', v_prev_veilleur_exp, 'members', v_members_json, 'plantedAt', v_now,
      'plantBonus', v_plant_bonus_amount);
  END IF;

  -- CAS D — reaffirm_gps : déjà veilleur GPS, refait son plant.
  -- FIX 11/05 mig 166 : ne plus insérer de plant_bonus (anti-exploit Cour).
  -- FIX 11/05 mig 167 : ne plus insérer de veille_history non plus (anti-exploit Coupe).
  --   Le user reste veilleur (place_veille mis à jour), les menaces Cour sont
  --   effacées, mais AUCUN nouveau gain. Décision Uriel : réaffirmer = défensif pur.
  IF COALESCE(v_prev_by_influence, false) = false
     AND v_prev_veilleur_exp IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.expedition_members em WHERE em.expedition_id = v_prev_veilleur_exp AND em.user_id = p_user_id)
  THEN
    UPDATE public.place_veille SET planted_at = v_now, veilleur_user_id = p_user_id WHERE place_id = p_place_id;

    v_notif_data := jsonb_build_object('placeId', p_place_id, 'placeTitle', v_place_title, 'expeditionId', v_prev_veilleur_exp);
    PERFORM public._notify_court_challengers(p_place_id, v_prev_veilleur_exp, 'place_reaffirmed', v_notif_data, p_user_id);

    DELETE FROM public.place_court_action WHERE place_id = p_place_id AND beneficiary_user_id IS DISTINCT FROM p_user_id;
    -- (volontairement pas de INSERT plant_bonus ici — anti-exploit mig 166)

    DELETE FROM public.place_court_score WHERE place_id = p_place_id AND expedition_id != v_prev_veilleur_exp;
    GET DIAGNOSTICS v_threats_cleared = ROW_COUNT;

    -- (volontairement pas de INSERT veille_history ici — anti-exploit mig 167)

    IF v_threats_cleared > 0 THEN
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_reaffirmed', p_user_id, p_place_id, v_notif_data || jsonb_build_object('threatsCleared', v_threats_cleared));
    END IF;

    SELECT jsonb_agg(jsonb_build_object('userId', em.user_id,
      'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
      'avatarUrl', u.avatar_url, 'factionId', em.faction_id))
    INTO v_members_json
    FROM public.expedition_members em
    JOIN public.users u ON u.id = em.user_id
    WHERE em.expedition_id = v_prev_veilleur_exp;

    RETURN json_build_object('success', true, 'mode', 'reaffirm_gps', 'placeId', p_place_id,
      'expeditionId', v_prev_veilleur_exp, 'members', v_members_json, 'plantedAt', v_now,
      'threatsCleared', v_threats_cleared, 'plantBonus', 0);
  END IF;

  -- CAS C
  SELECT MAX(planted_at) INTO v_last_plant
  FROM public.veille_history WHERE user_id = p_user_id AND place_id = p_place_id;

  IF v_last_plant IS NOT NULL AND v_last_plant > (v_now - (v_cooldown_hours || ' hours')::interval) THEN
    v_remaining_hours := EXTRACT(EPOCH FROM ((v_last_plant + (v_cooldown_hours || ' hours')::interval) - v_now)) / 3600.0;
    RETURN json_build_object('error', 'cooldown',
      'remainingHours', ROUND(v_remaining_hours::numeric, 1),
      'cooldownHours', v_cooldown_hours);
  END IF;

  SELECT array_agg(DISTINCT u.faction_id) INTO v_factions
  FROM public.users u
  WHERE (u.id = ANY(p_partners_user_ids) OR u.id = p_user_id) AND u.faction_id IS NOT NULL;

  v_is_neutral := (COALESCE(array_length(v_factions, 1), 0) > 1);
  v_expedition_faction := CASE WHEN v_is_neutral THEN NULL ELSE v_user_faction END;

  DECLARE
    v_planter_name text;
    v_title        text;
  BEGIN
    SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_planter_name
    FROM public.users WHERE id = p_user_id;
    v_title := CASE
      WHEN COALESCE(array_length(p_partners_user_ids, 1), 0) > 0
        THEN 'Expédition de ' || v_planter_name
      ELSE NULL
    END;

    INSERT INTO public.expeditions (place_id, is_neutral, faction_id, title, created_at)
    VALUES (p_place_id, v_is_neutral, v_expedition_faction, v_title, v_now)
    RETURNING id INTO v_expedition_id;
  END;

  INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
  VALUES (v_expedition_id, p_user_id, v_user_faction);

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

  IF v_prev_veilleur_exp IS NOT NULL AND v_prev_veilleur_exp != v_expedition_id THEN
    PERFORM public._notify_court_members(v_prev_veilleur_exp, 'place_taken_back_gps', jsonb_build_object(
      'placeId', p_place_id, 'placeTitle', v_place_title,
      'expeditionId', v_prev_veilleur_exp, 'reclaimedBy', v_expedition_id,
      'plantedByUser', p_user_id), p_user_id);
  END IF;

  INSERT INTO public.place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id, veilleur_user_id)
  VALUES (p_place_id, v_expedition_id, v_expedition_faction, v_is_neutral, v_now, false, NULL, p_user_id)
  ON CONFLICT (place_id) DO UPDATE SET
    expedition_id          = EXCLUDED.expedition_id,
    faction_id             = EXCLUDED.faction_id,
    is_neutral             = EXCLUDED.is_neutral,
    planted_at             = EXCLUDED.planted_at,
    by_influence           = false,
    previous_expedition_id = NULL,
    veilleur_user_id       = EXCLUDED.veilleur_user_id;

  DELETE FROM public.place_court_action WHERE place_id = p_place_id AND beneficiary_user_id IS DISTINCT FROM p_user_id;
  INSERT INTO public.place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
  VALUES (p_place_id, p_user_id, v_expedition_id, p_user_id, 'plant_bonus', v_plant_bonus_amount);

  DELETE FROM public.place_court_score WHERE place_id = p_place_id;

  INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
  SELECT p_place_id, v_expedition_id, em.user_id, em.faction_id, v_is_neutral, v_now
  FROM public.expedition_members em WHERE em.expedition_id = v_expedition_id;

  SELECT jsonb_agg(jsonb_build_object('userId', em.user_id,
    'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
    'avatarUrl', u.avatar_url, 'factionId', em.faction_id))
  INTO v_members_json
  FROM public.expedition_members em
  JOIN public.users u ON u.id = em.user_id
  WHERE em.expedition_id = v_expedition_id;

  INSERT INTO public.activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('plant_flag', p_user_id, p_place_id, v_expedition_faction,
    jsonb_build_object('placeTitle', v_place_title, 'isNeutral', v_is_neutral,
      'expeditionId', v_expedition_id,
      'memberCount', jsonb_array_length(v_members_json),
      'members', v_members_json));

  RETURN json_build_object('success', true, 'mode', 'plant', 'placeId', p_place_id,
    'isNeutral', v_is_neutral, 'factionId', v_expedition_faction,
    'expeditionId', v_expedition_id, 'members', v_members_json,
    'plantedAt', v_now, 'plantBonus', v_plant_bonus_amount);
END;
$function$;
