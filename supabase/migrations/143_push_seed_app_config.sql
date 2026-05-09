-- 143_push_seed_app_settings.sql
-- WHY : seed les valeurs lues par trigger_push_on_notification (mig 142) et par
-- l'Edge Function send-push.
--   - edge_function_send_push_url : URL publique de l'Edge Function (UPDATE post-deploy)
--   - push_trigger_secret         : secret partagé trigger ↔ Edge Function (X-Push-Secret)
--   - vapid_public_key            : clé publique VAPID (aussi exposée au front)
--   - vapid_private_key           : clé privée VAPID (DB-only — pas dans le repo)
--   - vapid_subject               : mailto: requis par la spec Web Push
--
-- Les valeurs sensibles sont écrites en placeholder dans cette migration (donc
-- pas de secret dans le repo). Elles sont remplies en production via UPDATE
-- depuis SQL Editor (ou via le MCP Supabase).
-- Le trigger (mig 142) détecte les placeholders et skip silencieusement.

INSERT INTO public.app_settings (key, value)
VALUES
  ('edge_function_send_push_url', 'PLACEHOLDER_REPLACE_IN_PROD'),
  ('push_trigger_secret',         'PLACEHOLDER_REPLACE_IN_PROD'),
  ('vapid_public_key',            'PLACEHOLDER_REPLACE_IN_PROD'),
  ('vapid_private_key',           'PLACEHOLDER_REPLACE_IN_PROD'),
  ('vapid_subject',               'mailto:contact@runesdechene.com')
ON CONFLICT (key) DO NOTHING;

-- Note opérateur :
-- En prod, après deploy de l'Edge Function send-push :
--   UPDATE public.app_config SET value = 'https://<project-ref>.supabase.co/functions/v1/send-push'
--    WHERE key = 'edge_function_send_push_url';
--   UPDATE public.app_config SET value = '<random_secret_base64url_32B>'
--    WHERE key = 'push_trigger_secret';
--   UPDATE public.app_config SET value = '<vapid_public>'  WHERE key = 'vapid_public_key';
--   UPDATE public.app_config SET value = '<vapid_private>' WHERE key = 'vapid_private_key';
