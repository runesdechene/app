-- WHY: Hub V2, plan 2 (spec 2026-10-14-hub-v2-design §8, §11) : la liste des comptes et la fiche d'un
--      compte, réservées aux admins. La liste calcule pour chacun ce qu'aucune table ne garde : son
--      département (celui où il a visité le plus de lieux, comme get_profil_explorateur, mais sans le
--      réglage d'affichage public : l'équipe le voit — décision d'Uriel du 14/10) et son nombre de
--      Fragments. La recherche ne connaît pas de joker (position, pas ILIKE).
-- SCHEMA CHECKED (14/10/2026, information_schema live) : voir le plan 2, Task 1 Step 1 (29 colonnes) ;
--   places_discovered.method ∈ remote, gps, author ; _is_admin(), _refus().

CREATE OR REPLACE FUNCTION public._hub_comptes_base()
 RETURNS TABLE (id text, nom text, email text, avatar text, role text, provenance text,
                inscrit timestamptz, derniere_visite timestamptz, charte timestamptz, client boolean,
                departement text, code text, fragments bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH visites AS (
    SELECT e.user_id, p.departement, count(*) AS n, max(e.visited_at) AS derniere
      FROM place_explorers e JOIN places p ON p.id = e.place_id
     WHERE p.departement IS NOT NULL
     GROUP BY e.user_id, p.departement
  ),
  dep AS (
    SELECT DISTINCT ON (user_id) user_id, departement
      FROM visites ORDER BY user_id, n DESC, derniere DESC
  ),
  frag AS (SELECT user_id, count(*) AS n FROM user_fragments GROUP BY user_id)
  SELECT u.id::text, COALESCE(u.display_name, u.first_name, 'Un Voyageur'), u.email_address::text,
         u.avatar_url, COALESCE(u.role, 'user')::text, u.account_source::text,
         u.created_at, u.last_login_at, u.charte_signee_le, u.shopify_customer_id IS NOT NULL,
         d.departement, g.code, COALESCE(f.n, 0)
    FROM users u
    LEFT JOIN dep d ON d.user_id = u.id
    LEFT JOIN geo_departements g ON g.nom = d.departement
    LEFT JOIN frag f ON f.user_id = u.id;
$function$;

REVOKE ALL ON FUNCTION public._hub_comptes_base() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hub_comptes(
  p_filtre text DEFAULT 'tous', p_recherche text DEFAULT NULL, p_provenance text DEFAULT NULL,
  p_departement text DEFAULT NULL, p_tri text DEFAULT 'visite', p_limite integer DEFAULT 50,
  p_decalage integer DEFAULT 0)
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
  IF p_filtre NOT IN ('tous', 'nouveaux', 'reactives', 'sommeil', 'porteurs', 'equipe') THEN
    PERFORM _refus('Filtre inconnu', 'filtre');
  END IF;
  IF p_tri NOT IN ('visite', 'inscription', 'nom') THEN PERFORM _refus('Tri inconnu', 'tri'); END IF;

  WITH base AS (SELECT * FROM _hub_comptes_base()),
  filtres AS (
    SELECT * FROM base b
     WHERE (v_recherche IS NULL OR position(v_recherche IN lower(b.nom)) > 0
                                OR position(v_recherche IN lower(COALESCE(b.email, ''))) > 0)
       AND (p_provenance IS NULL OR b.provenance = p_provenance)
       AND (p_departement IS NULL OR b.departement = p_departement)
       AND CASE p_filtre
             WHEN 'tous' THEN true
             WHEN 'nouveaux' THEN b.inscrit >= now() - interval '15 days'
             WHEN 'reactives' THEN b.charte >= now() - interval '15 days' AND b.charte > b.inscrit + interval '1 day'
             WHEN 'sommeil' THEN b.inscrit < '2026-10-07'::timestamptz AND b.charte IS NULL
             WHEN 'porteurs' THEN b.fragments > 0
             WHEN 'equipe' THEN b.role IN ('admin', 'moderator')
           END
  ),
  page AS (
    SELECT * FROM filtres
     ORDER BY CASE WHEN p_tri = 'visite' THEN derniere_visite END DESC NULLS LAST,
              CASE WHEN p_tri = 'inscription' THEN inscrit END DESC,
              CASE WHEN p_tri = 'nom' THEN lower(nom) END ASC,
              id
     LIMIT v_limite OFFSET v_decalage
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtres),
    'compteurs', jsonb_build_object(
      'comptes', (SELECT count(*) FROM base),
      'actifs', (SELECT count(*) FROM base WHERE derniere_visite >= now() - interval '7 days'),
      'reactives', (SELECT count(*) FROM base WHERE charte > inscrit + interval '1 day'),
      'sommeil', (SELECT count(*) FROM base WHERE inscrit < '2026-10-07'::timestamptz AND charte IS NULL)),
    'provenances', COALESCE((SELECT jsonb_agg(DISTINCT provenance ORDER BY provenance) FROM base WHERE provenance IS NOT NULL), '[]'::jsonb),
    'departements', COALESCE((SELECT jsonb_agg(DISTINCT departement ORDER BY departement) FROM base WHERE departement IS NOT NULL), '[]'::jsonb),
    'lignes', COALESCE((SELECT jsonb_agg(to_jsonb(page.*)) FROM page), '[]'::jsonb))
    INTO v_resultat;
  RETURN v_resultat;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_comptes(text, text, text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_comptes(text, text, text, text, text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.hub_compte(p_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_compte jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  SELECT to_jsonb(b.*) INTO v_compte FROM _hub_comptes_base() b WHERE b.id = p_id;
  IF v_compte IS NULL THEN RETURN NULL; END IF;

  RETURN v_compte || jsonb_build_object(
    'compteurs', jsonb_build_object(
      'decouverts', (SELECT count(*) FROM places_discovered WHERE user_id = p_id AND method = 'remote'),
      'visites', (SELECT count(*) FROM places_discovered WHERE user_id = p_id AND method = 'gps'),
      'ajoutes', (SELECT count(*) FROM places WHERE author_id = p_id),
      'enigmes', (SELECT count(*) FROM enigma_responses WHERE user_id = p_id AND correct)),
    'fragments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', f.fragment_id, 'nom', t.name, 'image', t.image_url,
                                          'source', f.source, 'quand', f.unlocked_at)
                       ORDER BY f.unlocked_at DESC NULLS LAST)
        FROM user_fragments f LEFT JOIN title_fragments t ON t.id = f.fragment_id
       WHERE f.user_id = p_id), '[]'::jsonb),
    'achats', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('commande', a.shopify_order_id, 'quand', a.created_at,
                                          'statut', a.status, 'tag', a.shopify_tag)
                       ORDER BY a.created_at DESC NULLS LAST)
        FROM purchase_log a
       WHERE a.user_id = p_id OR lower(a.email) = lower(v_compte->>'email')), '[]'::jsonb),
    'traces', COALESCE((
      SELECT jsonb_agg(t ORDER BY (t->>'quand') DESC) FROM (
        (SELECT jsonb_build_object('type', CASE d.method WHEN 'gps' THEN 'visite' ELSE 'decouverte' END,
                                   'quand', d.discovered_at, 'texte', p.title) AS t
           FROM places_discovered d JOIN places p ON p.id = d.place_id
          WHERE d.user_id = p_id AND d.method IN ('gps', 'remote')
          ORDER BY d.discovered_at DESC LIMIT 8)
        UNION ALL
        (SELECT jsonb_build_object('type', 'ajout', 'quand', p.created_at, 'texte', p.title)
           FROM places p WHERE p.author_id = p_id ORDER BY p.created_at DESC LIMIT 8)
        UNION ALL
        (SELECT jsonb_build_object('type', CASE WHEN r.correct THEN 'enigme' ELSE 'enigme_manquee' END,
                                   'quand', r.responded_at, 'texte', 'Énigme n° ' || r.enigma_id)
           FROM enigma_responses r WHERE r.user_id = p_id ORDER BY r.responded_at DESC LIMIT 8)
      ) x LIMIT 8), '[]'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_compte(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_compte(text) TO authenticated;
