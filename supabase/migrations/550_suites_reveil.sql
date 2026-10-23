-- WHY: Missives, lot 2, tâche 3 : le réveil envoie les étapes des suites.
--      1. suites_preparer : chaque inscription due pose son étape dans missive_envois et avance à la suivante.
--         L'écart se compte depuis l'étape précédente, pas depuis l'inscription : une suite remise en route
--         après une pause n'envoie pas trois e-mails d'un coup. Une seule étape par réveil et par personne.
--      2. _suite_permet : une étape part si l'inscription n'est pas arrêtée, le compte pas supprimé, et
--         l'accord le permet (Bienvenue : accord donné ; stand et après-achat : pas de refus daté).
--         suites_preparer retire les envois que cette règle n'admet plus (achat, désabonnement).
--      3. missives_prendre_lot et _reveiller_missives prennent aussi les étapes. Définitions live du 23/10
--         recopiées entières (541 pour prendre_lot, 545 pour le réveil) ; seul le delta change.
-- SCHEMA CHECKED (23/10/2026, live) : pg_get_functiondef de missives_prendre_lot (541) et
--   _reveiller_missives (545) ; tables de la 548.

CREATE FUNCTION public._suite_permet(p_missive bigint, p_user varchar)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM suite_etapes se
      JOIN suites s ON s.cle = se.suite
      JOIN suite_inscriptions si ON si.suite = se.suite AND si.user_id = p_user
      JOIN users u ON u.id = p_user
     WHERE se.missive_id = p_missive
       AND si.arretee_le IS NULL
       AND u.supprime_le IS NULL
       AND (u.accord_nouvelles OR (NOT s.exige_accord AND u.accord_nouvelles_le IS NULL))
  );
$function$;

CREATE FUNCTION public.suites_preparer()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inscription record;
  v_etape record;
  v_suivant integer;
BEGIN
  DELETE FROM missive_envois e
   USING missives mi
   WHERE mi.id = e.missive_id AND mi.statut = 'automatique' AND e.statut = 'a_envoyer'
     AND NOT _suite_permet(e.missive_id, e.user_id);

  FOR v_inscription IN
    SELECT i.suite, i.user_id, i.jour_fait
      FROM suite_inscriptions i
      JOIN suites s ON s.cle = i.suite AND s.active
     WHERE i.arretee_le IS NULL AND i.prochaine_le <= now()
       FOR UPDATE OF i SKIP LOCKED
  LOOP
    SELECT jour, missive_id INTO v_etape
      FROM suite_etapes
     WHERE suite = v_inscription.suite AND jour > COALESCE(v_inscription.jour_fait, -1)
     ORDER BY jour LIMIT 1;

    IF NOT FOUND THEN
      UPDATE suite_inscriptions SET prochaine_le = NULL
       WHERE suite = v_inscription.suite AND user_id = v_inscription.user_id;
      CONTINUE;
    END IF;

    IF _suite_permet(v_etape.missive_id, v_inscription.user_id) THEN
      INSERT INTO missive_envois (missive_id, user_id)
      VALUES (v_etape.missive_id, v_inscription.user_id)
      ON CONFLICT DO NOTHING;
    END IF;

    SELECT min(jour) INTO v_suivant
      FROM suite_etapes WHERE suite = v_inscription.suite AND jour > v_etape.jour;
    UPDATE suite_inscriptions
       SET jour_fait = v_etape.jour,
           prochaine_le = now() + (v_suivant - v_etape.jour) * interval '1 day'  -- NULL : suite finie
     WHERE suite = v_inscription.suite AND user_id = v_inscription.user_id;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.missives_prendre_lot(p_taille integer)
 RETURNS TABLE(missive_id bigint, user_id varchar, email text, prenom text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH lot AS (
    SELECT e.missive_id, e.user_id
      FROM missive_envois e
      JOIN missives mi ON mi.id = e.missive_id
      JOIN users u ON u.id = e.user_id
     WHERE e.statut = 'a_envoyer'
       AND ((mi.statut = 'en_cours' AND u.accord_nouvelles AND u.supprime_le IS NULL)
         OR (mi.statut = 'automatique' AND _suite_permet(e.missive_id, e.user_id)))
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

CREATE OR REPLACE FUNCTION public._reveiller_missives()
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
                                            OR (statut = 'programmee' AND programmee_le <= now()))
     AND NOT EXISTS (SELECT 1 FROM suite_inscriptions i JOIN suites s ON s.cle = i.suite AND s.active
                      WHERE i.arretee_le IS NULL AND i.prochaine_le <= now())
     AND NOT EXISTS (SELECT 1 FROM missive_envois e JOIN missives mi ON mi.id = e.missive_id
                      WHERE mi.statut = 'automatique' AND e.statut = 'a_envoyer') THEN
    RETURN;
  END IF;
  SELECT value INTO v_url FROM app_settings WHERE key = 'missives_envoi_url';
  -- Le secret vit dans Vault, jamais dans app_settings (lisible sans compte).
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'missives_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE WARNING 'missives : missives_envoi_url (app_settings) ou missives_secret (Vault) manquant';
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

REVOKE ALL ON FUNCTION public._suite_permet(bigint, varchar), public.suites_preparer()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.suites_preparer() TO service_role;
