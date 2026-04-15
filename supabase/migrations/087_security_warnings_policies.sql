-- ============================================
-- MIGRATION 087 : Security warnings — policies restrictions (W1/W2/W3)
-- ============================================
-- Phase 4 audit pré-lancement (2026-04-15) — suite de migration 086.
--
-- W1 : ad_screens / ad_tips — INSERT/UPDATE/DELETE par tout authenticated
--      → restreindre aux admins (role = 'admin')
-- W2 : community-photos — INSERT ouvert à tous sans restriction
--      → restreindre aux authenticated + extensions image uniquement
--      → bucket file_size_limit = 10 MB (cohérent avec MAX_FILE_SIZE frontend)
-- W3 : users — SELECT public permet énumération emails
--      → restreindre à authenticated (minimum viable, pas de column-level)
--
-- Non couvert ici (reporté) :
-- W4 : audit 50+ RPC SECURITY DEFINER sans auth.uid() — nécessite agent dédié
-- W5 : config dashboard Supabase (email audit) — manuel, pas SQL
-- W6 : rate-limiting RPC — gros chantier applicatif, post-lancement
-- ============================================

BEGIN;

-- ============================================
-- W1 : ad_screens / ad_tips — admin-only writes
-- ============================================
-- Les SELECT publics restent (affichage pub aux users).

-- ad_screens
DROP POLICY IF EXISTS "Authenticated can insert ad_screens" ON public.ad_screens;
DROP POLICY IF EXISTS "Authenticated can update ad_screens" ON public.ad_screens;
DROP POLICY IF EXISTS "Authenticated can delete ad_screens" ON public.ad_screens;
DROP POLICY IF EXISTS "Service role can manage ad_screens" ON public.ad_screens;
DROP POLICY IF EXISTS "Admins can manage ad_screens" ON public.ad_screens;

CREATE POLICY "Admins can manage ad_screens"
  ON public.ad_screens
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()::text AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()::text AND role = 'admin'
  ));

-- ad_tips
DROP POLICY IF EXISTS "Authenticated can insert ad_tips" ON public.ad_tips;
DROP POLICY IF EXISTS "Authenticated can update ad_tips" ON public.ad_tips;
DROP POLICY IF EXISTS "Authenticated can delete ad_tips" ON public.ad_tips;
DROP POLICY IF EXISTS "Service role can manage ad_tips" ON public.ad_tips;
DROP POLICY IF EXISTS "Admins can manage ad_tips" ON public.ad_tips;

CREATE POLICY "Admins can manage ad_tips"
  ON public.ad_tips
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()::text AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()::text AND role = 'admin'
  ));

-- ============================================
-- W2 : community-photos — restriction upload
-- ============================================
-- 1. Remplacer la policy INSERT anon/auth sans vérif par auth + extension image
DROP POLICY IF EXISTS "Anyone can upload community photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload community-photos" ON storage.objects;

CREATE POLICY "Authenticated can upload community-photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'community-photos'
    AND LOWER(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'heic', 'heif')
  );

-- 2. Limite de taille bucket : 10 MB (cohérent avec MAX_FILE_SIZE côté frontend)
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
WHERE id = 'community-photos';

-- ============================================
-- W3 : users — restreindre SELECT public à authenticated
-- ============================================
-- Ancienne policy "Public can lookup users by email" USING (true) :
-- ouverte à anon + authenticated, permet énumération complète.
-- On restreint à authenticated minimum. Column-level (masquage email
-- hors self) non supporté par Postgres directement → reporté si nécessaire.
DROP POLICY IF EXISTS "Public can lookup users by email" ON public.users;
DROP POLICY IF EXISTS "Authenticated can read users" ON public.users;

CREATE POLICY "Authenticated can read users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

COMMIT;

-- ============================================
-- SMOKE TESTS post-apply
-- ============================================
-- 1. Login comme user NON-admin dans le hub, tenter modif ad_screen
--    → doit échouer (policy violation)
-- 2. Login comme admin, même action → doit passer
-- 3. Upload photo communauté via soumission publique :
--    - PhotoSubmit.tsx (hub) : doit toujours fonctionner si user authentifié
--    - Anon tentant upload direct sur community-photos → rejeté
-- 4. Fichier .txt renommé en .jpg uploadé → devrait être rejeté par allowed_mime_types
-- 5. Anon tentant SELECT users → vide/refusé ; authenticated → OK
-- 6. App normale (login, carte, profil) → aucune régression attendue
