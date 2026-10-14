-- WHY: audit du 14/10/2026 (après rename_faction, mig 512) : des fonctions SECURITY DEFINER, ouvertes à
--      tout compte connecté, n'avaient aucune garde.
--      1. Les 16 fonctions de modération des photos (ancien Hub, écran Photos) : n'importe quel joueur
--         pouvait approuver, supprimer, modifier une contribution, et publier une photo sur le mur
--         « Ils nous portent », la communauté ou une fiche produit de la boutique. Corps repris de la
--         définition live ; seule la garde _is_staff() est ajoutée (l'ancien Hub les appelle en admin).
--      2. Onze fonctions qu'aucun client n'appelle plus (appli, ancien Hub, fonctions serveur, pages
--         SEO vérifiés) perdent EXECUTE pour les comptes connectés : get_my_informations (donnait
--         l'e-mail de n'importe quel compte), notify / notify_exploration (notification arbitraire à
--         n'importe qui), create_user_from_submission (compte au choix), add_submission_image,
--         cleanup_old_chat_messages (effaçait l'historique des messages), cheat_refill_target (se fiait
--         à un identifiant d'admin passé en paramètre), archive_passed_voyages et
--         herald_grade_promotions (tâches planifiées, lancées par pg_cron en propriétaire),
--         eject_voyage_participant et respond_voyage_join_request (Voyages V1). Aucune fonction
--         SECURITY INVOKER ne les appelle (vérifié) ; les fonctions DEFINER et pg_cron les gardent.
--      Réversible : un GRANT EXECUTE … TO authenticated rouvre chacune.
-- SCHEMA CHECKED (14/10/2026, live) : pg_get_functiondef des 16 fonctions copiées entières ; prosecdef,
--   has_function_privilege('authenticated') et absence de _is_admin/_is_staff/auth.uid vérifiés.

-- 1. Modération des photos : réservée à l’équipe

CREATE OR REPLACE FUNCTION public.add_tag_to_submission(p_submission_id uuid, p_tag_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  INSERT INTO hub_photo_submission_tags (submission_id, tag_id)

  VALUES (p_submission_id, p_tag_id)

  ON CONFLICT DO NOTHING;

END;

$function$;

CREATE OR REPLACE FUNCTION public.clear_submission_image_shopify_product(p_image_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  UPDATE hub_submission_images
     SET shopify_product_id     = null,
         shopify_product_handle = null,
         shopify_product_title  = null,
         shopify_media_id       = null,
         show_in_community      = false
   WHERE id = p_image_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.create_photo_tag(p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_id UUID;

BEGIN

  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  INSERT INTO hub_photo_tags (name)

  VALUES (lower(trim(p_name)))

  ON CONFLICT (name) DO UPDATE SET name = hub_photo_tags.name

  RETURNING id INTO v_id;

  RETURN v_id;

END;

$function$;

CREATE OR REPLACE FUNCTION public.delete_photo_submission(p_submission_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  DELETE FROM hub_submission_images WHERE submission_id = p_submission_id;

  DELETE FROM hub_photo_submissions WHERE id = p_submission_id;

END;

$function$;

CREATE OR REPLACE FUNCTION public.delete_photo_tag(p_tag_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  DELETE FROM hub_photo_tags WHERE id = p_tag_id;

END;

$function$;

CREATE OR REPLACE FUNCTION public.delete_submission_image(p_image_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  DELETE FROM public.hub_submission_images WHERE id = p_image_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.moderate_submission(p_submission_id uuid, p_status text, p_crowns integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id  text;
  v_rewarded timestamptz;
  v_amount   int;
BEGIN
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  UPDATE hub_photo_submissions SET status = p_status, moderated_at = NOW()
  WHERE id = p_submission_id RETURNING user_id, rewarded_at INTO v_user_id, v_rewarded;

  IF p_status = 'approved' AND v_rewarded IS NULL AND v_user_id IS NOT NULL THEN
    v_amount := GREATEST(0, COALESCE(p_crowns, 0));
    IF v_amount > 0 THEN
      INSERT INTO public.user_crowns (user_id, balance, updated_at)
      VALUES (v_user_id, LEAST(500, v_amount), now())
      ON CONFLICT (user_id) DO UPDATE SET
        balance = LEAST(500, public.user_crowns.balance + v_amount), updated_at = now();
    END IF;
    UPDATE users SET contributions_count = contributions_count + 1 WHERE id = v_user_id;
    UPDATE hub_photo_submissions SET rewarded_at = now(), reward_crowns = v_amount WHERE id = p_submission_id;
    INSERT INTO notifications (recipient_id, type, data)
    VALUES (v_user_id, 'contribution_approved',
            jsonb_build_object('kind','photo','submission_id',p_submission_id,'crowns',v_amount));
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.remove_tag_from_submission(p_submission_id uuid, p_tag_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  DELETE FROM hub_photo_submission_tags 

  WHERE submission_id = p_submission_id AND tag_id = p_tag_id;

END;

$function$;

CREATE OR REPLACE FUNCTION public.set_submission_image_community(p_image_id uuid, p_show boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  UPDATE hub_submission_images SET show_in_community = COALESCE(p_show, false) WHERE id = p_image_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.set_submission_image_media(p_image_id uuid, p_media_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  update hub_submission_images
     set shopify_media_id = nullif(btrim(p_media_id), '')
   where id = p_image_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.set_submission_image_product(p_image_id uuid, p_product text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  UPDATE hub_submission_images SET product_worn = NULLIF(btrim(p_product), '') WHERE id = p_image_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.set_submission_image_shopify_product(p_image_id uuid, p_product_id text, p_handle text, p_title text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  update hub_submission_images
     set shopify_product_id     = nullif(btrim(p_product_id), ''),
         shopify_product_handle = nullif(btrim(p_handle), ''),
         shopify_product_title  = nullif(btrim(p_title), '')
   where id = p_image_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.set_submission_image_status(p_image_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_status NOT IN ('pending','approved','archived') THEN
    RAISE EXCEPTION 'invalid status %', p_status;
  END IF;
  UPDATE hub_submission_images SET status = p_status WHERE id = p_image_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.set_submission_image_wall(p_image_id uuid, p_show boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  UPDATE public.hub_submission_images SET show_on_wall = COALESCE(p_show, false) WHERE id = p_image_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.update_submission_message(p_submission_id uuid, p_message text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  UPDATE hub_photo_submissions

  SET message = p_message

  WHERE id = p_submission_id;

END;

$function$;

CREATE OR REPLACE FUNCTION public.update_submission_product_worn(p_submission_id uuid, p_product_worn text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  UPDATE hub_photo_submissions

  SET product_worn = p_product_worn

  WHERE id = p_submission_id;

END;

$function$;

-- 2. Fermées aux comptes connectés
REVOKE ALL ON FUNCTION public.get_my_informations(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify(text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_exploration(text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_user_from_submission(character varying,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_submission_image(uuid,text,text,integer,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_old_chat_messages() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cheat_refill_target(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.archive_passed_voyages() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.herald_grade_promotions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eject_voyage_participant(text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.respond_voyage_join_request(text,uuid,text,text) FROM PUBLIC, anon, authenticated;
