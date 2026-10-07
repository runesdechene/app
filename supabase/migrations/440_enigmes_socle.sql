-- WHY: les énigmes reviennent dans la V2, semées sur la carte dans la zone de leur culture
--      (spec docs/superpowers/specs/2026-10-07-v2-enigmes-design.md). Socle : zone et complément de
--      chaque culture, éveils (mêmes places pour tous, 7 au plus par culture), paliers de connaissance,
--      titres de connaissance obtenus (acquis : le seuil bouge, le titre reste), forme féminine des
--      titres, réveil quotidien (pg_cron), 1 XP par énigme juste (au lieu de 1 à 3).
-- BASE: _trg_xp_enigma_insert — définition live copiée entière, seul le CASE du delta change.
-- SCHEMA CHECKED (2026-10-07) : enigma_themes(id, label, color, icon, sort_order, active) ;
--   enigmas(id, theme, difficulty, active, fragment_id) ; enigma_responses(enigma_id, user_id,
--   answer_given, correct, influence_gained, erudition_gained, responded_at) ; titles(id, name, type,
--   "order", icon, condition, description) ; users(id, title_gender, xp_total, role).

-- 1. Les cultures : complément de titre et zone (un à trois cercles)
ALTER TABLE public.enigma_themes
  ADD COLUMN IF NOT EXISTS complement text,
  ADD COLUMN IF NOT EXISTS cercles jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.enigma_themes SET complement = v.complement, cercles = v.cercles::jsonb
FROM (VALUES
  ('nordique',  'des arcanes scandinaves', '[{"lat":61.5,"lng":10,"rayon_km":550},{"lat":59,"lng":16.5,"rayon_km":400}]'),
  ('celtique',  'des mondes celtes',       '[{"lat":53.4,"lng":-7.8,"rayon_km":250},{"lat":56,"lng":-4.5,"rayon_km":300},{"lat":48.1,"lng":-3,"rayon_km":180}]'),
  ('romaine',   'de Rome',                 '[{"lat":42.5,"lng":12.6,"rayon_km":380},{"lat":40,"lng":16,"rayon_km":250}]'),
  ('grecque',   'de la Grèce antique',     '[{"lat":38.6,"lng":22.8,"rayon_km":280},{"lat":37.3,"lng":25.5,"rayon_km":220}]'),
  ('byzantine', 'de Byzance',              '[{"lat":41,"lng":28.9,"rayon_km":220},{"lat":38.8,"lng":28.5,"rayon_km":330}]')
) AS v(id, complement, cercles)
WHERE enigma_themes.id = v.id;

-- 2. La forme féminine d'un titre (null : le titre ne s'accorde pas)
ALTER TABLE public.titles ADD COLUMN IF NOT EXISTS name_f varchar(255);

CREATE OR REPLACE FUNCTION public._nom_titre(p_titre public.titles, p_genre text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_genre = 'f' AND p_titre.name_f IS NOT NULL THEN p_titre.name_f ELSE p_titre.name END
$$;

-- 3. Les sept paliers de connaissance
CREATE TABLE IF NOT EXISTS public.paliers_connaissance (
  palier   int PRIMARY KEY,
  nom_m    text NOT NULL,
  nom_f    text NOT NULL,
  plancher int NOT NULL,
  part     numeric NOT NULL
);
INSERT INTO public.paliers_connaissance VALUES
  (1, 'Curieux',  'Curieuse',  1,   0),
  (2, 'Apprenti', 'Apprentie', 4,   0.03),
  (3, 'Lettré',   'Lettrée',   10,  0.08),
  (4, 'Initié',   'Initiée',   20,  0.15),
  (5, 'Érudit',   'Érudite',   40,  0.30),
  (6, 'Sage',     'Sage',      70,  0.55),
  (7, 'Maître',   'Maître',    100, 0.80)
ON CONFLICT (palier) DO NOTHING;
ALTER TABLE public.paliers_connaissance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS paliers_connaissance_lecture ON public.paliers_connaissance;
CREATE POLICY paliers_connaissance_lecture ON public.paliers_connaissance
  FOR SELECT TO anon, authenticated USING (true);

-- 4. Les éveils : mêmes places pour tous. Aucune policy : on n'y lit qu'à travers les RPC
--    (la culture ne doit pas fuiter avant le toucher).
CREATE TABLE IF NOT EXISTS public.enigmes_eveillees (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enigma_id   integer NOT NULL REFERENCES public.enigmas(id) ON DELETE CASCADE,
  theme       text NOT NULL REFERENCES public.enigma_themes(id) ON DELETE CASCADE,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  eveillee_le timestamptz NOT NULL DEFAULT now(),
  effacee_le  timestamptz
);
CREATE INDEX IF NOT EXISTS enigmes_eveillees_en_attente ON public.enigmes_eveillees (theme) WHERE effacee_le IS NULL;
CREATE INDEX IF NOT EXISTS enigmes_eveillees_par_enigme ON public.enigmes_eveillees (enigma_id, eveillee_le DESC);
ALTER TABLE public.enigmes_eveillees ENABLE ROW LEVEL SECURITY;

-- 5. Une réponse par compte et par éveil
ALTER TABLE public.enigma_responses
  ADD COLUMN IF NOT EXISTS eveil_id bigint REFERENCES public.enigmes_eveillees(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS enigma_responses_une_par_eveil
  ON public.enigma_responses (user_id, eveil_id) WHERE eveil_id IS NOT NULL;

-- 6. Les titres de connaissance obtenus : acquis (le seuil peut monter, le titre reste)
CREATE TABLE IF NOT EXISTS public.titres_connaissance (
  user_id   character varying NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title_id  integer NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  obtenu_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, title_id)
);
ALTER TABLE public.titres_connaissance ENABLE ROW LEVEL SECURITY;

-- 7. Le stock d'une culture : actives, culture active, pas une énigme de Fragment
CREATE OR REPLACE FUNCTION public._enigmes_du_jeu(p_theme text)
RETURNS SETOF public.enigmas LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT e.* FROM enigmas e JOIN enigma_themes t ON t.id = e.theme
   WHERE e.theme = p_theme AND e.active AND t.active AND e.fragment_id IS NULL
$$;

-- 8. Un point au hasard : un cercle tiré selon sa surface, puis un point uniforme dans le cercle
CREATE OR REPLACE FUNCTION public._point_dans_les_cercles(p_cercles jsonb, OUT lat double precision, OUT lng double precision)
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  c        jsonb;
  v_tirage double precision;
  v_angle  double precision := random() * 2 * pi();
  v_dist   double precision;
BEGIN
  SELECT random() * sum(power((x->>'rayon_km')::float8, 2)) INTO v_tirage FROM jsonb_array_elements(p_cercles) x;
  FOR c IN SELECT x FROM jsonb_array_elements(p_cercles) x LOOP
    v_tirage := v_tirage - power((c->>'rayon_km')::float8, 2);
    EXIT WHEN v_tirage <= 0;
  END LOOP;
  v_dist := (c->>'rayon_km')::float8 * sqrt(random());
  lat := (c->>'lat')::float8 + v_dist * cos(v_angle) / 111.32;
  lng := (c->>'lng')::float8 + v_dist * sin(v_angle) / (111.32 * cos(radians((c->>'lat')::float8)));
END $$;

-- 9. Le réveil : une énigme par culture, celle qui dort depuis le plus longtemps (la réserve
--    tourne en cycle : une énigme ratée ou effacée revient au tour suivant), puis le plafond de 7.
CREATE OR REPLACE FUNCTION public._eveiller_enigmes()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  t         record;
  v_enigme  integer;
  p         record;
  v_eveils  int := 0;
BEGIN
  FOR t IN SELECT id, cercles FROM enigma_themes WHERE active AND jsonb_array_length(cercles) > 0 LOOP
    SELECT e.id INTO v_enigme FROM public._enigmes_du_jeu(t.id) e
     WHERE NOT EXISTS (SELECT 1 FROM enigmes_eveillees w WHERE w.enigma_id = e.id AND w.effacee_le IS NULL)
     ORDER BY (SELECT max(w.eveillee_le) FROM enigmes_eveillees w WHERE w.enigma_id = e.id) ASC NULLS FIRST, random()
     LIMIT 1;
    CONTINUE WHEN v_enigme IS NULL;
    SELECT * INTO p FROM public._point_dans_les_cercles(t.cercles);
    INSERT INTO enigmes_eveillees (enigma_id, theme, lat, lng) VALUES (v_enigme, t.id, p.lat, p.lng);
    UPDATE enigmes_eveillees SET effacee_le = now()
     WHERE id IN (SELECT id FROM enigmes_eveillees WHERE theme = t.id AND effacee_le IS NULL
                   ORDER BY eveillee_le DESC, id DESC OFFSET 7);
    v_eveils := v_eveils + 1;
  END LOOP;
  RETURN v_eveils;
END $$;

REVOKE EXECUTE ON FUNCTION public._point_dans_les_cercles(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._eveiller_enigmes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._enigmes_du_jeu(text) FROM PUBLIC, anon, authenticated;

-- 10. Chaque matin, 7 h à Paris l'été (6 h l'hiver, accepté : le cron tourne en UTC)
SELECT cron.unschedule('eveil_des_enigmes')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'eveil_des_enigmes');
SELECT cron.schedule('eveil_des_enigmes', '0 5 * * *', $$SELECT public._eveiller_enigmes()$$);

-- 11. Trois énigmes par culture dès le lancement
SELECT public._eveiller_enigmes() FROM generate_series(1, 3);

-- 12. 1 XP par énigme juste (V2, et la V1 jusqu'à la bascule). Corps = définition live, CASE retiré.
CREATE OR REPLACE FUNCTION public._trg_xp_enigma_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT NEW.correct THEN RETURN NEW; END IF;
  IF COALESCE(NEW.responded_at, now()) < public._xp_epoch() THEN RETURN NEW; END IF;
  UPDATE public.users SET xp_total = xp_total + 1 WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;
