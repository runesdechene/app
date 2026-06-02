-- 194_missions_admin_rls.sql
-- Gestion des Missions depuis le Hub : RLS sur public.missions (pattern home_banners mig 160).
-- - Lecture publique des missions non-draft (la carte d'entrée joueur lit en direct).
-- - Écriture réservée aux admins (role='admin'). Les lectures joueur "riches"
--   passent par get_defis_board / get_mission_state (SECURITY DEFINER, bypass RLS).

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- Privilèges table (RLS filtre ensuite les lignes)
GRANT INSERT, UPDATE, DELETE ON public.missions TO authenticated;

-- Lecture publique : tout sauf les brouillons
DROP POLICY IF EXISTS "missions public read" ON public.missions;
CREATE POLICY "missions public read" ON public.missions
  FOR SELECT TO authenticated, anon
  USING (status <> 'draft');

-- Gestion admin (lecture incluse des brouillons + écritures)
DROP POLICY IF EXISTS "missions admin manage" ON public.missions;
CREATE POLICY "missions admin manage" ON public.missions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND users.role::text = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND users.role::text = 'admin'));
