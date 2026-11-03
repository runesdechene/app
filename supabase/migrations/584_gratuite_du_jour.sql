-- WHY: le rescan d'un motif déjà connu propose ses choix sur la caméra (maquette Figma 929:3010,
--      Uriel 03/11) : « Découvrir l'anecdote du jour » si elle est encore à prendre, sinon « Creuser
--      une anecdote ». mon_fragment dit donc si la gratuite du jour reste. Définition live recopiée
--      entière ; seule la clé gratuiteDuJour s'ajoute. Les droits ne changent pas.

CREATE OR REPLACE FUNCTION public.mon_fragment(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := auth.uid()::text;
  v_numero integer;
  v_scans integer;
  v_genre text;
  v_portes integer[];
BEGIN
  IF v_moi IS NULL THEN PERFORM _refus('Connecte-toi pour ouvrir ton Codex', 'auth'); END IF;
  IF NOT EXISTS (SELECT 1 FROM title_fragments WHERE id = p_id AND visible) THEN RETURN NULL; END IF;

  SELECT numero INTO v_numero FROM user_fragments WHERE user_id = v_moi AND fragment_id = p_id;
  SELECT scans INTO v_scans FROM _mes_scans(v_moi) WHERE fragment_id = p_id;
  SELECT COALESCE(title_gender, 'm'), COALESCE(displayed_title_ids_v3, '{}') INTO v_genre, v_portes
  FROM users WHERE id = v_moi;

  RETURN jsonb_build_object(
    'etat', CASE WHEN v_numero IS NOT NULL THEN 'porte'
                 WHEN v_scans IS NOT NULL THEN 'scanne' ELSE 'inconnu' END,
    'scans', coalesce(v_scans, 0),
    'numero', v_numero,
    'porteurs', (SELECT count(*) FROM user_fragments WHERE fragment_id = p_id),
    'signe', EXISTS (SELECT 1 FROM users WHERE id = v_moi AND signe_fragment_id = p_id),
    'titre', (SELECT jsonb_build_object('id', t.id, 'nom', _nom_titre(t, v_genre)) FROM titles t
              WHERE t.condition->>'stat' = 'fragment' AND (t.condition->>'id')::int = p_id LIMIT 1),
    'titresPortes', to_jsonb(v_portes),
    'anecdotes', coalesce((
      SELECT jsonb_agg(jsonb_build_object('texte', a.texte, 'rarete', a.rarete) ORDER BY t.quand DESC)
      FROM anecdotes_trouvees t JOIN anecdotes a ON a.id = t.anecdote_id
      WHERE t.user_id = v_moi AND a.fragment_id = p_id AND a.visible), '[]'::jsonb),
    'restantes', (SELECT count(*) FROM anecdotes a WHERE a.fragment_id = p_id AND a.visible
                    AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id)),
    'raresRestantes', (SELECT count(*) FROM anecdotes a WHERE a.fragment_id = p_id AND a.visible AND a.rarete = 'rare'
                    AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id)),
    -- 584 : l'anecdote gratuite du jour est-elle encore à prendre ? (la même règle que tirer_anecdote)
    'gratuiteDuJour', NOT EXISTS (
      SELECT 1 FROM anecdotes_trouvees t JOIN anecdotes a ON a.id = t.anecdote_id
      WHERE t.user_id = v_moi AND a.fragment_id = p_id
        AND (t.quand AT TIME ZONE 'Europe/Paris')::date = (now() AT TIME ZONE 'Europe/Paris')::date)
  );
END $function$;
