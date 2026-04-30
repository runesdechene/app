-- 019_v07_map_veilles_with_members.sql
-- WHY : étendre get_map_veilles pour retourner aussi les membres de chaque veille
-- (avatar, factionColor, factionPattern). Permet à VeilleMarkers (composant carte
-- React) de rendre la pile d'avatars en haut-droite du territoire sans appel
-- supplémentaire par lieu.
-- Spec : docs/superpowers/specs/2026-04-30-v07-veille-plantage.md

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
            'factionPattern', f.image_url
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
