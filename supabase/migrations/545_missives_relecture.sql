-- WHY: Missives, relecture du lot 1 (23/10).
--      1. Le secret du réveil passe dans Supabase Vault : app_settings se lit sans compte (politique
--         app_settings_read, mig 520, qui n'exclut que cinq clés). Rangé là, missives_secret aurait été
--         lisible par tous. _reveiller_missives le lit dans vault.decrypted_secrets (nom 'missives_secret').
--      2. Une même adresse portée par deux fiches (5 cas en prod, à la casse près) ne reçoit la Missive
--         qu'une fois : missives_preparer garde une fiche par adresse.
--      Définitions live du 23/10 (mig 541), recopiées entières ; seul le delta change.
-- SCHEMA CHECKED (23/10/2026, live) : pg_policies app_settings_read = key <> ALL (resend_api_key,
--   vapid_private_key, email_trigger_secret, push_trigger_secret, shopify_access_token) ; extension
--   supabase_vault 0.3.1, vault.secrets vide ; pg_get_functiondef de missives_preparer et _reveiller_missives.

CREATE OR REPLACE FUNCTION public.missives_preparer()
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
    SELECT DISTINCT ON (lower(u.email_address)) v_missive.id, m.user_id
      FROM _liste_membres(v_missive.liste) m
      JOIN users u ON u.id = m.user_id
     WHERE u.accord_nouvelles
     ORDER BY lower(u.email_address), u.id
    ON CONFLICT DO NOTHING;
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
                                            OR (statut = 'programmee' AND programmee_le <= now())) THEN
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
