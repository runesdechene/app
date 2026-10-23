-- WHY: Missives, lot 2, relecture (23/10), avant qu'aucune suite ne soit activée.
--      1. Après le premier achat ne prend que les clients nés après la mise en route : purchase_log ne remonte
--         qu'à mars 2026, un client de 2025 qui recommande passait pour un premier achat. Le webhook de commande
--         écrit client_depuis (création du client Shopify) ; suites.active_depuis garde la première activation.
--         Une association à la main (sans shopify_order_id) n'est pas un achat en ligne.
--      2. Achat et « première commande » se lisent par l'adresse, pas par la fiche : une adresse en casse mixte
--         peut porter deux fiches, l'achat tombant sur l'autre.
--      3. Un e-mail de suite pas encore écrit (objet vide ou contenu_envoi NULL) ne part pas : la personne
--         l'attend ; et une suite ne s'active pas tant qu'un de ses e-mails n'est pas écrit.
--      4. Le stand inscrit aussi quand la fiche existait déjà (le webhook client Shopify arrive parfois avant).
--         Le jour 0 attend une heure : une commande passée en même temps arrête la Bienvenue avant qu'elle parte.
--      5. Une suite active garde au moins un e-mail : sans étape, ses inscrits seraient finis pour toujours.
--      6. Une suite en pause n'envoie plus rien, même déjà posé ; le réveil ne la compte plus.
--      Définitions live du 23/10 (548-551, appliquées ce jour) recopiées entières ; seul le delta change.
-- SCHEMA CHECKED (23/10/2026, live) : purchase_log(email varchar, shopify_order_id, user_id) sans client_depuis ;
--   suites sans active_depuis ; users.created_at sans défaut (inutilisable pour dater une fiche).

ALTER TABLE public.purchase_log ADD COLUMN IF NOT EXISTS client_depuis timestamptz;
ALTER TABLE public.suites ADD COLUMN IF NOT EXISTS active_depuis timestamptz;

CREATE OR REPLACE FUNCTION public._inscrire(p_suite text, p_user varchar)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_premier integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM suites WHERE cle = p_suite AND active) THEN RETURN; END IF;

  -- Déjà dans la suite, sous cette fiche ou une autre de la même adresse.
  IF EXISTS (
    SELECT 1 FROM suite_inscriptions i
      JOIN users autre ON autre.id = i.user_id
      JOIN users moi ON moi.id = p_user
     WHERE i.suite = p_suite AND lower(autre.email_address) = lower(moi.email_address)
  ) THEN RETURN; END IF;

  SELECT min(jour) INTO v_premier FROM suite_etapes WHERE suite = p_suite;
  -- Une heure de marge : une commande passée au même moment arrête la Bienvenue avant son premier e-mail.
  INSERT INTO suite_inscriptions (suite, user_id, prochaine_le)
  VALUES (p_suite, p_user, now() + interval '1 hour' + v_premier * interval '1 day')
  ON CONFLICT DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public._suites_depuis_users()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.account_source = 'stand' AND (TG_OP = 'INSERT' OR OLD.account_source IS DISTINCT FROM 'stand') THEN
    PERFORM _inscrire('stand', NEW.id);
  ELSIF NEW.accord_nouvelles
    AND (TG_OP = 'INSERT' OR NOT OLD.accord_nouvelles)
    AND NEW.accord_nouvelles_porte IN ('site', 'flyer', 'appli')
    AND NEW.account_source IS DISTINCT FROM 'stand'
    AND NOT EXISTS (SELECT 1 FROM purchase_log WHERE lower(email) = lower(NEW.email_address)) THEN
    PERFORM _inscrire('bienvenue', NEW.id);
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER users_suites ON public.users;
CREATE TRIGGER users_suites
  AFTER INSERT OR UPDATE OF accord_nouvelles, account_source ON public.users
  FOR EACH ROW EXECUTE FUNCTION public._suites_depuis_users();

CREATE OR REPLACE FUNCTION public._suites_depuis_achat()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Par la fiche et par l'adresse : une association à la main n'a pas toujours d'e-mail.
  UPDATE suite_inscriptions i SET arretee_le = now()
    FROM users u
   WHERE i.suite = 'bienvenue' AND i.arretee_le IS NULL AND u.id = i.user_id
     AND (u.id = NEW.user_id OR lower(u.email_address) = lower(NEW.email));

  -- Un achat en ligne, d'un client né après la mise en route, sans autre commande avant celle-ci.
  IF NEW.user_id IS NOT NULL AND NEW.shopify_order_id IS NOT NULL
     AND NEW.client_depuis >= (SELECT active_depuis FROM suites WHERE cle = 'apres_achat')
     AND NOT EXISTS (
       SELECT 1 FROM purchase_log
        WHERE lower(email) = lower(NEW.email) AND shopify_order_id IS NOT NULL
          AND shopify_order_id <> NEW.shopify_order_id
     ) THEN
    PERFORM _inscrire('apres_achat', NEW.user_id);
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public._suite_permet(p_missive bigint, p_user varchar)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM suite_etapes se
      JOIN suites s ON s.cle = se.suite AND s.active
      JOIN suite_inscriptions si ON si.suite = se.suite AND si.user_id = p_user
      JOIN users u ON u.id = p_user
     WHERE se.missive_id = p_missive
       AND si.arretee_le IS NULL
       AND u.supprime_le IS NULL
       AND (u.accord_nouvelles OR (NOT s.exige_accord AND u.accord_nouvelles_le IS NULL))
  );
$function$;

CREATE OR REPLACE FUNCTION public.suites_preparer()
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
  -- Ce qu'une suite n'admet plus (achat, désabonnement, pause) ne part pas.
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
    SELECT se.jour, se.missive_id, (mi.objet <> '' AND mi.contenu_envoi IS NOT NULL) AS ecrit INTO v_etape
      FROM suite_etapes se JOIN missives mi ON mi.id = se.missive_id
     WHERE se.suite = v_inscription.suite AND se.jour > COALESCE(v_inscription.jour_fait, -1)
     ORDER BY se.jour LIMIT 1;

    IF NOT FOUND THEN
      UPDATE suite_inscriptions SET prochaine_le = NULL
       WHERE suite = v_inscription.suite AND user_id = v_inscription.user_id;
      CONTINUE;
    END IF;

    -- Un e-mail pas encore écrit ne part pas : la personne l'attend.
    CONTINUE WHEN NOT v_etape.ecrit;

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
     AND NOT EXISTS (SELECT 1 FROM missive_envois e
                       JOIN suite_etapes se ON se.missive_id = e.missive_id
                       JOIN suites s ON s.cle = se.suite AND s.active
                      WHERE e.statut = 'a_envoyer') THEN
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

CREATE OR REPLACE FUNCTION public.hub_activer_suite(p_cle text, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_active AND NOT EXISTS (SELECT 1 FROM suite_etapes WHERE suite = p_cle) THEN
    PERFORM _refus('Écris d’abord son premier e-mail', 'etapes');
  END IF;
  IF p_active AND EXISTS (SELECT 1 FROM suite_etapes se JOIN missives mi ON mi.id = se.missive_id
                           WHERE se.suite = p_cle AND (mi.objet = '' OR mi.contenu_envoi IS NULL)) THEN
    PERFORM _refus('Un de ses e-mails n’est pas encore écrit : donne-lui un objet et enregistre-le', 'etapes');
  END IF;
  UPDATE suites SET active = p_active, active_depuis = COALESCE(active_depuis, CASE WHEN p_active THEN now() END)
   WHERE cle = p_cle;
END;
$function$;

CREATE OR REPLACE FUNCTION public.hub_retirer_etape(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_missive bigint;
  v_suite text;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  SELECT missive_id, suite INTO v_missive, v_suite FROM suite_etapes WHERE id = p_id;
  -- Verrouillés : un réveil ne peut pas prendre un envoi de cette étape pendant qu'on la retire.
  PERFORM 1 FROM missive_envois WHERE missive_id = v_missive FOR UPDATE;
  IF EXISTS (SELECT 1 FROM missive_envois WHERE missive_id = v_missive AND statut <> 'a_envoyer') THEN
    PERFORM _refus('Cet e-mail est déjà parti, change-le plutôt', 'envois');
  END IF;
  IF (SELECT active FROM suites WHERE cle = v_suite)
     AND NOT EXISTS (SELECT 1 FROM suite_etapes WHERE suite = v_suite AND id <> p_id) THEN
    PERFORM _refus('Une suite active garde au moins un e-mail : mets-la d’abord en pause', 'etapes');
  END IF;
  DELETE FROM missives WHERE id = v_missive;  -- l'étape et ses envois à faire suivent (ON DELETE CASCADE)
END;
$function$;
