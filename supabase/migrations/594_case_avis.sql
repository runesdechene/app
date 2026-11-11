-- WHY: « Avis » se coche photo par photo dans le Hub, comme « Mur » et « Communauté » (Uriel, 11/11) :
-- la 593 le déduisait de la note, et taguait « Avis » des photos que rien n'affiche en avis.
-- Les photos importées de Judge.me, déjà publiées avec leur avis, partent cochées.
-- SCHEMA CHECKED (2026-11-11) : hub_submission_images.show_in_community, show_on_wall (boolean),
--   submission_id ; hub_photo_submissions.team_note — information_schema. hub_contributions : définition
--   live (= 588) ; hub_photos : 593 ; set_submission_image_review calquée sur set_submission_image_community.

ALTER TABLE public.hub_submission_images ADD COLUMN show_in_review boolean NOT NULL DEFAULT false;

UPDATE public.hub_submission_images i SET show_in_review = true
  FROM public.hub_photo_submissions s
 WHERE s.id = i.submission_id AND s.team_note LIKE 'Importé de Judge.me%';

CREATE OR REPLACE FUNCTION public.set_submission_image_review(p_image_id uuid, p_show boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  UPDATE hub_submission_images SET show_in_review = COALESCE(p_show, false) WHERE id = p_image_id;
END; $function$;

REVOKE ALL ON FUNCTION public.set_submission_image_review(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_submission_image_review(uuid, boolean) TO authenticated;

-- hub_contributions : définition live, plus « avis » dans chaque image.
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
                          'mur', i.show_on_wall,
                          'avis', i.show_in_review)
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

-- hub_photos : la 593, « avis » lu sur la photo.
CREATE OR REPLACE FUNCTION public.hub_photos()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  -- shortcut: tout d'un bloc (134 photos le 11/11) ; paginer quand la vue ralentira.
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', i.id,
             'url', i.image_url,
             'contribution', s.id,
             'nom', s.submitter_name,
             'statut', s.status,
             'quand', COALESCE(i.created_at, s.created_at),
             'produit_titre', i.shopify_product_title,
             'fiche', COALESCE(i.shopify_media_id, '') <> '',
             'mur', i.show_on_wall,
             'communaute', i.show_in_community,
             'avis', i.show_in_review
           ) ORDER BY COALESCE(i.created_at, s.created_at) DESC, i.id)
      FROM hub_submission_images i
      JOIN hub_photo_submissions s ON s.id = i.submission_id
  ), '[]'::jsonb);
END;
$function$;
