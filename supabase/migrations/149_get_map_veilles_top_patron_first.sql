-- 149_get_map_veilles_top_patron_first.sql
-- WHY : la pilule sous chaque marker (composant VeilleurNamePills) prend
-- members[0] de get_map_veilles. Avant, l'ordre était indéfini (souvent
-- celui qui a planté l'étendard) → cas Chapelle de la Madeleine où "Le
-- Marcheur" (1 attack) s'affichait alors que "Tugdual" (3 defense) avait
-- contribué 3x plus.
--
-- Fix en 2 temps (mig fusionnée) :
--   1. Élargir la liste members aux user_ids qui ont investi en defense
--      sur ce place_id même s'ils ne sont pas dans expedition_members
--      (un mécène peut soutenir une veille sans rejoindre l'expé).
--   2. Trier par investissement total en defense DESC, puis user_id ASC.
--      → members[0] = principal mécène (top défenseur).
--
-- Cohérent avec la sémantique Mécénat de V0.7 phase 5 : la signature
-- visible sur la carte est celle qui a le plus tenu le lieu, pas celui
-- qui l'a découvert/planté.

CREATE OR REPLACE FUNCTION public.get_map_veilles()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    json_agg(json_build_object(
      'placeId', pv.place_id,
      'factionId', pv.faction_id,
      'isNeutral', pv.is_neutral,
      'plantedAt', pv.planted_at,
      'members', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
            'userId', m.user_id,
            'displayName', m.display_name,
            'avatarUrl', m.avatar_url,
            'factionId', m.faction_id,
            'factionColor', m.faction_color,
            'factionPattern', m.faction_pattern
          ) ORDER BY m.defense_total DESC NULLS LAST, m.user_id ASC)
          FROM (
            -- Union dédoublonnée : tous les user_ids qui sont soit membres
            -- de l'expé, soit patrons defense du lieu.
            SELECT DISTINCT ON (uu.user_id)
                   uu.user_id,
                   COALESCE(u.display_name, u.first_name, 'Quelqu''un') AS display_name,
                   u.avatar_url,
                   uu.faction_id,
                   f.color   AS faction_color,
                   f.pattern AS faction_pattern,
                   COALESCE((
                     SELECT SUM(pca.amount)
                       FROM public.place_court_action pca
                      WHERE pca.user_id = uu.user_id
                        AND pca.place_id = pv.place_id
                        AND pca.side = 'defense'
                   ), 0) AS defense_total
              FROM (
                SELECT em.user_id, em.faction_id
                  FROM public.expedition_members em
                 WHERE em.expedition_id = pv.expedition_id
                UNION
                SELECT pca.user_id, u2.faction_id
                  FROM public.place_court_action pca
                  JOIN public.users u2 ON u2.id = pca.user_id
                 WHERE pca.place_id = pv.place_id
                   AND pca.side = 'defense'
              ) uu
              JOIN public.users u    ON u.id = uu.user_id
              LEFT JOIN public.factions f ON f.id = uu.faction_id
          ) m
        ),
        '[]'::jsonb
      )
    )),
    '[]'::json
  )
  FROM public.place_veille pv;
$$;
