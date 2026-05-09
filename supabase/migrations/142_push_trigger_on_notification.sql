-- 142_push_trigger_on_notification.sql
-- WHY : Tout INSERT dans notifications → fire-and-forget POST vers Edge Function send-push.
-- L'Edge Function porte toute la logique (filtre catégorie, prefs user, format payload).
-- Le trigger reste minimal pour faciliter patch/test/debug.
-- Auth : header X-Push-Secret partagé (lu depuis app_settings). L'Edge Function tourne
-- en verify_jwt=false (le MCP Supabase n'expose pas de Supabase secrets ; tout en DB).
-- Note : pg_net est déjà installé (extension activée). Ses fonctions sont exposées
-- dans le schema 'net', pas 'extensions'.
-- Spec : docs/superpowers/specs/2026-05-09-push-notifications-design.md

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  SELECT value INTO v_url    FROM public.app_settings WHERE key = 'edge_function_send_push_url';
  SELECT value INTO v_secret FROM public.app_settings WHERE key = 'push_trigger_secret';

  IF v_url IS NULL OR v_secret IS NULL OR v_url LIKE 'PLACEHOLDER%' OR v_secret LIKE 'PLACEHOLDER%' THEN
    RAISE WARNING 'push trigger: edge_function config missing or placeholder, skipping push for notification %', NEW.id;
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'X-Push-Secret',  v_secret
    ),
    body    := jsonb_build_object(
      'notification_id', NEW.id,
      'recipient_id',    NEW.recipient_id,
      'type',            NEW.type,
      'data',            NEW.data
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_on_notification ON public.notifications;
CREATE TRIGGER push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_notification();
