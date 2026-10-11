-- WHY: le dépôt de photos du Studio (Hub, /soumettre-contenu, « mission contenu ») ne marchait
--      plus (Uriel, 11/10 ; dernière soumission le 25/07). Deux murs, côté navigateur sans compte :
--      la lecture de users_admin (réservée à l'équipe) était refusée, donc chaque client était
--      pris pour un nouveau ; et create_photo_submission refuse depuis la 347 (27/09) d'agir pour
--      un autre compte que le sien — or le formulaire, sans session, agit toujours pour un autre.
--      Le fond : le navigateur faisait le travail du serveur, et trois fonctions ouvertes à anon
--      laissaient créer une fiche à n'importe quel id et rattacher n'importe quelle adresse
--      d'image à la soumission de n'importe qui.
--   deposer_contenu(...) : une seule fonction, ouverte sans compte. Elle retrouve la fiche par
--   l'e-mail (sans jamais la rendre), la crée sinon — comme avant : elle ne s'ouvre qu'à qui
--   confirme cette adresse par code (mig 455) —, puis enregistre la soumission et ses images.
--   Une image est un fichier déjà déposé dans community-photos/submissions/ : son adresse est
--   reconstruite ici, jamais reçue du navigateur. Cinq dépôts par heure et par adresse au plus.
--   Les trois anciennes fonctions se ferment à anon (seul le Studio les appelait).
-- SCHEMA CHECKED (11/10/2026, live) : create_photo_submission et create_user_from_submission
--   (corps repris) ; hub_photo_submissions (submitter_role 'client', message <= 500, notes 1-5,
--   created_at) ; hub_submission_images(submission_id, storage_path, image_url, sort_order, size) ;
--   users(id varchar, email_address, created_at, supprime_le) ; app_settings('ugc_welcome_crowns') ;
--   storage.objects(bucket_id, name) ; _refus(text, text) (mig 421).

CREATE OR REPLACE FUNCTION public.deposer_contenu(
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
  p_team_note text DEFAULT NULL
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
  v_user text;
  v_nouveau boolean := false;
  v_bienvenue int;
  v_soumission uuid;
  v_image jsonb;
  v_rang int := 0;
BEGIN
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN PERFORM _refus('Adresse e-mail invalide', 'email'); END IF;
  IF v_nom = '' OR char_length(v_nom) > 80 THEN PERFORM _refus('Prénom manquant', 'nom'); END IF;
  IF NOT p_consent_brand OR NOT p_consent_account THEN PERFORM _refus('Accords manquants', 'accord'); END IF;
  IF jsonb_typeof(p_images) IS DISTINCT FROM 'array' OR jsonb_array_length(p_images) NOT BETWEEN 1 AND 10 THEN
    PERFORM _refus('Entre un et dix contenus', 'images');
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

  -- La fiche de cette adresse, sinon une nouvelle, avec les Couronnes de bienvenue.
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

  INSERT INTO hub_photo_submissions (
    user_id, submitter_name, submitter_email, message, consent_brand_usage,
    consent_account_creation, status, submitter_role, model_height_cm, departement, quest_ref,
    rating_experience, rating_products, team_note
  ) VALUES (
    v_user, v_nom, v_email, NULLIF(btrim(p_message), ''), p_consent_brand,
    p_consent_account, 'pending', 'client', p_model_height_cm,
    NULLIF(btrim(p_departement), ''), NULLIF(btrim(p_quest_ref), ''),
    p_rating_experience, p_rating_products, NULLIF(btrim(p_team_note), '')
  ) RETURNING id INTO v_soumission;

  FOR v_image IN SELECT * FROM jsonb_array_elements(p_images) LOOP
    INSERT INTO hub_submission_images (submission_id, storage_path, image_url, sort_order, size)
    VALUES (v_soumission, v_image->>'path', c_depot || (v_image->>'path'), v_rang, NULLIF(v_image->>'size', ''));
    v_rang := v_rang + 1;
  END LOOP;

  RETURN json_build_object('nouveauCompte', v_nouveau);
END;
$function$;

REVOKE ALL ON FUNCTION public.deposer_contenu(text, text, jsonb, boolean, boolean, text, text, text, numeric, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deposer_contenu(text, text, jsonb, boolean, boolean, text, text, text, numeric, integer, integer, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.create_user_from_submission(character varying, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_submission_image(uuid, text, text, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_photo_submission(character varying, text, text, text, text, text, text, boolean, boolean, text, text, numeric, numeric, text, text, integer, integer, text) FROM anon;
