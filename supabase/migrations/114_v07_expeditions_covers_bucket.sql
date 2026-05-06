-- 114_v07_expeditions_covers_bucket.sql
-- WHY : les covers d'expéditions doivent être visibles publiquement
-- (la carte est ouverte à tous, anon inclus). Le bucket voyage-medias
-- est privé (pour protéger les comptes rendus privés) — on crée donc
-- un bucket dédié 'voyage-covers' public.
--
-- Cleanup au passage : retire la policy SELECT publique sur voyage-medias
-- qui devient inutile (cf. mig 113 qui l'avait posée).

DROP POLICY IF EXISTS "voyage_medias_cover_public_select" ON storage.objects;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voyage-covers',
  'voyage-covers',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- RLS sur voyage-covers
-- INSERT : chef de l'expé (path = <voyage_id>/...)
-- SELECT : public (le bucket est public, mais on est explicite)
-- DELETE : chef de l'expé
-- ============================================================
DROP POLICY IF EXISTS "voyage_covers_insert" ON storage.objects;
DROP POLICY IF EXISTS "voyage_covers_delete" ON storage.objects;

CREATE POLICY "voyage_covers_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voyage-covers'
  AND EXISTS (
    SELECT 1 FROM public.voyages v
    WHERE v.id::text = split_part(name, '/', 1)
      AND v.chief_user_id = auth.uid()::text
  )
);

CREATE POLICY "voyage_covers_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'voyage-covers'
  AND EXISTS (
    SELECT 1 FROM public.voyages v
    WHERE v.id::text = split_part(name, '/', 1)
      AND v.chief_user_id = auth.uid()::text
  )
);
