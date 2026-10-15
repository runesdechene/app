-- WHY: Hub V2, plan 2 (spec §11) : les Compagnies vues par l'équipe — la liste de toutes (retirées
--      comprises), la fiche avec ses membres (même privée), et la modification de son identité (nom,
--      couleur, devise, présentation) par un admin qui n'en est pas Chef : modifier_compagnie exige un
--      rôle dans la Compagnie. Mêmes règles de forme que _verifier_fiche (2-40, 80, 500, #RRGGBB).
--      Jamais l'identifiant (rename_faction est fermée, mig 512).
-- SCHEMA CHECKED (14/10/2026, information_schema live) : factions(id, title, color, devise,
--   description, image_url, privee, retired, created_at, updated_at) ; faction_members(faction_id,
--   user_id, role, joined_at) ; _is_admin(), _refus().

CREATE OR REPLACE FUNCTION public.hub_compagnies()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(c ORDER BY (c->>'retiree')::boolean, (c->>'membres')::int DESC, c->>'nom')
      FROM (
        SELECT jsonb_build_object(
          'id', f.id, 'nom', f.title, 'couleur', f.color, 'devise', f.devise,
          'privee', COALESCE(f.privee, false), 'retiree', COALESCE(f.retired, false), 'fondee', f.created_at,
          'membres', (SELECT count(*) FROM faction_members m WHERE m.faction_id = f.id),
          'chef', (SELECT COALESCE(u.display_name, u.first_name, 'Un Voyageur')
                     FROM faction_members m JOIN users u ON u.id = m.user_id
                    WHERE m.faction_id = f.id AND m.role = 'chef' LIMIT 1)) AS c
          FROM factions f) x), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_compagnies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_compagnies() TO authenticated;

CREATE OR REPLACE FUNCTION public.hub_compagnie(p_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  SELECT jsonb_build_object(
           'id', f.id, 'nom', f.title, 'couleur', f.color, 'devise', f.devise, 'mission', f.description,
           'avatar', f.image_url, 'privee', COALESCE(f.privee, false), 'retiree', COALESCE(f.retired, false),
           'fondee', f.created_at,
           'membres', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
                      'id', u.id, 'nom', COALESCE(u.display_name, u.first_name, 'Un Voyageur'),
                      'avatar', u.avatar_url, 'role', m.role, 'depuis', m.joined_at)
                    ORDER BY CASE m.role WHEN 'chef' THEN 0 WHEN 'officier' THEN 1 ELSE 2 END, m.joined_at)
               FROM faction_members m JOIN users u ON u.id = m.user_id
              WHERE m.faction_id = f.id), '[]'::jsonb))
    INTO v
    FROM factions f WHERE f.id = p_id;
  RETURN v;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_compagnie(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_compagnie(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.hub_modifier_compagnie(p_id text, p_nom text, p_devise text, p_mission text, p_couleur text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nom text := btrim(COALESCE(p_nom, ''));
  v_devise text := NULLIF(btrim(COALESCE(p_devise, '')), '');
  v_mission text := NULLIF(btrim(COALESCE(p_mission, '')), '');
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF NOT EXISTS (SELECT 1 FROM factions WHERE id = p_id) THEN PERFORM _refus('Compagnie introuvable', 'compagnie'); END IF;
  IF char_length(v_nom) NOT BETWEEN 2 AND 40 THEN PERFORM _refus('Le nom fait 2 à 40 signes', 'nom'); END IF;
  IF char_length(COALESCE(v_devise, '')) > 80 THEN PERFORM _refus('La devise fait 80 signes au plus', 'devise'); END IF;
  IF char_length(COALESCE(v_mission, '')) > 500 THEN PERFORM _refus('La présentation fait 500 signes au plus', 'mission'); END IF;
  IF p_couleur IS NULL OR p_couleur !~ '^#[0-9a-fA-F]{6}$' THEN PERFORM _refus('La couleur est un code #RRGGBB', 'couleur'); END IF;
  IF EXISTS (SELECT 1 FROM factions WHERE id <> p_id AND NOT COALESCE(retired, false) AND lower(title) = lower(v_nom)) THEN
    PERFORM _refus('Ce nom est déjà pris', 'nom');
  END IF;
  UPDATE factions SET title = v_nom, devise = v_devise, description = v_mission, color = p_couleur, updated_at = now()
   WHERE id = p_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_modifier_compagnie(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_modifier_compagnie(text, text, text, text, text) TO authenticated;
