-- 021_v07_crowns.sql
-- WHY : V0.7 phase 2 — Couronnes de Chêne (récolte quotidienne sur les lieux veillés).
-- Mécanique :
--   - Toutes les 24h après le plantage (ou la dernière récolte), un coffre apparaît
--     sur chaque lieu où le user est dans l'expédition active.
--   - Click coffre → +1 ou +2 Couronnes dans son stock perso (cap 500).
--   - Solo (expé 1 membre) = 1/jour ; Expé (≥2 membres) = 2/jour, indépendamment du nombre.
--   - Pas de cumul : si le user a raté 3 jours, il récolte quand même 1 (= 1 coffre, 1 récolte).
--   - Récolte indépendante par membre dans une expé (chacun click depuis son téléphone).
--   - Stock plein → coffre absent côté carte (pas de récolte zéro frustrante).
--   - Supplantage : ancien veilleur perd l'accès — on filtre par expé active à chaque RPC,
--     les anciennes lignes crown_harvest restent en DB (cleanup ultérieur si besoin).
-- Couronnes serviront plus tard à acheter des énigmes + délocaliser son Campement (V0.7+).
-- Spec dérivée des décisions du 1-2 mai 2026 (session autonome XO).

-- ============================================================
-- TABLES
-- ============================================================

-- Stock de Couronnes par user (1 ligne par user après sa première récolte).
-- balance contraint à [0, 500] côté DB pour garantir le plafond même si le frontend dérape.
CREATE TABLE IF NOT EXISTS public.user_crowns (
  user_id    text PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  balance    integer NOT NULL DEFAULT 0 CHECK (balance >= 0 AND balance <= 500),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trace de la dernière récolte par (lieu, user) — drive le timer 24h par membre.
-- PK composite (place_id, user_id) : un user peut avoir plusieurs lieux, un lieu plusieurs users.
CREATE TABLE IF NOT EXISTS public.crown_harvest (
  place_id           text NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id            text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_harvested_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, user_id)
);

-- Index pour lookup rapide "tous les lieux récoltables par user X" — couvre le scan de la RPC.
CREATE INDEX IF NOT EXISTS crown_harvest_user_idx ON public.crown_harvest (user_id, last_harvested_at DESC);

GRANT SELECT ON public.user_crowns   TO authenticated, service_role;
GRANT SELECT ON public.crown_harvest TO authenticated, service_role;

-- ============================================================
-- RPC harvest_crown — récolte un coffre
-- ============================================================

CREATE OR REPLACE FUNCTION public.harvest_crown(
  p_user_id  text,
  p_place_id text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_now              timestamptz := now();
  v_expedition_id    uuid;
  v_planted_at       timestamptz;
  v_member_count     integer;
  v_is_member        boolean;
  v_last_harvested   timestamptz;
  v_eligible_at      timestamptz;
  v_gain             integer;
  v_current_balance  integer;
  v_new_balance      integer;
  v_place_title      text;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  -- Charge la veille active du lieu + planted_at (timer initial si jamais récolté)
  SELECT pv.expedition_id, pv.planted_at INTO v_expedition_id, v_planted_at
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  IF v_expedition_id IS NULL THEN
    RETURN json_build_object('error', 'not_veilled');
  END IF;

  -- Vérifie que le user est membre de l'expédition active (et compte les membres)
  SELECT
    bool_or(em.user_id = p_user_id),
    count(*)::integer
  INTO v_is_member, v_member_count
  FROM public.expedition_members em
  WHERE em.expedition_id = v_expedition_id;

  IF NOT COALESCE(v_is_member, false) THEN
    RETURN json_build_object('error', 'not_member');
  END IF;

  -- Timer 24h depuis dernière récolte (ou planted_at si jamais récolté)
  SELECT ch.last_harvested_at INTO v_last_harvested
  FROM public.crown_harvest ch
  WHERE ch.place_id = p_place_id AND ch.user_id = p_user_id;

  v_eligible_at := COALESCE(v_last_harvested, v_planted_at) + interval '24 hours';

  IF v_now < v_eligible_at THEN
    RETURN json_build_object(
      'error', 'too_soon',
      'eligibleAt', v_eligible_at
    );
  END IF;

  -- Charge balance actuelle
  SELECT balance INTO v_current_balance FROM public.user_crowns WHERE user_id = p_user_id;
  v_current_balance := COALESCE(v_current_balance, 0);

  IF v_current_balance >= 500 THEN
    RETURN json_build_object('error', 'stock_full', 'balance', v_current_balance);
  END IF;

  -- Gain : 1 si solo (1 membre), 2 si expé (≥2 membres)
  v_gain := CASE WHEN v_member_count >= 2 THEN 2 ELSE 1 END;

  -- Cap à 500
  v_new_balance := LEAST(500, v_current_balance + v_gain);

  -- UPSERT user_crowns
  INSERT INTO public.user_crowns (user_id, balance, updated_at)
  VALUES (p_user_id, v_new_balance, v_now)
  ON CONFLICT (user_id) DO UPDATE SET
    balance    = EXCLUDED.balance,
    updated_at = EXCLUDED.updated_at;

  -- UPSERT crown_harvest (reset le timer pour ce user sur ce lieu)
  INSERT INTO public.crown_harvest (place_id, user_id, last_harvested_at)
  VALUES (p_place_id, p_user_id, v_now)
  ON CONFLICT (place_id, user_id) DO UPDATE SET
    last_harvested_at = EXCLUDED.last_harvested_at;

  -- Activity log
  SELECT title INTO v_place_title FROM public.places WHERE id = p_place_id;
  INSERT INTO public.activity_log (type, actor_id, place_id, data)
  VALUES (
    'harvest_crown',
    p_user_id,
    p_place_id,
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

-- ============================================================
-- RPC get_my_crowns_state — balance + lieux récoltables maintenant
-- ============================================================
-- Retour : { balance, harvestable: [{ placeId, gain, eligibleAt }], capped: bool }
-- harvestable filtré sur "user dans expé active + timer 24h écoulé". Si capped (balance >= 500),
-- retourne balance + harvestable vide (le frontend masque les coffres).

CREATE OR REPLACE FUNCTION public.get_my_crowns_state(p_user_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_balance  integer;
  v_capped   boolean;
  v_now      timestamptz := now();
  v_items    jsonb;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('balance', 0, 'capped', false, 'harvestable', '[]'::jsonb);
  END IF;

  SELECT COALESCE(balance, 0) INTO v_balance FROM public.user_crowns WHERE user_id = p_user_id;
  v_balance := COALESCE(v_balance, 0);
  v_capped := v_balance >= 500;

  IF v_capped THEN
    RETURN json_build_object('balance', v_balance, 'capped', true, 'harvestable', '[]'::jsonb);
  END IF;

  -- Toutes les expéditions actives où le user est membre + timer 24h écoulé
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'placeId',    t.place_id,
    'gain',       t.gain,
    'eligibleAt', t.eligible_at
  )), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      pv.place_id,
      CASE WHEN (
        SELECT count(*) FROM public.expedition_members em2
        WHERE em2.expedition_id = pv.expedition_id
      ) >= 2 THEN 2 ELSE 1 END                         AS gain,
      COALESCE(ch.last_harvested_at, pv.planted_at) + interval '24 hours' AS eligible_at
    FROM public.place_veille pv
    JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id AND em.user_id = p_user_id
    LEFT JOIN public.crown_harvest ch ON ch.place_id = pv.place_id AND ch.user_id = p_user_id
    WHERE COALESCE(ch.last_harvested_at, pv.planted_at) + interval '24 hours' <= v_now
  ) t;

  RETURN json_build_object(
    'balance',     v_balance,
    'capped',      false,
    'harvestable', v_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_crowns_state(text) TO authenticated, service_role;
