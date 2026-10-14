-- WHY: dans fil_du_hub (508), le filtre des notifications portait sur date_trunc('hour', created_at),
--      une expression : l'index notifications_par_date n'était pas utilisable et chaque lecture
--      parcourait toute la table. On ajoute la borne équivalente sur la colonne nue
--      (created_at < p_avant + 1 h : toute heure <= p_avant tient dans cette borne) ; le filtre
--      par heure reste, il décide. Rien d'autre ne change.
-- SCHEMA CHECKED (14/10/2026, live) : definition live de fil_du_hub (508) reprise entiere par
--   pg_get_functiondef ; notifications(created_at) indexee par notifications_par_date.

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
    (SELECT 'compte', 'reactivation', u.charte_signee_le, u.id, NULL,
            jsonb_build_object('inscrit', u.created_at), 'compte:reactivation:' || u.id
       FROM users u WHERE (v_tous OR 'compte' = ANY(p_types)) AND u.charte_signee_le <= v_avant
        AND u.charte_signee_le > u.created_at + interval '1 day'
      ORDER BY u.charte_signee_le DESC LIMIT v_limite)
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

REVOKE ALL ON FUNCTION public.fil_du_hub(text[], timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fil_du_hub(text[], timestamptz, integer) TO authenticated;
