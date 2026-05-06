-- 110_v07_expeditions_notifications.sql
-- WHY : ajoute les INSERT INTO public.notifications dans les RPCs voyages
-- pour déclencher les toasts personnels (request, validated/rejected,
-- modified, cancelled, report posted).
--
-- CREATE OR REPLACE des RPCs des migs 105/106/107 avec ajout des notifs.
-- Convention type : "expedition_*" côté front (alignée NotificationPanel.tsx)
-- pour conserver la sémantique UI "Expédition" (cf. docs/db/tech-debt.md D1).

-- ============================================================
-- request_join_voyage (avec notif au chef)
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_join_voyage(
  p_user_id text,
  p_voyage_id uuid,
  p_message text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_voy public.voyages%ROWTYPE;
  v_existing_status text;
  v_validated_count integer;
  v_target_status text;
  v_requester_name text;
BEGIN
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
$$;

-- ============================================================
-- respond_voyage_join_request (avec notif au demandeur)
-- ============================================================
CREATE OR REPLACE FUNCTION public.respond_voyage_join_request(
  p_chief_user_id text,
  p_voyage_id uuid,
  p_target_user_id text,
  p_decision text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_voy public.voyages%ROWTYPE;
  v_validated_count integer;
  v_chief_name text;
BEGIN
  IF p_decision NOT IN ('accept','reject') THEN
    RETURN json_build_object('success', false, 'error', 'invalid_decision');
  END IF;

  SELECT * INTO v_voy FROM public.voyages WHERE id = p_voyage_id;
  IF NOT FOUND OR v_voy.chief_user_id <> p_chief_user_id THEN
    RETURN json_build_object('success', false, 'error', 'not_chief_or_not_found');
  END IF;
  IF v_voy.status NOT IN ('published','passed') THEN
    RETURN json_build_object('success', false, 'error', 'voyage_closed');
  END IF;

  IF p_decision = 'accept' THEN
    SELECT count(*) INTO v_validated_count FROM public.voyage_participants
      WHERE voyage_id = p_voyage_id AND status = 'validated';
    IF v_voy.slots_open = false AND v_validated_count + 1 >= COALESCE(v_voy.slots_max, 0) THEN
      RETURN json_build_object('success', false, 'error', 'slots_full');
    END IF;

    UPDATE public.voyage_participants
      SET status = 'validated', validated_at = now()
      WHERE voyage_id = p_voyage_id AND user_id = p_target_user_id AND status = 'pending';
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'no_pending_request');
    END IF;
  ELSE
    UPDATE public.voyage_participants
      SET status = 'rejected'
      WHERE voyage_id = p_voyage_id AND user_id = p_target_user_id AND status = 'pending';
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'no_pending_request');
    END IF;
  END IF;

  -- Notif au demandeur
  SELECT display_name INTO v_chief_name FROM public.users WHERE id = p_chief_user_id;
  INSERT INTO public.notifications(recipient_id, type, data)
  VALUES (
    p_target_user_id,
    CASE WHEN p_decision = 'accept' THEN 'expedition_validated' ELSE 'expedition_rejected' END,
    jsonb_build_object(
      'expeditionId', v_voy.id,
      'expeditionName', v_voy.name,
      'chiefName', COALESCE(v_chief_name, 'Le chef')
    )
  );

  RETURN json_build_object(
    'success', true,
    'voyage_name', v_voy.name,
    'decision', p_decision
  );
END;
$$;

-- ============================================================
-- update_voyage (avec notif aux validés si champ sensible change)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_voyage(
  p_user_id text,
  p_voyage_id uuid,
  p_name text,
  p_description text,
  p_rdv_at timestamptz,
  p_rdv_lat double precision,
  p_rdv_lng double precision,
  p_rdv_label text,
  p_slots_max integer,
  p_slots_open boolean
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_voy public.voyages%ROWTYPE;
  v_changed_fields text[] := ARRAY[]::text[];
  v_validated_count integer;
BEGIN
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
$$;

-- ============================================================
-- cancel_voyage (avec notif aux validés)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_voyage(
  p_user_id text,
  p_voyage_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_chief text;
  v_status text;
  v_name text;
  v_chief_name text;
BEGIN
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
$$;

-- ============================================================
-- upsert_voyage_report (avec notif aux autres validés au premier post)
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
  v_author_name text;
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
$$;
