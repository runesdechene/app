-- WHY: Missives, lot 1, tâche 7 : l'écran « Les listes » du Hub (maquette 713:2091).
--      1. hub_listes gagne, pour chaque liste, son dernier envoi (objet et date) : la colonne « Dernier envoi ».
--         Rien d'autre ne change. Définition live du 23/10 (mig 539), recopiée entière.
--      2. Les ambassadeurs et égéries, qu'Uriel choisit lui-même : la liste (nom, portrait, rôle, Fragments),
--         ajouter ou changer le rôle, retirer. Réservé à l'équipe.
-- SCHEMA CHECKED (23/10/2026, live) : hub_listes() lu par pg_get_functiondef ; ambassadeurs(user_id varchar,
--   role, ajoute_le) et missives(liste, objet, statut, envoyee_le) créées par la 539 ; users.display_name,
--   first_name, avatar_url ; user_fragments(user_id) ; _is_admin(), _refus(text, text).

CREATE OR REPLACE FUNCTION public.hub_listes()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resultat jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;

  SELECT jsonb_agg(jsonb_build_object('cle', l.cle, 'personnes', c.personnes, 'avec_accord', c.avec_accord,
                                      'dernier', d.dernier)
                   ORDER BY l.ordre)
    INTO v_resultat
    FROM unnest(ARRAY['tous', 'prospects', 'porteurs', 'meilleurs', 'ambassadeurs']) WITH ORDINALITY AS l(cle, ordre)
    CROSS JOIN LATERAL (
      SELECT count(*) AS personnes, count(*) FILTER (WHERE u.accord_nouvelles) AS avec_accord
        FROM _liste_membres(l.cle) m JOIN users u ON u.id = m.user_id
    ) c
    LEFT JOIN LATERAL (
      SELECT jsonb_build_object('objet', mi.objet, 'le', mi.envoyee_le) AS dernier
        FROM missives mi
       WHERE mi.liste = l.cle AND mi.statut = 'envoyee'
       ORDER BY mi.envoyee_le DESC
       LIMIT 1
    ) d ON true;

  RETURN v_resultat;
END;
$function$;

CREATE FUNCTION public.hub_ambassadeurs()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resultat jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', u.id,
           'nom', COALESCE(u.display_name, u.first_name, 'Un Voyageur'),
           'avatar', u.avatar_url,
           'role', a.role,
           'fragments', (SELECT count(*) FROM user_fragments f WHERE f.user_id = u.id)
         ) ORDER BY a.ajoute_le), '[]'::jsonb)
    INTO v_resultat
    FROM ambassadeurs a JOIN users u ON u.id = a.user_id;

  RETURN v_resultat;
END;
$function$;

-- Ajoute la personne, ou change son rôle si elle y est déjà.
CREATE FUNCTION public.hub_ambassadeur(p_user varchar, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  INSERT INTO ambassadeurs (user_id, role) VALUES (p_user, p_role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$function$;

CREATE FUNCTION public.hub_retirer_ambassadeur(p_user varchar)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  DELETE FROM ambassadeurs WHERE user_id = p_user;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_ambassadeurs(), public.hub_ambassadeur(varchar, text),
  public.hub_retirer_ambassadeur(varchar) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_ambassadeurs(), public.hub_ambassadeur(varchar, text),
  public.hub_retirer_ambassadeur(varchar) TO authenticated;
