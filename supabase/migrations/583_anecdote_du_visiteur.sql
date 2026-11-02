-- 583 — Le visiteur sans compte lit une anecdote du motif qu'il scanne
--
-- WHY : spec du Codex (02/11/2026) : « Sans compte : le scan montre la carte, la préhistoire et
--   l'anecdote, mais rien n'est gardé. » Uriel, 02/11 : il tire les anecdotes qu'il veut, rien n'est
--   enregistré. Même tirage pondéré que tirer_anecdote (rare 10, peu commune 30, commune 60), parmi
--   toutes les anecdotes visibles ; aucune écriture, aucune énergie.
--
-- SCHEMA CHECKED (02/11/2026, live) : anecdotes(id, fragment_id, texte, rarete, visible) ;
--   title_fragments(id, visible).

CREATE OR REPLACE FUNCTION public.anecdote_au_hasard(p_fragment integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH rarete AS (
    SELECT r.rarete
    FROM (
      SELECT DISTINCT a.rarete,
             CASE a.rarete WHEN 'commune' THEN 60 WHEN 'peu_commune' THEN 30 ELSE 10 END AS poids
      FROM anecdotes a JOIN title_fragments f ON f.id = a.fragment_id AND f.visible
      WHERE a.fragment_id = p_fragment AND a.visible
    ) r
    ORDER BY -ln(1 - random()) / r.poids  -- tirage pondéré (méthode exponentielle)
    LIMIT 1
  )
  SELECT jsonb_build_object('id', a.id, 'texte', a.texte, 'rarete', a.rarete)
  FROM anecdotes a JOIN rarete USING (rarete)
  WHERE a.fragment_id = p_fragment AND a.visible
  ORDER BY random()
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.anecdote_au_hasard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anecdote_au_hasard(integer) TO anon, authenticated;
