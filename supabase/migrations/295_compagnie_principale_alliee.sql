-- 295_compagnie_principale_alliee.sql
-- WHY : modèle « Compagnie PRINCIPALE + ALLIÉE » (décidé 24/06 ; terme « officielle »
-- abandonné). Un joueur a 1 Compagnie principale (= users.faction_id : points, territoires,
-- Chef, grades) et au plus 1 Alliée (2e adhésion, social/chat, 0 point, exclue Chef/classement).
--   • set_primary_faction : bascule DÉLIBÉRÉE de la principale (cooldown réutilisé +
--     repaint contrôlé des territoires du joueur). Remplace le toggle casual set_active_faction
--     (laissé vivant ici pour ne pas casser le front en prod ; cleanup une fois le front déployé).
--   • _faction_chef : l'allié ne peut JAMAIS être Chef (même avec des couronnes).
--   • get_faction_detail : flag isAlly par membre (badge « Allié » côté UI).
-- ADDITIF (1 RPC neuve + 2 redéfinitions backward-compatibles).

-- ── Bascule délibérée de la Compagnie principale ──────────────────────────────
-- Doit être membre de la cible. Cooldown réutilise faction_change_cooldown_days (30j)
-- + users.faction_changed_at. La pose de users.faction_id déclenche :
--   • _track_banner_history (288) → épingle les points passés à l'ancienne principale ;
--   • _adopt_orphan_veilles_on_faction_gain (294) → adopte les veilles grises.
-- Le repaint TOTAL (territoires déjà colorés) a été retiré du toggle en 289 : on le refait
-- ici explicitement, borné à ce changement délibéré (spec point 4).
CREATE OR REPLACE FUNCTION public.set_primary_faction(p_user_id text, p_faction_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_old text; v_changed_at timestamptz; v_cd int; v_rem int;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error','unauthorized'); END IF;
  IF NOT EXISTS (SELECT 1 FROM faction_members WHERE faction_id = p_faction_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error','not_member'); END IF;

  SELECT faction_id, faction_changed_at INTO v_old, v_changed_at FROM users WHERE id = p_user_id;
  IF v_old = p_faction_id THEN
    RETURN json_build_object('success', true, 'activeFactionId', p_faction_id); END IF;

  v_cd := COALESCE((SELECT value::int FROM app_settings WHERE key = 'faction_change_cooldown_days'), 30);
  IF v_old IS NOT NULL AND v_changed_at IS NOT NULL
     AND (now() - v_changed_at) < (v_cd || ' days')::interval THEN
    v_rem := v_cd - EXTRACT(DAY FROM (now() - v_changed_at))::int;
    RETURN json_build_object('error','cooldown','daysRemaining', GREATEST(1, v_rem));
  END IF;

  UPDATE users SET faction_id = p_faction_id, faction_changed_at = now(), updated_at = now()
  WHERE id = p_user_id;

  -- Repaint contrôlé : tous les territoires non-neutres du joueur suivent la nouvelle principale.
  UPDATE place_veille SET faction_id = p_faction_id
  WHERE veilleur_user_id = p_user_id AND NOT is_neutral;

  RETURN json_build_object('success', true, 'activeFactionId', p_faction_id);
END;$$;
GRANT EXECUTE ON FUNCTION public.set_primary_faction(text, text) TO authenticated, service_role;

-- ── Chef = membre PRINCIPAL le mieux classé (l'allié exclu) ───────────────────
-- (identique à la mig 286 + filtre u.faction_id = p_faction_id → l'allié n'est plus candidat,
--  même avec des couronnes. La Coupe d'un allié est déjà 0 via banner-history.)
CREATE OR REPLACE FUNCTION public._faction_chef(p_faction_id text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_from timestamptz; v_to timestamptz; v_chef text;
BEGIN
  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;
  SELECT m.user_id INTO v_chef
  FROM faction_members m JOIN users u ON u.id = m.user_id
  WHERE m.faction_id = p_faction_id
    AND u.faction_id = p_faction_id          -- principale uniquement : l'allié ne peut pas régner
  ORDER BY (
    public._user_coupe_score(m.user_id, v_from, v_to)
    + m.crowns_invested + m.crowns_conquered
  ) DESC, m.joined_at ASC
  LIMIT 1;
  RETURN v_chef;
END;$$;

-- ── get_faction_detail : + isAlly par membre (= cette Compagnie n'est pas sa principale) ──
-- (corps réel prod = mig 291 + locked via _faction_is_locked ; seul ajout : is_ally / isAlly.)
CREATE OR REPLACE FUNCTION public.get_faction_detail(p_faction_id text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_from timestamptz; v_to timestamptz; v_members json; v_total int; v_f public.factions%ROWTYPE;
  v_visit int := _barem('coupe.visit_gps', 3);
  v_add   int := _barem('coupe.add_place', 7);
  v_plant int := _barem('coupe.plant_flag', 2);
  v_photo int := _barem('coupe.photo', 1);
  v_e_ve  int := _barem('coupe.enigma_very_easy', 1);
  v_e_e   int := _barem('coupe.enigma_easy', 1);
  v_e_m   int := _barem('coupe.enigma_medium', 1);
  v_e_h   int := _barem('coupe.enigma_hard', 1);
  v_mc int;
BEGIN
  SELECT * INTO v_f FROM factions WHERE id = p_faction_id;
  IF v_f.id IS NULL THEN RETURN json_build_object('error','not_found'); END IF;
  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;

  WITH iv AS (
    SELECT user_id, started_at, COALESCE(ended_at, now()) AS ended_at
    FROM faction_banner_history WHERE faction_id = p_faction_id
  ),
  mem AS (
    SELECT
      m.user_id,
      COALESCE(u.display_name, u.first_name, 'Veilleur') AS name,
      u.avatar_url, m.joined_at, m.is_founder, m.crowns_invested, m.crowns_conquered,
      (u.faction_id IS DISTINCT FROM p_faction_id) AS is_ally,
      (SELECT count(DISTINCT pe.place_id) FROM place_explorers pe
        WHERE pe.user_id = m.user_id AND pe.visited_at >= v_from AND pe.visited_at < v_to
          AND EXISTS (SELECT 1 FROM iv WHERE iv.user_id = m.user_id AND pe.visited_at >= iv.started_at AND pe.visited_at < iv.ended_at))::int AS n_vis,
      (SELECT count(*) FROM places p
        WHERE p.author_id = m.user_id AND p.created_at >= v_from AND p.created_at < v_to
          AND EXISTS (SELECT 1 FROM iv WHERE iv.user_id = m.user_id AND p.created_at >= iv.started_at AND p.created_at < iv.ended_at))::int AS n_add,
      (SELECT count(*) FROM veille_history vh
        WHERE vh.user_id = m.user_id AND vh.planted_at >= v_from AND vh.planted_at < v_to
          AND EXISTS (SELECT 1 FROM iv WHERE iv.user_id = m.user_id AND vh.planted_at >= iv.started_at AND vh.planted_at < iv.ended_at))::int AS n_plant,
      (SELECT count(DISTINCT pc.place_id) FROM place_contributions pc
        WHERE pc.user_id = m.user_id AND pc.type = 'photo' AND pc.created_at >= v_from AND pc.created_at < v_to
          AND EXISTS (SELECT 1 FROM iv WHERE iv.user_id = m.user_id AND pc.created_at >= iv.started_at AND pc.created_at < iv.ended_at))::int AS n_photo,
      (SELECT COALESCE(
          count(*) FILTER (WHERE e.difficulty = 'very_easy') * v_e_ve
        + count(*) FILTER (WHERE e.difficulty = 'easy')      * v_e_e
        + count(*) FILTER (WHERE e.difficulty = 'medium')    * v_e_m
        + count(*) FILTER (WHERE e.difficulty = 'hard')      * v_e_h, 0)
        FROM enigma_responses er JOIN enigmas e ON e.id = er.enigma_id
        WHERE er.user_id = m.user_id AND er.correct = TRUE
          AND er.responded_at >= v_from AND er.responded_at < v_to
          AND EXISTS (SELECT 1 FROM iv WHERE iv.user_id = m.user_id AND er.responded_at >= iv.started_at AND er.responded_at < iv.ended_at))::int AS enig_pts
    FROM faction_members m JOIN users u ON u.id = m.user_id
    WHERE m.faction_id = p_faction_id
  ),
  mem_pts AS (
    SELECT *, n_vis * v_visit AS vis_pts, n_add * v_add AS add_pts,
      n_plant * v_plant AS plant_pts, n_photo * v_photo AS photo_pts
    FROM mem
  )
  SELECT
    COALESCE(json_agg(json_build_object(
      'userId', user_id, 'name', name, 'avatarUrl', avatar_url,
      'joinedAt', joined_at, 'isFounder', is_founder, 'isAlly', is_ally,
      'crownsInvested', crowns_invested, 'crownsConquered', crowns_conquered,
      'coupe', (vis_pts + add_pts + plant_pts + photo_pts + enig_pts),
      'breakdown', jsonb_strip_nulls(jsonb_build_object(
        'enigmes', NULLIF(enig_pts, 0), 'visites', NULLIF(vis_pts, 0),
        'ajouts',  NULLIF(add_pts, 0), 'veilles', NULLIF(plant_pts, 0), 'photos', NULLIF(photo_pts, 0)
      ))
    ) ORDER BY is_ally ASC, (vis_pts + add_pts + plant_pts + photo_pts + enig_pts + crowns_invested + crowns_conquered) DESC, joined_at ASC), '[]'::json),
    COALESCE(sum(vis_pts + add_pts + plant_pts + photo_pts + enig_pts), 0)::int
  INTO v_members, v_total
  FROM mem_pts;

  v_mc := (SELECT count(*) FROM faction_members WHERE faction_id = p_faction_id);

  RETURN json_build_object(
    'id', v_f.id, 'name', v_f.title, 'color', v_f.color, 'imageUrl', v_f.image_url,
    'description', v_f.description, 'tags', to_json(v_f.tags),
    'emblemIcon', v_f.emblem_icon, 'emblemMono', v_f.emblem_mono, 'publicSlug', v_f.public_slug,
    'createdBy', v_f.created_by, 'isOfficial', (v_f.created_by IS NULL),
    'memberCount', v_mc,
    'locked', public._faction_is_locked(p_faction_id),
    'totalCoupe', v_total,
    'totalCrowns', (SELECT COALESCE(sum(crowns_invested + crowns_conquered), 0)
                    FROM faction_members WHERE faction_id = p_faction_id),
    'members', v_members
  );
END;$$;
