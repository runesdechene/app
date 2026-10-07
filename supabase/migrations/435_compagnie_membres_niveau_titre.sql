-- WHY: la fiche d'une Compagnie montre désormais ses membres en liste (maquette 454:272, Uriel 07/10) :
--      chacun avec son niveau et le premier titre qu'il porte, les plus récents d'abord.
-- BASE: définition live de `compagnie(text)` (migration 434, vérifiée en prod le 07/10) copiée entière ;
--       seuls changent, dans chaque membre, `niveau` et `titre` (ajoutés) et l'ordre (`joined_at DESC`).
-- SCHEMA CHECKED (2026-10-07) : users.xp_total, users.displayed_title_ids_v3, titles.id / name / type —
--   lus dans `get_profil_explorateur` (migration 432), qui calcule niveau et titres portés de la même façon.

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
        'genre', CASE WHEN u.title_gender = 'f' THEN 'f' ELSE 'm' END,
        'niveau', public._level_from_xp(COALESCE(u.xp_total, 0)),
        'titre', (SELECT t.name
                    FROM unnest(u.displayed_title_ids_v3) WITH ORDINALITY AS x(tid, ord)
                    JOIN public.titles t ON t.id = x.tid AND t.type = 'general'
                   ORDER BY x.ord
                   LIMIT 1))
        ORDER BY CASE m.role WHEN 'chef' THEN 0 WHEN 'officier' THEN 1 ELSE 2 END, m.joined_at DESC)
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
