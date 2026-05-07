-- 122_crowns_progressive.sql
-- WHY : refonte de l'éco Couronnes (spec 2026-05-07).
-- Avant : cap silencieux fixe 15 coffres/jour, set sélectionné par md5
-- (mig 029) — frustrait les "0 lieu" et trivialisait les gros bâtisseurs.
-- Après : tirage indépendant par lieu, proba dégressive p(N) = K/sqrt(N),
-- drip intra-journée (6h-20h), paramétré app_settings.
--
-- Reprise EXACTE de la mig 029 puis modifications ciblées :
--   1) get_my_crowns_state : remplace today_set (LIMIT 15) par tirage par lieu
--      + filtre drip_minute <= now()
--   2) harvest_crown : remplace check today_set par re-évaluation du tirage
--      (cohérent avec ce que voit le frontend) + check drip
--
-- Côté front, aucun changement de signature : payload identique.

BEGIN;

-- ============================================================
-- _crown_proba_for_n : helper qui calcule p(N) lu depuis app_settings
-- ============================================================

CREATE OR REPLACE FUNCTION public._crown_proba_for_n(p_n integer)
RETURNS numeric
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_k       numeric;
  v_floor_n integer;
BEGIN
  v_k       := COALESCE((SELECT value::numeric FROM public.app_settings WHERE key = 'crowns_proba_k'),       3.87);
  v_floor_n := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_proba_n_floor'), 15);

  IF p_n <= 0 THEN RETURN 0; END IF;
  IF p_n <= v_floor_n THEN RETURN 1.0; END IF;
  RETURN LEAST(1.0, v_k / sqrt(p_n));
END;
$$;

GRANT EXECUTE ON FUNCTION public._crown_proba_for_n(integer) TO authenticated, service_role;

-- ============================================================
-- _crown_eligible_today : helper booléen — ce lieu a-t-il un coffre
-- aujourd'hui pour ce user, et est-il déjà apparu (drip) ?
-- Stateless, déterministe via md5(user || place || date).
-- ============================================================

CREATE OR REPLACE FUNCTION public._crown_eligible_today(
  p_user_id  text,
  p_place_id text,
  p_n_total  integer
) RETURNS boolean
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_h            text;
  v_h_lo         text;
  v_proba        numeric;
  v_proba_int    integer;
  v_h_hi         integer;
  v_drip_minute  integer;
  v_now_minute   integer;
  v_drip_h0      integer;
  v_drip_h1      integer;
  v_drip_window  integer;
BEGIN
  v_h := md5(p_user_id || '-' || p_place_id || '-' || current_date::text);

  -- Tirage proba par lieu : convertir 8 premiers chars hex (32 bits) en bigint
  -- puis abs() avant le modulo (le cast bit(32)::bigint donne un signed → la
  -- moitié des hashes seraient négatifs et tomberaient jamais dans le seuil).
  v_h_lo := substr(v_h, 1, 8);
  v_proba := public._crown_proba_for_n(p_n_total);
  v_proba_int := (FLOOR(v_proba * 1000))::integer;
  IF (abs(('x' || v_h_lo)::bit(32)::bigint) % 1000) >= v_proba_int THEN
    RETURN false;
  END IF;

  -- Drip : minute d'apparition entre crowns_drip_start_hour et crowns_drip_end_hour
  v_drip_h0     := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_drip_start_hour'), 6);
  v_drip_h1     := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_drip_end_hour'),   20);
  v_drip_window := GREATEST(60, (v_drip_h1 - v_drip_h0) * 60);  -- safety floor 60 min

  v_h_hi := (abs(('x' || substr(v_h, 9, 8))::bit(32)::bigint) % v_drip_window)::integer;
  v_drip_minute := v_drip_h0 * 60 + v_h_hi;

  v_now_minute := EXTRACT(HOUR FROM now())::integer * 60 + EXTRACT(MINUTE FROM now())::integer;
  RETURN v_drip_minute <= v_now_minute;
END;
$$;

GRANT EXECUTE ON FUNCTION public._crown_eligible_today(text, text, integer) TO authenticated, service_role;

-- ============================================================
-- get_my_crowns_state — refonte sur tirage par lieu
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_crowns_state(p_user_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_balance   integer;
  v_cap       integer;
  v_capped    boolean;
  v_now       timestamptz := now();
  v_n_total   integer;
  v_items     jsonb;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('balance', 0, 'capped', false, 'harvestable', '[]'::jsonb);
  END IF;

  SELECT COALESCE(balance, 0) INTO v_balance FROM public.user_crowns WHERE user_id = p_user_id;
  v_balance := COALESCE(v_balance, 0);
  v_cap     := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_stock_cap'), 500);
  v_capped  := v_balance >= v_cap;

  IF v_capped THEN
    RETURN json_build_object('balance', v_balance, 'capped', true, 'harvestable', '[]'::jsonb);
  END IF;

  -- N = nombre total de lieux veillés par le user (denominator de la proba)
  SELECT count(*)::integer INTO v_n_total
  FROM public.place_veille pv
  JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id AND em.user_id = p_user_id;

  -- Pour chaque lieu : tirage proba + drip + cooldown 24h.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'placeId',    t.place_id,
    'gain',       t.gain,
    'eligibleAt', t.eligible_at
  )), '[]'::jsonb) INTO v_items
  FROM (
    SELECT
      pv.place_id,
      CASE WHEN (
        SELECT count(*) FROM public.expedition_members em2
        WHERE em2.expedition_id = pv.expedition_id
      ) >= 2 THEN 2 ELSE 1 END                                                     AS gain,
      COALESCE(ch.last_harvested_at, pv.planted_at) + interval '24 hours'          AS eligible_at
    FROM public.place_veille pv
    JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id AND em.user_id = p_user_id
    LEFT JOIN public.crown_harvest ch ON ch.place_id = pv.place_id AND ch.user_id = p_user_id
    WHERE
      public._crown_eligible_today(p_user_id, pv.place_id, v_n_total) = true
      AND COALESCE(ch.last_harvested_at, pv.planted_at) + interval '24 hours' <= v_now
  ) t;

  RETURN json_build_object(
    'balance',     v_balance,
    'capped',      false,
    'harvestable', v_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_crowns_state(text) TO authenticated, service_role;

-- ============================================================
-- harvest_crown — re-vérifie le tirage du jour (anti-bypass)
-- Reprise exacte mig 029 sauf le bloc de check, remplacé par appel
-- au helper _crown_eligible_today (cohérent avec ce que voit le front).
-- ============================================================

CREATE OR REPLACE FUNCTION public.harvest_crown(
  p_user_id  text,
  p_place_id text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_now              timestamptz := now();
  v_eligible         boolean;
  v_expedition_id    uuid;
  v_planted_at       timestamptz;
  v_member_count     integer;
  v_is_member        boolean;
  v_last_harvested   timestamptz;
  v_eligible_at      timestamptz;
  v_gain             integer;
  v_current_balance  integer;
  v_new_balance      integer;
  v_cap              integer;
  v_n_total          integer;
  v_place_title      text;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  -- Anti-bypass : recalcul du tirage du jour côté serveur.
  -- Le user doit être dans une expé sur ce lieu pour que N inclue le lieu.
  SELECT count(*)::integer INTO v_n_total
  FROM public.place_veille pv
  JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id AND em.user_id = p_user_id;

  v_eligible := public._crown_eligible_today(p_user_id, p_place_id, v_n_total);
  IF NOT v_eligible THEN
    RETURN json_build_object('error', 'not_today');
  END IF;

  SELECT pv.expedition_id, pv.planted_at INTO v_expedition_id, v_planted_at
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  IF v_expedition_id IS NULL THEN
    RETURN json_build_object('error', 'not_veilled');
  END IF;

  SELECT
    bool_or(em.user_id = p_user_id),
    count(*)::integer
  INTO v_is_member, v_member_count
  FROM public.expedition_members em
  WHERE em.expedition_id = v_expedition_id;

  IF NOT COALESCE(v_is_member, false) THEN
    RETURN json_build_object('error', 'not_member');
  END IF;

  SELECT ch.last_harvested_at INTO v_last_harvested
  FROM public.crown_harvest ch
  WHERE ch.place_id = p_place_id AND ch.user_id = p_user_id;

  v_eligible_at := COALESCE(v_last_harvested, v_planted_at) + interval '24 hours';

  IF v_now < v_eligible_at THEN
    RETURN json_build_object('error', 'too_soon', 'eligibleAt', v_eligible_at);
  END IF;

  v_cap := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_stock_cap'), 500);
  SELECT balance INTO v_current_balance FROM public.user_crowns WHERE user_id = p_user_id;
  v_current_balance := COALESCE(v_current_balance, 0);

  IF v_current_balance >= v_cap THEN
    RETURN json_build_object('error', 'stock_full', 'balance', v_current_balance);
  END IF;

  v_gain := CASE WHEN v_member_count >= 2 THEN 2 ELSE 1 END;
  v_new_balance := LEAST(v_cap, v_current_balance + v_gain);

  INSERT INTO public.user_crowns (user_id, balance, updated_at)
  VALUES (p_user_id, v_new_balance, v_now)
  ON CONFLICT (user_id) DO UPDATE SET
    balance    = EXCLUDED.balance,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.crown_harvest (place_id, user_id, last_harvested_at)
  VALUES (p_place_id, p_user_id, v_now)
  ON CONFLICT (place_id, user_id) DO UPDATE SET
    last_harvested_at = EXCLUDED.last_harvested_at;

  SELECT title INTO v_place_title FROM public.places WHERE id = p_place_id;
  INSERT INTO public.activity_log (type, actor_id, place_id, data)
  VALUES (
    'harvest_crown', p_user_id, p_place_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'gain', v_gain,
      'memberCount', v_member_count,
      'newBalance', v_new_balance
    )
  );

  RETURN json_build_object(
    'success',     true,
    'placeId',     p_place_id,
    'gain',        v_gain,
    'balance',     v_new_balance,
    'harvestedAt', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.harvest_crown(text, text) TO authenticated, service_role;

COMMIT;
