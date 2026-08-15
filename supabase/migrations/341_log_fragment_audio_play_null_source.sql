-- 341 — Fix log_fragment_audio_play : p_source NULL contournait la garde
--
-- WHY : `NULL NOT IN (...)` vaut NULL, et PL/pgSQL traite un IF nul comme faux — la
-- garde sur p_source était donc sautée quand p_source = NULL, laissant l'INSERT violer
-- la contrainte NOT NULL et remonter une erreur Postgres à l'appelant anon au lieu du
-- rejet silencieux voulu. Repris depuis pg_get_functiondef (live), delta = un coalesce().

CREATE OR REPLACE FUNCTION public.log_fragment_audio_play(
  p_illustration_handle text,
  p_source              text,
  p_session_id          text,
  p_listened_seconds    integer,
  p_completed           boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Entrées hostiles ou malformées : on sort en silence. Le visiteur n'a rien
  -- demandé, il n'a pas à recevoir une erreur PostgREST dans sa console.
  IF coalesce(btrim(p_illustration_handle), '') = '' THEN RETURN; END IF;
  IF coalesce(p_source, '') NOT IN ('motif', 'produit') THEN RETURN; END IF;
  IF length(coalesce(p_session_id, '')) NOT BETWEEN 8 AND 64 THEN RETURN; END IF;

  INSERT INTO public.fragment_audio_plays
    (illustration_handle, source, session_id, listened_seconds, completed)
  VALUES
    (btrim(p_illustration_handle), p_source, p_session_id,
     greatest(coalesce(p_listened_seconds, 0), 0), coalesce(p_completed, false))
  ON CONFLICT (session_id, illustration_handle, source, played_on) DO UPDATE SET
    listened_seconds = greatest(fragment_audio_plays.listened_seconds, excluded.listened_seconds),
    completed        = fragment_audio_plays.completed OR excluded.completed;
END;
$$;

COMMENT ON FUNCTION public.log_fragment_audio_play(text, text, text, integer, boolean) IS
  'Enregistre ou enrichit une écoute. greatest() et OR : un événement tardif ne peut
   que faire monter le compteur — un rembobinage ne défait pas une complétion.';

GRANT EXECUTE ON FUNCTION public.log_fragment_audio_play(text, text, text, integer, boolean) TO anon;
