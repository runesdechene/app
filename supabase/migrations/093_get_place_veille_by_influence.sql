-- 093_get_place_veille_by_influence.sql
-- WHY : VeilleFrame doit cacher le bouton "Planter mon étendard" si le user
-- est déjà membre de l'expé veilleuse plein-veilleur (= replant interdit
-- depuis mig 092). Pour ça il a besoin de byInfluence en plus des members
-- déjà retournés. Verbatim mig 018 + ajout du champ byInfluence.

BEGIN;

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
    'byInfluence', COALESCE(v_row.by_influence, false),
    'members', COALESCE(v_members, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_veille(text) TO authenticated, anon, service_role;

COMMIT;
