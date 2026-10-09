-- WHY: la page « Les Compagnies » se range par activité, plus par nombre de membres (Uriel, 07/10) :
--      les lieux revendiqués pour chacune, sans rang ni podium — un annuaire vivant, pas la Coupe
--      abandonnée (spec V2 §1, purification).
--   1. _lieux_compagnie : le nombre de lieux revendiqués pour une Compagnie, compté comme la liste
--      « Leurs lieux » de `compagnie()` (un lieu une fois, ni masqué ni privé).
--   2. _carte_compagnie : + `lieux`.
--   3. compagnies() : les miennes et les autres triées par lieux, puis membres, puis nom.
-- BASE: `_carte_compagnie` et `compagnies` ne sont définies que par la migration 421 ; copiées
--       entières, seul le delta ci-dessus change.
-- SCHEMA CHECKED (2026-10-07) : expeditions.place_id / pour_compagnie, places.masked / private —
--   lus dans `compagnie()` (migration 438).

CREATE FUNCTION public._lieux_compagnie(p_id text) RETURNS integer LANGUAGE sql STABLE
SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT count(DISTINCT x.place_id)::int
  FROM expeditions x JOIN places p ON p.id = x.place_id
  WHERE x.pour_compagnie = p_id AND p.masked IS NOT TRUE AND p.private IS NOT TRUE;
$function$;
REVOKE ALL ON FUNCTION public._lieux_compagnie(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._carte_compagnie(p_id text, p_moi text) RETURNS json LANGUAGE sql STABLE
SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT json_build_object('id', f.id, 'nom', f.title, 'devise', f.devise, 'couleur', f.color,
    'avatar', f.image_url, 'privee', f.privee,
    'membres', (SELECT count(*) FROM faction_members m WHERE m.faction_id = f.id),
    'lieux', public._lieux_compagnie(f.id), -- 439
    'role', public._role_compagnie(f.id, p_moi),
    'demandee', EXISTS (SELECT 1 FROM demandes_compagnie d WHERE d.faction_id = f.id AND d.user_id = p_moi))
  FROM factions f WHERE f.id = p_id;
$function$;

CREATE OR REPLACE FUNCTION public.compagnies() RETURNS json LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id)
  SELECT json_build_object(
    'porteur', public._est_porteur(moi.id),
    'miennes', COALESCE((SELECT json_agg(public._carte_compagnie(f.id, moi.id)
                                         ORDER BY public._lieux_compagnie(f.id) DESC,
                                                  (SELECT count(*) FROM faction_members m WHERE m.faction_id = f.id) DESC, f.title)
                         FROM factions f WHERE NOT f.retired AND public._role_compagnie(f.id, moi.id) IS NOT NULL), '[]'::json),
    'autres', COALESCE((SELECT json_agg(public._carte_compagnie(f.id, moi.id)
                                        ORDER BY public._lieux_compagnie(f.id) DESC,
                                                 (SELECT count(*) FROM faction_members m WHERE m.faction_id = f.id) DESC, f.title)
                        FROM factions f WHERE NOT f.retired AND public._role_compagnie(f.id, moi.id) IS NULL), '[]'::json))
  FROM moi WHERE moi.id IS NOT NULL;
$function$;
