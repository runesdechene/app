-- WHY: Hub V2, le fil d'activité (spec 2026-10-14-hub-v2-design §10) : tout ce que font les
--      gens, avec plus de détails que l'appli publique, sans nouvelle table — chaque source est
--      lue là où la base la garde déjà, comme sur_les_chemins (504) : une branche par source,
--      chacune limitée, puis un tri commun.
--      Les lieux masqués ou privés restent dans le fil : c'est l'équipe qui lit.
--      Un compte sans nom s'appelle « Un Voyageur » (mig 486).
--      Notifications : regroupées par type et par heure (une ligne « l'énigme du jour est
--      partie », pas 400).
-- SCHEMA CHECKED (14/10/2026, information_schema live) : voir le plan, Task 7 Step 1 (26
--   colonnes) ; _is_admin(), _refus(). Toutes les clés de jointure sont varchar : aucun cast.

CREATE OR REPLACE FUNCTION public.fil_du_hub(p_types text[], p_avant timestamptz, p_limite integer DEFAULT 30)
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
            jsonb_build_object('provenance', u.account_source, 'client', u.shopify_customer_id IS NOT NULL) AS donnees
       FROM users u WHERE (v_tous OR 'compte' = ANY(p_types)) AND u.created_at < v_avant
      ORDER BY u.created_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'compte', 'reactivation', u.charte_signee_le, u.id, NULL,
            jsonb_build_object('inscrit', u.created_at)
       FROM users u WHERE (v_tous OR 'compte' = ANY(p_types)) AND u.charte_signee_le < v_avant
        AND u.charte_signee_le > u.created_at + interval '1 day'
      ORDER BY u.charte_signee_le DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'lieu', 'ajout', p.created_at, p.author_id, p.id,
            jsonb_build_object('verifie', p.verified_at IS NOT NULL, 'masque', p.masked)
       FROM places p WHERE (v_tous OR 'lieu' = ANY(p_types)) AND p.created_at < v_avant
      ORDER BY p.created_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'lieu', 'modification', v.cree_le, v.auteur, v.place_id, '{}'::jsonb
       FROM versions_lieu v WHERE (v_tous OR 'lieu' = ANY(p_types)) AND v.cree_le < v_avant
      ORDER BY v.cree_le DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'visite', 'sur_place', d.discovered_at, d.user_id, d.place_id,
            jsonb_build_object('premiere', NOT EXISTS (
              SELECT 1 FROM places_discovered d2
               WHERE d2.place_id = d.place_id AND d2.method = 'gps' AND d2.discovered_at < d.discovered_at))
       FROM places_discovered d WHERE (v_tous OR 'visite' = ANY(p_types)) AND d.method = 'gps' AND d.discovered_at < v_avant
      ORDER BY d.discovered_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'enigme', CASE WHEN r.correct THEN 'percee' ELSE 'manquee' END, r.responded_at, r.user_id, NULL,
            jsonb_build_object('enigme', r.enigma_id, 'culture', e.theme,
              'essai', (SELECT count(*) FROM enigma_responses r2
                         WHERE r2.user_id = r.user_id AND r2.enigma_id = r.enigma_id AND r2.responded_at <= r.responded_at))
       FROM enigma_responses r LEFT JOIN enigmas e ON e.id = r.enigma_id
      WHERE (v_tous OR 'enigme' = ANY(p_types)) AND r.responded_at < v_avant
      ORDER BY r.responded_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'boutique', 'fragment', f.unlocked_at, f.user_id, NULL,
            jsonb_build_object('fragment', t.name, 'source', f.source)
       FROM user_fragments f LEFT JOIN title_fragments t ON t.id = f.fragment_id
      WHERE (v_tous OR 'boutique' = ANY(p_types)) AND f.unlocked_at < v_avant
      ORDER BY f.unlocked_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'photo', 'contribution', s.created_at, s.user_id, NULL,
            jsonb_build_object('nom', s.submitter_name, 'produit', s.product_worn, 'note', s.rating_products, 'statut', s.status)
       FROM hub_photo_submissions s WHERE (v_tous OR 'photo' = ANY(p_types)) AND s.created_at < v_avant
      ORDER BY s.created_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'message', 'canal', m.created_at, m.user_id, NULL, jsonb_build_object('canal', m.channel)
       FROM chat_messages m WHERE (v_tous OR 'message' = ANY(p_types)) AND m.created_at < v_avant AND m.retire_le IS NULL
      ORDER BY m.created_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'moderation', 'signalement_lieu', s.cree_le, s.user_id, s.place_id, jsonb_build_object('motif', s.raison)
       FROM signalements_lieu s WHERE (v_tous OR 'moderation' = ANY(p_types)) AND s.cree_le < v_avant
      ORDER BY s.cree_le DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'moderation', 'signalement_enigme', s.cree_le, s.user_id, NULL,
            jsonb_build_object('motif', s.raison, 'enigme', s.enigma_id)
       FROM signalements_enigme s WHERE (v_tous OR 'moderation' = ANY(p_types)) AND s.cree_le < v_avant
      ORDER BY s.cree_le DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'notification', n.type, date_trunc('hour', n.created_at), NULL, NULL,
            jsonb_build_object('envoyees', count(*), 'lues', count(*) FILTER (WHERE n.read))
       FROM notifications n WHERE (v_tous OR 'notification' = ANY(p_types)) AND n.created_at < v_avant
      GROUP BY n.type, date_trunc('hour', n.created_at)
      ORDER BY date_trunc('hour', n.created_at) DESC LIMIT v_limite)
  ),
  derniers AS (
    SELECT * FROM evenements WHERE quand IS NOT NULL ORDER BY quand DESC LIMIT v_limite
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'type', e.type, 'sorte', e.sorte, 'quand', e.quand,
           'qui', CASE WHEN e.qui IS NULL THEN NULL ELSE jsonb_build_object(
             'id', e.qui,
             'nom', COALESCE(u.display_name, u.first_name, 'Un Voyageur'),
             'avatar', u.avatar_url) END,
           'lieu', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
             'id', p.id, 'nom', p.title, 'departement', p.departement) END,
           'donnees', e.donnees) ORDER BY e.quand DESC), '[]'::jsonb)
    INTO v_resultat
    FROM derniers e
    LEFT JOIN users u ON u.id = e.qui
    LEFT JOIN places p ON p.id = e.lieu;

  RETURN v_resultat;
END;
$function$;

REVOKE ALL ON FUNCTION public.fil_du_hub(text[], timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fil_du_hub(text[], timestamptz, integer) TO authenticated;
