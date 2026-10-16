-- WHY: Hub V2, page Comptes (Uriel, 16/10). Un compte ne porte plus qu'un seul état parmi trois, dans
--      cet ordre :
--      1. « Jamais connecté » (nouveau) : un compte créé POUR quelqu'un (stand, flyer, commande en ligne :
--         account_source 'stand', 'flyer', 'shopify') qu'il n'a jamais ouvert (last_login_at vide — la V1
--         comme la V2 la posent à chaque entrée, par touch_last_login). Un compte 'app' a forcément été
--         ouvert par la personne. Ces comptes étaient jusqu'ici « En sommeil » (avant la bascule) ou sans
--         balise (après) ;
--      2. « Nouveau » : inscrit il y a moins de 15 jours, sauf s'il n'a jamais été ouvert ;
--      3. « En sommeil » : créé avant la bascule (07/10/2026), jamais entré dans la V2, et ni l'un ni
--         l'autre des deux premiers (avant : un compte pouvait être Nouveau ET En sommeil).
--      hub_comptes gagne le filtre 'jamais' et le compteur 'jamais' ; 'nouveaux' et 'sommeil' suivent les
--      règles ci-dessus. Même signature, mêmes droits : CREATE OR REPLACE. Les balises du client
--      (apps/hub-v2/src/features/communaute/lib/balises.ts) suivent les mêmes règles.
-- SCHEMA CHECKED : définition reprise de la 515 (dernière migration qui définit hub_comptes ; 516-522
--   n'y touchent pas). À comparer à pg_get_functiondef('public.hub_comptes(text,text,text,text,text,integer,integer)'::regprocedure)
--   juste avant l'application : toute différence avec la 515 arrête l'application.
--   _hub_comptes_base rend déjà provenance (account_source) et derniere_visite (last_login_at).

CREATE OR REPLACE FUNCTION public.hub_comptes(p_filtre text DEFAULT 'tous'::text, p_recherche text DEFAULT NULL::text, p_provenance text DEFAULT NULL::text, p_departement text DEFAULT NULL::text, p_tri text DEFAULT 'visite'::text, p_limite integer DEFAULT 50, p_decalage integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_recherche text := NULLIF(lower(btrim(p_recherche)), '');
  v_limite integer := LEAST(GREATEST(COALESCE(p_limite, 50), 1), 10000);
  v_decalage integer := GREATEST(COALESCE(p_decalage, 0), 0);
  v_resultat jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_filtre NOT IN ('tous', 'nouveaux', 'reactives', 'sommeil', 'jamais', 'porteurs', 'equipe') THEN
    PERFORM _refus('Filtre inconnu', 'filtre');
  END IF;
  IF p_tri NOT IN ('visite', 'inscription', 'nom') THEN PERFORM _refus('Tri inconnu', 'tri'); END IF;

  WITH base AS (
    SELECT b.*,
           (b.provenance IN ('stand', 'flyer', 'shopify') AND b.derniere_visite IS NULL) AS jamais
      FROM _hub_comptes_base() b
  ),
  etats AS (
    SELECT b.*,
           (NOT b.jamais AND b.inscrit >= now() - interval '15 days') AS nouveau,
           (NOT b.jamais AND b.inscrit < now() - interval '15 days'
              AND b.inscrit < '2026-10-07 00:00:00+02'::timestamptz AND b.entree_v2 IS NULL) AS sommeil
      FROM base b
  ),
  filtres AS (
    SELECT * FROM etats b
     WHERE (v_recherche IS NULL OR position(v_recherche IN lower(b.nom)) > 0
                                OR position(v_recherche IN lower(COALESCE(b.email, ''))) > 0)
       AND (p_provenance IS NULL OR b.provenance = p_provenance)
       AND (p_departement IS NULL OR b.departement = p_departement)
       AND CASE p_filtre
             WHEN 'tous' THEN true
             WHEN 'nouveaux' THEN b.nouveau
             WHEN 'reactives' THEN b.entree_v2 >= now() - interval '15 days' AND b.entree_v2 > b.inscrit + interval '1 day'
             WHEN 'sommeil' THEN b.sommeil
             WHEN 'jamais' THEN b.jamais
             WHEN 'porteurs' THEN b.fragments > 0
             WHEN 'equipe' THEN b.role IN ('admin', 'moderator')
           END
  ),
  page AS (
    SELECT id, nom, email, avatar, role, provenance, inscrit, derniere_visite, entree_v2, client,
           departement, code, fragments
      FROM filtres
     ORDER BY CASE WHEN p_tri = 'visite' THEN derniere_visite END DESC NULLS LAST,
              CASE WHEN p_tri = 'inscription' THEN inscrit END DESC,
              CASE WHEN p_tri = 'nom' THEN lower(nom) END ASC,
              id
     LIMIT v_limite OFFSET v_decalage
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtres),
    'compteurs', jsonb_build_object(
      'comptes', (SELECT count(*) FROM etats),
      'actifs', (SELECT count(*) FROM etats WHERE derniere_visite >= now() - interval '7 days'),
      'reactives', (SELECT count(*) FROM etats WHERE entree_v2 > inscrit + interval '1 day'),
      'sommeil', (SELECT count(*) FROM etats WHERE sommeil),
      'jamais', (SELECT count(*) FROM etats WHERE jamais)),
    'provenances', COALESCE((SELECT jsonb_agg(DISTINCT provenance ORDER BY provenance) FROM etats WHERE provenance IS NOT NULL), '[]'::jsonb),
    'departements', COALESCE((SELECT jsonb_agg(DISTINCT departement ORDER BY departement) FROM etats WHERE departement IS NOT NULL), '[]'::jsonb),
    'lignes', COALESCE((SELECT jsonb_agg(to_jsonb(page.*)) FROM page), '[]'::jsonb))
    INTO v_resultat;
  RETURN v_resultat;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_comptes(text, text, text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_comptes(text, text, text, text, text, integer, integer) TO authenticated;
