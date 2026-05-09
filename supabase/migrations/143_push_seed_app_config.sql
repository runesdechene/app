-- 143_push_seed_app_config.sql
-- WHY : seed les 2 valeurs lues par trigger_push_on_notification (mig 142) :
--   - edge_function_send_push_url : URL publique de la Edge Function send-push
--   - edge_function_service_key   : SERVICE_ROLE_KEY pour autoriser le call
--
-- Ces valeurs DOIVENT être remplacées en prod via SQL Editor avec les vraies
-- valeurs. La migration insère des placeholders pour ne pas péter le trigger
-- en prod si la mig est appliquée avant la mise à jour manuelle.
-- Le trigger (mig 142) détecte les placeholders et skip silencieusement.

INSERT INTO public.app_config (key, value)
VALUES
  ('edge_function_send_push_url', 'PLACEHOLDER_REPLACE_IN_PROD'),
  ('edge_function_service_key',   'PLACEHOLDER_REPLACE_IN_PROD')
ON CONFLICT (key) DO NOTHING;

-- Note opérateur :
-- En prod, après deploy de l'Edge Function send-push, exécuter dans SQL Editor :
--   UPDATE public.app_config SET value = 'https://<project-ref>.supabase.co/functions/v1/send-push'
--    WHERE key = 'edge_function_send_push_url';
--   UPDATE public.app_config SET value = '<SERVICE_ROLE_KEY>'
--    WHERE key = 'edge_function_service_key';
--
-- Project ref RdC : ukpapqssgsxirsgmcvof
