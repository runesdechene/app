-- 020_v07_map_veilles_use_svg_pattern.sql
-- WHY : la mig 019 retournait f.image_url (bannière .webp) comme factionPattern.
-- Erreur — pour les markers carte on veut f.pattern (icône SVG) qui se rend en
-- blanc sur fond couleur faction. La bannière .webp a été conservée pour les
-- usages "fichier d'image plein cadre" (ex : InfluenceFrame v0.5).

CREATE OR REPLACE FUNCTION public.get_map_veilles() RETURNS json
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(
    json_agg(json_build_object(
      'placeId', pv.place_id,
      'factionId', pv.faction_id,
      'isNeutral', pv.is_neutral,
      'plantedAt', pv.planted_at,
      'members', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
            'userId', em.user_id,
            'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
            'avatarUrl', u.avatar_url,
            'factionId', em.faction_id,
            'factionColor', f.color,
            'factionPattern', f.pattern
          ))
          FROM public.expedition_members em
          JOIN public.users u ON u.id = em.user_id
          LEFT JOIN public.factions f ON f.id = em.faction_id
          WHERE em.expedition_id = pv.expedition_id),
        '[]'::jsonb
      )
    )),
    '[]'::json
  )
  FROM public.place_veille pv;
$$;

GRANT EXECUTE ON FUNCTION public.get_map_veilles() TO authenticated, anon, service_role;
