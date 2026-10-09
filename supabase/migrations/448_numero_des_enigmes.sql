-- WHY: chaque énigme porte un numéro fixe, le même pour tous (Uriel, 07/10 : « que les gens puissent
--      dire "je bloque sur la 30" »). C'est son id (1 à 453, sans trou) : la feuille de l'énigme et
--      « Les énigmes » l'affichent, au lieu d'un rang compté sur la page.
-- BASE: définitions en ligne de ouvrir_enigme et mes_enigmes_culture (pg_get_functiondef, 07/10),
--      copiées entières ; seule s'ajoute la clé `numero`. Ajout pur : la V2 en ligne l'ignore.
-- SCHEMA CHECKED (07/10, information_schema) : enigmas.id integer.

CREATE OR REPLACE FUNCTION public.ouvrir_enigme(p_eveil bigint)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  w enigmes_eveillees := public._eveil_en_attente(p_eveil);
BEGIN
  -- Jamais la réponse ici : elle n'arrive qu'avec le verdict.
  RETURN (SELECT json_build_object(
      'culture', json_build_object('id', t.id, 'nom', t.label, 'icone', t.icon, 'couleur', t.color),
      'recit', e.lore_text, 'question', e.question, 'format', e.format,
      'choix', CASE WHEN e.format = 'qcm' THEN e.choices ELSE NULL END,
      'difficulte', e.difficulty,
      'numero', e.id) -- 448 : le numéro fixe de l'énigme (« je bloque sur la 242 »)
    FROM enigmas e JOIN enigma_themes t ON t.id = e.theme WHERE e.id = w.enigma_id);
END $function$;

CREATE OR REPLACE FUNCTION public.mes_enigmes_culture(p_theme text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := auth.uid()::text;
  t enigma_themes;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'non connecté' USING ERRCODE = '42501'; END IF;
  SELECT * INTO t FROM enigma_themes WHERE id = p_theme AND active;
  IF t.id IS NULL THEN RAISE EXCEPTION 'culture introuvable' USING ERRCODE = 'P0002'; END IF;
  RETURN json_build_object(
    'culture', json_build_object('id', t.id, 'nom', t.label, 'icone', t.icon, 'couleur', t.color, 'zone', t.zone),
    'resolues', (SELECT count(*) FROM public._enigmes_resolues(v_moi, t.id)),
    'total', (SELECT count(*) FROM public._enigmes_du_jeu(t.id)),
    -- Le premier cercle : « Les chercher sur la carte » y emmène.
    'centre', CASE WHEN jsonb_array_length(t.cercles) > 0
                   THEN json_build_object('lat', (t.cercles->0->>'lat')::float8, 'lng', (t.cercles->0->>'lng')::float8) END,
    'enigmes', (SELECT COALESCE(json_agg(json_build_object('numero', e.id, -- 448
                                                            'reponse', e.answer, 'question', e.question,
                                                            'explication', e.explanation, 'le', r.le)
                                         ORDER BY r.le DESC), '[]'::json)
                  FROM public._enigmes_resolues(v_moi, t.id) r JOIN enigmas e ON e.id = r.enigma_id));
END $function$;
