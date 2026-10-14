-- WHY: Hub V2, plan 4 (Fragments et boutique).
--      1. Les lectures de photos de l'ancien Hub (get_photo_submissions & co.) étaient ouvertes à tout
--         compte connecté, sans garde : n'importe quel joueur lisait l'e-mail des contributeurs. Garde
--         _is_staff(), comme les 16 écritures de la mig 513 ; corps repris du live.
--      2. Le Hub V2 lit les contributions par hub_contributions (les chiffres, sans la limite de 100).
--      3. « Achats à associer » (spec §9) : purchase_log n'a pas de politique UPDATE ; une ligne
--         no_match ne pouvait jamais quitter la file. hub_associer_achat / hub_classer_achat la règlent.
--      4. Associer un Fragment à la main en une écriture (user_fragments + purchase_log, comme l'ancien Hub).
--      5. La synchro de provenance lit les comptes clients sans passer par la vue users_admin.
--      6. Le bucket community-photos n'avait aucune politique d'effacement : l'ancien Hub croyait retirer
--         les fichiers et ne retirait rien.
--      7. La pastille « achats » de hub_ouverture ne compte plus que les no_match (décision d'Uriel du
--         14/10 : une pastille veut dire une action ; les pending se règlent seuls à l'inscription).
-- SCHEMA CHECKED (14/10/2026, live) : voir le plan 4, Task 1 Step 1 ; _is_admin(), _is_staff(), _refus().
--      pg_get_functiondef live de get_photo_submissions(text), get_photo_tags(),
--      get_submission_images_batch(uuid[]), get_submission_tags_batch(uuid[]), hub_ouverture(text)
--      (= mig 518) et enregistrer_fragment(integer,double precision,double precision,text,boolean,text)
--      (= mig 461) ; colonnes de purchase_log, user_fragments, hub_photo_submissions,
--      hub_submission_images, hub_photo_submission_tags, hub_photo_tags, title_fragments, users par
--      information_schema ; purchase_log_status_check, user_fragments_source_check,
--      user_fragments_pkey (user_id, fragment_id) ; storage community-photos : SELECT + INSERT, aucun DELETE.

-- 1. Lectures de photos : réservées à l'équipe (corps live, garde ajoutée)
CREATE OR REPLACE FUNCTION public.get_photo_submissions(p_status text DEFAULT NULL::text)
 RETURNS SETOF hub_photo_submissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_status IS NULL THEN
    RETURN QUERY SELECT * FROM hub_photo_submissions ORDER BY created_at DESC LIMIT 100;
  ELSE
    RETURN QUERY SELECT * FROM hub_photo_submissions WHERE status = p_status ORDER BY created_at DESC LIMIT 100;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_photo_tags()
 RETURNS SETOF hub_photo_tags
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  RETURN QUERY SELECT * FROM hub_photo_tags ORDER BY name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_submission_images_batch(p_submission_ids uuid[])
 RETURNS SETOF hub_submission_images
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  RETURN QUERY SELECT * FROM hub_submission_images WHERE submission_id = ANY(p_submission_ids) ORDER BY sort_order;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_submission_tags_batch(p_submission_ids uuid[])
 RETURNS TABLE(submission_id uuid, tag_id uuid, tag_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  RETURN QUERY
    SELECT pst.submission_id, t.id AS tag_id, t.name AS tag_name
    FROM hub_photo_submission_tags pst
    INNER JOIN hub_photo_tags t ON t.id = pst.tag_id
    WHERE pst.submission_id = ANY(p_submission_ids)
    ORDER BY t.name;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_photo_submissions(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_photo_tags() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_submission_images_batch(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_submission_tags_batch(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_photo_submissions(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_photo_tags() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_submission_images_batch(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_submission_tags_batch(uuid[]) TO authenticated;

-- 2. Les contributions du Hub V2 : une page, le total filtré et les quatre chiffres
CREATE OR REPLACE FUNCTION public.hub_contributions(p_statut text DEFAULT 'pending', p_recherche text DEFAULT NULL, p_limite integer DEFAULT 50, p_decalage integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_recherche text;
  v_limite int;
  v_decalage int;
  v_resultat jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_statut IS NULL OR p_statut NOT IN ('pending', 'approved', 'archived', 'toutes') THEN
    PERFORM _refus('Statut inconnu', 'statut');
  END IF;
  v_recherche := NULLIF(lower(btrim(p_recherche)), '');
  v_limite := LEAST(GREATEST(COALESCE(p_limite, 50), 1), 100);
  v_decalage := GREATEST(COALESCE(p_decalage, 0), 0);

  WITH filtres AS (
    SELECT s.*
      FROM hub_photo_submissions s
     WHERE (p_statut = 'toutes' OR s.status = p_statut)
       AND (v_recherche IS NULL
            OR position(v_recherche IN lower(s.submitter_name)) > 0
            OR position(v_recherche IN lower(s.submitter_email)) > 0)
  ),
  page AS (
    SELECT * FROM filtres
     ORDER BY created_at DESC NULLS LAST, id
     LIMIT v_limite OFFSET v_decalage
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtres),
    'compteurs', jsonb_build_object(
      'a_valider', (SELECT count(*) FROM hub_photo_submissions WHERE status = 'pending'),
      'publiees', (SELECT count(*) FROM hub_photo_submissions WHERE status = 'approved'),
      'archivees', (SELECT count(*) FROM hub_photo_submissions WHERE status = 'archived'),
      'au_mur', (SELECT count(*) FROM hub_submission_images WHERE show_on_wall),
      'plus_ancienne', (SELECT min(created_at) FROM hub_photo_submissions WHERE status = 'pending')
    ),
    'lignes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', p.id,
               'quand', p.created_at,
               'statut', p.status,
               'nom', p.submitter_name,
               'email', p.submitter_email,
               'instagram', p.submitter_instagram,
               'role', p.submitter_role,
               'compte', p.user_id,
               'lieu', p.location_name,
               'code_postal', p.location_zip,
               'departement', p.departement,
               'message', p.message,
               'note_equipe', p.team_note,
               'taille', p.product_size,
               'produit', p.product_worn,
               'hauteur', p.model_height_cm,
               'epaules', p.model_shoulder_width_cm,
               'note_experience', p.rating_experience,
               'note_produits', p.rating_products,
               'diffusion', p.consent_brand_usage,
               'recompensee_le', p.rewarded_at,
               'images', COALESCE((
                 SELECT jsonb_agg(jsonb_build_object(
                          'id', i.id,
                          'url', i.image_url,
                          'chemin', i.storage_path,
                          'taille', i.size,
                          'produit_id', i.shopify_product_id,
                          'produit_handle', i.shopify_product_handle,
                          'produit_titre', i.shopify_product_title,
                          'media', i.shopify_media_id,
                          'communaute', i.show_in_community,
                          'mur', i.show_on_wall)
                          ORDER BY i.sort_order, i.created_at)
                   FROM hub_submission_images i
                  WHERE i.submission_id = p.id), '[]'::jsonb),
               'etiquettes', COALESCE((
                 SELECT jsonb_agg(jsonb_build_object('id', t.id, 'nom', t.name) ORDER BY t.name)
                   FROM hub_photo_submission_tags pst
                   JOIN hub_photo_tags t ON t.id = pst.tag_id
                  WHERE pst.submission_id = p.id), '[]'::jsonb))
               ORDER BY p.created_at DESC NULLS LAST, p.id)
        FROM page p), '[]'::jsonb)
  ) INTO v_resultat;

  RETURN v_resultat;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_contributions(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_contributions(text, text, integer, integer) TO authenticated;

-- 3. Achats à associer : la file (pending et no_match), puis les deux gestes sur une ligne no_match
CREATE OR REPLACE FUNCTION public.hub_achats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', a.id,
             'quand', a.created_at,
             'statut', a.status,
             'email', a.email,
             'commande', a.shopify_order_id,
             'tag', a.shopify_tag,
             'fragment', a.unlock_ref_id,
             'compte', CASE WHEN u.id IS NULL THEN NULL
                            ELSE jsonb_build_object('id', u.id, 'nom', COALESCE(u.display_name, u.first_name, 'Un Voyageur'))
                       END)
             ORDER BY a.created_at DESC, a.id DESC)
      FROM purchase_log a
      LEFT JOIN users u ON u.id = a.user_id
     WHERE a.status IN ('pending', 'no_match')), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_achats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_achats() TO authenticated;

CREATE OR REPLACE FUNCTION public.hub_associer_achat(p_achat integer, p_fragment integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_achat purchase_log%ROWTYPE;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  SELECT * INTO v_achat FROM purchase_log WHERE id = p_achat FOR UPDATE;
  IF NOT FOUND THEN PERFORM _refus('Achat introuvable', 'achat'); END IF;
  IF v_achat.status <> 'no_match' THEN PERFORM _refus('Cet achat n’attend pas d’association', 'achat'); END IF;
  IF v_achat.user_id IS NULL THEN PERFORM _refus('Aucun compte pour cet achat', 'achat'); END IF;
  IF NOT EXISTS (SELECT 1 FROM title_fragments WHERE id = p_fragment) THEN PERFORM _refus('Fragment inconnu', 'fragment'); END IF;
  INSERT INTO user_fragments (user_id, fragment_id, source) VALUES (v_achat.user_id, p_fragment, 'shopify')
    ON CONFLICT (user_id, fragment_id) DO NOTHING;
  UPDATE purchase_log SET status = 'manual', unlock_type = 'fragment', unlock_ref_id = p_fragment WHERE id = p_achat;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_associer_achat(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_associer_achat(integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.hub_classer_achat(p_achat integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_achat purchase_log%ROWTYPE;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  SELECT * INTO v_achat FROM purchase_log WHERE id = p_achat FOR UPDATE;
  IF NOT FOUND THEN PERFORM _refus('Achat introuvable', 'achat'); END IF;
  IF v_achat.status <> 'no_match' THEN PERFORM _refus('Cet achat n’attend pas d’association', 'achat'); END IF;
  UPDATE purchase_log SET status = 'skipped' WHERE id = p_achat;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_classer_achat(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_classer_achat(integer) TO authenticated;

-- 4. Associer / retirer un Fragment depuis la fiche d'un compte
CREATE OR REPLACE FUNCTION public.hub_associer_fragment(p_user text, p_fragment integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user) THEN PERFORM _refus('Compte introuvable', 'compte'); END IF;
  IF NOT EXISTS (SELECT 1 FROM title_fragments WHERE id = p_fragment) THEN PERFORM _refus('Fragment inconnu', 'fragment'); END IF;
  INSERT INTO user_fragments (user_id, fragment_id, source) VALUES (p_user, p_fragment, 'manual')
    ON CONFLICT (user_id, fragment_id) DO NOTHING;
  IF FOUND THEN
    INSERT INTO purchase_log (email, user_id, unlock_type, unlock_ref_id, status)
      SELECT u.email_address, u.id, 'fragment', p_fragment, 'manual' FROM users u WHERE u.id = p_user;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_associer_fragment(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_associer_fragment(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.hub_retirer_fragment(p_user text, p_fragment integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  DELETE FROM user_fragments WHERE user_id = p_user AND fragment_id = p_fragment;
  UPDATE users SET signe_fragment_id = NULL WHERE id = p_user AND signe_fragment_id = p_fragment;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_retirer_fragment(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_retirer_fragment(text, integer) TO authenticated;

-- 5. Enregistrer un Fragment : corps live d'enregistrer_fragment (mig 461), garde du Hub,
--    origine facultative (R3d). L'ancienne enregistrer_fragment ne bouge pas (l'ancien Hub l'appelle).
CREATE OR REPLACE FUNCTION public.hub_enregistrer_fragment(p_id integer, p_visible boolean, p_theme text, p_origine_nom text, p_origine_lat double precision DEFAULT NULL, p_origine_lng double precision DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF (p_origine_lat IS NULL) <> (p_origine_lng IS NULL) THEN
    RAISE EXCEPTION 'Une origine a une latitude et une longitude, ou aucune';
  END IF;
  IF nullif(p_theme, '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM enigma_themes WHERE id = p_theme) THEN
    RAISE EXCEPTION 'Culture inconnue : %', p_theme;
  END IF;
  UPDATE title_fragments SET
    origine_lat = p_origine_lat,
    origine_lng = p_origine_lng,
    origine_nom = nullif(btrim(p_origine_nom), ''),
    visible = p_visible,
    theme = nullif(p_theme, '')
  WHERE id = p_id;
  IF NOT FOUND THEN PERFORM _refus('Fragment introuvable', 'fragment'); END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_enregistrer_fragment(integer, boolean, text, text, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_enregistrer_fragment(integer, boolean, text, text, double precision, double precision) TO authenticated;

-- 6. La pastille « achats » ne compte que les no_match (corps live = mig 518, une ligne change)
CREATE OR REPLACE FUNCTION public.hub_ouverture(p_periode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fin timestamptz := now();
  v_local timestamp := now() AT TIME ZONE 'Europe/Paris';
  v_unite text;
  v_recul interval;
  v_debut timestamptz;
  v_avant_debut timestamptz;
  v_avant_fin timestamptz;
  v_avant jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_periode IS NULL OR p_periode NOT IN ('jour', 'semaine', 'mois', 'toujours') THEN
    PERFORM _refus('Période inconnue', 'periode');
  END IF;

  IF p_periode = 'toujours' THEN
    v_debut := '-infinity';
  ELSE
    v_unite := CASE p_periode WHEN 'jour' THEN 'day' WHEN 'semaine' THEN 'week' ELSE 'month' END;
    v_recul := CASE p_periode WHEN 'jour' THEN interval '1 day' WHEN 'semaine' THEN interval '7 days' ELSE interval '1 month' END;
    v_debut := date_trunc(v_unite, v_local) AT TIME ZONE 'Europe/Paris';
    v_avant_debut := date_trunc(v_unite, v_local - v_recul) AT TIME ZONE 'Europe/Paris';
    v_avant_fin := (v_local - v_recul) AT TIME ZONE 'Europe/Paris';
    v_avant := _hub_pouls(v_avant_debut, v_avant_fin);
  END IF;

  RETURN jsonb_build_object(
    'pouls', _hub_pouls(v_debut, v_fin)
      || jsonb_build_object('actifs', (SELECT count(*) FROM users WHERE last_login_at >= v_debut)),
    'avant', v_avant,
    'attente', jsonb_build_object(
      'photos', (SELECT count(*) FROM hub_photo_submissions WHERE status = 'pending'),
      'photos_depuis', (SELECT min(created_at) FROM hub_photo_submissions WHERE status = 'pending'),
      'lieux', (SELECT count(*) FROM places
                 WHERE masked = false AND verified_at IS NULL AND created_at >= '2026-10-07 00:00:00+02'::timestamptz),
      'signalements_lieu', (SELECT count(*) FROM signalements_lieu WHERE traite_le IS NULL),
      'signalements_enigme', (SELECT count(*) FROM signalements_enigme WHERE traite_le IS NULL),
      'achats', (SELECT count(*) FROM purchase_log WHERE status = 'no_match')
    ),
    'sante', jsonb_build_object(
      'derniere_commande', (SELECT max(created_at) FROM purchase_log),
      'notifications', (SELECT count(*) FROM notifications WHERE created_at >= v_debut),
      'notifications_lues', (SELECT count(*) FROM notifications WHERE created_at >= v_debut AND read)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_ouverture(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_ouverture(text) TO authenticated;

-- 7. Les comptes clients Shopify, pour la synchro de provenance
CREATE OR REPLACE FUNCTION public.hub_comptes_clients()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'email', email_address,
             'client', shopify_customer_id,
             'provenance', account_source))
      FROM users
     WHERE shopify_customer_id IS NOT NULL), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_comptes_clients() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_comptes_clients() TO authenticated;

-- 8. Le bucket community-photos : l'équipe peut retirer un fichier
CREATE POLICY equipe_retire_photos_communaute ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'community-photos' AND public._is_admin());
