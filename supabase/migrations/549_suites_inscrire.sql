-- WHY: Missives, lot 2, tâche 2 : la base inscrit aux suites et arrête la découverte, sans toucher au code
--      des portes (stand, flyer, webhook client Shopify, appli écrivent déjà users ; chaque commande écrit
--      purchase_log, même sans Fragment).
--      1. Un compte créé au stand → Bienvenue du stand.
--      2. Un accord donné au flyer, sur le site (customers/create) ou dans l'appli, sans achat → Bienvenue.
--         La porte 'shopify' (synchro, mises à jour) n'inscrit jamais : ce sont des contacts anciens.
--      3. Une commande arrête la Bienvenue ; la première inscrit à Après le premier achat.
--      Une suite en pause n'inscrit personne. Une adresse portée par deux fiches n'est inscrite qu'une fois.
-- SCHEMA CHECKED (23/10/2026, live) : tables de la 548 ; users(id varchar, email_address, account_source,
--   accord_nouvelles, accord_nouvelles_porte) ; purchase_log(user_id, shopify_order_id).

CREATE FUNCTION public._inscrire(p_suite text, p_user varchar)
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
  INSERT INTO suite_inscriptions (suite, user_id, prochaine_le)
  VALUES (p_suite, p_user, now() + v_premier * interval '1 day')
  ON CONFLICT DO NOTHING;
END;
$function$;

CREATE FUNCTION public._suites_depuis_users()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.account_source = 'stand' THEN
    PERFORM _inscrire('stand', NEW.id);
  ELSIF NEW.accord_nouvelles
    AND (TG_OP = 'INSERT' OR NOT OLD.accord_nouvelles)
    AND NEW.accord_nouvelles_porte IN ('site', 'flyer', 'appli')
    AND NEW.account_source IS DISTINCT FROM 'stand'
    AND NOT EXISTS (SELECT 1 FROM purchase_log WHERE user_id = NEW.id) THEN
    PERFORM _inscrire('bienvenue', NEW.id);
  END IF;
  RETURN NULL;
END;
$function$;

CREATE TRIGGER users_suites
  AFTER INSERT OR UPDATE OF accord_nouvelles ON public.users
  FOR EACH ROW EXECUTE FUNCTION public._suites_depuis_users();

CREATE FUNCTION public._suites_depuis_achat()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NULL; END IF;

  UPDATE suite_inscriptions SET arretee_le = now()
   WHERE suite = 'bienvenue' AND user_id = NEW.user_id AND arretee_le IS NULL;

  -- Une commande écrit une ligne par Fragment : seule une autre commande dit « pas la première ».
  IF NOT EXISTS (
    SELECT 1 FROM purchase_log
     WHERE user_id = NEW.user_id AND shopify_order_id IS DISTINCT FROM NEW.shopify_order_id
  ) THEN
    PERFORM _inscrire('apres_achat', NEW.user_id);
  END IF;
  RETURN NULL;
END;
$function$;

CREATE TRIGGER purchase_log_suites
  AFTER INSERT ON public.purchase_log
  FOR EACH ROW EXECUTE FUNCTION public._suites_depuis_achat();

REVOKE ALL ON FUNCTION public._inscrire(text, varchar), public._suites_depuis_users(),
  public._suites_depuis_achat() FROM PUBLIC, anon, authenticated;
