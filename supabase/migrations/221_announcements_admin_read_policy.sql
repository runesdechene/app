-- 221_announcements_admin_read_policy.sql
-- WHY : la table announcements n'avait qu'une policy SELECT (« public lit les
-- published »). Conséquence : un admin ne pouvait pas relire ses propres
-- BROUILLONS via .from('announcements').select() → le composer du Hub plantait
-- ("Cannot coerce the result to a single JSON object" = .single() sur 0 ligne)
-- juste après create_announcement. On ajoute une policy de lecture admin (les
-- policies permissives sont OR'd : published OU admin). Écritures toujours via
-- RPCs SECURITY DEFINER. Même pattern que home_banners (mig 160).

DROP POLICY IF EXISTS "announcements_admin_read_all" ON public.announcements;
CREATE POLICY "announcements_admin_read_all"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (public._is_admin());
