-- WHY: app_settings_read laissait lire toute la table à anon et authenticated (USING true), et la table
--      range aussi des secrets : resend_api_key, vapid_private_key, email_trigger_secret,
--      push_trigger_secret, shopify_access_token (relevé du 14/10/2026). N'importe qui, avec la clé
--      publique de l'appli, pouvait les lire. Leurs seuls lecteurs sont le serveur : les fonctions
--      send-email et send-push et les fonctions Netlify (clé service_role), les déclencheurs
--      trigger_email_on_notification et trigger_push_on_notification (SECURITY DEFINER). Aucun écran
--      ne les lit. La lecture publique garde tous les autres réglages ; l'équipe garde tout par
--      app_settings_admin_write (FOR ALL). Réversible : recréer la politique avec USING (true).
-- SCHEMA CHECKED (14/10/2026, live, pg_policies) : app_settings_read FOR SELECT TO anon, authenticated
--   USING (true) ; app_settings_admin_write FOR ALL TO authenticated (admin). Les cinq clés : migrations
--   001 (shopify_access_token), 143 (vapid_private_key, push_trigger_secret), 175 (resend_api_key,
--   email_trigger_secret).

DROP POLICY "app_settings_read" ON public.app_settings;

CREATE POLICY "app_settings_read" ON public.app_settings
  FOR SELECT TO anon, authenticated
  USING (key NOT IN (
    'resend_api_key',
    'vapid_private_key',
    'email_trigger_secret',
    'push_trigger_secret',
    'shopify_access_token'
  ));
