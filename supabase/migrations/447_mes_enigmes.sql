-- WHY: la page « Les énigmes » (Uriel, 07/10) : combien d'énigmes on a résolues sur le total, par
--      culture, puis ce qu'on a appris ; et la phrase qui dit où une culture s'éveille, réglée dans le Hub.
-- BASE: enregistrer_culture et cultures_du_hub — définitions live (444 et 441) copiées entières ;
--       enregistrer_culture gagne p_zone (DEFAULT NULL : l'appel à 8 paramètres du Hub en ligne tient).
-- SCHEMA CHECKED (2026-10-07) : enigma_themes(id, label, icon, color, cercles, active, sort_order),
--   enigma_responses(enigma_id, user_id, correct, responded_at), enigmas(question, answer, explanation).

ALTER TABLE public.enigma_themes ADD COLUMN IF NOT EXISTS zone text;

-- Les énigmes du stock d'une culture qu'un compte a résolues, avec la date de sa bonne réponse.
CREATE OR REPLACE FUNCTION public._enigmes_resolues(p_user text, p_theme text)
RETURNS TABLE (enigma_id integer, le timestamptz) LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT e.id, max(r.responded_at)
    FROM public._enigmes_du_jeu(p_theme) e JOIN enigma_responses r ON r.enigma_id = e.id
   WHERE r.user_id = p_user AND r.correct
   GROUP BY e.id
$$;
REVOKE EXECUTE ON FUNCTION public._enigmes_resolues(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mes_enigmes()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_moi text := auth.uid()::text;
  v_cultures json;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'non connecté' USING ERRCODE = '42501'; END IF;
  WITH c AS (
    SELECT t.id, t.label, t.icon, t.color,
           (SELECT count(*) FROM public._enigmes_resolues(v_moi, t.id))::int AS resolues,
           (SELECT count(*) FROM public._enigmes_du_jeu(t.id))::int AS total
      FROM enigma_themes t WHERE t.active AND jsonb_array_length(t.cercles) > 0)
  SELECT COALESCE(json_agg(json_build_object('id', id, 'nom', label, 'icone', icon, 'couleur', color,
                                             'resolues', resolues, 'total', total)
                  ORDER BY resolues::numeric / greatest(total, 1) DESC, label), '[]'::json)
    INTO v_cultures FROM c WHERE total > 0;
  RETURN json_build_object(
    'resolues', (SELECT COALESCE(sum((x->>'resolues')::int), 0) FROM json_array_elements(v_cultures) x),
    'total', (SELECT COALESCE(sum((x->>'total')::int), 0) FROM json_array_elements(v_cultures) x),
    'cultures', v_cultures);
END $$;

CREATE OR REPLACE FUNCTION public.mes_enigmes_culture(p_theme text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
    'enigmes', (SELECT COALESCE(json_agg(json_build_object('reponse', e.answer, 'question', e.question,
                                                            'explication', e.explanation, 'le', r.le)
                                         ORDER BY r.le DESC), '[]'::json)
                  FROM public._enigmes_resolues(v_moi, t.id) r JOIN enigmas e ON e.id = r.enigma_id));
END $$;

REVOKE ALL ON FUNCTION public.mes_enigmes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_enigmes() TO authenticated;
REVOKE ALL ON FUNCTION public.mes_enigmes_culture(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_enigmes_culture(text) TO authenticated;

-- enregistrer_culture : la définition live (444), plus p_zone (DEFAULT NULL : l'appel à 8 paramètres tient).
DROP FUNCTION IF EXISTS public.enregistrer_culture(text, text, text, text, text, jsonb, boolean, integer);
CREATE OR REPLACE FUNCTION public.enregistrer_culture(p_id text, p_label text, p_couleur text, p_icone text, p_complement text, p_cercles jsonb, p_active boolean, p_ordre integer, p_zone text DEFAULT NULL::text)
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
  INSERT INTO enigma_themes (id, label, color, icon, complement, cercles, active, sort_order, zone)
  VALUES (p_id, p_label, NULLIF(p_couleur, ''), NULLIF(p_icone, ''), NULLIF(btrim(p_complement), ''),
          p_cercles, p_active, p_ordre, NULLIF(btrim(p_zone), ''))
  ON CONFLICT (id) DO UPDATE SET
    label = EXCLUDED.label, color = EXCLUDED.color, icon = EXCLUDED.icon, complement = EXCLUDED.complement,
    cercles = EXCLUDED.cercles, active = EXCLUDED.active, sort_order = EXCLUDED.sort_order, zone = EXCLUDED.zone;
  PERFORM public._creer_titres_culture(p_id);
END $function$;
REVOKE ALL ON FUNCTION public.enregistrer_culture(text, text, text, text, text, jsonb, boolean, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_culture(text, text, text, text, text, jsonb, boolean, integer, text) TO authenticated;

-- cultures_du_hub : la définition live (441), plus la zone.
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
      'stock', (SELECT count(*) FROM public._enigmes_du_jeu(t.id)),
      'total', public._total_connaissance(t.id),
      'eveils', (SELECT COALESCE(json_agg(json_build_object('lat', w.lat, 'lng', w.lng)), '[]'::json)
                   FROM enigmes_eveillees w WHERE w.theme = t.id AND w.effacee_le IS NULL))
    ORDER BY t.sort_order, t.id), '[]'::json) FROM enigma_themes t);
END $function$;
