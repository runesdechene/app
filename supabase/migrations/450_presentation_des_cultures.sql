-- WHY: la page d'une culture s'ouvre sur un bref portrait de la culture, réglé dans le Hub, pour
--      donner envie de s'y intéresser (Uriel, 07/10). Les cinq sont pré-remplis ; aucun ne cite la
--      réponse d'une énigme (vérifié contre les 421 réponses, .claude/rules/produit.md).
--      Au passage, enregistrer_culture ne vide plus la phrase de zone quand un Hub plus ancien
--      l'appelle sans elle (revue finale du 07/10) : NULL la laisse, '' la vide.
-- BASE: définitions en ligne de cultures_du_hub, enregistrer_culture et mes_enigmes_culture
--      (pg_get_functiondef, 07/10), copiées entières ; s'ajoutent presentation et le CASE des NULL.
-- SCHEMA CHECKED (07/10, information_schema) : enigma_themes.id, .zone text ; presentation n'existe pas.

ALTER TABLE enigma_themes ADD COLUMN IF NOT EXISTS presentation text;

CREATE OR REPLACE FUNCTION public.cultures_du_hub()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin') THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT COALESCE(json_agg(json_build_object(
      'id', t.id, 'label', t.label, 'couleur', t.color, 'icone', t.icon, 'complement', t.complement,
      'cercles', t.cercles, 'active', t.active, 'ordre', t.sort_order, 'zone', t.zone,
      'presentation', t.presentation, -- 450
      'stock', (SELECT count(*) FROM public._enigmes_du_jeu(t.id)),
      'total', public._total_connaissance(t.id),
      'eveils', (SELECT COALESCE(json_agg(json_build_object('lat', w.lat, 'lng', w.lng)), '[]'::json)
                   FROM enigmes_eveillees w WHERE w.theme = t.id AND w.effacee_le IS NULL))
    ORDER BY t.sort_order, t.id), '[]'::json) FROM enigma_themes t);
END $function$;

-- Une signature de plus : l'ancienne (9 paramètres) s'en va, sans quoi PostgREST hésiterait entre les deux.
DROP FUNCTION IF EXISTS public.enregistrer_culture(text, text, text, text, text, jsonb, boolean, integer, text);
CREATE OR REPLACE FUNCTION public.enregistrer_culture(p_id text, p_label text, p_couleur text, p_icone text, p_complement text, p_cercles jsonb, p_active boolean, p_ordre integer, p_zone text DEFAULT NULL::text, p_presentation text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  INSERT INTO enigma_themes (id, label, color, icon, complement, cercles, active, sort_order, zone, presentation)
  VALUES (p_id, p_label, NULLIF(p_couleur, ''), NULLIF(p_icone, ''), NULLIF(btrim(p_complement), ''),
          p_cercles, p_active, p_ordre, NULLIF(btrim(p_zone), ''), NULLIF(btrim(p_presentation), ''))
  ON CONFLICT (id) DO UPDATE SET
    label = EXCLUDED.label, color = EXCLUDED.color, icon = EXCLUDED.icon, complement = EXCLUDED.complement,
    cercles = EXCLUDED.cercles, active = EXCLUDED.active, sort_order = EXCLUDED.sort_order,
    -- 450 : sans valeur (un Hub plus ancien), la phrase de zone et la présentation restent ; '' les vide.
    zone = CASE WHEN p_zone IS NULL THEN enigma_themes.zone ELSE EXCLUDED.zone END,
    presentation = CASE WHEN p_presentation IS NULL THEN enigma_themes.presentation ELSE EXCLUDED.presentation END;
  PERFORM public._creer_titres_culture(p_id);
END $function$;
REVOKE ALL ON FUNCTION public.enregistrer_culture(text, text, text, text, text, jsonb, boolean, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_culture(text, text, text, text, text, jsonb, boolean, integer, text, text) TO authenticated;

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
    'culture', json_build_object('id', t.id, 'nom', t.label, 'icone', t.icon, 'couleur', t.color, 'zone', t.zone,
                               'presentation', t.presentation), -- 450
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

-- Les cinq portraits, pré-remplis (Uriel les reprend dans le Hub).
UPDATE enigma_themes SET presentation = 'Des Alpes à l’Irlande, les Celtes ont couvert l’Europe de leurs places fortes, de leurs routes et de leurs sanctuaires bien avant Rome. Artisans hors pair, guerriers et poètes, ils confiaient leur savoir à la mémoire plutôt qu’à l’écrit. Leurs énigmes vous mènent dans les forêts, les tombes princières et les fêtes d’un monde qu’on dit sans histoire, et qui en déborde.' WHERE id = 'celtique' AND presentation IS NULL;
UPDATE enigma_themes SET presentation = 'Pendant trois siècles, les peuples du Nord ont fait de la mer une route : marchands, explorateurs et guerriers, ils ont gagné l’Orient comme les rives de l’Atlantique. Derrière leurs navires, une civilisation de lois, d’assemblées, de récits et de pierres gravées. Leurs énigmes ouvrent ce monde de dieux, de héros et de navigateurs.' WHERE id = 'nordique' AND presentation IS NULL;
UPDATE enigma_themes SET presentation = 'Une cité du Latium devenue maîtresse de la Méditerranée : Rome a bâti des routes, des ponts et un droit qui portent encore l’Europe. Son génie fut d’intégrer les peuples vaincus jusqu’à en faire des citoyens. Ses énigmes racontent ses légions, ses magistrats, ses dieux et la vie de ses rues.' WHERE id = 'romaine' AND presentation IS NULL;
UPDATE enigma_themes SET presentation = 'Pendant mille ans après la chute de Rome en Occident, l’Empire romain d’Orient a tenu, depuis sa capitale entre deux mers, le pont entre l’Europe et l’Asie. Empire chrétien de langue grecque, il a gardé et transmis l’héritage antique, tout en inventant un art, une diplomatie et une cour d’un raffinement inouï. Ses énigmes vous ouvrent les portes de ce monde qu’on a trop vite oublié.' WHERE id = 'byzantine' AND presentation IS NULL;
UPDATE enigma_themes SET presentation = 'Des cités rivales sur des côtes de rocaille, et pourtant l’aube de presque tout : la philosophie, le théâtre, l’art de débattre en citoyens. Les Grecs ont pensé le monde avec une audace qui nous nourrit encore, et l’ont peuplé de dieux et de héros inoubliables. Leurs énigmes vous emmènent des temples aux sanctuaires et aux champs de bataille de l’Antiquité.' WHERE id = 'grecque' AND presentation IS NULL;
