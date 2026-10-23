-- WHY: Missives, lot 2, tâche 4 : le Hub lit et règle les suites (écran Automatisations).
--      1. hub_suites : chaque suite, ses chiffres (en cours, finis, arrêtés) et ses e-mails jour par jour.
--      2. hub_activer_suite, hub_ajouter_etape, hub_regler_etape, hub_retirer_etape. Une étape déjà partie
--         ne s'efface pas (l'historique de ses envois resterait orphelin) : on la change plutôt.
--      3. hub_enregistrer_missive accepte une étape (statut 'automatique') ; hub_envois ne montre que les
--         Missives écrites à la main : les étapes ont leurs chiffres dans Automatisations.
--      Définitions live du 23/10 recopiées entières (hub_enregistrer_missive : 547 ; hub_envois : 544).
-- SCHEMA CHECKED (23/10/2026, live) : md5 de pg_get_functiondef identiques aux fichiers 547 et 544 ;
--   tables de la 548 ; _is_admin(), _refus(text, text).

CREATE FUNCTION public.hub_suites()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resultat jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'cle', s.cle,
           'nom', s.nom,
           'active', s.active,
           'exige_accord', s.exige_accord,
           'en_cours', (SELECT count(*) FROM suite_inscriptions i
                         WHERE i.suite = s.cle AND i.arretee_le IS NULL AND i.prochaine_le IS NOT NULL),
           'finis', (SELECT count(*) FROM suite_inscriptions i
                      WHERE i.suite = s.cle AND i.arretee_le IS NULL AND i.prochaine_le IS NULL),
           'arretes', (SELECT count(*) FROM suite_inscriptions i WHERE i.suite = s.cle AND i.arretee_le IS NOT NULL),
           'etapes', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'id', se.id,
                        'jour', se.jour,
                        'missive_id', se.missive_id,
                        'objet', mi.objet,
                        'envoyes', (SELECT count(*) FROM missive_envois e
                                     WHERE e.missive_id = se.missive_id AND e.statut IN ('envoye', 'rebond', 'plainte')),
                        'ouverts', (SELECT count(e.ouvert_le) FROM missive_envois e WHERE e.missive_id = se.missive_id),
                        'clics', (SELECT count(e.clique_le) FROM missive_envois e WHERE e.missive_id = se.missive_id)
                      ) ORDER BY se.jour), '[]'::jsonb)
                        FROM suite_etapes se JOIN missives mi ON mi.id = se.missive_id
                       WHERE se.suite = s.cle)
         ) ORDER BY array_position(ARRAY['bienvenue', 'stand', 'apres_achat'], s.cle))
    INTO v_resultat
    FROM suites s;

  RETURN v_resultat;
END;
$function$;

CREATE FUNCTION public.hub_activer_suite(p_cle text, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_active AND NOT EXISTS (SELECT 1 FROM suite_etapes WHERE suite = p_cle) THEN
    PERFORM _refus('Écris d’abord son premier e-mail', 'etapes');
  END IF;
  UPDATE suites SET active = p_active WHERE cle = p_cle;
END;
$function$;

-- p : la Missive neuve, comme hub_enregistrer_missive la reçoit (le Hub part de brouillonVide).
CREATE FUNCTION public.hub_ajouter_etape(p_cle text, p_jour integer, p jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id bigint;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF EXISTS (SELECT 1 FROM suite_etapes WHERE suite = p_cle AND jour = p_jour) THEN
    PERFORM _refus('Ce jour a déjà son e-mail', 'jour');
  END IF;
  v_id := hub_enregistrer_missive(p - 'id' - 'liste');
  UPDATE missives SET statut = 'automatique' WHERE id = v_id;
  INSERT INTO suite_etapes (suite, jour, missive_id) VALUES (p_cle, p_jour, v_id);
  RETURN v_id;
END;
$function$;

CREATE FUNCTION public.hub_regler_etape(p_id bigint, p_jour integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF EXISTS (SELECT 1 FROM suite_etapes autre JOIN suite_etapes moi ON moi.suite = autre.suite
              WHERE moi.id = p_id AND autre.id <> p_id AND autre.jour = p_jour) THEN
    PERFORM _refus('Ce jour a déjà son e-mail', 'jour');
  END IF;
  UPDATE suite_etapes SET jour = p_jour WHERE id = p_id;
END;
$function$;

CREATE FUNCTION public.hub_retirer_etape(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_missive bigint;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  SELECT missive_id INTO v_missive FROM suite_etapes WHERE id = p_id;
  IF EXISTS (SELECT 1 FROM missive_envois WHERE missive_id = v_missive AND statut <> 'a_envoyer') THEN
    PERFORM _refus('Cet e-mail est déjà parti, change-le plutôt', 'envois');
  END IF;
  DELETE FROM missives WHERE id = v_missive;  -- l'étape et ses envois à faire suivent (ON DELETE CASCADE)
END;
$function$;

CREATE OR REPLACE FUNCTION public.hub_enregistrer_missive(p jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id bigint := (p->>'id')::bigint;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;

  IF v_id IS NULL THEN
    INSERT INTO missives (modele, couleurs, contenu, contenu_envoi, objet, apercu, liste)
    VALUES (p->>'modele', p->'couleurs', p->'contenu', p->'contenu_envoi', COALESCE(p->>'objet', ''), p->>'apercu', p->>'liste')
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE missives
     SET modele = p->>'modele', couleurs = p->'couleurs', contenu = p->'contenu', contenu_envoi = p->'contenu_envoi',
         objet = COALESCE(p->>'objet', ''), apercu = p->>'apercu', liste = p->>'liste'
   WHERE id = v_id AND statut IN ('brouillon', 'programmee', 'automatique');
  IF NOT FOUND THEN PERFORM _refus('Cette Missive est déjà partie', 'statut'); END IF;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.hub_envois()
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
           'id', mi.id,
           'objet', mi.objet,
           'liste', mi.liste,
           'statut', mi.statut,
           'date', COALESCE(mi.envoyee_le, mi.programmee_le, mi.cree_le),
           'envoyes', c.envoyes,
           'echecs', c.echecs,
           'ouverts', c.ouverts,
           'clics', c.clics
         ) ORDER BY COALESCE(mi.envoyee_le, mi.programmee_le, mi.cree_le) DESC), '[]'::jsonb)
    INTO v_resultat
    FROM missives mi
    CROSS JOIN LATERAL (
      SELECT count(*) FILTER (WHERE e.statut IN ('envoye', 'rebond', 'plainte')) AS envoyes,
             count(*) FILTER (WHERE e.statut = 'echec') AS echecs,
             count(e.ouvert_le) AS ouverts,
             count(e.clique_le) AS clics
        FROM missive_envois e
       WHERE e.missive_id = mi.id
    ) c
   WHERE mi.statut <> 'automatique';

  RETURN v_resultat;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_suites(), public.hub_activer_suite(text, boolean),
  public.hub_ajouter_etape(text, integer, jsonb), public.hub_regler_etape(bigint, integer),
  public.hub_retirer_etape(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_suites(), public.hub_activer_suite(text, boolean),
  public.hub_ajouter_etape(text, integer, jsonb), public.hub_regler_etape(bigint, integer),
  public.hub_retirer_etape(bigint) TO authenticated;
