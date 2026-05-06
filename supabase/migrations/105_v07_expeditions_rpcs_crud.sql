-- 105_v07_expeditions_rpcs_crud.sql
-- WHY : RPCs CRUD du sous-système Expéditions (côté SQL : voyage_*).
-- Création, modification, annulation, lecture détaillée, et listings publics.
-- Toutes en SECURITY DEFINER avec contrôle d'autorisation côté RPC
-- (cf. règle inviolable apps/explore-web/CLAUDE.md).
--
-- Listings retournent faction_color + faction_title via JOIN sur public.factions
-- (cf. spec §12.4 — nécessaire pour la bordure colorée + pilule Héritage côté UI).
-- get_voyage retourne aussi call_text + call_author_id + call_updated_at.

-- ============================================================
-- create_voyage
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

  IF p_rdv_at <= now() THEN
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
GRANT EXECUTE ON FUNCTION public.create_voyage(text,text,text,timestamptz,double precision,double precision,text,integer,boolean,text) TO authenticated;

-- ============================================================
-- update_voyage
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
    SELECT count(*) INTO v_validated_count
      FROM public.voyage_participants
      WHERE voyage_id = p_voyage_id AND status = 'validated';
    -- Chef compte dans les slots → +1
    IF p_slots_open = false AND p_slots_max IS NOT NULL AND p_slots_max < (v_validated_count + 1) THEN
      RETURN json_build_object('success', false, 'error', 'slots_below_validated_count');
    END IF;
    v_changed_fields := array_append(v_changed_fields, 'slots');
  END IF;

  UPDATE public.voyages SET
    name = p_name,
    description = p_description,
    rdv_at = p_rdv_at,
    rdv_lat = p_rdv_lat,
    rdv_lng = p_rdv_lng,
    rdv_label = p_rdv_label,
    slots_max = p_slots_max,
    slots_open = p_slots_open,
    updated_at = now()
  WHERE id = p_voyage_id;

  RETURN json_build_object(
    'success', true,
    'changed_fields', v_changed_fields
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_voyage(text,uuid,text,text,timestamptz,double precision,double precision,text,integer,boolean) TO authenticated;

-- ============================================================
-- cancel_voyage
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
  v_validated_user_ids text[];
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

  SELECT array_agg(user_id) INTO v_validated_user_ids
    FROM public.voyage_participants
    WHERE voyage_id = p_voyage_id AND status = 'validated';

  UPDATE public.voyages
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE id = p_voyage_id;

  RETURN json_build_object(
    'success', true,
    'voyage_name', v_name,
    'notify_user_ids', COALESCE(v_validated_user_ids, ARRAY[]::text[])
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_voyage(text,uuid) TO authenticated;

-- ============================================================
-- get_voyage (visibilité publique vs cœur privé)
-- Retourne faction_color + faction_title pour le chef et chaque participant
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_voyage(
  p_user_id text,
  p_voyage_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_voy public.voyages%ROWTYPE;
  v_is_member boolean;
  v_chief_obj json;
  v_validated_participants json;
  v_pending_participants json;
  v_reports json;
  v_my_status text;
BEGIN
  SELECT * INTO v_voy FROM public.voyages WHERE id = p_voyage_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_found');
  END IF;

  -- Cancelled visibles 30j seulement pour les anciens membres (pas public)
  IF v_voy.status = 'cancelled' AND (v_voy.cancelled_at + interval '30 days' < now()) THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_found');
  END IF;

  v_is_member := v_voy.chief_user_id = p_user_id OR EXISTS (
    SELECT 1 FROM public.voyage_participants
    WHERE voyage_id = p_voyage_id
      AND user_id = p_user_id AND status = 'validated'
  );

  -- Chef avec faction
  SELECT json_build_object(
    'user_id', u.id,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'level', public._level_from_xp(u.xp_total),
    'faction_id', u.faction_id,
    'faction_title', f.title,
    'faction_color', f.color
  ) INTO v_chief_obj
  FROM public.users u
  LEFT JOIN public.factions f ON f.id = u.faction_id
  WHERE u.id = v_voy.chief_user_id;

  -- Validés (publique)
  SELECT json_agg(json_build_object(
    'user_id', u.id,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'level', public._level_from_xp(u.xp_total),
    'faction_id', u.faction_id,
    'faction_title', f.title,
    'faction_color', f.color,
    'validated_at', vp.validated_at
  ) ORDER BY vp.validated_at) INTO v_validated_participants
  FROM public.voyage_participants vp
  JOIN public.users u ON u.id = vp.user_id
  LEFT JOIN public.factions f ON f.id = u.faction_id
  WHERE vp.voyage_id = p_voyage_id AND vp.status = 'validated';

  -- Pending (chef seul)
  IF v_voy.chief_user_id = p_user_id THEN
    SELECT json_agg(json_build_object(
      'user_id', u.id,
      'display_name', u.display_name,
      'avatar_url', u.avatar_url,
      'level', public._level_from_xp(u.xp_total),
      'faction_id', u.faction_id,
      'faction_title', f.title,
      'faction_color', f.color,
      'request_message', vp.request_message,
      'joined_at', vp.joined_at
    ) ORDER BY vp.joined_at) INTO v_pending_participants
    FROM public.voyage_participants vp
    JOIN public.users u ON u.id = vp.user_id
    LEFT JOIN public.factions f ON f.id = u.faction_id
    WHERE vp.voyage_id = p_voyage_id AND vp.status = 'pending';
  END IF;

  -- Comptes rendus : tous si membre, sinon seulement is_public=true
  SELECT json_agg(json_build_object(
    'user_id', r.user_id,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'faction_id', u.faction_id,
    'faction_title', f.title,
    'faction_color', f.color,
    'text_content', r.text_content,
    'is_public', r.is_public,
    'cover_media_id', r.cover_media_id,
    'created_at', r.created_at,
    'updated_at', r.updated_at,
    'medias', (
      SELECT json_agg(json_build_object(
        'id', m.id,
        'storage_path', m.storage_path,
        'kind', m.kind
      ) ORDER BY m.created_at)
      FROM public.voyage_report_medias m
      WHERE m.voyage_id = r.voyage_id AND m.user_id = r.user_id
    )
  )) INTO v_reports
  FROM public.voyage_reports r
  JOIN public.users u ON u.id = r.user_id
  LEFT JOIN public.factions f ON f.id = u.faction_id
  WHERE r.voyage_id = p_voyage_id
    AND (v_is_member OR r.is_public = true);

  -- Mon propre statut
  IF v_voy.chief_user_id = p_user_id THEN
    v_my_status := 'chief';
  ELSE
    SELECT status INTO v_my_status FROM public.voyage_participants
      WHERE voyage_id = p_voyage_id AND user_id = p_user_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'is_member', v_is_member,
    'my_status', v_my_status,
    'voyage', json_build_object(
      'id', v_voy.id,
      'chief_user_id', v_voy.chief_user_id,
      'name', v_voy.name,
      'description', v_voy.description,
      'rdv_at', v_voy.rdv_at,
      'rdv_lat', v_voy.rdv_lat,
      'rdv_lng', v_voy.rdv_lng,
      'rdv_label', v_voy.rdv_label,
      'call_text', v_voy.call_text,
      'call_author_id', v_voy.call_author_id,
      'call_updated_at', v_voy.call_updated_at,
      'slots_max', v_voy.slots_max,
      'slots_open', v_voy.slots_open,
      'validation_mode', v_voy.validation_mode,
      'status', v_voy.status,
      'created_at', v_voy.created_at,
      'cancelled_at', v_voy.cancelled_at
    ),
    'chief', v_chief_obj,
    'validated_participants', COALESCE(v_validated_participants, '[]'::json),
    'pending_participants', COALESCE(v_pending_participants, '[]'::json),
    'reports', COALESCE(v_reports, '[]'::json)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_voyage(text,uuid) TO authenticated;

-- ============================================================
-- list_voyages_upcoming (Tableau de Quêtes - À venir)
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_voyages_upcoming()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_agg(row_to_json(t) ORDER BY t.rdv_at ASC) INTO v_result FROM (
    SELECT
      v.id, v.name, v.rdv_at, v.rdv_lat, v.rdv_lng, v.rdv_label,
      v.call_text,
      v.slots_max, v.slots_open, v.validation_mode, v.status,
      json_build_object(
        'user_id', u.id,
        'display_name', u.display_name,
        'avatar_url', u.avatar_url,
        'faction_id', u.faction_id,
        'faction_title', f.title,
        'faction_color', f.color
      ) AS chief,
      (SELECT count(*) FROM public.voyage_participants p
       WHERE p.voyage_id = v.id AND p.status = 'validated') AS validated_count
    FROM public.voyages v
    JOIN public.users u ON u.id = v.chief_user_id
    LEFT JOIN public.factions f ON f.id = u.faction_id
    WHERE v.status = 'published'
  ) t;
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_voyages_upcoming() TO authenticated;

-- ============================================================
-- list_voyages_archives (Tableau - Archives)
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_voyages_archives(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  IF p_limit > 100 THEN p_limit := 100; END IF;
  SELECT json_agg(row_to_json(t) ORDER BY t.rdv_at DESC) INTO v_result FROM (
    SELECT
      v.id, v.name, v.rdv_at, v.rdv_lat, v.rdv_lng, v.rdv_label,
      v.call_text, v.status,
      json_build_object(
        'user_id', u.id,
        'display_name', u.display_name,
        'avatar_url', u.avatar_url,
        'faction_id', u.faction_id,
        'faction_title', f.title,
        'faction_color', f.color
      ) AS chief,
      (SELECT count(*) FROM public.voyage_participants p
       WHERE p.voyage_id = v.id AND p.status = 'validated') AS validated_count,
      (SELECT count(*) FROM public.voyage_reports r
       WHERE r.voyage_id = v.id AND r.is_public = true) AS public_reports_count
    FROM public.voyages v
    JOIN public.users u ON u.id = v.chief_user_id
    LEFT JOIN public.factions f ON f.id = u.faction_id
    WHERE v.status = 'archived'
    ORDER BY v.rdv_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_voyages_archives(integer,integer) TO authenticated;

-- ============================================================
-- list_my_voyages (profil joueur — créées + rejointes)
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_my_voyages(p_user_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN json_build_object(
    'upcoming', COALESCE((
      SELECT json_agg(row_to_json(t) ORDER BY t.rdv_at ASC) FROM (
        SELECT v.id, v.name, v.rdv_at, v.rdv_lat, v.rdv_lng, v.status,
               (v.chief_user_id = p_user_id) AS i_am_chief
        FROM public.voyages v
        LEFT JOIN public.voyage_participants p
          ON p.voyage_id = v.id AND p.user_id = p_user_id
        WHERE v.status = 'published'
          AND (v.chief_user_id = p_user_id OR p.status = 'validated')
      ) t
    ), '[]'::json),
    'past', COALESCE((
      SELECT json_agg(row_to_json(t) ORDER BY t.rdv_at DESC) FROM (
        SELECT v.id, v.name, v.rdv_at, v.rdv_lat, v.rdv_lng, v.status,
               (v.chief_user_id = p_user_id) AS i_am_chief
        FROM public.voyages v
        LEFT JOIN public.voyage_participants p
          ON p.voyage_id = v.id AND p.user_id = p_user_id
        WHERE v.status IN ('passed','archived')
          AND (v.chief_user_id = p_user_id OR p.status = 'validated')
      ) t
    ), '[]'::json),
    'cancelled', COALESCE((
      SELECT json_agg(row_to_json(t) ORDER BY t.cancelled_at DESC) FROM (
        SELECT v.id, v.name, v.rdv_at, v.cancelled_at,
               (v.chief_user_id = p_user_id) AS i_am_chief
        FROM public.voyages v
        LEFT JOIN public.voyage_participants p
          ON p.voyage_id = v.id AND p.user_id = p_user_id
        WHERE v.status = 'cancelled'
          AND v.cancelled_at + interval '30 days' >= now()
          AND (v.chief_user_id = p_user_id OR p.status = 'validated')
      ) t
    ), '[]'::json)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_my_voyages(text) TO authenticated;
