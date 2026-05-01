-- 018_v07_query_rpcs.sql
-- WHY : RPCs de lecture pour la veille (panel place + carte + opt-in expedition).
-- Spec : docs/superpowers/specs/2026-04-30-v07-veille-plantage.md

-- ============================================================
-- get_nearby_planters : autres users qui ont fait visit_gps/revisit_gps
-- sur le même lieu dans les 5 dernières minutes (candidats opt-in expedition)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_nearby_planters(
  p_user_id  text,
  p_place_id text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('candidates', '[]'::json);
  END IF;

  RETURN json_build_object(
    'candidates',
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
          'userId', u.id,
          'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
          'avatarUrl', u.avatar_url,
          'factionId', u.faction_id,
          'factionColor', f.color
        ))
        FROM (
          SELECT DISTINCT actor_id
          FROM public.activity_log
          WHERE place_id = p_place_id
            AND type IN ('visit_gps', 'revisit_gps')
            AND actor_id IS NOT NULL
            AND actor_id <> p_user_id
            AND created_at > now() - interval '5 minutes'
        ) recent
        JOIN public.users u ON u.id = recent.actor_id
        LEFT JOIN public.factions f ON f.id = u.faction_id
        WHERE u.faction_id IS NOT NULL
      ),
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_planters(text, text) TO authenticated, service_role;

-- ============================================================
-- get_place_veille : état actuel pour le panel (modèle unifié)
-- members toujours non-vide quand vacant=false (1 à N entrées)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_place_veille(p_place_id text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
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
    'plantedAt', v_row.planted_at,
    'members', COALESCE(v_members, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_veille(text) TO authenticated, anon, service_role;

-- ============================================================
-- get_map_veilles : minimal pour coloriage carte
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_map_veilles() RETURNS json
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(
    json_agg(json_build_object(
      'placeId', place_id,
      'factionId', faction_id,
      'isNeutral', is_neutral
    )),
    '[]'::json
  )
  FROM public.place_veille;
$$;

GRANT EXECUTE ON FUNCTION public.get_map_veilles() TO authenticated, anon, service_role;
