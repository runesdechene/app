-- WHY: Hub V2, page Comptes (Uriel, 16/10) : la V1 est sortie en MARS 2026, pas en mars 2025 — les 524 et
--      525 comptaient à tort depuis mars 2025 (dont 340 comptes de l'ancienne appli créés entre mars 2025
--      et février 2026, et 12 testeurs de février 2026). « Connectés au moins une fois » = connectés à la
--      V1 ou à la V2 :
--      1. une dernière connexion depuis le 1er mars 2026 (la V1 note chaque connexion : last_login_at,
--         rattrapée depuis auth.users par la 456 ; ces traces commencent le 05/02/2026) ;
--      2. ou un compte de l'appli créé depuis le 1er mars 2026 (créé en se connectant ; 5 comptes au 16/10
--         sans date notée).
--      Les gestes de la 525 (découvertes, visites, énigmes, lieux) n'ajoutaient plus personne : retirés.
--      723 comptes au 16/10. Même signature, mêmes droits.
-- SCHEMA CHECKED : définition reprise de la 524 (la 525 n'y ajoutait que les gestes) ; à recomparer à
--   pg_get_functiondef (= la 525) juste avant d'appliquer.

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
      'connectes', (SELECT count(*) FROM etats
                     WHERE derniere_visite >= '2026-03-01 00:00:00+01'::timestamptz
                        OR (provenance = 'app' AND inscrit >= '2026-03-01 00:00:00+01'::timestamptz)),
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
