-- WHY: « Un avis seul » (spec docs/superpowers/specs/2026-10-16-avis-et-photos-design.md, plan
--      2026-11-11-avis-seul) : un client laisse quelques étoiles et un mot, sans photo, depuis
--      /soumettre-contenu?chemin=avis. Les avis s'afficheront par type de vêtement, jamais par motif.
--   hub_photo_submissions.garment_type : le type de vêtement (tshirt, sweat, casquette, autre).
--   deposer_contenu : accepte 0 image, à condition d'un type de vêtement et d'une note ou d'un texte.
--   Un avis seul ne crée ni ne rattache aucun compte (user_id NULL) : pas de case « création de
--   compte » à cocher pour deux étoiles, et pas de notification « contribution approuvée » à la
--   validation. L'accord de diffusion reste exigé ; celui du compte, seulement avec des photos.
--   La signature change (p_garment_type) : l'ancienne est supprimée, sinon les deux coexistent.
--   hub_contributions rend le vêtement et le nombre de Fragments des comptes de cet e-mail :
--   « client vérifié » se calcule à la lecture, un client qui reçoit son Fragment plus tard le devient.
-- SCHEMA CHECKED (11/11/2026, live) : deposer_contenu identique à la 501 ; hub_contributions
--   identique à la 521 ; hub_photo_submissions.user_id nullable ; moderate_submission ne récompense
--   pas sans user_id ; user_fragments(user_id, fragment_id) ; users(email_address, supprime_le).

ALTER TABLE public.hub_photo_submissions
  ADD COLUMN garment_type text CHECK (garment_type IN ('tshirt', 'sweat', 'casquette', 'autre'));

DROP FUNCTION public.deposer_contenu(text, text, jsonb, boolean, boolean, text, text, text, numeric, integer, integer, text);

CREATE FUNCTION public.deposer_contenu(
  p_email text,
  p_nom text,
  p_images jsonb,
  p_consent_brand boolean,
  p_consent_account boolean,
  p_message text DEFAULT NULL,
  p_departement text DEFAULT NULL,
  p_quest_ref text DEFAULT NULL,
  p_model_height_cm numeric DEFAULT NULL,
  p_rating_experience integer DEFAULT NULL,
  p_rating_products integer DEFAULT NULL,
  p_team_note text DEFAULT NULL,
  p_garment_type text DEFAULT NULL
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c_depot constant text := 'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/community-photos/';
  v_email text := lower(btrim(p_email));
  v_nom text := btrim(p_nom);
  v_avis_seul boolean;
  v_user text;
  v_nouveau boolean := false;
  v_bienvenue int;
  v_soumission uuid;
  v_image jsonb;
  v_rang int := 0;
BEGIN
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN PERFORM _refus('Adresse e-mail invalide', 'email'); END IF;
  IF v_nom = '' OR char_length(v_nom) > 80 THEN PERFORM _refus('Prénom manquant', 'nom'); END IF;
  IF jsonb_typeof(p_images) IS DISTINCT FROM 'array' OR jsonb_array_length(p_images) NOT BETWEEN 0 AND 10 THEN
    PERFORM _refus('Entre zéro et dix contenus', 'images');
  END IF;
  v_avis_seul := jsonb_array_length(p_images) = 0;
  IF NOT p_consent_brand OR (NOT v_avis_seul AND NOT p_consent_account) THEN
    PERFORM _refus('Accords manquants', 'accord');
  END IF;
  IF v_avis_seul THEN
    IF p_rating_experience IS NULL AND p_rating_products IS NULL AND NULLIF(btrim(p_message), '') IS NULL THEN
      PERFORM _refus('Un avis demande une note ou quelques mots', 'avis');
    END IF;
    IF p_garment_type IS NULL THEN PERFORM _refus('Type de vêtement manquant', 'vetement'); END IF;
  END IF;
  FOR v_image IN SELECT * FROM jsonb_array_elements(p_images) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM storage.objects
       WHERE bucket_id = 'community-photos' AND name = v_image->>'path' AND name LIKE 'submissions/%'
    ) THEN
      PERFORM _refus('Contenu introuvable dans le dépôt', 'images');
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM hub_photo_submissions
       WHERE submitter_email = v_email AND created_at > now() - interval '1 hour') >= 5 THEN
    PERFORM _refus('Trop d’envois d’un coup : réessaie dans une heure', 'limite');
  END IF;

  -- Avec des photos : la fiche de cette adresse, sinon une nouvelle, avec les Couronnes de bienvenue.
  IF NOT v_avis_seul THEN
    SELECT id INTO v_user FROM users
     WHERE lower(email_address) = v_email AND supprime_le IS NULL
     ORDER BY created_at LIMIT 1;
    IF v_user IS NULL THEN
      v_user := gen_random_uuid()::text;
      v_nouveau := true;
      INSERT INTO users (id, email_address, first_name, role, is_active, rank, biography)
      VALUES (v_user, v_email, v_nom, 'user', true, 0, '');
      SELECT value::int INTO v_bienvenue FROM app_settings WHERE key = 'ugc_welcome_crowns';
      IF v_bienvenue > 0 THEN
        INSERT INTO user_crowns (user_id, balance, updated_at)
        VALUES (v_user, LEAST(500, v_bienvenue), now())
        ON CONFLICT (user_id) DO UPDATE SET
          balance = LEAST(500, user_crowns.balance + v_bienvenue), updated_at = now();
      END IF;
    END IF;
  END IF;

  INSERT INTO hub_photo_submissions (
    user_id, submitter_name, submitter_email, message, consent_brand_usage,
    consent_account_creation, status, submitter_role, model_height_cm, departement, quest_ref,
    rating_experience, rating_products, team_note, garment_type
  ) VALUES (
    v_user, v_nom, v_email, NULLIF(btrim(p_message), ''), p_consent_brand,
    p_consent_account, 'pending', 'client', p_model_height_cm,
    NULLIF(btrim(p_departement), ''), NULLIF(btrim(p_quest_ref), ''),
    p_rating_experience, p_rating_products, NULLIF(btrim(p_team_note), ''), p_garment_type
  ) RETURNING id INTO v_soumission;

  FOR v_image IN SELECT * FROM jsonb_array_elements(p_images) LOOP
    INSERT INTO hub_submission_images (submission_id, storage_path, image_url, sort_order, size)
    VALUES (v_soumission, v_image->>'path', c_depot || (v_image->>'path'), v_rang, NULLIF(v_image->>'size', ''));
    v_rang := v_rang + 1;
  END LOOP;

  RETURN json_build_object('nouveauCompte', v_nouveau);
END;
$function$;

REVOKE ALL ON FUNCTION public.deposer_contenu(text, text, jsonb, boolean, boolean, text, text, text, numeric, integer, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deposer_contenu(text, text, jsonb, boolean, boolean, text, text, text, numeric, integer, integer, text, text) TO anon, authenticated;

-- hub_contributions : définition live, plus « vetement » et « fragments ».
CREATE OR REPLACE FUNCTION public.hub_contributions(p_statut text DEFAULT 'pending'::text, p_recherche text DEFAULT NULL::text, p_limite integer DEFAULT 50, p_decalage integer DEFAULT 0)
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
               'vetement', p.garment_type,
               'fragments', (SELECT count(*) FROM user_fragments uf
                               JOIN users u ON u.id = uf.user_id
                              WHERE lower(u.email_address) = lower(p.submitter_email)
                                AND u.supprime_le IS NULL),
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
