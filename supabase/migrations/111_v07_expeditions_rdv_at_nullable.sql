-- 111_v07_expeditions_rdv_at_nullable.sql
-- WHY : permettre la création d'expéditions sans date de RDV fixée
-- d'avance. Les participants se mettent d'accord dans le chat puis le
-- chef édite la date plus tard. Cf. retours UX 6 mai 2026.
--
-- Adapte create_voyage + update_voyage pour accepter rdv_at NULL.
-- archive_passed_voyages reste correct (WHERE rdv_at <= now() ne match
-- pas NULL) — les expés "à définir" ne sont jamais auto-passées.

ALTER TABLE public.voyages ALTER COLUMN rdv_at DROP NOT NULL;

-- ============================================================
-- create_voyage (avec rdv_at nullable)
-- Copie-collée de 105_v07_expeditions_rpcs_crud.sql + ajustement check
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_voyage(
  p_user_id text,
  p_name text,
  p_description text,
  p_rdv_at timestamptz,
  p_rdv_lat double precision,
  p_rdv_lng double precision,
  p_rdv_label text,
  p_slots_max integer,
  p_slots_open boolean,
  p_validation_mode text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_active_count integer;
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  -- rdv_at nullable : on accepte NULL ("à définir"). Si fourni, doit être futur.
  IF p_rdv_at IS NOT NULL AND p_rdv_at <= now() THEN
    RETURN json_build_object('success', false, 'error', 'rdv_must_be_in_future');
  END IF;

  IF p_validation_mode NOT IN ('manual','free') THEN
    RETURN json_build_object('success', false, 'error', 'invalid_validation_mode');
  END IF;

  -- Anti-spam : limite 3 voyages actifs en tant que chef
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
$$;

-- ============================================================
-- update_voyage (avec rdv_at nullable)
-- Copie-collée de 110_v07_expeditions_notifications.sql + ajustement check
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
$$;
