-- 222_announcement_covers_bucket.sql
-- WHY : l'image de couverture d'une annonce doit s'uploader (pas se coller en URL).
-- Bucket public dédié 'announcement-covers' (lecture publique pour le lecteur
-- in-app + le miroir blog) ; INSERT/DELETE réservés aux admins (_is_admin).
-- Template : voyage-covers (mig 114) + helper _is_admin (mig 219).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'announcement-covers',
  'announcement-covers',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "announcement_covers_insert" ON storage.objects;
DROP POLICY IF EXISTS "announcement_covers_delete" ON storage.objects;

CREATE POLICY "announcement_covers_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'announcement-covers' AND public._is_admin());

CREATE POLICY "announcement_covers_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'announcement-covers' AND public._is_admin());
