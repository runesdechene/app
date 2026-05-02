-- 064_v07_notify_note_reaction.sql
-- WHY: quand quelqu'un réagit à ta note (react_to_note), tu ne reçois rien
--      dans l'onglet Activité — Uriel le 2026-05-02. On branche react_to_note
--      sur le helper standard `notify(recipient, type, data)` qui pose une
--      ligne dans `notifications` (réceptionnée en realtime par le hook
--      useNotifications côté client → toast + onglet Activité).
--
-- Type 'note_reaction'. Data : { actorName, actorId, actorAvatarUrl, emoji }.
-- Pas de notification si on réagit à sa propre note (cas peu intéressant).

CREATE OR REPLACE FUNCTION public.react_to_note(p_note_user_id text, p_emoji text)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id      text := auth.uid()::text;
  v_note_active  boolean;
  v_actor_name   text;
  v_actor_avatar text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT (note_posted_at IS NOT NULL AND note_posted_at >= NOW() - INTERVAL '24 hours')
    INTO v_note_active
    FROM public.users WHERE id = p_note_user_id;
  IF NOT COALESCE(v_note_active, false) THEN
    RAISE EXCEPTION 'note_not_active';
  END IF;

  IF NOT public.is_allowed_emoji(p_emoji) THEN
    RAISE EXCEPTION 'emoji_not_allowed';
  END IF;

  INSERT INTO public.note_reactions (note_user_id, reactor_user_id, emoji)
    VALUES (p_note_user_id, v_user_id, p_emoji)
    ON CONFLICT (note_user_id, reactor_user_id, emoji) DO NOTHING;

  -- Hook quête V0.7+ (préservé tel que mig 056)
  PERFORM public.increment_quest_progress(v_user_id, 'social_action', 1);

  -- Notification au propriétaire de la note (skip si on réagit à soi-même)
  IF p_note_user_id <> v_user_id THEN
    SELECT
      COALESCE(NULLIF(TRIM(display_name), ''), first_name),
      avatar_url
    INTO v_actor_name, v_actor_avatar
    FROM public.users WHERE id = v_user_id;

    PERFORM public.notify(
      p_note_user_id,
      'note_reaction',
      jsonb_build_object(
        'actorName',      v_actor_name,
        'actorId',        v_user_id,
        'actorAvatarUrl', v_actor_avatar,
        'emoji',          p_emoji
      )
    );
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;
