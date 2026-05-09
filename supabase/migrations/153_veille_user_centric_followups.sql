-- 153_veille_user_centric_followups.sql
-- WHY : 3 fixes immédiats après mig 152 (user-centric), découverts au test
-- d'Uriel sur Veymont :
--
-- 1. create_challenger_expedition refusait quand le caller était membre de
--    l'expé veilleuse legacy (case "already_veilleur"). Or en user-centric,
--    le critère "déjà veilleur" doit être place_veille.veilleur_user_id =
--    caller, pas "membre de l'expé legacy". Sinon impossible de Défier
--    quand on est membre d'une expé legacy mais qu'un autre user a basculé
--    via invest_crowns (cas Veymont après backfill mig 152).
--
-- 2. get_map_veilles (mig 149) ordonnait members par defense_total. En
--    user-centric, on veut members[0] = veilleur_user_id (pinned), puis les
--    autres triés par score user DESC. La pilule sous marker affiche ainsi
--    le bon veilleur peu importe le camp d'investissement.
--
-- 3. invest_crowns (mig 152) appelait _notify_court_members pour notifier
--    les anciens veilleurs lors d'une bascule. Mais en user-centric,
--    veilleur déchu = un user (pas une expé). Pour Nepherys déchue à Veymont,
--    _notify_court_members(expé legacy d'Uriel) ne notifiait pas Nepherys.
--    Fix : en plus de _notify_court_members (legacy multi-membres), on appelle
--    notify(v_current_veilleur_user, ...) directement pour le user déchu.
--    Idem pour place_court_attack et place_court_high_threat.

BEGIN;

-- ============================================================
-- 1. create_challenger_expedition — check user-centric
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_challenger_expedition(
  p_user_id  text,
  p_place_id text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_faction_id      text;
  v_veilleur_exp    uuid;
  v_veilleur_user   text;
  v_existing_exp    uuid;
  v_new_exp_id      uuid;
  v_place_exists    boolean;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT faction_id INTO v_faction_id FROM public.users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) INTO v_place_exists;
  IF NOT v_place_exists THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  SELECT pv.expedition_id, pv.veilleur_user_id
  INTO v_veilleur_exp, v_veilleur_user
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  -- V153 : refuse seulement si caller EST le veilleur user.
  IF v_veilleur_user IS NOT NULL AND v_veilleur_user = p_user_id THEN
    RETURN json_build_object('error', 'already_veilleur');
  END IF;

  -- Réutiliser une expé existante du user sur ce lieu (autre que veilleuse)
  SELECT e.id INTO v_existing_exp
  FROM public.expeditions e
  JOIN public.expedition_members em ON em.expedition_id = e.id
  WHERE e.place_id = p_place_id
    AND em.user_id = p_user_id
    AND (v_veilleur_exp IS NULL OR e.id != v_veilleur_exp)
  LIMIT 1;

  IF v_existing_exp IS NOT NULL THEN
    RETURN json_build_object(
      'success',      true,
      'expeditionId', v_existing_exp,
      'reused',       true
    );
  END IF;

  INSERT INTO public.expeditions (place_id, is_neutral, faction_id, created_at)
  VALUES (p_place_id, false, v_faction_id, now())
  RETURNING id INTO v_new_exp_id;

  INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
  VALUES (v_new_exp_id, p_user_id, v_faction_id);

  RETURN json_build_object(
    'success',      true,
    'expeditionId', v_new_exp_id,
    'reused',       false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_challenger_expedition(text, text)
  TO authenticated, service_role;

-- ============================================================
-- 2. get_map_veilles — pin veilleur_user_id en members[0]
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_map_veilles()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    json_agg(json_build_object(
      'placeId',   pv.place_id,
      'factionId', pv.faction_id,
      'isNeutral', pv.is_neutral,
      'plantedAt', pv.planted_at,
      'members', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
            'userId',         m.user_id,
            'displayName',    m.display_name,
            'avatarUrl',      m.avatar_url,
            'factionId',      m.faction_id,
            'factionColor',   m.faction_color,
            'factionPattern', m.faction_pattern
          ) ORDER BY
            (CASE WHEN m.user_id = pv.veilleur_user_id THEN 0 ELSE 1 END) ASC,
            m.score DESC NULLS LAST,
            m.user_id ASC)
          FROM (
            SELECT DISTINCT ON (uu.user_id)
                   uu.user_id,
                   COALESCE(u.display_name, u.first_name, 'Quelqu''un') AS display_name,
                   u.avatar_url,
                   u.faction_id,
                   f.color   AS faction_color,
                   f.pattern AS faction_pattern,
                   COALESCE((
                     SELECT SUM(pca.amount)
                       FROM public.place_court_action pca
                      WHERE pca.beneficiary_user_id = uu.user_id
                        AND pca.place_id = pv.place_id
                   ), 0) AS score
              FROM (
                SELECT pv.veilleur_user_id AS user_id WHERE pv.veilleur_user_id IS NOT NULL
                UNION
                SELECT em.user_id
                  FROM public.expedition_members em
                 WHERE em.expedition_id = pv.expedition_id
                UNION
                SELECT pca.beneficiary_user_id
                  FROM public.place_court_action pca
                 WHERE pca.place_id = pv.place_id
              ) uu
              JOIN public.users u    ON u.id = uu.user_id
              LEFT JOIN public.factions f ON f.id = u.faction_id
          ) m
        ),
        '[]'::jsonb
      )
    )),
    '[]'::json
  )
  FROM public.place_veille pv
  WHERE pv.veilleur_user_id IS NOT NULL OR pv.expedition_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_map_veilles() TO anon, authenticated, service_role;

COMMIT;
