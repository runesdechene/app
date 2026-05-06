-- 106_v07_expeditions_rpcs_participation.sql
-- WHY : RPCs de participation aux voyages (Expéditions joueur-joueur).
-- request/respond/withdraw/eject + update_voyage_call (l'Appel collectif
-- modifiable par chef + validés).

-- ============================================================
-- request_join_voyage
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

  SELECT status INTO v_existing_status
    FROM public.voyage_participants
    WHERE voyage_id = p_voyage_id AND user_id = p_user_id;

  IF v_existing_status IN ('pending','validated') THEN
    RETURN json_build_object('success', false, 'error', 'already_pending_or_validated');
  END IF;

  -- Auto-validate si validation_mode = 'free' ET (slot libre OU slots_open)
  IF v_voy.validation_mode = 'free' THEN
    SELECT count(*) INTO v_validated_count
      FROM public.voyage_participants
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

  RETURN json_build_object(
    'success', true,
    'status', v_target_status,
    'chief_user_id', v_voy.chief_user_id,
    'voyage_name', v_voy.name
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_join_voyage(text,uuid,text) TO authenticated;

-- ============================================================
-- respond_voyage_join_request (chef accepte ou refuse une demande pending)
-- ============================================================
CREATE OR REPLACE FUNCTION public.respond_voyage_join_request(
  p_chief_user_id text,
  p_voyage_id uuid,
  p_target_user_id text,
  p_decision text  -- 'accept' | 'reject'
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_voy public.voyages%ROWTYPE;
  v_validated_count integer;
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
    SELECT count(*) INTO v_validated_count
      FROM public.voyage_participants
      WHERE voyage_id = p_voyage_id AND status = 'validated';
    IF v_voy.slots_open = false AND v_validated_count + 1 >= COALESCE(v_voy.slots_max, 0) THEN
      RETURN json_build_object('success', false, 'error', 'slots_full');
    END IF;

    UPDATE public.voyage_participants
      SET status = 'validated', validated_at = now()
      WHERE voyage_id = p_voyage_id
        AND user_id = p_target_user_id
        AND status = 'pending';
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'no_pending_request');
    END IF;
  ELSE
    UPDATE public.voyage_participants
      SET status = 'rejected'
      WHERE voyage_id = p_voyage_id
        AND user_id = p_target_user_id
        AND status = 'pending';
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'no_pending_request');
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'voyage_name', v_voy.name,
    'decision', p_decision
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.respond_voyage_join_request(text,uuid,text,text) TO authenticated;

-- ============================================================
-- withdraw_from_voyage (participant se retire)
-- ============================================================
CREATE OR REPLACE FUNCTION public.withdraw_from_voyage(
  p_user_id text,
  p_voyage_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_status text;
BEGIN
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
$$;
GRANT EXECUTE ON FUNCTION public.withdraw_from_voyage(text,uuid) TO authenticated;

-- ============================================================
-- eject_voyage_participant (chef éjecte un participant)
-- ============================================================
CREATE OR REPLACE FUNCTION public.eject_voyage_participant(
  p_chief_user_id text,
  p_voyage_id uuid,
  p_target_user_id text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_chief text;
BEGIN
  SELECT chief_user_id INTO v_chief FROM public.voyages WHERE id = p_voyage_id;
  IF NOT FOUND OR v_chief <> p_chief_user_id THEN
    RETURN json_build_object('success', false, 'error', 'not_chief_or_not_found');
  END IF;

  UPDATE public.voyage_participants
    SET status = 'rejected'
    WHERE voyage_id = p_voyage_id
      AND user_id = p_target_user_id
      AND status = 'validated';
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'not_a_validated_participant');
  END IF;
  RETURN json_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.eject_voyage_participant(text,uuid,text) TO authenticated;

-- ============================================================
-- update_voyage_call ("L'appel" — phrase modifiable collectivement)
-- Autorise chef OU participant validé.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_voyage_call(
  p_user_id text,
  p_voyage_id uuid,
  p_call_text text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_voy public.voyages%ROWTYPE;
  v_authorized boolean;
BEGIN
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
$$;
GRANT EXECUTE ON FUNCTION public.update_voyage_call(text,uuid,text) TO authenticated;
