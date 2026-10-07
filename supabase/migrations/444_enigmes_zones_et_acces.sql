-- WHY: (1) Uriel, 07/10 : la zone d'une culture compte autant de cercles qu'on veut, chacun tiré à
--      égalité (un cercle de 5 km vaut un site précis) ; 5 km au moins. (2) Revue finale des énigmes :
--      enigma_responses acceptait des INSERT directs (policy responses_insert + GRANT ALL) — on pouvait
--      s'offrir XP et titres de connaissance ; et enigmas (réponses comprises) se lisait par REST.
--      Toutes les écritures passent par des fonctions SECURITY DEFINER (answer_enigma, percer_enigme…),
--      et seul le Hub (admins) lit enigmas en direct : on ferme le reste. (3) enigmes_en_attente rend ses
--      points dans un ordre qui ne trahit plus la culture (l'ordre des id suivait la boucle du réveil).
--      (4) Uriel, 07/10 : la bonne réponse se fête — percer_enigme dit le niveau et la jauge avant / après.
-- BASE: _point_dans_les_cercles, enregistrer_culture, enigmes_en_attente, percer_enigme — définitions des
--       migrations 440 et 441 (identiques en live, appliquées le 07/10), modifiées aux seuls endroits ci-dessous.
-- SCHEMA CHECKED (2026-10-07) : pg_policies enigma_responses (responses_insert, responses_select),
--   enigmas (enigmas_select) ; grants ALL à anon et authenticated sur les deux tables ; aucune appli
--   n'écrit enigma_responses ni ne lit enigmas en direct hors du Hub (grep apps/).

-- 1. Un cercle tiré à égalité, puis un point uniforme dans ce cercle
CREATE OR REPLACE FUNCTION public._point_dans_les_cercles(p_cercles jsonb, OUT lat double precision, OUT lng double precision)
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  c       jsonb;
  v_angle double precision := random() * 2 * pi();
  v_dist  double precision;
BEGIN
  SELECT x INTO c FROM jsonb_array_elements(p_cercles) x ORDER BY random() LIMIT 1;
  v_dist := (c->>'rayon_km')::float8 * sqrt(random());
  lat := (c->>'lat')::float8 + v_dist * cos(v_angle) / 111.32;
  lng := (c->>'lng')::float8 + v_dist * sin(v_angle) / (111.32 * cos(radians((c->>'lat')::float8)));
END $$;
REVOKE EXECUTE ON FUNCTION public._point_dans_les_cercles(jsonb) FROM PUBLIC, anon, authenticated;

-- 2. Le Hub : autant de cercles qu'on veut, chacun valide (un cercle faux bloquerait le réveil de toutes
--    les cultures, qui tourne dans une seule transaction).
CREATE OR REPLACE FUNCTION public.enregistrer_culture(
  p_id text, p_label text, p_couleur text, p_icone text, p_complement text,
  p_cercles jsonb, p_active boolean, p_ordre int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin') THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_cercles) <> 'array' OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_cercles) c
        WHERE jsonb_typeof(c->'lat') <> 'number' OR jsonb_typeof(c->'lng') <> 'number'
           OR jsonb_typeof(c->'rayon_km') <> 'number'
           OR (c->>'lat')::float8 NOT BETWEEN -80 AND 80
           OR (c->>'lng')::float8 NOT BETWEEN -180 AND 180
           OR (c->>'rayon_km')::float8 NOT BETWEEN 5 AND 2000) THEN
    RAISE EXCEPTION 'Cercle invalide : latitude, longitude, et un rayon de 5 à 2000 km';
  END IF;
  INSERT INTO enigma_themes (id, label, color, icon, complement, cercles, active, sort_order)
  VALUES (p_id, p_label, NULLIF(p_couleur, ''), NULLIF(p_icone, ''), NULLIF(btrim(p_complement), ''),
          p_cercles, p_active, p_ordre)
  ON CONFLICT (id) DO UPDATE SET
    label = EXCLUDED.label, color = EXCLUDED.color, icon = EXCLUDED.icon, complement = EXCLUDED.complement,
    cercles = EXCLUDED.cercles, active = EXCLUDED.active, sort_order = EXCLUDED.sort_order;
  PERFORM public._creer_titres_culture(p_id);
END $$;

-- 3. Les points en attente, rangés par position : l'ordre ne dit plus rien de la culture
CREATE OR REPLACE FUNCTION public.enigmes_en_attente()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_moi text := auth.uid()::text;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'non connecté' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT COALESCE(json_agg(json_build_object('id', w.id, 'lat', w.lat, 'lng', w.lng) ORDER BY w.lat, w.lng), '[]'::json)
    FROM enigmes_eveillees w JOIN enigma_themes t ON t.id = w.theme AND t.active
   WHERE w.effacee_le IS NULL
     AND NOT EXISTS (SELECT 1 FROM enigma_responses r
                      WHERE r.user_id = v_moi AND (r.eveil_id = w.id OR (r.enigma_id = w.enigma_id AND r.correct))));
END $$;

-- 4. Plus d'écriture directe dans les réponses : on ne s'offre plus d'XP ni de titre par REST
DROP POLICY IF EXISTS responses_insert ON public.enigma_responses;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enigma_responses FROM anon, authenticated;

-- 5. Les énigmes (et leurs réponses) ne se lisent plus en direct, sauf par le Hub (admins)
DROP POLICY IF EXISTS enigmas_select ON public.enigmas;
CREATE POLICY enigmas_select ON public.enigmas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role = 'admin'));

-- 6. Le verdict dit le niveau et sa jauge avant / après, pour que la fête la remplisse sous les yeux
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
  v_niveau   int;
  v_seuil    int;
  v_suivant  int;
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
  v_niveau := public._level_from_xp(v_xp_apres);
  v_seuil := public._xp_for_level(v_niveau);
  v_suivant := public._xp_for_level(v_niveau + 1);

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
    'niveau', v_niveau,
    -- Monter de niveau fait repartir la jauge de zéro (comme decouvrir_lieu, mig 401).
    'avant', CASE WHEN public._level_from_xp(v_xp_avant) < v_niveau THEN 0
                  ELSE round((v_xp_avant - v_seuil)::numeric / greatest(1, v_suivant - v_seuil), 3) END,
    'apres', round((v_xp_apres - v_seuil)::numeric / greatest(1, v_suivant - v_seuil), 3),
    'gagnes', CASE WHEN v_juste THEN public._poids_enigme(e.difficulty) ELSE 0 END,
    'points', public._points_connaissance(v_moi, e.theme),
    'total', public._total_connaissance(e.theme),
    'nouveauxTitres', to_json(v_nouveaux),
    'prochain', v_prochain,
    'resteEnAttente', json_array_length(public.enigmes_en_attente()));
END $$;
