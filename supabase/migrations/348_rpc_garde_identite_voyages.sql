-- 348 — Garde d'identité sur les fonctions des Expéditions (voyages)
--
-- WHY : audit du 27/09/2026. Ces fonctions s'exécutent avec les droits de leur propriétaire
-- (SECURITY DEFINER), agissent pour le `p_user_id` FOURNI PAR L'APPELANT et ne vérifiaient
-- jamais que cet appelant est bien ce joueur : n'importe qui pouvait écrire, supprimer ou
-- publier au nom d'un autre. Le backlog les croyait « protégées par auth.uid() en interne ».
-- Chaque définition ci-dessous est la définition LIVE relevée le 27/09/2026, recopiée entière ;
-- seul ajout : la garde en tête du corps. Le front V1 envoie toujours son propre identifiant :
-- aucun effet pour un joueur honnête.

CREATE OR REPLACE FUNCTION public.cancel_voyage(p_user_id text, p_voyage_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_chief text;
  v_status text;
  v_name text;
  v_chief_name text;
BEGIN
  -- 348 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  SELECT chief_user_id, status, name INTO v_chief, v_status, v_name
    FROM public.voyages WHERE id = p_voyage_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_found');
  END IF;
  IF v_chief <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'not_chief');
  END IF;
  IF v_status NOT IN ('published','passed') THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_cancellable');
  END IF;

  UPDATE public.voyages
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE id = p_voyage_id;

  -- Notifs aux validés
  SELECT display_name INTO v_chief_name FROM public.users WHERE id = p_user_id;
  INSERT INTO public.notifications(recipient_id, type, data)
  SELECT p.user_id, 'expedition_cancelled',
         jsonb_build_object(
           'expeditionId', p_voyage_id,
           'expeditionName', v_name,
           'chiefName', COALESCE(v_chief_name, 'Le chef')
         )
  FROM public.voyage_participants p
  WHERE p.voyage_id = p_voyage_id AND p.status = 'validated';

  RETURN json_build_object('success', true, 'voyage_name', v_name);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_voyage(p_user_id text, p_name text, p_description text, p_rdv_at timestamp with time zone, p_rdv_lat double precision, p_rdv_lng double precision, p_rdv_label text, p_slots_max integer, p_slots_open boolean, p_validation_mode text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_active_count integer;
  v_id uuid;
BEGIN
  -- 348 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  IF p_rdv_at IS NOT NULL AND p_rdv_at <= now() THEN
    RETURN json_build_object('success', false, 'error', 'rdv_must_be_in_future');
  END IF;

  IF p_validation_mode NOT IN ('manual','free') THEN
    RETURN json_build_object('success', false, 'error', 'invalid_validation_mode');
  END IF;

  SELECT count(*) INTO v_active_count
  FROM public.voyages
  WHERE chief_user_id = p_user_id AND status = 'published';

  IF v_active_count >= 3 THEN
    RETURN json_build_object('success', false, 'error', 'max_active_voyages_reached');
  END IF;

  INSERT INTO public.voyages(
    chief_user_id, name, description, rdv_at, rdv_lat, rdv_lng, rdv_label,
    slots_max, slots_open, validation_mode
  ) VALUES (
    p_user_id, p_name, p_description, p_rdv_at, p_rdv_lat, p_rdv_lng, p_rdv_label,
    p_slots_max, p_slots_open, p_validation_mode
  ) RETURNING id INTO v_id;

  RETURN json_build_object('success', true, 'voyage_id', v_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_voyage_media(p_user_id text, p_media_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_media public.voyage_report_medias%ROWTYPE;
  v_chief text;
BEGIN
  -- 348 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.flag_voyage(p_user_id text, p_voyage_id uuid, p_reason text, p_comment text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- 348 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.mark_voyage_messages_read(p_user_id text, p_voyage_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- 348 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.voyage_message_reads(voyage_id, user_id, last_read_at)
  VALUES (p_voyage_id, p_user_id, now())
  ON CONFLICT (voyage_id, user_id) DO UPDATE SET last_read_at = now();
  RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_voyage_media(p_user_id text, p_voyage_id uuid, p_storage_path text, p_kind text, p_size_bytes integer, p_duration_seconds integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_voy public.voyages%ROWTYPE;
  v_authorized boolean;
  v_id uuid;
BEGIN
  -- 348 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.request_join_voyage(p_user_id text, p_voyage_id uuid, p_message text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_voy public.voyages%ROWTYPE;
  v_existing_status text;
  v_validated_count integer;
  v_target_status text;
  v_requester_name text;
BEGIN
  -- 348 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_voy FROM public.voyages WHERE id = p_voyage_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_found');
  END IF;
  IF v_voy.status <> 'published' THEN
    RETURN json_build_object('success', false, 'error', 'voyage_closed');
  END IF;
  IF v_voy.chief_user_id = p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'is_chief');
  END IF;
  IF p_message IS NOT NULL AND length(p_message) > 280 THEN
    RETURN json_build_object('success', false, 'error', 'message_too_long');
  END IF;

  SELECT status INTO v_existing_status FROM public.voyage_participants
    WHERE voyage_id = p_voyage_id AND user_id = p_user_id;
  IF v_existing_status IN ('pending','validated') THEN
    RETURN json_build_object('success', false, 'error', 'already_pending_or_validated');
  END IF;

  IF v_voy.validation_mode = 'free' THEN
    SELECT count(*) INTO v_validated_count FROM public.voyage_participants
      WHERE voyage_id = p_voyage_id AND status = 'validated';
    IF v_voy.slots_open = true OR (v_validated_count + 1 < COALESCE(v_voy.slots_max, 0)) THEN
      v_target_status := 'validated';
    ELSE
      v_target_status := 'pending';
    END IF;
  ELSE
    v_target_status := 'pending';
  END IF;

  INSERT INTO public.voyage_participants(voyage_id, user_id, status, request_message, validated_at)
  VALUES (p_voyage_id, p_user_id, v_target_status, p_message,
          CASE WHEN v_target_status = 'validated' THEN now() ELSE NULL END)
  ON CONFLICT (voyage_id, user_id) DO UPDATE SET
    status = EXCLUDED.status,
    request_message = EXCLUDED.request_message,
    joined_at = now(),
    validated_at = EXCLUDED.validated_at;

  -- Notif au chef
  SELECT display_name INTO v_requester_name FROM public.users WHERE id = p_user_id;
  INSERT INTO public.notifications(recipient_id, type, data)
  VALUES (
    v_voy.chief_user_id,
    CASE WHEN v_target_status = 'validated' THEN 'expedition_auto_joined' ELSE 'expedition_join_request' END,
    jsonb_build_object(
      'expeditionId', v_voy.id,
      'expeditionName', v_voy.name,
      'requesterUserId', p_user_id,
      'requesterName', COALESCE(v_requester_name, 'Un voyageur'),
      'message', p_message
    )
  );

  -- Si auto-validé, notif au demandeur aussi
  IF v_target_status = 'validated' THEN
    INSERT INTO public.notifications(recipient_id, type, data)
    VALUES (
      p_user_id,
      'expedition_validated',
      jsonb_build_object(
        'expeditionId', v_voy.id,
        'expeditionName', v_voy.name,
        'autoValidated', true
      )
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'status', v_target_status,
    'chief_user_id', v_voy.chief_user_id,
    'voyage_name', v_voy.name
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_voyage_message(p_user_id text, p_voyage_id uuid, p_content text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_voy public.voyages%ROWTYPE;
  v_authorized boolean;
  v_id bigint;
  v_author_name text;
BEGIN
  -- 348 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  IF length(coalesce(p_content,'')) NOT BETWEEN 1 AND 500 THEN
    RETURN json_build_object('success', false, 'error', 'invalid_content_length');
  END IF;

  SELECT * INTO v_voy FROM public.voyages WHERE id = p_voyage_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_found');
  END IF;
  IF v_voy.status NOT IN ('published','passed') THEN
    RETURN json_build_object('success', false, 'error', 'chat_closed');
  END IF;

  v_authorized := v_voy.chief_user_id = p_user_id OR EXISTS (
    SELECT 1 FROM public.voyage_participants
    WHERE voyage_id = p_voyage_id AND user_id = p_user_id AND status = 'validated'
  );
  IF NOT v_authorized THEN
    RETURN json_build_object('success', false, 'error', 'not_authorized');
  END IF;

  INSERT INTO public.voyage_messages(voyage_id, user_id, content)
  VALUES (p_voyage_id, p_user_id, p_content)
  RETURNING id INTO v_id;

  -- Notification aux autres membres (chef + validés, sauf l'auteur)
  SELECT display_name INTO v_author_name FROM public.users WHERE id = p_user_id;
  INSERT INTO public.notifications(recipient_id, type, data)
  SELECT
    target_id,
    'expedition_message',
    jsonb_build_object(
      'expeditionId', v_voy.id,
      'expeditionName', v_voy.name,
      'authorUserId', p_user_id,
      'authorName', COALESCE(v_author_name, 'Un compagnon'),
      'preview', left(p_content, 80)
    )
  FROM (
    SELECT user_id AS target_id FROM public.voyage_participants
      WHERE voyage_id = p_voyage_id AND status = 'validated' AND user_id <> p_user_id
    UNION
    SELECT v_voy.chief_user_id WHERE v_voy.chief_user_id <> p_user_id
  ) targets;

  RETURN json_build_object('success', true, 'message_id', v_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_voyage_cover_image(p_user_id text, p_voyage_id uuid, p_storage_path text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_chief text;
BEGIN
  -- 348 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  SELECT chief_user_id INTO v_chief FROM public.voyages WHERE id = p_voyage_id;
  IF NOT FOUND OR v_chief <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'not_chief_or_not_found');
  END IF;

  UPDATE public.voyages
    SET cover_image_url = p_storage_path, updated_at = now()
    WHERE id = p_voyage_id;

  RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_voyage(p_user_id text, p_voyage_id uuid, p_name text, p_description text, p_rdv_at timestamp with time zone, p_rdv_lat double precision, p_rdv_lng double precision, p_rdv_label text, p_slots_max integer, p_slots_open boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_voy public.voyages%ROWTYPE;
  v_changed_fields text[] := ARRAY[]::text[];
  v_validated_count integer;
BEGIN
  -- 348 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_voy FROM public.voyages WHERE id = p_voyage_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_found');
  END IF;
  IF v_voy.chief_user_id <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'not_chief');
  END IF;
  IF v_voy.status <> 'published' THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_editable');
  END IF;

  -- rdv_at nullable : on accepte NULL. Si fourni, doit être futur.
  IF p_rdv_at IS NOT NULL AND p_rdv_at <= now() THEN
    RETURN json_build_object('success', false, 'error', 'rdv_must_be_in_future');
  END IF;

  IF v_voy.rdv_at IS DISTINCT FROM p_rdv_at THEN
    v_changed_fields := array_append(v_changed_fields, 'rdv_at');
  END IF;
  IF v_voy.rdv_lat IS DISTINCT FROM p_rdv_lat OR v_voy.rdv_lng IS DISTINCT FROM p_rdv_lng THEN
    v_changed_fields := array_append(v_changed_fields, 'location');
  END IF;
  IF (v_voy.slots_max IS DISTINCT FROM p_slots_max) OR (v_voy.slots_open IS DISTINCT FROM p_slots_open) THEN
    SELECT count(*) INTO v_validated_count FROM public.voyage_participants
      WHERE voyage_id = p_voyage_id AND status = 'validated';
    IF p_slots_open = false AND p_slots_max IS NOT NULL AND p_slots_max < (v_validated_count + 1) THEN
      RETURN json_build_object('success', false, 'error', 'slots_below_validated_count');
    END IF;
    v_changed_fields := array_append(v_changed_fields, 'slots');
  END IF;

  UPDATE public.voyages SET
    name = p_name, description = p_description,
    rdv_at = p_rdv_at, rdv_lat = p_rdv_lat, rdv_lng = p_rdv_lng, rdv_label = p_rdv_label,
    slots_max = p_slots_max, slots_open = p_slots_open,
    updated_at = now()
  WHERE id = p_voyage_id;

  -- Notif aux validés si un champ sensible a changé
  IF array_length(v_changed_fields, 1) > 0 THEN
    INSERT INTO public.notifications(recipient_id, type, data)
    SELECT p.user_id, 'expedition_modified',
           jsonb_build_object(
             'expeditionId', v_voy.id,
             'expeditionName', p_name,
             'changedFields', v_changed_fields
           )
    FROM public.voyage_participants p
    WHERE p.voyage_id = p_voyage_id AND p.status = 'validated';
  END IF;

  RETURN json_build_object('success', true, 'changed_fields', v_changed_fields);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_voyage_call(p_user_id text, p_voyage_id uuid, p_call_text text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_voy public.voyages%ROWTYPE;
  v_authorized boolean;
BEGIN
  -- 348 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  IF p_call_text IS NOT NULL AND length(p_call_text) > 200 THEN
    RETURN json_build_object('success', false, 'error', 'call_too_long');
  END IF;

  SELECT * INTO v_voy FROM public.voyages WHERE id = p_voyage_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_found');
  END IF;
  IF v_voy.status NOT IN ('published','passed') THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_editable');
  END IF;

  v_authorized := v_voy.chief_user_id = p_user_id OR EXISTS (
    SELECT 1 FROM public.voyage_participants
    WHERE voyage_id = p_voyage_id AND user_id = p_user_id AND status = 'validated'
  );
  IF NOT v_authorized THEN
    RETURN json_build_object('success', false, 'error', 'not_authorized');
  END IF;

  UPDATE public.voyages
    SET call_text = p_call_text,
        call_author_id = p_user_id,
        call_updated_at = now(),
        updated_at = now()
    WHERE id = p_voyage_id;

  RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_voyage_name(p_user_id text, p_voyage_id uuid, p_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_voy public.voyages%ROWTYPE;
  v_authorized boolean;
  v_name text := btrim(coalesce(p_name, ''));
BEGIN
  -- 348 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  IF length(v_name) < 3 THEN
    RETURN json_build_object('success', false, 'error', 'name_too_short');
  END IF;
  IF length(v_name) > 80 THEN
    RETURN json_build_object('success', false, 'error', 'name_too_long');
  END IF;

  SELECT * INTO v_voy FROM public.voyages WHERE id = p_voyage_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_found');
  END IF;
  IF v_voy.status NOT IN ('published','passed') THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_editable');
  END IF;

  v_authorized := v_voy.chief_user_id = p_user_id OR EXISTS (
    SELECT 1 FROM public.voyage_participants
    WHERE voyage_id = p_voyage_id AND user_id = p_user_id AND status = 'validated'
  );
  IF NOT v_authorized THEN
    RETURN json_build_object('success', false, 'error', 'not_authorized');
  END IF;

  UPDATE public.voyages
    SET name = v_name,
        updated_at = now()
    WHERE id = p_voyage_id;

  RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_voyage_report(p_user_id text, p_voyage_id uuid, p_text_content text, p_is_public boolean, p_cover_media_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_voy public.voyages%ROWTYPE;
  v_authorized boolean;
  v_existed boolean;
  v_author_name text;
BEGIN
  -- 348 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
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

  -- Notif aux autres validés (uniquement au premier post)
  IF NOT COALESCE(v_existed, false) THEN
    SELECT display_name INTO v_author_name FROM public.users WHERE id = p_user_id;
    INSERT INTO public.notifications(recipient_id, type, data)
    SELECT
      CASE WHEN p.user_id IS NOT NULL THEN p.user_id ELSE v_voy.chief_user_id END,
      'expedition_report_posted',
      jsonb_build_object(
        'expeditionId', v_voy.id,
        'expeditionName', v_voy.name,
        'authorName', COALESCE(v_author_name, 'Un compagnon'),
        'isPublic', p_is_public
      )
    FROM (
      SELECT user_id FROM public.voyage_participants
        WHERE voyage_id = p_voyage_id AND status = 'validated' AND user_id <> p_user_id
      UNION
      SELECT v_voy.chief_user_id WHERE v_voy.chief_user_id <> p_user_id
    ) p;
  END IF;

  RETURN json_build_object('success', true, 'first_post', NOT COALESCE(v_existed, false));
END;
$function$;

CREATE OR REPLACE FUNCTION public.withdraw_from_voyage(p_user_id text, p_voyage_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_status text;
BEGIN
  -- 348 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  SELECT status INTO v_status FROM public.voyages WHERE id = p_voyage_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_found');
  END IF;
  IF v_status <> 'published' THEN
    RETURN json_build_object('success', false, 'error', 'voyage_closed');
  END IF;

  UPDATE public.voyage_participants
    SET status = 'withdrawn'
    WHERE voyage_id = p_voyage_id
      AND user_id = p_user_id
      AND status IN ('pending','validated');
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'not_a_participant');
  END IF;
  RETURN json_build_object('success', true);
END;
$function$;
