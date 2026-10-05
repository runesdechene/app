-- WHY: Compagnies V2 (spec 2026-10-05-v2-compagnies-design) : publiques ou privées, une devise, deux rôles
--      nommés (masculin/féminin), un rôle par membre, des demandes, la revendication « pour » une
--      Compagnie ; les 5 Compagnies retirées restent retirées, les 8 actives sont reprises (un Chef chacune,
--      publiques, les deux premiers grades V1 deviennent les noms de rôle).
-- SCHEMA CHECKED (05/10/2026) : factions(id, title, color, description, image_url, created_by, retired,
--      created_at…, toutes les colonnes NOT NULL ont un défaut) ; faction_members(faction_id, user_id,
--      joined_at, is_founder…) ; faction_grade_labels(faction_id, rank — 1 = le plus haut —, label_m,
--      label_f) ; expeditions(id, place_id, faction_id, title) ; place_veille(place_id, expedition_id) ;
--      user_fragments(user_id, fragment_id) ; title_fragments(id, visible) ; users.title_gender ('m'|'f').

ALTER TABLE public.factions
  ADD COLUMN privee boolean NOT NULL DEFAULT false,
  ADD COLUMN devise text,
  ADD COLUMN chef_m text NOT NULL DEFAULT 'Chef',
  ADD COLUMN chef_f text NOT NULL DEFAULT 'Cheffe',
  ADD COLUMN officier_m text NOT NULL DEFAULT 'Officier',
  ADD COLUMN officier_f text NOT NULL DEFAULT 'Officière';
ALTER TABLE public.faction_members
  ADD COLUMN role text NOT NULL DEFAULT 'membre' CHECK (role IN ('chef', 'officier', 'membre'));
CREATE UNIQUE INDEX factions_nom_unique ON public.factions (lower(title)) WHERE NOT retired;

CREATE TABLE public.demandes_compagnie (
  faction_id varchar NOT NULL REFERENCES public.factions(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mot text,
  cree_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (faction_id, user_id)
);
ALTER TABLE public.demandes_compagnie ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.demandes_compagnie FROM PUBLIC, anon, authenticated;

ALTER TABLE public.expeditions ADD COLUMN pour_compagnie varchar REFERENCES public.factions(id) ON DELETE SET NULL;
ALTER TABLE public.place_veille ADD COLUMN pour_compagnie varchar REFERENCES public.factions(id) ON DELETE SET NULL;

-- Porteur : au moins un Fragment visible (la règle de porteurVerifie, migs 362 et 406).
CREATE FUNCTION public._est_porteur(p_user text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $function$
  SELECT EXISTS (SELECT 1 FROM user_fragments f JOIN title_fragments tf ON tf.id = f.fragment_id AND tf.visible
                 WHERE f.user_id = p_user);
$function$;
REVOKE ALL ON FUNCTION public._est_porteur(text) FROM PUBLIC, anon, authenticated;

-- Le rôle d'une personne dans une Compagnie vivante ; NULL : pas membre.
CREATE FUNCTION public._role_compagnie(p_id text, p_user text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $function$
  SELECT m.role FROM faction_members m JOIN factions f ON f.id = m.faction_id
  WHERE m.faction_id = p_id AND m.user_id = p_user AND NOT f.retired;
$function$;
REVOKE ALL ON FUNCTION public._role_compagnie(text, text) FROM PUBLIC, anon, authenticated;

-- La reprise : un Chef par Compagnie active — le fondateur ; sinon le créateur s'il est membre ; sinon le
-- plus ancien.
UPDATE public.faction_members m SET role = 'chef'
FROM (
  SELECT DISTINCT ON (fm.faction_id) fm.faction_id, fm.user_id
  FROM faction_members fm JOIN factions f ON f.id = fm.faction_id
  WHERE NOT f.retired
  ORDER BY fm.faction_id, fm.is_founder DESC NULLS LAST, (fm.user_id = f.created_by) DESC NULLS LAST, fm.joined_at
) c
WHERE m.faction_id = c.faction_id AND m.user_id = c.user_id;

-- Les noms de rôle : le grade V1 le plus haut (rank 1) pour le Chef, le suivant pour les Officiers.
UPDATE public.factions f SET
  chef_m = COALESCE(NULLIF(btrim(g1.label_m), ''), f.chef_m),
  chef_f = COALESCE(NULLIF(btrim(g1.label_f), ''), NULLIF(btrim(g1.label_m), ''), f.chef_f),
  officier_m = COALESCE(NULLIF(btrim(g2.label_m), ''), f.officier_m),
  officier_f = COALESCE(NULLIF(btrim(g2.label_f), ''), NULLIF(btrim(g2.label_m), ''), f.officier_f)
FROM (SELECT DISTINCT ON (faction_id) * FROM faction_grade_labels ORDER BY faction_id, rank) g1
LEFT JOIN LATERAL (SELECT * FROM faction_grade_labels g WHERE g.faction_id = g1.faction_id AND g.rank > g1.rank
                   ORDER BY g.rank LIMIT 1) g2 ON true
WHERE g1.faction_id = f.id AND NOT f.retired;
