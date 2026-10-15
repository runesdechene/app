-- WHY: Hub V2, plan 2 (spec 2026-10-14-hub-v2-design §8, §10). « Réactivé » = première connexion d'un
--      ancien compte à la V2 ; « En sommeil » = compte créé avant la bascule (07/10/2026) jamais entré
--      dans la V2. La 514 (et les 504-511) lisaient users.charte_signee_le : faux — au 14/10, 62 des 82
--      comptes connectés depuis le 30/09 n'ont pas de date de Charte (20 comptes l'ont). La première
--      entrée dans la V2 a désormais sa propre colonne, users.entree_v2_le :
--      1. posée une seule fois par touch_last_login (que seule la V2 appelle depuis la bascule) ;
--      2. remplie pour le passé : la date de la Charte, sinon la dernière connexion postérieure au
--         07/10/2026 minuit Paris (la V1 appelait aussi touch_last_login : une connexion avant la
--         bascule ne prouve pas la V2) ;
--      3. lue par _hub_pouls, fil_du_hub (réactivation) et _hub_comptes_base (colonne « entree_v2 »,
--         qui remplace « charte » : la signature change, d'où DROP + CREATE de _hub_comptes_base et des
--         deux fonctions qui l'appellent, avec les mêmes droits qu'en 514).
--      Au passage, hub_compte limite enfin ses traces à 8 après le tri (la 514 en rendait jusqu'à 24),
--      et la date de bascule s'écrit en heure de Paris.
--      Droits de la colonne : aucun GRANT/REVOKE de colonne, comme charte_signee_le (pas d'ACL de
--      colonne ; anon et authenticated n'ont pas SELECT sur users au niveau table).
-- SCHEMA CHECKED (14/10/2026, live) : users.charte_signee_le, last_login_at, created_at présents,
--   entree_v2_le absent ; triggers de users tous en UPDATE OF <autre colonne> (aucun ne part sur le
--   remplissage) ; définitions de touch_last_login, _hub_pouls, fil_du_hub, _hub_comptes_base,
--   hub_comptes, hub_compte copiées de pg_get_functiondef ; seules hub_comptes et hub_compte appellent
--   _hub_comptes_base ; aucune vue n'en dépend.

-- 1. La colonne
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS entree_v2_le timestamptz;
COMMENT ON COLUMN public.users.entree_v2_le IS
  'première connexion à la V2 (Explore depuis la bascule) ; posée une seule fois par touch_last_login ; remplie le 14/10 pour le passé : date de la Charte, sinon dernière connexion postérieure au 07/10/2026';

-- 2. Le passé
UPDATE public.users SET entree_v2_le = COALESCE(charte_signee_le, last_login_at)
 WHERE entree_v2_le IS NULL
   AND (charte_signee_le IS NOT NULL OR last_login_at >= '2026-10-07 00:00:00+02'::timestamptz);

-- 3. touch_last_login : pose la première entrée, une seule fois
CREATE OR REPLACE FUNCTION public.touch_last_login(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  UPDATE public.users
  SET last_login_at = NOW(),
      entree_v2_le = COALESCE(entree_v2_le, NOW())
  WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$function$;

-- 4. Le pouls : les réactivés lisent la première entrée dans la V2
CREATE OR REPLACE FUNCTION public._hub_pouls(p_debut timestamp with time zone, p_fin timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'nouveaux', (SELECT count(*) FROM users WHERE created_at >= p_debut AND created_at < p_fin),
    'reactives', (SELECT count(*) FROM users
                   WHERE entree_v2_le >= p_debut AND entree_v2_le < p_fin
                     AND entree_v2_le > created_at + interval '1 day'),
    'lieux', (SELECT count(*) FROM places WHERE created_at >= p_debut AND created_at < p_fin),
    'visites', (SELECT count(*) FROM places_discovered
                 WHERE method = 'gps' AND discovered_at >= p_debut AND discovered_at < p_fin),
    'enigmes', (SELECT count(*) FROM enigma_responses
                 WHERE correct AND responded_at >= p_debut AND responded_at < p_fin)
  );
$function$;

-- 5. Le fil : la réactivation lit la première entrée dans la V2
CREATE OR REPLACE FUNCTION public.fil_du_hub(p_types text[], p_avant timestamp with time zone, p_limite integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_avant timestamptz := COALESCE(p_avant, now() + interval '1 second');
  v_limite integer := LEAST(GREATEST(COALESCE(p_limite, 30), 1), 100);
  v_tous boolean := p_types IS NULL OR cardinality(p_types) = 0;
  v_resultat jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;

  WITH
  evenements AS (
    (SELECT 'compte' AS type, 'inscription' AS sorte, u.created_at AS quand, u.id AS qui, NULL::text AS lieu,
            jsonb_build_object('provenance', u.account_source, 'client', u.shopify_customer_id IS NOT NULL) AS donnees, 'compte:inscription:' || u.id AS cle
       FROM users u WHERE (v_tous OR 'compte' = ANY(p_types)) AND u.created_at <= v_avant
      ORDER BY u.created_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'compte', 'reactivation', u.entree_v2_le, u.id, NULL,
            jsonb_build_object('inscrit', u.created_at), 'compte:reactivation:' || u.id
       FROM users u WHERE (v_tous OR 'compte' = ANY(p_types)) AND u.entree_v2_le <= v_avant
        AND u.entree_v2_le > u.created_at + interval '1 day'
      ORDER BY u.entree_v2_le DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'lieu', 'ajout', p.created_at, p.author_id, p.id,
            jsonb_build_object('verifie', p.verified_at IS NOT NULL, 'masque', p.masked), 'lieu:ajout:' || p.id
       FROM places p WHERE (v_tous OR 'lieu' = ANY(p_types)) AND p.created_at <= v_avant
      ORDER BY p.created_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'lieu', 'modification', v.cree_le, v.auteur, v.place_id, '{}'::jsonb, 'lieu:modification:' || v.id::text
       FROM versions_lieu v WHERE (v_tous OR 'lieu' = ANY(p_types)) AND v.cree_le <= v_avant
      ORDER BY v.cree_le DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'visite', 'sur_place', d.discovered_at, d.user_id, d.place_id,
            jsonb_build_object('premiere', NOT EXISTS (
              SELECT 1 FROM places_discovered d2
               WHERE d2.place_id = d.place_id AND d2.method = 'gps' AND d2.discovered_at < d.discovered_at)), 'visite:' || d.user_id || ':' || d.place_id || ':' || d.discovered_at::text
       FROM places_discovered d WHERE (v_tous OR 'visite' = ANY(p_types)) AND d.method = 'gps' AND d.discovered_at <= v_avant
      ORDER BY d.discovered_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'enigme', CASE WHEN r.correct THEN 'percee' ELSE 'manquee' END, r.responded_at, r.user_id, NULL,
            jsonb_build_object('enigme', r.enigma_id, 'culture', e.theme,
              'essai', (SELECT count(*) FROM enigma_responses r2
                         WHERE r2.user_id = r.user_id AND r2.enigma_id = r.enigma_id AND r2.responded_at <= r.responded_at)), 'enigme:' || r.id::text
       FROM enigma_responses r LEFT JOIN enigmas e ON e.id = r.enigma_id
      WHERE (v_tous OR 'enigme' = ANY(p_types)) AND r.responded_at <= v_avant
      ORDER BY r.responded_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'boutique', 'fragment', f.unlocked_at, f.user_id, NULL,
            jsonb_build_object('fragment', t.name, 'source', f.source), 'boutique:' || f.user_id || ':' || f.fragment_id::text
       FROM user_fragments f LEFT JOIN title_fragments t ON t.id = f.fragment_id
      WHERE (v_tous OR 'boutique' = ANY(p_types)) AND f.unlocked_at <= v_avant
      ORDER BY f.unlocked_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'photo', 'contribution', s.created_at, s.user_id, NULL,
            jsonb_build_object('nom', s.submitter_name, 'produit', s.product_worn, 'note', s.rating_products, 'statut', s.status), 'photo:' || s.id::text
       FROM hub_photo_submissions s WHERE (v_tous OR 'photo' = ANY(p_types)) AND s.created_at <= v_avant
      ORDER BY s.created_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'message', 'canal', m.created_at, m.user_id, NULL, jsonb_build_object('canal', m.channel), 'message:' || m.id::text
       FROM chat_messages m WHERE (v_tous OR 'message' = ANY(p_types)) AND m.created_at <= v_avant AND m.retire_le IS NULL
      ORDER BY m.created_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'moderation', 'signalement_lieu', s.cree_le, s.user_id, s.place_id, jsonb_build_object('motif', s.raison), 'moderation:lieu:' || s.id::text
       FROM signalements_lieu s WHERE (v_tous OR 'moderation' = ANY(p_types)) AND s.cree_le <= v_avant
      ORDER BY s.cree_le DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'moderation', 'signalement_enigme', s.cree_le, s.user_id, NULL,
            jsonb_build_object('motif', s.raison, 'enigme', s.enigma_id), 'moderation:enigme:' || s.id::text
       FROM signalements_enigme s WHERE (v_tous OR 'moderation' = ANY(p_types)) AND s.cree_le <= v_avant
      ORDER BY s.cree_le DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'notification', n.type, date_trunc('hour', n.created_at), NULL, NULL,
            jsonb_build_object('envoyees', count(*), 'lues', count(*) FILTER (WHERE n.read)), 'notification:' || n.type || ':' || date_trunc('hour', n.created_at)::text
       FROM notifications n WHERE (v_tous OR 'notification' = ANY(p_types)) AND date_trunc('hour', n.created_at) <= v_avant
        AND n.created_at < v_avant + interval '1 hour'
      GROUP BY n.type, date_trunc('hour', n.created_at)
      ORDER BY date_trunc('hour', n.created_at) DESC LIMIT v_limite)
  ),
  derniers AS (
    SELECT * FROM evenements WHERE quand IS NOT NULL ORDER BY quand DESC, cle LIMIT v_limite
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'type', e.type, 'sorte', e.sorte, 'quand', e.quand,
           'qui', CASE WHEN e.qui IS NULL THEN NULL ELSE jsonb_build_object(
             'id', e.qui,
             'nom', COALESCE(u.display_name, u.first_name, 'Un Voyageur'),
             'avatar', u.avatar_url) END,
           'lieu', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
             'id', p.id, 'nom', p.title, 'departement', p.departement) END,
           'donnees', e.donnees, 'cle', e.cle) ORDER BY e.quand DESC, e.cle), '[]'::jsonb)
    INTO v_resultat
    FROM derniers e
    LEFT JOIN users u ON u.id = e.qui
    LEFT JOIN places p ON p.id = e.lieu;

  RETURN v_resultat;
END;
$function$;

-- 6. Les comptes : « charte » devient « entree_v2 » (la signature change → DROP puis CREATE)
DROP FUNCTION public.hub_compte(text);
DROP FUNCTION public.hub_comptes(text, text, text, text, text, integer, integer);
DROP FUNCTION public._hub_comptes_base();

CREATE FUNCTION public._hub_comptes_base()
 RETURNS TABLE(id text, nom text, email text, avatar text, role text, provenance text, inscrit timestamp with time zone, derniere_visite timestamp with time zone, entree_v2 timestamp with time zone, client boolean, departement text, code text, fragments bigint)
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
         u.created_at, u.last_login_at, u.entree_v2_le, u.shopify_customer_id IS NOT NULL,
         d.departement, g.code, COALESCE(f.n, 0)
    FROM users u
    LEFT JOIN dep d ON d.user_id = u.id
    LEFT JOIN geo_departements g ON g.nom = d.departement
    LEFT JOIN frag f ON f.user_id = u.id;
$function$;

REVOKE ALL ON FUNCTION public._hub_comptes_base() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.hub_comptes(p_filtre text DEFAULT 'tous'::text, p_recherche text DEFAULT NULL::text, p_provenance text DEFAULT NULL::text, p_departement text DEFAULT NULL::text, p_tri text DEFAULT 'visite'::text, p_limite integer DEFAULT 50, p_decalage integer DEFAULT 0)
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
             WHEN 'reactives' THEN b.entree_v2 >= now() - interval '15 days' AND b.entree_v2 > b.inscrit + interval '1 day'
             WHEN 'sommeil' THEN b.inscrit < '2026-10-07 00:00:00+02'::timestamptz AND b.entree_v2 IS NULL
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
      'reactives', (SELECT count(*) FROM base WHERE entree_v2 > inscrit + interval '1 day'),
      'sommeil', (SELECT count(*) FROM base WHERE inscrit < '2026-10-07 00:00:00+02'::timestamptz AND entree_v2 IS NULL)),
    'provenances', COALESCE((SELECT jsonb_agg(DISTINCT provenance ORDER BY provenance) FROM base WHERE provenance IS NOT NULL), '[]'::jsonb),
    'departements', COALESCE((SELECT jsonb_agg(DISTINCT departement ORDER BY departement) FROM base WHERE departement IS NOT NULL), '[]'::jsonb),
    'lignes', COALESCE((SELECT jsonb_agg(to_jsonb(page.*)) FROM page), '[]'::jsonb))
    INTO v_resultat;
  RETURN v_resultat;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_comptes(text, text, text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_comptes(text, text, text, text, text, integer, integer) TO authenticated;

CREATE FUNCTION public.hub_compte(p_id text)
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
        SELECT t FROM (
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
        ) u ORDER BY (t->>'quand') DESC LIMIT 8
      ) x), '[]'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_compte(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_compte(text) TO authenticated;
