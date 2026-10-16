-- WHY: Hub V2, page Comptes (Uriel, 16/10) : « Connectés au moins une fois » compte aussi les anciens
--      comptes (d'avant mars 2025) revenus dans la V1 avant février 2026 sans dernière connexion notée,
--      quand ils ont laissé un geste daté depuis mars 2025 : une découverte (places_discovered), une
--      énigme (enigma_responses), une visite (place_explorers), un lieu ajouté (places). 12 comptes de
--      plus au 16/10 (1 070 → 1 082). Rien d'autre ne change. Même signature, mêmes droits.
-- SCHEMA CHECKED : définition reprise de la 524, appliquée le 16/10 ; colonnes discovered_at,
--   responded_at, visited_at, created_at et leurs user_id / author_id lues en prod le 16/10 (requête de
--   décompte). À recomparer à pg_get_functiondef juste avant d'appliquer.

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

  WITH traces AS (
    -- Un geste dans l'appli depuis mars 2025 prouve une connexion à la V1, même sans date de connexion.
    SELECT user_id::text AS id FROM places_discovered WHERE discovered_at >= '2025-03-01 00:00:00+01'::timestamptz
    UNION SELECT user_id::text FROM enigma_responses WHERE responded_at >= '2025-03-01 00:00:00+01'::timestamptz
    UNION SELECT user_id::text FROM place_explorers WHERE visited_at >= '2025-03-01 00:00:00+01'::timestamptz
    UNION SELECT author_id::text FROM places WHERE created_at >= '2025-03-01 00:00:00+01'::timestamptz
  ),
  base AS (
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
                     WHERE derniere_visite IS NOT NULL
                        OR (provenance = 'app' AND inscrit >= '2025-03-01 00:00:00+01'::timestamptz)
                        OR id IN (SELECT id FROM traces)),
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
