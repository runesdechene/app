-- 108_v07_expeditions_moderation_storage.sql
-- WHY : (1) Modération des voyages — flag (public) + admin_delete (Hub).
--       (2) Bucket Storage 'voyage-medias' + RLS policies.
--
-- Le bucket est créé via INSERT dans storage.buckets (équivalent à passer
-- par le dashboard). Les policies RLS sur storage.objects autorisent :
-- - INSERT : chef ou participant validé du voyage (path = <voyage_id>/<user_id>/...)
-- - SELECT : chef + validés OU média marqué public (cover de report public)
-- - DELETE : auteur du média ou chef
--
-- Convention de path : `<voyage_id>/<user_id>/<filename>`

-- ============================================================
-- flag_voyage (signalement public)
-- ============================================================
CREATE OR REPLACE FUNCTION public.flag_voyage(
  p_user_id text,
  p_voyage_id uuid,
  p_reason text,
  p_comment text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF p_reason NOT IN ('spam','inappropriate','other') THEN
    RETURN json_build_object('success', false, 'error', 'invalid_reason');
  END IF;
  IF p_comment IS NOT NULL AND length(p_comment) > 500 THEN
    RETURN json_build_object('success', false, 'error', 'comment_too_long');
  END IF;
  INSERT INTO public.voyage_flags(voyage_id, reporter_user_id, reason, comment)
  VALUES (p_voyage_id, p_user_id, p_reason, p_comment);
  RETURN json_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.flag_voyage(text,uuid,text,text) TO authenticated;

-- ============================================================
-- _is_voyage_admin — helper protégé via GUC app.voyage_admin_user_ids
-- À configurer côté Supabase :
-- ALTER DATABASE postgres SET app.voyage_admin_user_ids = '<uriel_id>,<matheo_id>';
-- (les deux IDs séparés par virgule, sans espaces)
-- ============================================================
CREATE OR REPLACE FUNCTION public._is_voyage_admin(p_user_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p_user_id = ANY(string_to_array(
    coalesce(current_setting('app.voyage_admin_user_ids', true), ''), ','
  ));
$$;
GRANT EXECUTE ON FUNCTION public._is_voyage_admin(text) TO authenticated;

-- ============================================================
-- admin_delete_voyage (Hub — suppression d'urgence par admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_delete_voyage(
  p_admin_user_id text,
  p_voyage_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT public._is_voyage_admin(p_admin_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'not_admin');
  END IF;
  DELETE FROM public.voyages WHERE id = p_voyage_id;
  RETURN json_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_delete_voyage(text,uuid) TO authenticated;

-- ============================================================
-- BUCKET STORAGE : voyage-medias (création via INSERT dans storage.buckets)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voyage-medias',
  'voyage-medias',
  false,
  52428800, -- 50 MB
  ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- RLS POLICIES sur storage.objects pour le bucket voyage-medias
-- ============================================================

-- Cleanup d'éventuelles policies existantes du même nom (pour idempotence)
DROP POLICY IF EXISTS "voyage_medias_insert" ON storage.objects;
DROP POLICY IF EXISTS "voyage_medias_select" ON storage.objects;
DROP POLICY IF EXISTS "voyage_medias_delete" ON storage.objects;

-- INSERT : auth + (chef OR participant validé du voyage visé)
CREATE POLICY "voyage_medias_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voyage-medias'
  AND (
    EXISTS (
      SELECT 1 FROM public.voyages v
      WHERE v.id::text = split_part(name, '/', 1)
        AND v.chief_user_id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM public.voyage_participants p
      WHERE p.voyage_id::text = split_part(name, '/', 1)
        AND p.user_id = auth.uid()::text
        AND p.status = 'validated'
    )
  )
);

-- SELECT : chef + validés OU média rendu public via cover_media_id d'un report public
CREATE POLICY "voyage_medias_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'voyage-medias'
  AND (
    EXISTS (
      SELECT 1 FROM public.voyages v
      WHERE v.id::text = split_part(name, '/', 1)
        AND v.chief_user_id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM public.voyage_participants p
      WHERE p.voyage_id::text = split_part(name, '/', 1)
        AND p.user_id = auth.uid()::text
        AND p.status = 'validated'
    )
    OR EXISTS (
      SELECT 1
      FROM public.voyage_report_medias m
      JOIN public.voyage_reports r
        ON r.voyage_id = m.voyage_id AND r.user_id = m.user_id
      WHERE m.storage_path = name
        AND r.is_public = true
        AND r.cover_media_id = m.id
    )
  )
);

-- DELETE : auteur du média (path 2e segment) ou chef
CREATE POLICY "voyage_medias_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'voyage-medias'
  AND (
    split_part(name, '/', 2) = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.voyages v
      WHERE v.id::text = split_part(name, '/', 1)
        AND v.chief_user_id = auth.uid()::text
    )
  )
);
