-- WHY: la fiche d'une Compagnie privée montrait la liste de ses membres à tout le monde ; seul son
--      canal était caché. Uriel (07/10) : les membres d'une privée restent entre eux. Un non-membre
--      n'en voit plus que le nombre, dans la nouvelle clé `nbMembres` (la V2 l'affiche à la place
--      de la longueur de `membres`, qui reste une liste — vide pour lui).
-- BASE: définition live de `compagnie(text)` copiée entière le 07/10 ; seuls `membres` (filtré) et
--       `nbMembres` (ajouté) changent.
-- SCHEMA CHECKED (2026-10-07) : factions.privee, faction_members.faction_id — lus dans la définition
--   live ; `_role_compagnie` renvoie NULL hors de la Compagnie, 'membre' / 'officier' / 'chef' sinon.

CREATE OR REPLACE FUNCTION public.compagnie(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id),
  r AS (SELECT public._role_compagnie(p_id, moi.id) AS role FROM moi)
  SELECT json_build_object(
    'id', f.id, 'nom', f.title, 'devise', f.devise, 'mission', f.description, 'couleur', f.color,
    'avatar', f.image_url, 'privee', f.privee, 'fondeeLe', f.created_at,
    'roles', json_build_object('chefM', f.chef_m, 'chefF', f.chef_f, 'officierM', f.officier_m, 'officierF', f.officier_f),
    'monRole', r.role,
    'demandee', EXISTS (SELECT 1 FROM demandes_compagnie d WHERE d.faction_id = f.id AND d.user_id = moi.id),
    'nbMembres', (SELECT count(*) FROM faction_members m WHERE m.faction_id = f.id),
    'membres', CASE WHEN NOT f.privee OR r.role IS NOT NULL THEN COALESCE((SELECT json_agg(json_build_object('id', u.id,
        'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url, 'role', m.role,
        'genre', CASE WHEN u.title_gender = 'f' THEN 'f' ELSE 'm' END)
        ORDER BY CASE m.role WHEN 'chef' THEN 0 WHEN 'officier' THEN 1 ELSE 2 END, m.joined_at)
      FROM faction_members m JOIN users u ON u.id = m.user_id WHERE m.faction_id = f.id), '[]'::json) ELSE '[]'::json END,
    'lieux', COALESCE((SELECT json_agg(json_build_object('id', l.id, 'nom', l.title, 'par', l.par, 'quand', l.quand) ORDER BY l.quand DESC)
      FROM (SELECT DISTINCT ON (x.place_id) p.id, p.title, x.created_at AS quand,
              COALESCE(NULLIF(x.title, ''), (SELECT user_public_name(u.id, u.display_name, u.first_name)
                FROM expedition_members em JOIN users u ON u.id = em.user_id WHERE em.expedition_id = x.id LIMIT 1)) AS par
            FROM expeditions x JOIN places p ON p.id = x.place_id
            WHERE x.pour_compagnie = f.id AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
            ORDER BY x.place_id, x.created_at DESC) l), '[]'::json),
    'demandes', CASE WHEN r.role IN ('chef', 'officier') THEN COALESCE((SELECT json_agg(json_build_object(
        'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url,
        'mot', d.mot, 'quand', d.cree_le) ORDER BY d.cree_le)
      FROM demandes_compagnie d JOIN users u ON u.id = d.user_id WHERE d.faction_id = f.id), '[]'::json) ELSE '[]'::json END)
  FROM factions f, moi, r
  WHERE f.id = p_id AND NOT f.retired AND moi.id IS NOT NULL;
$function$;
