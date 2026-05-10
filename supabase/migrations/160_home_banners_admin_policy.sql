-- 160_home_banners_admin_policy.sql
-- Bugfix de la 159 : ajout de la policy ALL admin oubliée.
--
-- Sans cette policy, RLS bloquait silencieusement les INSERT/UPDATE/DELETE
-- depuis le hub admin (le client utilise la clé anon avec session
-- authenticated, soumise aux policies). Calque le pattern d'ad_screens.

CREATE POLICY "home_banners admin manage" ON public.home_banners
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id::text = auth.uid()::text
        AND users.role::text = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id::text = auth.uid()::text
        AND users.role::text = 'admin'
    )
  );
