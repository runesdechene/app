-- WHY: le jeu des énigmes sur la carte (spec 2026-10-07-v2-enigmes-design.md) : points de
--      connaissance (barème V1 1/1/2/3), seuils en % du total d'une culture avec un plancher, titres
--      de connaissance acquis + Polymathe, RPC du joueur (en attente → ouvrir → percer) sans
--      Couronnes, RPC du Hub (cultures), titres des cinq cultures et rattrapage des réponses V1.
-- BASE: aucune fonction existante redéfinie ici.
-- SCHEMA CHECKED (2026-10-07) : celles de 440, plus enigmas(lore_text, question, format, choices,
--   answer, explanation), enigma_themes(complement, cercles).

-- 1. Points
CREATE OR REPLACE FUNCTION public._poids_enigme(p_difficulte text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_difficulte WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 ELSE 1 END
$$;

CREATE OR REPLACE FUNCTION public._total_connaissance(p_theme text)
RETURNS int LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT COALESCE(sum(public._poids_enigme(e.difficulty)), 0)::int FROM public._enigmes_du_jeu(p_theme) e
$$;

-- Les énigmes distinctes percées au moins une fois, V1 comprise (décision du 07/10).
CREATE OR REPLACE FUNCTION public._points_connaissance(p_user text, p_theme text)
RETURNS int LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT COALESCE(sum(public._poids_enigme(e.difficulty)), 0)::int FROM enigmas e
   WHERE e.theme = p_theme AND e.fragment_id IS NULL
     AND EXISTS (SELECT 1 FROM enigma_responses r WHERE r.enigma_id = e.id AND r.user_id = p_user AND r.correct)
$$;

CREATE OR REPLACE FUNCTION public._seuil_connaissance(p_theme text, p_palier int)
RETURNS int LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT greatest(p.plancher, ceil(p.part * public._total_connaissance(p_theme))::int)
    FROM paliers_connaissance p WHERE p.palier = p_palier
$$;

-- 2. Les sept titres d'une culture : créés s'ils manquent, renommés sinon (le complément change)
CREATE OR REPLACE FUNCTION public._creer_titres_culture(p_theme text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_complement text;
  v_ordre      int;
  p            record;
  v_id         integer;
BEGIN
  SELECT COALESCE(NULLIF(btrim(complement), ''), 'de ' || label), 200 + sort_order * 10
    INTO v_complement, v_ordre FROM enigma_themes WHERE id = p_theme;
  FOR p IN SELECT * FROM paliers_connaissance ORDER BY palier LOOP
    SELECT id INTO v_id FROM titles
     WHERE condition->>'stat' = 'connaissance' AND condition->>'theme' = p_theme
       AND (condition->>'palier')::int = p.palier;
    IF v_id IS NULL THEN
      INSERT INTO titles (name, name_f, type, "order", icon, unlocks, condition, description)
      VALUES (p.nom_m || ' ' || v_complement, p.nom_f || ' ' || v_complement, 'general', v_ordre + p.palier,
              '✦', '{}'::text[],
              jsonb_build_object('stat', 'connaissance', 'theme', p_theme, 'palier', p.palier, 'min', p.plancher),
              NULL);
    ELSE
      UPDATE titles SET name = p.nom_m || ' ' || v_complement, name_f = p.nom_f || ' ' || v_complement
       WHERE id = v_id;
    END IF;
  END LOOP;
END $$;

-- 3. Attribuer ce qui est atteint (et Polymathe) ; renvoie les noms nouvellement obtenus, accordés
CREATE OR REPLACE FUNCTION public._attribuer_titres_connaissance(p_user text, p_theme text)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_points   int := public._points_connaissance(p_user, p_theme);
  v_genre    text;
  v_nouveaux text[];
  v_poly     text[];
BEGIN
  SELECT COALESCE(title_gender, 'm') INTO v_genre FROM users WHERE id = p_user;
  WITH gagnes AS (
    INSERT INTO titres_connaissance (user_id, title_id)
    SELECT p_user, t.id FROM titles t
     WHERE t.condition->>'stat' = 'connaissance' AND t.condition->>'theme' = p_theme
       AND v_points >= public._seuil_connaissance(p_theme, (t.condition->>'palier')::int)
    ON CONFLICT DO NOTHING
    RETURNING title_id)
  SELECT array_agg(public._nom_titre(t, v_genre) ORDER BY t."order") INTO v_nouveaux
    FROM gagnes g JOIN titles t ON t.id = g.title_id;

  WITH poly AS (
    INSERT INTO titres_connaissance (user_id, title_id)
    SELECT p_user, t.id FROM titles t
     WHERE t.condition->>'stat' = 'polymathe'
       AND (SELECT count(*) FROM titres_connaissance c JOIN titles s ON s.id = c.title_id
             WHERE c.user_id = p_user AND s.condition->>'stat' = 'connaissance'
               AND (s.condition->>'palier')::int = 6) >= 3
    ON CONFLICT DO NOTHING
    RETURNING title_id)
  SELECT array_agg(public._nom_titre(t, v_genre)) INTO v_poly FROM poly g JOIN titles t ON t.id = g.title_id;

  RETURN COALESCE(v_nouveaux, '{}') || COALESCE(v_poly, '{}');
END $$;

-- 4. L'éveil qui attend le compte connecté, ou une erreur
CREATE OR REPLACE FUNCTION public._eveil_en_attente(p_eveil bigint)
RETURNS public.enigmes_eveillees LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_moi text := auth.uid()::text;
  w     enigmes_eveillees;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'non connecté' USING ERRCODE = '42501'; END IF;
  SELECT * INTO w FROM enigmes_eveillees WHERE id = p_eveil AND effacee_le IS NULL;
  IF w.id IS NULL OR EXISTS (
       SELECT 1 FROM enigma_responses r
        WHERE r.user_id = v_moi AND (r.eveil_id = w.id OR (r.enigma_id = w.enigma_id AND r.correct))) THEN
    RAISE EXCEPTION 'énigme indisponible' USING ERRCODE = 'P0002';
  END IF;
  RETURN w;
END $$;

-- 5. Le joueur
CREATE OR REPLACE FUNCTION public.enigmes_en_attente()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_moi text := auth.uid()::text;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'non connecté' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT COALESCE(json_agg(json_build_object('id', w.id, 'lat', w.lat, 'lng', w.lng) ORDER BY w.id), '[]'::json)
    FROM enigmes_eveillees w JOIN enigma_themes t ON t.id = w.theme AND t.active
   WHERE w.effacee_le IS NULL
     AND NOT EXISTS (SELECT 1 FROM enigma_responses r
                      WHERE r.user_id = v_moi AND (r.eveil_id = w.id OR (r.enigma_id = w.enigma_id AND r.correct))));
END $$;

CREATE OR REPLACE FUNCTION public.ouvrir_enigme(p_eveil bigint)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  w enigmes_eveillees := public._eveil_en_attente(p_eveil);
BEGIN
  -- Jamais la réponse ici : elle n'arrive qu'avec le verdict.
  RETURN (SELECT json_build_object(
      'culture', json_build_object('id', t.id, 'nom', t.label, 'icone', t.icon, 'couleur', t.color),
      'recit', e.lore_text, 'question', e.question, 'format', e.format,
      'choix', CASE WHEN e.format = 'qcm' THEN e.choices ELSE NULL END,
      'difficulte', e.difficulty)
    FROM enigmas e JOIN enigma_themes t ON t.id = e.theme WHERE e.id = w.enigma_id);
END $$;

CREATE OR REPLACE FUNCTION public.percer_enigme(p_eveil bigint, p_reponse text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_moi      text := auth.uid()::text;
  w          enigmes_eveillees := public._eveil_en_attente(p_eveil);
  e          enigmas;
  v_juste    boolean;
  v_genre    text;
  v_xp_avant int;
  v_xp_apres int;
  v_nouveaux text[] := '{}';
  v_prochain json;
BEGIN
  SELECT * INTO e FROM enigmas WHERE id = w.enigma_id;
  v_juste := CASE WHEN e.format = 'free' THEN public._enigma_answer_matches(p_reponse, e.answer)
                  ELSE public._enigma_normalize(p_reponse) = public._enigma_normalize(e.answer) END;
  SELECT COALESCE(xp_total, 0), COALESCE(title_gender, 'm') INTO v_xp_avant, v_genre FROM users WHERE id = v_moi;

  -- Pas de Couronnes (en sommeil dans Explore) : on n'appelle pas _answer_enigma_internal.
  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained, eveil_id)
  VALUES (e.id, v_moi, left(p_reponse, 500), v_juste, 0, 0, w.id);

  IF v_juste THEN v_nouveaux := public._attribuer_titres_connaissance(v_moi, e.theme); END IF;
  SELECT COALESCE(xp_total, 0) INTO v_xp_apres FROM users WHERE id = v_moi;

  SELECT json_build_object('nom', public._nom_titre(t, v_genre),
                           'seuil', public._seuil_connaissance(e.theme, (t.condition->>'palier')::int))
    INTO v_prochain
    FROM titles t
   WHERE t.condition->>'stat' = 'connaissance' AND t.condition->>'theme' = e.theme
     AND NOT EXISTS (SELECT 1 FROM titres_connaissance c WHERE c.user_id = v_moi AND c.title_id = t.id)
   ORDER BY (t.condition->>'palier')::int LIMIT 1;

  RETURN json_build_object(
    'juste', v_juste,
    'reponse', e.answer,
    'explication', e.explanation,
    'xp', v_xp_apres - v_xp_avant,
    'gagnes', CASE WHEN v_juste THEN public._poids_enigme(e.difficulty) ELSE 0 END,
    'points', public._points_connaissance(v_moi, e.theme),
    'total', public._total_connaissance(e.theme),
    'nouveauxTitres', to_json(v_nouveaux),
    'prochain', v_prochain,
    'resteEnAttente', json_array_length(public.enigmes_en_attente()));
END $$;

-- 6. Le Hub (admins)
CREATE OR REPLACE FUNCTION public.cultures_du_hub()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin') THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT COALESCE(json_agg(json_build_object(
      'id', t.id, 'label', t.label, 'couleur', t.color, 'icone', t.icon, 'complement', t.complement,
      'cercles', t.cercles, 'active', t.active, 'ordre', t.sort_order,
      'stock', (SELECT count(*) FROM public._enigmes_du_jeu(t.id)),
      'total', public._total_connaissance(t.id),
      'eveils', (SELECT COALESCE(json_agg(json_build_object('lat', w.lat, 'lng', w.lng)), '[]'::json)
                   FROM enigmes_eveillees w WHERE w.theme = t.id AND w.effacee_le IS NULL))
    ORDER BY t.sort_order, t.id), '[]'::json) FROM enigma_themes t);
END $$;

CREATE OR REPLACE FUNCTION public.enregistrer_culture(
  p_id text, p_label text, p_couleur text, p_icone text, p_complement text,
  p_cercles jsonb, p_active boolean, p_ordre int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin') THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_cercles) <> 'array' OR jsonb_array_length(p_cercles) > 3 THEN
    RAISE EXCEPTION 'Trois cercles au plus';
  END IF;
  INSERT INTO enigma_themes (id, label, color, icon, complement, cercles, active, sort_order)
  VALUES (p_id, p_label, NULLIF(p_couleur, ''), NULLIF(p_icone, ''), NULLIF(btrim(p_complement), ''),
          p_cercles, p_active, p_ordre)
  ON CONFLICT (id) DO UPDATE SET
    label = EXCLUDED.label, color = EXCLUDED.color, icon = EXCLUDED.icon, complement = EXCLUDED.complement,
    cercles = EXCLUDED.cercles, active = EXCLUDED.active, sort_order = EXCLUDED.sort_order;
  PERFORM public._creer_titres_culture(p_id);
END $$;

-- 7. Droits
REVOKE ALL ON FUNCTION public.enigmes_en_attente() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enigmes_en_attente() TO authenticated;
REVOKE ALL ON FUNCTION public.ouvrir_enigme(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ouvrir_enigme(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.percer_enigme(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.percer_enigme(bigint, text) TO authenticated;
REVOKE ALL ON FUNCTION public.cultures_du_hub() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cultures_du_hub() TO authenticated;
REVOKE ALL ON FUNCTION public.enregistrer_culture(text, text, text, text, text, jsonb, boolean, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_culture(text, text, text, text, text, jsonb, boolean, int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public._points_connaissance(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._creer_titres_culture(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._attribuer_titres_connaissance(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._eveil_en_attente(bigint) FROM PUBLIC, anon, authenticated;

-- 8. Les titres des cultures existantes, Polymathe, et le rattrapage des énigmes réussies en V1
SELECT public._creer_titres_culture(id) FROM enigma_themes;

INSERT INTO titles (name, name_f, type, "order", icon, unlocks, condition, description)
SELECT 'Polymathe', 'Polymathe', 'general', 199, '✦', '{}'::text[], '{"stat":"polymathe","min":3}'::jsonb,
       'Sage dans trois cultures.'
WHERE NOT EXISTS (SELECT 1 FROM titles WHERE condition->>'stat' = 'polymathe');

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT er.user_id, e.theme
             FROM enigma_responses er
             JOIN enigmas e ON e.id = er.enigma_id
             JOIN users u ON u.id = er.user_id
            WHERE er.correct AND e.theme IS NOT NULL AND e.fragment_id IS NULL LOOP
    PERFORM public._attribuer_titres_connaissance(r.user_id, r.theme);
  END LOOP;
END $$;
