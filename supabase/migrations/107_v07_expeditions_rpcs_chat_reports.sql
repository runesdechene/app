-- 107_v07_expeditions_rpcs_chat_reports.sql
-- WHY : RPCs messagerie (chat privé) et comptes rendus (texte + médias)
-- des voyages. Le chat est réservé aux validés + chef. Les comptes rendus
-- ne peuvent être posés qu'après que la date du RDV soit passée.
--
-- Le +10 XP au premier compte rendu est porté par le trigger
-- _trg_xp_voyage_report_insert (mig 104).

-- ============================================================
-- send_voyage_message
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_voyage_message(
  p_user_id text,
  p_voyage_id uuid,
  p_content text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_status text;
  v_authorized boolean;
  v_id bigint;
BEGIN
  IF coalesce(length(p_content),0) NOT BETWEEN 1 AND 500 THEN
    RETURN json_build_object('success', false, 'error', 'invalid_content_length');
  END IF;

  SELECT status INTO v_status FROM public.voyages WHERE id = p_voyage_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_found');
  END IF;
  IF v_status NOT IN ('published','passed') THEN
    RETURN json_build_object('success', false, 'error', 'chat_closed');
  END IF;

  v_authorized := EXISTS (
    SELECT 1 FROM public.voyages WHERE id = p_voyage_id AND chief_user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.voyage_participants
    WHERE voyage_id = p_voyage_id AND user_id = p_user_id AND status = 'validated'
  );
  IF NOT v_authorized THEN
    RETURN json_build_object('success', false, 'error', 'not_authorized');
  END IF;

  INSERT INTO public.voyage_messages(voyage_id, user_id, content)
  VALUES (p_voyage_id, p_user_id, p_content)
  RETURNING id INTO v_id;

  RETURN json_build_object('success', true, 'message_id', v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.send_voyage_message(text,uuid,text) TO authenticated;

-- ============================================================
-- mark_voyage_messages_read
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_voyage_messages_read(
  p_user_id text,
  p_voyage_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.voyage_message_reads(voyage_id, user_id, last_read_at)
  VALUES (p_voyage_id, p_user_id, now())
  ON CONFLICT (voyage_id, user_id) DO UPDATE SET last_read_at = now();
  RETURN json_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_voyage_messages_read(text,uuid) TO authenticated;

-- ============================================================
-- upsert_voyage_report (compte rendu — 1 par participant après date passée)
-- ============================================================
CREATE OR REPLACE FUNCTION public.upsert_voyage_report(
  p_user_id text,
  p_voyage_id uuid,
  p_text_content text,
  p_is_public boolean,
  p_cover_media_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_voy public.voyages%ROWTYPE;
  v_authorized boolean;
  v_existed boolean;
BEGIN
  IF coalesce(length(p_text_content),0) > 1000 THEN
    RETURN json_build_object('success', false, 'error', 'text_too_long');
  END IF;

  SELECT * INTO v_voy FROM public.voyages WHERE id = p_voyage_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_found');
  END IF;
  IF v_voy.status NOT IN ('passed','archived') THEN
    RETURN json_build_object('success', false, 'error', 'reports_not_open_yet');
  END IF;

  v_authorized := v_voy.chief_user_id = p_user_id OR EXISTS (
    SELECT 1 FROM public.voyage_participants
    WHERE voyage_id = p_voyage_id AND user_id = p_user_id AND status = 'validated'
  );
  IF NOT v_authorized THEN
    RETURN json_build_object('success', false, 'error', 'not_authorized');
  END IF;

  SELECT TRUE INTO v_existed FROM public.voyage_reports
    WHERE voyage_id = p_voyage_id AND user_id = p_user_id;

  INSERT INTO public.voyage_reports(
    voyage_id, user_id, text_content, is_public, cover_media_id, updated_at
  ) VALUES (
    p_voyage_id, p_user_id, p_text_content, p_is_public, p_cover_media_id, now()
  )
  ON CONFLICT (voyage_id, user_id) DO UPDATE SET
    text_content = EXCLUDED.text_content,
    is_public = EXCLUDED.is_public,
    cover_media_id = EXCLUDED.cover_media_id,
    updated_at = now();

  RETURN json_build_object('success', true, 'first_post', NOT COALESCE(v_existed, false));
END;
$$;
GRANT EXECUTE ON FUNCTION public.upsert_voyage_report(text,uuid,text,boolean,uuid) TO authenticated;

-- ============================================================
-- register_voyage_media (lie un blob uploadé au compte rendu)
-- Le client uploade vers Storage 'voyage-medias' puis appelle cette RPC.
-- Si pas de report préexistant, on crée un skeleton (text_content NULL).
-- ============================================================
CREATE OR REPLACE FUNCTION public.register_voyage_media(
  p_user_id text,
  p_voyage_id uuid,
  p_storage_path text,
  p_kind text,
  p_size_bytes integer,
  p_duration_seconds integer
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_voy public.voyages%ROWTYPE;
  v_authorized boolean;
  v_id uuid;
BEGIN
  IF p_kind NOT IN ('photo','video') THEN
    RETURN json_build_object('success', false, 'error', 'invalid_kind');
  END IF;
  IF p_kind = 'video' AND coalesce(p_duration_seconds,0) > 30 THEN
    RETURN json_build_object('success', false, 'error', 'video_too_long');
  END IF;

  SELECT * INTO v_voy FROM public.voyages WHERE id = p_voyage_id;
  IF NOT FOUND OR v_voy.status NOT IN ('passed','archived') THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_open_for_media');
  END IF;

  v_authorized := v_voy.chief_user_id = p_user_id OR EXISTS (
    SELECT 1 FROM public.voyage_participants
    WHERE voyage_id = p_voyage_id AND user_id = p_user_id AND status = 'validated'
  );
  IF NOT v_authorized THEN
    RETURN json_build_object('success', false, 'error', 'not_authorized');
  END IF;

  -- Auto-create report skeleton si nécessaire (pour satisfaire la FK composite)
  INSERT INTO public.voyage_reports(voyage_id, user_id, text_content, is_public)
    VALUES (p_voyage_id, p_user_id, NULL, false)
    ON CONFLICT (voyage_id, user_id) DO NOTHING;

  INSERT INTO public.voyage_report_medias(
    voyage_id, user_id, storage_path, kind, size_bytes, duration_seconds
  ) VALUES (
    p_voyage_id, p_user_id, p_storage_path, p_kind, p_size_bytes, p_duration_seconds
  ) RETURNING id INTO v_id;

  RETURN json_build_object('success', true, 'media_id', v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.register_voyage_media(text,uuid,text,text,integer,integer) TO authenticated;

-- ============================================================
-- delete_voyage_media
-- Retourne le storage_path pour que le client purge le blob côté Storage.
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_voyage_media(
  p_user_id text,
  p_media_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_media public.voyage_report_medias%ROWTYPE;
  v_chief text;
BEGIN
  SELECT * INTO v_media FROM public.voyage_report_medias WHERE id = p_media_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'media_not_found');
  END IF;
  SELECT chief_user_id INTO v_chief FROM public.voyages WHERE id = v_media.voyage_id;
  IF v_media.user_id <> p_user_id AND v_chief <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'not_authorized');
  END IF;

  -- Cleanup éventuel cover_media_id
  UPDATE public.voyage_reports SET cover_media_id = NULL
    WHERE voyage_id = v_media.voyage_id
      AND user_id = v_media.user_id
      AND cover_media_id = p_media_id;

  DELETE FROM public.voyage_report_medias WHERE id = p_media_id;
  RETURN json_build_object('success', true, 'storage_path', v_media.storage_path);
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_voyage_media(text,uuid) TO authenticated;
