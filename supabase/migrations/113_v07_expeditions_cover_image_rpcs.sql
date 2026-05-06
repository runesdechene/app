-- 113_v07_expeditions_cover_image_rpcs.sql
-- WHY : étendre les RPCs de lecture pour exposer cover_image_url + ajouter
-- la policy SELECT publique sur le bucket voyage-medias pour les paths
-- en <voyage_id>/cover/* (la carte est publique, tout le monde voit la
-- bannière de l'expé donc l'image cover doit être lisible sans auth check).

-- ============================================================
-- get_voyage — recompose pour inclure cover_image_url dans expedition
-- (copie-collée de 105 + ajout d'un champ)
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

  IF v_voy.status = 'cancelled' AND (v_voy.cancelled_at + interval '30 days' < now()) THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_found');
  END IF;

  v_is_member := v_voy.chief_user_id = p_user_id OR EXISTS (
    SELECT 1 FROM public.voyage_participants
    WHERE voyage_id = p_voyage_id
      AND user_id = p_user_id AND status = 'validated'
  );

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
      'cover_image_url', v_voy.cover_image_url,
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

-- ============================================================
-- list_voyages_upcoming — ajoute cover_image_url
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
      v.call_text, v.cover_image_url,
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
-- Storage policy : SELECT public pour cover paths
-- Convention path : <voyage_id>/cover/<filename>
-- ============================================================
DROP POLICY IF EXISTS "voyage_medias_cover_public_select" ON storage.objects;
CREATE POLICY "voyage_medias_cover_public_select"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'voyage-medias'
  AND split_part(name, '/', 2) = 'cover'
);
