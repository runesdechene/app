-- WHY: Missives, lot 1, tâche 4 : l'envoi programmé. Toutes les 5 minutes, pg_cron réveille la fonction
--      Netlify missives-envoyer (s'il y a du travail), qui rend et envoie un lot par Resend. Ce qui doit
--      tenir quand deux réveils se croisent vit ici, dans la base :
--      1. missives_preparer : une Missive programmée et arrivée à échéance passe en_cours (un seul réveil
--         la prend) et ses destinataires sont résolus maintenant, pas à la programmation.
--      2. missives_prendre_lot : prend N envois à faire, FOR UPDATE SKIP LOCKED, et les passe en_route :
--         deux réveils ne prennent jamais la même personne. Un compte désabonné ou supprimé entre-temps
--         n'est pas pris.
--      3. missives_noter : le résultat de Resend, envoi par envoi (envoye ou echec et sa raison).
--      4. missives_terminer : une Missive sans plus personne à prendre passe envoyee ; les envois restés
--         à faire (désabonnés en route) sont retirés : ils ne reçoivent rien.
--      Les noms posés par défaut (V1, synchro Shopify, stand, flyer) ne sont pas des prénoms : la lettre
--      salue alors « Explorateur ».
-- SCHEMA CHECKED (23/10/2026, live) : app_settings(key, value) ; first_name par défaut en prod :
--   « Un Voyageur » (2 459), « Client Shopify » (48), « Pionnier » (27) ; motif net.http_post et secret
--   d'app_settings repris de trigger_email_on_notification (mig 175) ; missives, missive_envois,
--   _liste_membres et users.accord_nouvelles créées par la 539.

CREATE FUNCTION public.missives_preparer()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_missive record;
BEGIN
  FOR v_missive IN
    UPDATE missives SET statut = 'en_cours'
     WHERE statut = 'programmee' AND programmee_le <= now()
    RETURNING id, liste
  LOOP
    INSERT INTO missive_envois (missive_id, user_id)
    SELECT v_missive.id, m.user_id
      FROM _liste_membres(v_missive.liste) m
      JOIN users u ON u.id = m.user_id
     WHERE u.accord_nouvelles
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$function$;

CREATE FUNCTION public.missives_prendre_lot(p_taille integer)
 RETURNS TABLE(missive_id bigint, user_id varchar, email text, prenom text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH lot AS (
    SELECT e.missive_id, e.user_id
      FROM missive_envois e
      JOIN missives mi ON mi.id = e.missive_id AND mi.statut = 'en_cours'
      JOIN users u ON u.id = e.user_id AND u.accord_nouvelles AND u.supprime_le IS NULL
     WHERE e.statut = 'a_envoyer'
     LIMIT p_taille
       FOR UPDATE OF e SKIP LOCKED
  )
  UPDATE missive_envois e SET statut = 'en_route'
    FROM lot, users u
   WHERE e.missive_id = lot.missive_id AND e.user_id = lot.user_id AND u.id = e.user_id
  RETURNING e.missive_id, e.user_id, u.email_address::text,
            CASE WHEN btrim(u.first_name) IN ('', 'Un Voyageur', 'Client Shopify', 'Pionnier') THEN NULL
                 ELSE btrim(u.first_name) END;
$function$;

-- p_resultats : [{ missive_id, user_id, resend_id }] ou [{ missive_id, user_id, erreur }].
CREATE FUNCTION public.missives_noter(p_resultats jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE missive_envois e
     SET statut = CASE WHEN r.resend_id IS NULL THEN 'echec' ELSE 'envoye' END,
         resend_id = r.resend_id,
         erreur = r.erreur,
         envoye_le = now()
    FROM jsonb_to_recordset(p_resultats) AS r(missive_id bigint, user_id varchar, resend_id text, erreur text)
   WHERE e.missive_id = r.missive_id AND e.user_id = r.user_id AND e.statut = 'en_route';
$function$;

CREATE FUNCTION public.missives_terminer()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id bigint;
BEGIN
  FOR v_id IN
    SELECT mi.id FROM missives mi
     WHERE mi.statut = 'en_cours'
       AND NOT EXISTS (
         SELECT 1 FROM missive_envois e JOIN users u ON u.id = e.user_id
          WHERE e.missive_id = mi.id
            AND (e.statut = 'en_route' OR (e.statut = 'a_envoyer' AND u.accord_nouvelles AND u.supprime_le IS NULL)))
  LOOP
    DELETE FROM missive_envois WHERE missive_id = v_id AND statut = 'a_envoyer';
    UPDATE missives SET statut = 'envoyee', envoyee_le = now() WHERE id = v_id;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.missives_preparer(), public.missives_prendre_lot(integer),
  public.missives_noter(jsonb), public.missives_terminer() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.missives_preparer(), public.missives_prendre_lot(integer),
  public.missives_noter(jsonb), public.missives_terminer() TO service_role;

-- Le réveil : n'appelle la fonction Netlify que s'il y a une Missive à préparer ou en cours.
CREATE FUNCTION public._reveiller_missives()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM missives WHERE statut = 'en_cours'
                                            OR (statut = 'programmee' AND programmee_le <= now())) THEN
    RETURN;
  END IF;
  SELECT value INTO v_url FROM app_settings WHERE key = 'missives_envoi_url';
  SELECT value INTO v_secret FROM app_settings WHERE key = 'missives_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE WARNING 'missives : missives_envoi_url ou missives_secret manquant dans app_settings';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Missives-Secret', v_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._reveiller_missives() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('missives_envoi', '*/5 * * * *', $$SELECT public._reveiller_missives()$$);
