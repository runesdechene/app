-- 581 — La découverte d'un Fragment dit sa place dans sa collection
--
-- WHY : Uriel, 02/11/2026 — l'animation d'un nouveau Fragment dit « 2 sur 5 de La Garde d'Acier »
--   (le compte dans la collection, jamais sur le total : à 50 Fragments, « 7 sur 50 » décourage).
--   tirer_anecdote, appelé juste après le scan, le rend : les Fragments visibles de la collection que
--   je connais (scannés ou portés), et leur nombre. tirer_anecdote repart de sa définition de la 579
--   (live du 02/11) ; seule s'ajoute la clé « collection ».
--
-- SCHEMA CHECKED (02/11/2026, live) : title_fragments(id, heritage, visible) ; scans(user_id,
--   fragment_id) ; user_fragments(user_id, fragment_id).

CREATE OR REPLACE FUNCTION public.tirer_anecdote(p_fragment integer, p_creuser boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_moi text := auth.uid()::text;
  v_aujourdhui date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_premiere boolean;
  v_rarete text;
  v_id bigint;
  v_texte text;
  v_raison text;
  v_points numeric;
BEGIN
  IF v_moi IS NULL THEN PERFORM _refus('Connecte-toi pour garder tes anecdotes', 'auth'); END IF;
  IF NOT EXISTS (SELECT 1 FROM title_fragments WHERE id = p_fragment AND visible) THEN
    PERFORM _refus('Fragment introuvable', 'fragment');
  END IF;

  -- Le premier scan de ce motif par moi : l'appli joue la découverte.
  v_premiere := (SELECT count(*) FROM scans WHERE user_id = v_moi AND fragment_id = p_fragment) <= 1;

  -- La rareté d'abord, pondérée parmi celles qui restent ; puis une anecdote de cette rareté.
  SELECT r.rarete INTO v_rarete
  FROM (
    SELECT DISTINCT a.rarete,
           CASE a.rarete WHEN 'commune' THEN 60 WHEN 'peu_commune' THEN 30 ELSE 10 END AS poids
    FROM anecdotes a
    WHERE a.fragment_id = p_fragment AND a.visible
      AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id)
  ) r
  ORDER BY -ln(1 - random()) / r.poids  -- tirage pondéré (méthode exponentielle)
  LIMIT 1;

  IF v_rarete IS NULL THEN
    v_raison := 'toutes_trouvees';
  ELSIF NOT p_creuser THEN
    IF EXISTS (
      SELECT 1 FROM anecdotes_trouvees t JOIN anecdotes a ON a.id = t.anecdote_id
      WHERE t.user_id = v_moi AND a.fragment_id = p_fragment
        AND (t.quand AT TIME ZONE 'Europe/Paris')::date = v_aujourdhui
    ) THEN
      v_raison := 'deja_aujourdhui';
    ELSE
      v_raison := 'gratuite';
    END IF;
  ELSE
    PERFORM 1 FROM users WHERE id = v_moi FOR UPDATE; -- deux « Creuser » rapprochés : l'un attend l'autre
    PERFORM public.get_user_energy(v_moi); -- la recharge d'abord
    SELECT energy_points INTO v_points FROM users WHERE id = v_moi;
    IF v_points < 2 THEN
      RAISE EXCEPTION 'Pas assez d''énergie' USING ERRCODE = 'RDC01';
    END IF;
    UPDATE users SET energy_points = energy_points - 2 WHERE id = v_moi;
    v_raison := 'creusee';
  END IF;

  IF v_raison IN ('gratuite', 'creusee') THEN
    SELECT a.id, a.texte INTO v_id, v_texte
    FROM anecdotes a
    WHERE a.fragment_id = p_fragment AND a.visible AND a.rarete = v_rarete
      AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id)
    ORDER BY random()
    LIMIT 1;
    INSERT INTO anecdotes_trouvees (user_id, anecdote_id) VALUES (v_moi, v_id);
  END IF;

  RETURN jsonb_build_object(
    'anecdote', CASE WHEN v_id IS NULL THEN NULL
                     ELSE jsonb_build_object('id', v_id, 'texte', v_texte, 'rarete', v_rarete) END,
    'raison', v_raison,
    'restantes', (SELECT count(*) FROM anecdotes a WHERE a.fragment_id = p_fragment AND a.visible
                    AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id)),
    'raresRestantes', (SELECT count(*) FROM anecdotes a WHERE a.fragment_id = p_fragment AND a.visible AND a.rarete = 'rare'
                    AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id)),
    'premiereDecouverte', v_premiere,
    -- 581 : « 2 sur 5 de La Garde d'Acier » — les Fragments de sa collection que je connais.
    'collection', (SELECT CASE WHEN nullif(f.heritage, '') IS NULL THEN NULL ELSE jsonb_build_object(
        'nom', f.heritage,
        'connus', (SELECT count(*) FROM title_fragments g WHERE g.visible AND g.heritage = f.heritage
                     AND (EXISTS (SELECT 1 FROM scans s WHERE s.user_id = v_moi AND s.fragment_id = g.id)
                          OR EXISTS (SELECT 1 FROM user_fragments uf WHERE uf.user_id = v_moi AND uf.fragment_id = g.id))),
        'total', (SELECT count(*) FROM title_fragments g WHERE g.visible AND g.heritage = f.heritage)) END
      FROM title_fragments f WHERE f.id = p_fragment)
  );
END $$;
