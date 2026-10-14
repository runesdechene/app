-- WHY: Hub V2, plan 3. Depuis la mig 444, la table enigmas n'a qu'une politique de lecture : l'ancien
--      Hub ne peut plus créer, modifier, activer ni supprimer une énigme (l'écriture échoue ou ne
--      touche aucune ligne, sans erreur visible) — relevé du 14/10/2026. Les énigmes s'écrivent
--      désormais par des fonctions réservées aux admins, avec les règles de l'ancien formulaire
--      (QCM : la réponse est l'un des choix ; libre : pas d'accolade, réservées aux dates).
--      Une énigme ne se supprime pas (les réponses des joueurs la référencent) : elle se désactive.
-- SCHEMA CHECKED (14/10/2026, live) : enigmas (id, type, difficulty, place_tag, lore_text, question,
--   format, choices jsonb, answer, explanation, active, created_at, fragment_id, theme,
--   accepted_answers text[] NOT NULL) ; enigma_themes(id) ; enigma_responses(enigma_id, correct) ;
--   signalements_enigme(enigma_id, traite_le) ; seule politique de enigmas : enigmas_select ;
--   _is_admin(), _refus().

-- Liste : filtres culture / difficulté / actives / recherche (par position, sans joker).
CREATE OR REPLACE FUNCTION public.hub_enigmes(
  p_culture text DEFAULT NULL, p_difficulte text DEFAULT NULL, p_actives text DEFAULT 'toutes',
  p_recherche text DEFAULT NULL, p_limite integer DEFAULT 50, p_decalage integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_recherche text := NULLIF(lower(btrim(p_recherche)), '');
  v_limite integer := LEAST(GREATEST(COALESCE(p_limite, 50), 1), 200);
  v_decalage integer := GREATEST(COALESCE(p_decalage, 0), 0);
  v_resultat jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_actives IS NULL OR p_actives NOT IN ('toutes', 'actives', 'inactives') THEN
    PERFORM _refus('Filtre inconnu', 'actives');
  END IF;

  WITH filtres AS (
    SELECT e.* FROM enigmas e
     WHERE (p_culture IS NULL OR e.theme = p_culture)
       AND (p_difficulte IS NULL OR e.difficulty = p_difficulte)
       AND CASE p_actives WHEN 'actives' THEN e.active WHEN 'inactives' THEN NOT e.active ELSE true END
       AND (v_recherche IS NULL
            OR position(v_recherche IN lower(e.question)) > 0
            OR position(v_recherche IN lower(e.lore_text)) > 0
            OR position(v_recherche IN lower(e.answer)) > 0)
  ),
  page AS (
    SELECT * FROM filtres ORDER BY created_at DESC, id LIMIT v_limite OFFSET v_decalage
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtres),
    'compteurs', jsonb_build_object(
      'toutes', (SELECT count(*) FROM enigmas),
      'actives', (SELECT count(*) FROM enigmas WHERE active),
      'parCulture', COALESCE((SELECT jsonb_object_agg(c.theme, c.n)
                                FROM (SELECT theme, count(*) AS n FROM enigmas
                                       WHERE theme IS NOT NULL GROUP BY theme) c), '{}'::jsonb)),
    'lignes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'question', p.question, 'culture', p.theme, 'difficulte', p.difficulty,
        'format', p.format, 'active', p.active, 'reponse', p.answer, 'cree_le', p.created_at)
        ORDER BY p.created_at DESC, p.id) FROM page p), '[]'::jsonb))
    INTO v_resultat;
  RETURN v_resultat;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_enigmes(text, text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_enigmes(text, text, text, text, integer, integer) TO authenticated;

-- Fiche : tout ce que l'éditeur affiche, plus les trois compteurs.
CREATE OR REPLACE FUNCTION public.hub_enigme(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_enigme jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  SELECT jsonb_build_object(
      'id', e.id, 'culture', e.theme, 'difficulte', e.difficulty, 'recit', e.lore_text,
      'question', e.question, 'format', e.format, 'choix', e.choices, 'reponse', e.answer,
      'variantes', to_jsonb(e.accepted_answers), 'explication', e.explanation, 'active', e.active,
      'cree_le', e.created_at,
      'reponses', (SELECT count(*) FROM enigma_responses r WHERE r.enigma_id = e.id),
      'percees', (SELECT count(*) FROM enigma_responses r WHERE r.enigma_id = e.id AND r.correct),
      'signalements', (SELECT count(*) FROM signalements_enigme s
                        WHERE s.enigma_id = e.id AND s.traite_le IS NULL))
    INTO v_enigme
    FROM enigmas e WHERE e.id = p_id;
  RETURN v_enigme;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_enigme(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_enigme(integer) TO authenticated;

-- Création (p_id null) ou mise à jour. Mêmes règles que l'ancien formulaire.
CREATE OR REPLACE FUNCTION public.hub_enregistrer_enigme(
  p_difficulte text, p_recit text, p_question text, p_format text, p_choix jsonb, p_reponse text,
  p_variantes text[], p_explication text, p_active boolean,
  p_id integer DEFAULT NULL, p_culture text DEFAULT NULL)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_question text := btrim(COALESCE(p_question, ''));
  v_reponse text := btrim(COALESCE(p_reponse, ''));
  v_recit text := btrim(COALESCE(p_recit, ''));
  v_explication text := btrim(COALESCE(p_explication, ''));
  v_choix jsonb := NULL;
  v_variantes text[] := '{}';
  v_id integer;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM enigmas WHERE id = p_id) THEN
    PERFORM _refus('Énigme introuvable', 'id');
  END IF;
  IF p_culture IS NOT NULL AND NOT EXISTS (SELECT 1 FROM enigma_themes WHERE id = p_culture) THEN
    PERFORM _refus('Culture inconnue', 'culture');
  END IF;
  IF p_difficulte IS NULL OR p_difficulte NOT IN ('very_easy', 'easy', 'medium', 'hard') THEN
    PERFORM _refus('Difficulté inconnue', 'difficulte');
  END IF;
  IF p_format IS NULL OR p_format NOT IN ('qcm', 'free') THEN
    PERFORM _refus('Format inconnu', 'format');
  END IF;
  IF v_question = '' THEN PERFORM _refus('La question est vide', 'question'); END IF;
  IF v_reponse = '' THEN PERFORM _refus('La réponse est vide', 'reponse'); END IF;

  IF p_format = 'qcm' THEN
    IF p_choix IS NOT NULL AND jsonb_typeof(p_choix) = 'array' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(c.t) ORDER BY c.ord), '[]'::jsonb) INTO v_choix
        FROM (SELECT btrim(x.value) AS t, x.ord
                FROM jsonb_array_elements_text(p_choix) WITH ORDINALITY AS x(value, ord)) c
       WHERE c.t <> '';
    ELSE
      v_choix := '[]'::jsonb;
    END IF;
    IF jsonb_array_length(v_choix) < 2 THEN
      PERFORM _refus('Il faut au moins deux choix', 'choix');
    END IF;
    IF NOT (v_choix ? v_reponse) THEN
      PERFORM _refus('La réponse doit être l’un des choix', 'reponse');
    END IF;
  ELSE
    SELECT COALESCE(array_agg(btrim(u.v) ORDER BY u.ord), '{}') INTO v_variantes
      FROM unnest(COALESCE(p_variantes, '{}')) WITH ORDINALITY AS u(v, ord)
     WHERE btrim(u.v) <> '';
    IF v_reponse ~ '[{}]' OR EXISTS (SELECT 1 FROM unnest(v_variantes) AS w(v) WHERE w.v ~ '[{}]') THEN
      PERFORM _refus('Une réponse ou une variante contient une accolade', 'accolade');
    END IF;
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO enigmas (type, difficulty, place_tag, lore_text, question, format, choices, answer,
                         explanation, active, fragment_id, theme, accepted_answers)
    VALUES ('daily', p_difficulte, NULL, v_recit, v_question, p_format, v_choix, v_reponse,
            v_explication, COALESCE(p_active, true), NULL, p_culture, v_variantes)
    RETURNING id INTO v_id;
  ELSE
    UPDATE enigmas
       SET difficulty = p_difficulte, lore_text = v_recit, question = v_question, format = p_format,
           choices = v_choix, answer = v_reponse, explanation = v_explication,
           active = COALESCE(p_active, true), theme = p_culture, accepted_answers = v_variantes
     WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_enregistrer_enigme(text, text, text, text, jsonb, text, text[], text, boolean, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_enregistrer_enigme(text, text, text, text, jsonb, text, text[], text, boolean, integer, text) TO authenticated;

-- Activer / désactiver (une énigme ne se supprime pas).
CREATE OR REPLACE FUNCTION public.hub_activer_enigme(p_id integer, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  UPDATE enigmas SET active = COALESCE(p_active, true) WHERE id = p_id;
  IF NOT FOUND THEN PERFORM _refus('Énigme introuvable', 'id'); END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_activer_enigme(integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_activer_enigme(integer, boolean) TO authenticated;
