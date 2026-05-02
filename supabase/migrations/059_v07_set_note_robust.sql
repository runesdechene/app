-- 059_v07_set_note_robust.sql
-- WHY: durcir set_note et clear_note pour révéler tout silent fail.
--      Si auth.uid()::text ne matche aucun users.id, l'UPDATE affecte 0 ligne et la
--      RPC retourne {ok:true} alors que rien n'a été écrit. Côté client, l'optimistic
--      update reste, presence broadcast la nouvelle valeur, mais la DB n'a pas changé →
--      au reload, on récupère l'ancienne valeur. Symptôme rapporté Uriel : la note
--      affichée diffère entre A (qui pose) et B (qui observe via presence).
--
-- Fix : GET DIAGNOSTICS ROW_COUNT après UPDATE → RAISE EXCEPTION si 0. Le client
-- recevra l'erreur, rollback le store, et on saura que quelque chose ne va pas.
-- Aussi : retourner le note_posted_at RÉEL via RETURNING (était NOW() recalculé
-- dans le RETURN, qui pouvait différer de quelques µs du timestamp inscrit).

CREATE OR REPLACE FUNCTION public.set_note(p_text text)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
  v_trimmed text := trim(coalesce(p_text, ''));
  v_actual_posted_at timestamptz;
  v_rows integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF length(v_trimmed) = 0 THEN
    RAISE EXCEPTION 'note_empty';
  END IF;
  IF length(v_trimmed) > 200 THEN
    RAISE EXCEPTION 'note_too_long';
  END IF;

  DELETE FROM public.note_reactions WHERE note_user_id = v_user_id;

  UPDATE public.users
    SET note_text = v_trimmed,
        note_posted_at = NOW(),
        updated_at = NOW()
    WHERE id = v_user_id
    RETURNING note_posted_at INTO v_actual_posted_at;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'user_not_found_for_auth_uid' USING DETAIL = 'auth.uid()::text = ' || v_user_id;
  END IF;

  RETURN json_build_object('ok', true, 'text', v_trimmed, 'posted_at', v_actual_posted_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_note()
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
  v_rows integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  DELETE FROM public.note_reactions WHERE note_user_id = v_user_id;

  UPDATE public.users
    SET note_text = NULL,
        note_posted_at = NULL,
        updated_at = NOW()
    WHERE id = v_user_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'user_not_found_for_auth_uid' USING DETAIL = 'auth.uid()::text = ' || v_user_id;
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;
