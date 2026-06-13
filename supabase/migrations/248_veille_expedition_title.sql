-- 248_veille_expedition_title.sql
-- WHY : afficher les veilles d'EXPÉDITION (2+ membres) correctement (V0.9.56).
-- Les RPCs renvoyaient les membres mais PAS le titre d'expédition → la carte et la
-- fiche montraient le 1er membre (le lead) au lieu du nom de l'expédition.
-- On expose 'expeditionTitle' dans get_map_veilles (carte) et get_place_veille (fiche).
-- Discipline B1 : copie verbatim du live + 1 champ ajouté à chaque.

-- ── get_map_veilles : + expeditionTitle ──
CREATE OR REPLACE FUNCTION public.get_map_veilles()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT COALESCE(
    json_agg(json_build_object(
      'placeId',   pv.place_id,
      'factionId', pv.faction_id,
      'isNeutral', pv.is_neutral,
      'plantedAt', pv.planted_at,
      'expeditionTitle', (SELECT e.title FROM public.expeditions e WHERE e.id = pv.expedition_id),
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
$function$;

-- ── get_place_veille : + expeditionTitle ──
CREATE OR REPLACE FUNCTION public.get_place_veille(p_place_id text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_row record;
  v_members jsonb;
BEGIN
  SELECT * INTO v_row FROM public.place_veille WHERE place_id = p_place_id;
  IF v_row IS NULL THEN
    RETURN json_build_object('vacant', true);
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'userId', em.user_id,
    'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
    'avatarUrl', u.avatar_url,
    'factionId', em.faction_id
  ))
  INTO v_members
  FROM public.expedition_members em
  JOIN public.users u ON u.id = em.user_id
  WHERE em.expedition_id = v_row.expedition_id;

  RETURN json_build_object(
    'vacant', false,
    'isNeutral', v_row.is_neutral,
    'factionId', v_row.faction_id,
    'expeditionId', v_row.expedition_id,
    'expeditionTitle', (SELECT e.title FROM public.expeditions e WHERE e.id = v_row.expedition_id),
    'plantedAt', v_row.planted_at,
    'byInfluence', COALESCE(v_row.by_influence, false),
    'members', COALESCE(v_members, '[]'::jsonb)
  );
END;
$function$;
