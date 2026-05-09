-- 142_push_trigger_on_notification.sql
-- WHY : Tout INSERT dans notifications → fire-and-forget POST vers Edge Function send-push.
-- L'Edge Function porte toute la logique (filtre catégorie, prefs user, format payload).
-- Le trigger reste minimal pour faciliter patch/test/debug.
-- Spec : docs/superpowers/specs/2026-05-09-push-notifications-design.md

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  -- Lecture des secrets via app_config (seedés dans la mig 143).
  -- Si manquants, on log un warning et on n'envoie rien (fail-open : l'INSERT
  -- dans notifications réussit toujours, le push est best-effort).
  SELECT value INTO v_url FROM public.app_config WHERE key = 'edge_function_send_push_url';
  SELECT value INTO v_key FROM public.app_config WHERE key = 'edge_function_service_key';

  IF v_url IS NULL OR v_key IS NULL OR v_url LIKE 'PLACEHOLDER%' OR v_key LIKE 'PLACEHOLDER%' THEN
    RAISE WARNING 'push trigger: edge_function config missing or placeholder, skipping push for notification %', NEW.id;
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type',  'application/json'
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
