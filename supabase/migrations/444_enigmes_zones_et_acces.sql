-- WHY: (1) Uriel, 07/10 : la zone d'une culture compte autant de cercles qu'on veut, chacun tiré à
--      égalité (un cercle de 5 km vaut un site précis) ; 5 km au moins. (2) Revue finale des énigmes :
--      enigma_responses acceptait des INSERT directs (policy responses_insert + GRANT ALL) — on pouvait
--      s'offrir XP et titres de connaissance ; et enigmas (réponses comprises) se lisait par REST.
--      Toutes les écritures passent par des fonctions SECURITY DEFINER (answer_enigma, percer_enigme…),
--      et seul le Hub (admins) lit enigmas en direct : on ferme le reste. (3) enigmes_en_attente rend ses
--      points dans un ordre qui ne trahit plus la culture (l'ordre des id suivait la boucle du réveil).
-- BASE: _point_dans_les_cercles, enregistrer_culture, enigmes_en_attente — définitions des migrations
--       440 et 441 (identiques en live, appliquées le 07/10), modifiées aux seuls endroits ci-dessous.
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
