-- 141_push_subscriptions_table.sql
-- WHY : Système push notifications V1.
--   - push_subscriptions stocke les endpoints+keys par appareil/navigateur
--   - 2 colonnes users pour préférences "Important" / "Récap"
--   - Toutes les notifs partent de la table notifications (source unique de vérité).
-- Spec : docs/superpowers/specs/2026-05-09-push-notifications-design.md

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           serial PRIMARY KEY,
  user_id      text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint     text NOT NULL UNIQUE,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions(user_id);

-- RLS : un user voit/édite uniquement ses propres subs
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_push_subs" ON public.push_subscriptions;
CREATE POLICY "users_read_own_push_subs"
  ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = (auth.uid())::text);

DROP POLICY IF EXISTS "users_insert_own_push_subs" ON public.push_subscriptions;
CREATE POLICY "users_insert_own_push_subs"
  ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (auth.uid())::text);

DROP POLICY IF EXISTS "users_update_own_push_subs" ON public.push_subscriptions;
CREATE POLICY "users_update_own_push_subs"
  ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = (auth.uid())::text)
  WITH CHECK (user_id = (auth.uid())::text);

DROP POLICY IF EXISTS "users_delete_own_push_subs" ON public.push_subscriptions;
CREATE POLICY "users_delete_own_push_subs"
  ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = (auth.uid())::text);

-- Préférences : 2 toggles
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS push_important_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_recap_enabled     boolean NOT NULL DEFAULT true;

COMMENT ON TABLE public.push_subscriptions IS 'Web Push API subscriptions (1 row par appareil/navigateur).';
COMMENT ON COLUMN public.users.push_important_enabled IS 'Énigme du jour, message expé, lieu contesté.';
COMMENT ON COLUMN public.users.push_recap_enabled     IS 'Level-up imminent, récap hebdo nouveaux lieux.';
