-- 115_v07_voyages_unread_messages.sql
-- WHY : signaler les messages chat non-lus à l'utilisateur, à 2 endroits :
--   1) Pastille rouge sur la card du panneau et sur la bannière carte
--      (compteur calculé via last_read_at vs created_at messages)
--   2) Notification personnelle dans la cloche (type 'expedition_message')
--      insérée à chaque INSERT — visibilité Realtime déjà existante.
--
-- Patch 2 RPCs :
--   - send_voyage_message : insert notification aux autres membres
--   - list_voyages_upcoming : ajoute unread_count par expé
--   - list_my_voyages : idem dans les sections où le user est membre

-- ============================================================
-- send_voyage_message — ajoute INSERT notifications + retourne id
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_voyage_message(
  p_user_id text,
  p_voyage_id uuid,
  p_content text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_voy public.voyages%ROWTYPE;
  v_authorized boolean;
  v_id bigint;
  v_author_name text;
BEGIN
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
$$;

-- ============================================================
-- list_voyages_upcoming — ajoute unread_count
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_voyages_upcoming()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
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
       WHERE p.voyage_id = v.id AND p.status = 'validated') AS validated_count,
      -- unread_count : nombre de messages postés après last_read_at du user (membre seulement)
      CASE
        WHEN v_user_id IS NULL THEN 0
        WHEN v.chief_user_id = v_user_id OR EXISTS (
          SELECT 1 FROM public.voyage_participants p
          WHERE p.voyage_id = v.id AND p.user_id = v_user_id AND p.status = 'validated'
        ) THEN (
          SELECT count(*) FROM public.voyage_messages m
          WHERE m.voyage_id = v.id
            AND m.user_id <> v_user_id
            AND m.created_at > COALESCE(
              (SELECT last_read_at FROM public.voyage_message_reads
                WHERE voyage_id = v.id AND user_id = v_user_id),
              '-infinity'::timestamptz
            )
        )
        ELSE 0
      END AS unread_count
    FROM public.voyages v
    JOIN public.users u ON u.id = v.chief_user_id
    LEFT JOIN public.factions f ON f.id = u.faction_id
    WHERE v.status = 'published'
  ) t;
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_voyages_upcoming() TO authenticated;
