-- 205_get_defi_participants.sql
-- Participants d'un défi (surtout collectif) : les joueurs distincts ayant
-- réalisé l'action (action × tag) dans la fenêtre courante, pour afficher leurs
-- avatars sur la carte de défi collectif.
--
-- Même langage que _defi_progress (mig 192) : 100% calcul-à-la-lecture, aucune
-- table de participation dédiée. On agrège les tables sources selon l'action,
-- on regroupe par user, on trie par contribution décroissante.

CREATE OR REPLACE FUNCTION public.get_defi_participants(p_defi_id text, p_limit int DEFAULT 12)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  d public.defis;
  v_ws timestamptz;
  v_total int;
  v_list json;
BEGIN
  SELECT * INTO d FROM public.defis WHERE id = p_defi_id;
  IF NOT FOUND THEN
    RETURN json_build_object('total', 0, 'participants', '[]'::json);
  END IF;
  v_ws := public._defi_window_start(d.cadence);

  WITH src AS (
    -- reveal (remote) / visit (gps)
    SELECT pd.user_id AS u_id, pd.discovered_at AS ts
      FROM public.places_discovered pd
     WHERE d.action IN ('reveal','visit')
       AND pd.method = CASE d.action WHEN 'reveal' THEN 'remote' ELSE 'gps' END
       AND pd.discovered_at >= v_ws
       AND (d.tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pd.place_id AND pt.tag_id = d.tag_id))
    UNION ALL
    -- add (création de lieu)
    SELECT p.author_id, p.created_at
      FROM public.places p
     WHERE d.action = 'add'
       AND p.created_at >= v_ws
       AND (d.tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = p.id AND pt.tag_id = d.tag_id))
    UNION ALL
    -- veilleur (plantage d'étendard GPS, by_influence = false)
    SELECT pv.veilleur_user_id, pv.planted_at
      FROM public.place_veille pv
     WHERE d.action = 'veilleur'
       AND pv.by_influence = false AND pv.planted_at >= v_ws
       AND (d.tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pv.place_id AND pt.tag_id = d.tag_id))
    UNION ALL
    -- enigma
    SELECT e.user_id, e.responded_at
      FROM public.enigma_responses e
     WHERE d.action = 'enigma' AND e.responded_at >= v_ws
  ),
  agg AS (
    SELECT u_id, count(*) AS n, max(ts) AS last_at
      FROM src
     WHERE u_id IS NOT NULL
     GROUP BY u_id
  )
  SELECT
    (SELECT count(*) FROM agg),
    COALESCE((
      SELECT json_agg(json_build_object(
               'userId', t.u_id,
               'name',   u.first_name,
               'avatar', u.avatar_url,
               'count',  t.n,
               'lastAt', t.last_at
             ) ORDER BY t.last_at DESC, t.u_id)
        FROM (SELECT u_id, n, last_at FROM agg ORDER BY last_at DESC, u_id LIMIT p_limit) t
        JOIN public.users u ON u.id = t.u_id
    ), '[]'::json)
  INTO v_total, v_list;

  RETURN json_build_object('total', COALESCE(v_total, 0), 'participants', v_list);
END; $$;

GRANT EXECUTE ON FUNCTION public.get_defi_participants(text, int) TO authenticated, service_role;
